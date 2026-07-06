import { NextResponse } from "next/server";
import { callLLM, LLM_BUSY_MESSAGE } from "@/lib/llm";

type Format = "tweet" | "thread" | "article";
const FORMATS: Format[] = ["tweet", "thread", "article"];

// A shared rule appended to every format: the model must never emit em dashes.
const NO_EM_DASH =
  `Do NOT use em dashes (—) or en dashes (–) anywhere in the output; ` +
  `use commas or periods instead.`;

// Shared rules to keep drafts reading like a person with a point of view,
// not generic AI filler. Appended to every format's system prompt.
const HUMAN_VOICE =
  `Write like a sharp human, not an AI. Follow these rules strictly:\n` +
  `- Never use these words or phrases: ensures, vital, key role, plays an ` +
  `indispensable role, forged its own path, leverages, underscores, ` +
  `highlights, deeply rooted, evolving landscape, dynamic mechanism, unique ` +
  `economic model. They inflate importance without saying anything concrete.\n` +
  `- Never open with a rhetorical question ("Ever wonder...", "Did you ` +
  `know...") or an announcement ("Let's dive into...", "Here's what you need ` +
  `to know..."). Start with the actual point.\n` +
  `- Prefer concrete specifics over inflated generalities. If a hook implies ` +
  `something surprising or important, actually explain that thing; never ` +
  `tease something and fail to deliver it.\n` +
  `- Vary sentence length naturally. Do not make every sentence the same tidy ` +
  `structure.\n` +
  `- It is fine to sound direct and confident rather than neutral-corporate. ` +
  `You are a research agent with a point of view on the data, not a press ` +
  `release.`;

// One system prompt per export format. Each turns a real research finding into
// a ready-to-post draft grounded in the actual answer, not a generic take.
const SYSTEM_PROMPTS: Record<Format, string> = {
  tweet:
    `You are a technical writer turning a research finding into a single, ` +
    `punchy tweet under 280 characters. Summarize the finding in plain, ` +
    `engaging language a curious non-expert can follow. No hashtags unless ` +
    `one is genuinely useful. Output only the tweet text, nothing else. ` +
    NO_EM_DASH +
    " " +
    HUMAN_VOICE,
  thread:
    `You are a technical writer turning a research finding into a 5 to 7 ` +
    `tweet thread. The first tweet is a hook that makes people want to keep ` +
    `reading, not just a restatement of the question. The hook must state a ` +
    `real, concrete point from the finding, not a vague tease. Let the ` +
    `numbering stay implicit through natural flow. Separate each tweet with a ` +
    `line containing only "---". Use plain language, no jargon dumps. Output ` +
    `only the thread, nothing else. ` +
    NO_EM_DASH +
    " " +
    HUMAN_VOICE,
  article:
    `You are a technical writer turning a research finding into a short, ` +
    `clear article of 350 to 450 words in Markdown. Stay within that range; ` +
    `less room means less room to pad. Include a title (# heading), a couple ` +
    `of short sections (## headings), and a plain concluding line. Use a ` +
    `plain, direct title only: no colon-subtitle dramatic titles like "X: Y ` +
    `Takes Center Stage". Every paragraph must contain at least one concrete, ` +
    `specific detail (a number, a named mechanism, a specific action), not ` +
    `just abstract reasoning about importance or positioning. In addition to ` +
    `the shared banned list, never use these phrase patterns: "positions X at ` +
    `the heart of", "solidifies X's position as", "reinforces X's role as", ` +
    `"dynamic nature of", "operational economics", "functional asset". Write ` +
    `like you're explaining this to a smart friend who's never touched crypto, ` +
    `not writing a corporate blog post. Contractions are fine. Directness over ` +
    `formality. Output only the Markdown article, nothing else. ` +
    NO_EM_DASH +
    " " +
    HUMAN_VOICE,
};

export async function POST(req: Request) {
  let body: {
    question?: unknown;
    answer?: unknown;
    skillName?: unknown;
    format?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { question, answer, skillName, format } = body;

  if (typeof answer !== "string" || answer.trim().length === 0) {
    return NextResponse.json(
      { error: "Body must include a non-empty string `answer`." },
      { status: 400 },
    );
  }
  if (typeof format !== "string" || !FORMATS.includes(format as Format)) {
    return NextResponse.json(
      { error: `\`format\` must be one of: ${FORMATS.join(", ")}.` },
      { status: 400 },
    );
  }

  const q = typeof question === "string" ? question.trim() : "";
  const skill = typeof skillName === "string" ? skillName.trim() : "";

  // Ground the draft in the real research: original question, the answer that
  // was produced, and which skill produced it (context only, not to be quoted).
  const userPrompt =
    `Turn the following Mantle research finding into a ${format} draft.\n\n` +
    (q ? `ORIGINAL QUESTION:\n${q}\n\n` : "") +
    (skill ? `PRODUCED BY SKILL (context only): ${skill}\n\n` : "") +
    `RESEARCH ANSWER:\n${answer}\n\n` +
    `Base the draft strictly on this finding. Do not invent facts, numbers, ` +
    `or claims that are not supported by the answer above.`;

  let draft: string;
  try {
    draft = await callLLM(SYSTEM_PROMPTS[format as Format], userPrompt);
  } catch (err) {
    // Log the real technical error; never leak provider details to the UI.
    console.error(
      `[export] draft generation failed (${format}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return NextResponse.json({ error: LLM_BUSY_MESSAGE }, { status: 503 });
  }

  // Belt-and-suspenders: strip any em/en dashes the model slipped in, since the
  // "no em dash" rule is a hard requirement for the posted output.
  const cleaned = draft.trim().replace(/\s*[—–]\s*/g, ", ");

  return NextResponse.json({ draft: cleaned, format });
}
