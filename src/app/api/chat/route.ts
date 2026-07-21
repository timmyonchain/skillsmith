import { NextResponse } from "next/server";
import { callLLM, LLM_BUSY_MESSAGE } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabase";
import { getMntBalance, getTxCount } from "@/lib/mantle";

const ADDRESS_RE = /0x[a-fA-F0-9]{40}/;

export async function POST(req: Request) {
  let message: unknown;
  try {
    ({ message } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: "Body must include a non-empty string `message`." },
      { status: 400 },
    );
  }

  // 2. Load the catalog of available skills (lightweight fields only).
  const { data: skills, error: listError } = await supabaseAdmin
    .from("skills")
    .select("slug, name, description");

  if (listError) {
    return NextResponse.json(
      { error: `Failed to load skills: ${listError.message}` },
      { status: 500 },
    );
  }

  // 3. Ask the model which skill (if any) best fits the user's message.
  const catalog = (skills ?? [])
    .map((s) => `- ${s.slug}: ${s.name} — ${s.description}`)
    .join("\n");

  const matchSystemPrompt =
    `You are a router. Given a user's message and a list of available skills, ` +
    `choose the single best-fitting skill. Respond with STRICT JSON only, ` +
    `no prose, in the exact shape {"match": "slug-or-NEW"}. Use the skill's ` +
    `slug if one clearly fits, or "NEW" if none fits well.\n\n` +
    `Available skills:\n${catalog}`;

  let match: string;
  try {
    const raw = await callLLM(matchSystemPrompt, message);
    // callLLM returns a plain string; providers may wrap JSON in prose or code
    // fences, so extract the object span before parsing.
    const jsonText = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    match = JSON.parse(jsonText).match;
  } catch (err) {
    // Log the real technical error; never leak provider details to the UI.
    console.error(
      `[chat] skill routing failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return NextResponse.json({ error: LLM_BUSY_MESSAGE }, { status: 503 });
  }

  // 4. NEW path — forge a brand-new reusable skill for this question, persist
  //    it so the library grows, and answer the user in one shot.
  if (!match || match === "NEW") {
    const forgeSystemPrompt =
      `You are a skill designer for a Mantle-focused AI agent. None of the ` +
      `existing skills fit the user's question, so design ONE new reusable ` +
      `mini-skill in the same spirit as the official skills: a reusable ` +
      `capability for handling this CATEGORY of question in the future — not a ` +
      `one-off canned answer. Respond with STRICT JSON ONLY: no markdown, no ` +
      `code fences, no preamble, exactly this shape:\n` +
      `{"name": string, "slug": string (kebab-case), "description": string ` +
      `(1-2 sentences), "trigger_keywords": string[] (4-6 items), ` +
      `"instructions": string (reusable guidance for handling this category of ` +
      `question in future), "answer": string (the actual answer to the user's ` +
      `current question)}\n\n` +
      `If the user's question involves something that could have changed ` +
      `recently, current events, the latest version of anything, prices, or ` +
      `facts about yourself as an AI, be upfront that you may not have the ` +
      `most current information and suggest the user verify with an ` +
      `authoritative source. Don't guess at self-referential facts like your ` +
      `own training cutoff, just say you're not fully certain of the exact ` +
      `date.`;

    let forged: {
      name: string;
      slug: string;
      description: string;
      trigger_keywords: string[];
      instructions: string;
      answer: string;
    };
    try {
      const raw = await callLLM(forgeSystemPrompt, message);
      // Strip accidental markdown code fences, then isolate the JSON object.
      const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const jsonText = cleaned.slice(
        cleaned.indexOf("{"),
        cleaned.lastIndexOf("}") + 1,
      );
      const parsed = JSON.parse(jsonText);
      if (
        typeof parsed?.name !== "string" ||
        typeof parsed?.slug !== "string" ||
        typeof parsed?.description !== "string" ||
        typeof parsed?.instructions !== "string" ||
        typeof parsed?.answer !== "string" ||
        !Array.isArray(parsed?.trigger_keywords)
      ) {
        throw new Error("forged skill is missing required fields");
      }
      forged = parsed;
    } catch (err) {
      // Defensive: never crash on a malformed design — degrade gracefully.
      console.warn(`[forge] failed to build a new skill: ${String(err)}`);
      return NextResponse.json({
        answer:
          "I couldn't build a new skill for that just now — the skill " +
          "designer returned something I couldn't parse. Please try " +
          "rephrasing your question.",
        usedSkill: null,
        isNew: false,
      });
    }

    // Normalize the slug to a safe kebab-case value.
    let slug =
      forged.slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "skill";

    const insertRow = (s: string) =>
      supabaseAdmin.from("skills").insert({
        slug: s,
        name: forged.name,
        description: forged.description,
        instructions: forged.instructions,
        trigger_keywords: forged.trigger_keywords,
        execution_type: "llm-only",
        is_official: false,
      });

    let { error: insertError } = await insertRow(slug);
    if (insertError?.code === "23505") {
      // Unique-violation on slug — append a short random suffix and retry once
      // so the insert never silently fails on a name collision.
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      ({ error: insertError } = await insertRow(slug));
    }
    if (insertError) {
      console.warn(`[forge] skill insert failed: ${insertError.message}`);
    }

    return NextResponse.json({
      answer: forged.answer,
      usedSkill: forged.name,
      isNew: true,
    });
  }

  // 5. Matched a slug — fetch its full row.
  const { data: skill, error: skillError } = await supabaseAdmin
    .from("skills")
    .select("slug, name, instructions, execution_type, usage_count")
    .eq("slug", match)
    .single();

  if (skillError || !skill) {
    // Model returned a slug that doesn't resolve to a stored skill.
    return NextResponse.json({
      answer:
        "I matched a skill that doesn't exist anymore. Please try asking again.",
      usedSkill: null,
      isNew: false,
    });
  }

  // Gather real on-chain data when the skill is on-chain and an address is present.
  let onchainData = "";
  if (skill.execution_type === "onchain-data") {
    const found = message.match(ADDRESS_RE);
    if (found) {
      const address = found[0];
      try {
        const [balance, txCount] = await Promise.all([
          getMntBalance(address),
          getTxCount(address),
        ]);
        onchainData =
          `\n\nREAL DATA (fetched live from Mantle mainnet for ${address}):\n` +
          `- Native MNT balance: ${balance} MNT\n` +
          `- Transaction count (nonce): ${txCount}`;
      } catch (err) {
        onchainData =
          `\n\nNOTE: An address (${address}) was provided but the live Mantle ` +
          `lookup failed: ${
            err instanceof Error ? err.message : String(err)
          }. Do not fabricate balances; tell the user the lookup failed.`;
      }
    } else {
      onchainData =
        `\n\nNOTE: No wallet address was found in the user's message, so no ` +
        `on-chain data was fetched. Do not invent balances or positions.`;
    }
  }

  const answerSystemPrompt =
    `You are answering using the ${skill.name} skill. Your real, actual ` +
    `instructions: ${skill.instructions}. IMPORTANT: You do NOT have access ` +
    `to mantle-cli, an MCP server, or any tool other than what's explicitly ` +
    `given to you below as real data. If the instructions above reference ` +
    `tools or data you don't actually have, ignore those parts and clearly ` +
    `tell the user what you can't check yet — don't pretend to have checked ` +
    `it.${onchainData}`;

  let answer: string;
  try {
    answer = await callLLM(answerSystemPrompt, message);
  } catch (err) {
    // Log the real technical error; never leak provider details to the UI.
    console.error(
      `[chat] answer generation failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return NextResponse.json({ error: LLM_BUSY_MESSAGE }, { status: 503 });
  }

  // Increment usage_count by 1 (best-effort; don't fail the response on error).
  await supabaseAdmin
    .from("skills")
    .update({ usage_count: (skill.usage_count ?? 0) + 1 })
    .eq("slug", skill.slug);

  return NextResponse.json({
    answer,
    usedSkill: skill.name,
    isNew: false,
  });
}
