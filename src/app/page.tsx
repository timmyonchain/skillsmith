"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Hero from "./Hero";

type Skill = {
  slug: string;
  name: string;
  description: string;
  trigger_keywords: string[];
  execution_type: string;
  is_official: boolean;
  usage_count: number;
  created_at: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  usedSkill?: string | null;
  isNew?: boolean;
  error?: boolean;
};

const EXAMPLES = [
  "How does gas work on Mantle, and is it paid in ETH?",
  "What's in wallet 0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8?",
  "What are common smart contract security risks on Mantle?",
];

// --- small inline icons (SVG, never emoji) ---------------------------------
function HammerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9" />
      <path d="m18 15 4-4" />
      <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2z" />
    </svg>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [sending, setSending] = useState(false);
  const [forgingSlug, setForgingSlug] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchSkills = useCallback(async (): Promise<Skill[]> => {
    try {
      const res = await fetch("/api/skills");
      if (!res.ok) return [];
      const data = await res.json();
      const next: Skill[] = data.skills ?? [];
      setSkills(next);
      return next;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || sending) return;

      setInput("");
      setMessages((m) => [...m, { role: "user", content: message }]);
      setSending(true);

      // Snapshot existing slugs so we can detect a freshly forged one.
      const prevSlugs = new Set(skills.map((s) => s.slug));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message }),
        });
        const data = await res.json();

        if (!res.ok) {
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content:
                data?.error ??
                "Something went wrong reaching the forge. Please try again.",
              error: true,
            },
          ]);
        } else {
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content: data.answer ?? "",
              usedSkill: data.usedSkill ?? null,
              isNew: Boolean(data.isNew),
            },
          ]);

          // Refresh the rack after every message.
          const next = await fetchSkills();

          // If a skill was just forged, find the new slug and let its card cool.
          if (data.isNew) {
            const fresh = next.find((s) => !prevSlugs.has(s.slug));
            if (fresh) {
              setForgingSlug(fresh.slug);
              window.setTimeout(() => setForgingSlug(null), 4000);
            }
          }
        }
      } catch {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "Couldn't reach the forge (network error). Please try again.",
            error: true,
          },
        ]);
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [sending, skills, fetchSkills],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const officialCount = skills.filter((s) => s.is_official).length;
  const forgedCount = skills.length - officialCount;

  return (
    <>
      {/* New hero — 3D forge backdrop, sits above the untouched workbench. */}
      <Hero />

      <div className="relative z-10 flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[var(--bg)]/60 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[var(--accent)]"
            aria-hidden="true"
          >
            <HammerIcon className="h-5 w-5" />
          </span>
          <div className="flex flex-col leading-tight">
            <h1 className="mono text-base font-semibold tracking-wide text-[var(--text)]">
              SKILLSMITH
            </h1>
            <p className="text-xs text-[var(--text-dim)]">
              forge a Mantle skill
            </p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6">
        <div className="grid gap-4 lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-5">
          {/* Workbench — the chat */}
          <section
            id="workbench"
            aria-label="Workbench"
            className="glass flex min-h-0 min-w-0 flex-col overflow-hidden scroll-mt-20"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <span className="mono text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">
                Workbench
              </span>
            </div>

            <div className="scroll-quiet flex-1 overflow-y-auto px-4 py-4 max-lg:max-h-[52vh]">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col justify-center gap-4 py-6">
                  <p className="text-sm text-[var(--text-dim)]">
                    Ask a question about Mantle. If an existing skill fits, it
                    answers. If none does, a new skill is{" "}
                    <span className="text-[var(--accent)]">forged</span> and
                    added to the rack.
                  </p>
                  <div className="flex flex-col gap-2">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => send(ex)}
                        className="wrap-anywhere cursor-pointer rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-[var(--text-dim)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ul className="flex flex-col gap-4">
                  {messages.map((m, i) => (
                    <li
                      key={i}
                      className={
                        m.role === "user"
                          ? "flex justify-end"
                          : "flex justify-start"
                      }
                    >
                      {m.role === "user" ? (
                        <div className="wrap-anywhere max-w-[85%] rounded-xl rounded-br-sm border border-white/10 bg-white/[0.055] px-3.5 py-2.5 text-sm text-[var(--text)]">
                          {m.content}
                        </div>
                      ) : (
                        <div className="max-w-[92%]">
                          <div
                            className={`rounded-xl rounded-bl-sm border px-3.5 py-3 text-sm ${
                              m.error
                                ? "border-[var(--error)]/50 bg-[var(--error)]/10 text-[var(--text)]"
                                : "border-white/10 bg-black/20 text-[var(--text)]"
                            }`}
                          >
                            <div className="chat-md">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  a: ({ href, children }) => (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {children}
                                    </a>
                                  ),
                                }}
                              >
                                {m.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                          {m.usedSkill && (
                            <p className="mono mt-1.5 flex items-center gap-1 pl-1 text-xs">
                              {m.isNew ? (
                                <span className="flex items-center gap-1 text-[var(--accent)]">
                                  <SparkIcon className="h-3 w-3" />
                                  forged: {m.usedSkill}
                                </span>
                              ) : (
                                <span className="text-[var(--accent)]/80">
                                  via {m.usedSkill}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                  {sending && (
                    <li className="flex justify-start">
                      <div className="mono rounded-xl rounded-bl-sm border border-white/10 bg-black/20 px-3.5 py-2.5 text-xs text-[var(--text-dim)]">
                        working the forge…
                      </div>
                    </li>
                  )}
                  <div ref={messagesEndRef} />
                </ul>
              )}
            </div>

            {/* Input */}
            <form
              className="border-t border-white/10 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <label htmlFor="chat-input" className="sr-only">
                Ask a question about Mantle
              </label>
              <div className="glass glass-strong flex items-end gap-2 p-2 focus-within:shadow-[0_0_0_1px_rgba(0,227,154,0.3)]">
                <textarea
                  id="chat-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder="Ask about Mantle…"
                  className="relative z-10 max-h-32 min-h-[2.5rem] min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-base text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || input.trim().length === 0}
                  aria-label="Forge — send message"
                  className="relative z-10 flex h-11 min-w-11 cursor-pointer items-center gap-2 rounded-lg bg-[var(--forge)] px-3.5 font-medium text-[var(--bg)] shadow-[0_0_20px_rgba(255,122,69,0.35)] transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  <HammerIcon className="h-4 w-4" />
                  <span className="mono text-sm">
                    {sending ? "Working" : "Forge"}
                  </span>
                </button>
              </div>
            </form>
          </section>

          {/* Rack — the skill library */}
          <aside
            aria-label="Skill rack"
            className="glass flex min-h-0 min-w-0 flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <span className="mono text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">
                The Rack
              </span>
              <span className="mono text-xs text-[var(--text-faint)]">
                {officialCount} official · {forgedCount} forged
              </span>
            </div>

            <div className="scroll-quiet flex-1 overflow-y-auto p-3 max-lg:max-h-[60vh]">
              <ul className="flex flex-col gap-2.5">
                {skills.map((s) => (
                  <li
                    key={s.slug}
                    className={`glass skill-card p-3 ${
                      forgingSlug === s.slug ? "skill-card--forging" : ""
                    }`}
                  >
                    <div className="relative z-10 flex items-start justify-between gap-2">
                      <h3 className="mono min-w-0 wrap-anywhere text-sm font-semibold text-[var(--text)]">
                        {s.name}
                      </h3>
                      {s.is_official && (
                        <span className="mono shrink-0 rounded border border-[var(--accent)]/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-[var(--accent)]">
                          OFFICIAL
                        </span>
                      )}
                    </div>
                    <p className="relative z-10 mt-1.5 text-sm leading-relaxed text-[var(--text-dim)]">
                      {s.description}
                    </p>
                    <div className="relative z-10 mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="mono rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--accent)]">
                        {s.execution_type}
                      </span>
                      {s.trigger_keywords?.slice(0, 3).map((k) => (
                        <span
                          key={k}
                          className="mono rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--text-faint)]"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
                {skills.length === 0 && (
                  <li className="px-1 py-6 text-center text-sm text-[var(--text-faint)]">
                    Loading the rack…
                  </li>
                )}
              </ul>
            </div>
          </aside>
        </div>

        {/* How this works — collapsible */}
        <details id="how-it-works" className="group glass mt-4 scroll-mt-20">
          <summary className="mono flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">
            How this works
            <ChevronIcon className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="relative z-10 space-y-3 border-t border-white/10 px-4 py-4 text-sm leading-relaxed text-[var(--text-dim)]">
            <p>
              Every question is first shown to a router alongside the current
              rack. If an existing skill clearly fits, that skill answers.
            </p>
            <p>
              If nothing fits, a new mini-skill is{" "}
              <span className="text-[var(--accent)]">forged</span> for that
              category of question — given a name, description, trigger keywords,
              and reusable instructions — then saved to the rack. Its card
              arrives glowing ember and cools to steel. Ask something similar
              later and it is reused instead of forged again.
            </p>
            <p>
              Skills tagged{" "}
              <span className="mono text-[var(--accent)]">OFFICIAL</span> are the
              curated Mantle skills. On-chain skills pull live data from Mantle
              mainnet when a wallet address is present.
            </p>
          </div>
        </details>
      </main>
      </div>
    </>
  );
}
