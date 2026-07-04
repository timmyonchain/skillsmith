"use client";

import { motion, MotionConfig } from "framer-motion";
import HeroCanvas from "./HeroCanvas";

const REPO_URL = "https://github.com/timmyonchain/skillsmith";

/** Hammer mark — matches the icon used in the existing app header. */
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

/** Smooth-scroll to an in-page target, honouring reduced-motion. */
function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export default function Hero() {
  // Staggered fade-up entrance. Props are identical on server & client (no
  // reduced-motion branching here — that would mismatch on hydration); the
  // MotionConfig below strips the transform for reduced-motion users at runtime.
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <MotionConfig reducedMotion="user">
    <section
      id="hero"
      className="relative flex h-[100svh] min-h-[560px] w-full flex-col overflow-hidden"
    >
      {/* Base gradient — shows before/behind the canvas and if WebGL is absent. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(120%_90%_at_75%_10%,rgba(0,227,154,0.10)_0%,transparent_55%),radial-gradient(130%_100%_at_20%_100%,rgba(255,122,69,0.08)_0%,transparent_50%),var(--bg)]"
      />

      {/* 3D particle field. */}
      <HeroCanvas />

      {/* Dark overlay for text contrast, plus a bottom-up scrim for the copy. */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/30" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/70 to-transparent"
      />

      {/* NAVBAR — transparent, floating over the hero. */}
      <nav className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          {/* Left: logo */}
          <a
            href="#hero"
            className="flex items-center gap-3"
            aria-label="Skillsmith home"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[var(--accent)]"
              aria-hidden="true"
            >
              <HammerIcon className="h-5 w-5" />
            </span>
            <span className="mono text-base font-semibold tracking-wide text-[var(--text)]">
              SKILLSMITH
            </span>
          </a>

          {/* Center: nav links (hidden on mobile) */}
          <div className="hidden items-center gap-7 md:flex">
            <button
              type="button"
              onClick={() => scrollToId("how-it-works")}
              className="mono cursor-pointer text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
            >
              How It Works
            </button>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mono text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
            >
              GitHub
            </a>
          </div>

          {/* Right: Try It */}
          <button
            type="button"
            onClick={() => scrollToId("workbench")}
            className="mono cursor-pointer rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-[var(--text)] backdrop-blur-md transition-colors hover:border-[var(--accent)]/40 hover:bg-white/10"
          >
            Try It
          </button>
        </div>
      </nav>

      {/* CONTENT — anchored bottom-left, staggered entrance. */}
      <div className="relative z-10 mt-auto w-full">
        <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="max-w-2xl">
            <motion.h2
              {...rise(0.2)}
              className="mono text-4xl font-bold uppercase leading-[1.15] tracking-tight sm:text-6xl"
            >
              <span className="block text-[var(--text)]">Skillsmith</span>
              <span className="block text-[var(--accent)]">
                Forges Its Own Skills
              </span>
            </motion.h2>

            <motion.p
              {...rise(0.4)}
              className="mt-5 text-lg text-[var(--text)] sm:text-xl"
            >
              A research agent for Mantle that writes its own tools.
            </motion.p>

            <motion.p
              {...rise(0.55)}
              className="mt-4 max-w-xl text-base leading-relaxed text-[var(--text-dim)]"
            >
              Ask it something it doesn&apos;t know, and instead of guessing, it
              forges a brand new skill on the spot, then remembers it for next
              time. Adapted from Mantle&apos;s own official AI Agent Skills.
            </motion.p>

            <motion.div
              {...rise(0.7)}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <button
                type="button"
                onClick={() => scrollToId("workbench")}
                className="mono flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--forge)] px-5 py-3 text-sm font-semibold text-[var(--bg)] shadow-[0_0_24px_rgba(255,122,69,0.35)] transition-[filter] hover:brightness-110"
              >
                <HammerIcon className="h-4 w-4" />
                Try It
              </button>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mono rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold text-[var(--text)] transition-colors hover:border-white/50 hover:bg-white/5"
              >
                View on GitHub
              </a>
            </motion.div>

            <motion.p
              {...rise(0.85)}
              className="mt-6 text-xs text-[var(--text-faint)]"
            >
              Built on Mantle&apos;s official AI Agent Skills · Mantle Research
              Challenge submission
            </motion.p>
          </div>
        </div>
      </div>
    </section>
    </MotionConfig>
  );
}
