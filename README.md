# Skillsmith

Skillsmith is a research agent for the Mantle network. It ships with a set of real Mantle skills and, when it hits a question none of them cover, it **forges** a new reusable skill on the fly instead of just answering once. That new skill is saved to the library and reused the next time a similar question comes up, so the agent's capabilities grow with use.

## How it works

Every question runs through three stages:

- **Discover** — the question is shown to a router alongside the current skill library. The router picks the best-fitting skill, or returns `NEW` if nothing fits.
- **Activate** — the matched skill answers using its stored instructions. On-chain skills also read live data from Mantle mainnet (via viem) when a wallet address is present.
- **Forge** — if nothing fits, the model designs a new mini-skill (name, description, trigger keywords, reusable instructions) and answers the question. The skill is written to the database so later, related questions match it instead of forging again.

The UI is a two-panel workbench: chat on the left, the live skill library ("the rack") on the right. Freshly forged skills appear in the rack with a brief ember-cooling animation.

## Official skills

Three curated Mantle skills are seeded at setup:

- **network-primer** — Mantle fundamentals: MNT gas, chain setup, inclusion vs. settlement, finality.
- **data-indexer** — historical/analytical queries via GraphQL or SQL indexers.
- **portfolio-analyst** — read-only wallet analysis: balances, DeFi positions, allowance/approval risk.

These are adapted from the real [mantle-xyz/mantle-skills](https://github.com/mantle-xyz/mantle-skills) repository. Reference copies of the source `SKILL.md` files live in [`reference/`](./reference).

## Tech stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS**
- **LLM:** Google Gemini (`gemini-2.5-flash`, native API) as primary with retry-on-overload, falling back to **OpenRouter** free models
- **Supabase** (Postgres) for the skill library
- **viem** for reading Mantle mainnet (chain id 5000)

## Setup

Requires Node.js 18+ and a Supabase project.

```bash
git clone https://github.com/timmyonchain/skillsmith.git
cd skillsmith
npm install
```

Copy the environment template and fill in your keys:

```bash
cp .env.local.example .env.local
```

`.env.local` values:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Google Gemini (primary LLM) |
| `OPENROUTER_API_KEY` | OpenRouter (fallback LLM) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `MANTLE_RPC_URL` | Mantle RPC endpoint (defaults to `https://rpc.mantle.xyz`) |

Run the database migration against your Supabase project — either paste [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) into the Supabase SQL editor, or apply it with the Supabase CLI. It creates the `skills` table and seeds the three official skills.

Start the dev server:

```bash
npm run dev
```

Then open http://localhost:3000.

## About

Built for Mantle's Research Challenge (Track 2).
