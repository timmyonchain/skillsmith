import "server-only";

// Multi-provider LLM client. Each provider has its OWN base URL, auth scheme,
// and request/response shape — they do NOT share one endpoint. `callLLM`
// normalizes every provider down to a plain answer string and tries them in
// order, logging which one actually answered.

// Calm, user-facing message for the rare case where the whole chain fails.
// The real technical error is logged server-side, never shown in the UI.
export const LLM_BUSY_MESSAGE =
  "The research agent is temporarily busy, please try your question again in a moment.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// HTTP error that carries its status code so callers can decide to retry.
class HttpError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`${status} ${body}`);
    this.status = status;
  }
}

// --- Provider 1: Google Gemini (native REST) ---------------------------------
// Gemini's new "AQ."-format API keys are NOT accepted on the OpenAI-compatible
// endpoint, so we use the native generateContent API with x-goog-api-key auth.
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGeminiNative(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing env var GEMINI_API_KEY");
  }

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
    }),
  });

  if (!res.ok) {
    throw new HttpError(res.status, await res.text());
  }

  const data = await res.json();
  const text: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error(`Gemini returned no text: ${JSON.stringify(data)}`);
  }
  return text;
}

// Gemini with retry-on-overload. Google returns 503 (UNAVAILABLE, "high
// demand") or 429 (rate limit) transiently; a couple of short retries usually
// rides it out before we bother falling through to the OpenRouter chain.
// Only 503/429 are retried; any other failure (e.g. malformed request) throws
// immediately so it falls through without wasted waiting.
const GEMINI_RETRY_DELAYS = [1000, 2000]; // before retry 1, then before retry 2

async function callGeminiWithRetry(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  let attempt = 0;
  for (;;) {
    try {
      return await callGeminiNative(systemPrompt, userPrompt);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : undefined;
      const retryable = status === 503 || status === 429;
      if (retryable && attempt < GEMINI_RETRY_DELAYS.length) {
        const wait = GEMINI_RETRY_DELAYS[attempt];
        console.warn(
          `[llm] gemini transient ${status} — retry ${attempt + 1}/${
            GEMINI_RETRY_DELAYS.length
          } after ${wait}ms`,
        );
        await sleep(wait);
        attempt++;
        continue;
      }
      throw err; // non-retryable, or retries exhausted → fall through
    }
  }
}

// --- Providers 2 & 3: OpenRouter (OpenAI-compatible) -------------------------
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function callOpenRouter(
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing env var OPENROUTER_API_KEY");
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new HttpError(res.status, await res.text());
  }

  const data = await res.json();
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (data?.error || typeof content !== "string" || content.length === 0) {
    throw new Error(
      `OpenRouter returned no usable choice: ${JSON.stringify(
        data?.error ?? data,
      )}`,
    );
  }
  return content;
}

// --- Ordered provider chain --------------------------------------------------
const PROVIDERS: {
  label: string;
  run: (systemPrompt: string, userPrompt: string) => Promise<string>;
}[] = [
  {
    label: "gemini (native) / gemini-2.5-flash",
    run: callGeminiWithRetry,
  },
  {
    label: "openrouter / meta-llama/llama-3.3-70b-instruct:free",
    run: (s, u) =>
      callOpenRouter("meta-llama/llama-3.3-70b-instruct:free", s, u),
  },
  {
    label: "openrouter / google/gemma-4-26b-a4b-it:free",
    run: (s, u) => callOpenRouter("google/gemma-4-26b-a4b-it:free", s, u),
  },
];

/**
 * Shared entry point for all LLM calls. Tries each provider in order (Gemini
 * with retry-on-overload first) and returns the first successful answer as a
 * plain string. Logs which provider/model answered. If the entire chain fails,
 * logs the real technical error and throws a calm, user-safe message.
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  let lastError = "unknown error";

  for (const provider of PROVIDERS) {
    try {
      const answer = await provider.run(systemPrompt, userPrompt);
      console.log(`[llm] ✅ answered by ${provider.label}`);
      return answer;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(
        `[llm] ${provider.label} failed (${lastError}) — trying next provider...`,
      );
    }
  }

  // Total failure: log the real error for debugging, surface a calm message.
  console.error(`[llm] all providers failed — last error: ${lastError}`);
  throw new Error(LLM_BUSY_MESSAGE);
}
