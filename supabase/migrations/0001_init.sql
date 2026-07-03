create table skills (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  instructions text not null,
  trigger_keywords text[] not null,
  execution_type text not null,
  is_official boolean not null default false,
  usage_count int not null default 0,
  created_at timestamptz not null default now()
);

insert into skills (slug, name, description, instructions, trigger_keywords, execution_type, is_official) values (
  'network-primer',
  'Mantle Network Primer',
  'A reference/onboarding skill that explains Mantle-specific fundamentals — MNT gas, chain setup, transaction inclusion vs. L1 settlement, and finality — that are easy to misunderstand during development or user support.',
  'Domain onboarding and misconception-prevention skill, not an execution operator. Classify each request as basics, differences, operations, or live_verify, then load the matching section of references/mantle-network-basics.md. Explain stable concepts first (always note that gas is paid in MNT and distinguish L2 inclusion from L1-backed settlement/finality), then add dated snapshot details only when operational specifics matter. When quoting any operational value (RPC URLs, chain IDs, contract addresses, compiler versions, explorer links, architecture), always append the reference snapshot date (March 8, 2026) inline. Define sequencer, settlement, finality, and gas token once. For time-sensitive questions (fees, block time, throughput, current ecosystem status, latest architecture), state values can change and request live verification from official docs — but still ground the answer in the relevant stable concept. Do not answer "latest/current" questions from this file alone. Avoid financial advice and price/ROI speculation. State low confidence directly and request a source check. Hand off address lookup, transaction risk, portfolio inspection, and execution planning to the specialized Mantle skills.',
  array['mantle basics', 'mnt gas token', 'chain id', 'settlement finality', 'developer onboarding', 'rpc endpoint'],
  'llm-only',
  true
);

insert into skills (slug, name, description, instructions, trigger_keywords, execution_type, is_official) values (
  'data-indexer',
  'Mantle Data Indexer',
  'Answers historical Mantle questions — wallet activity, time-windowed metrics, event backfills, and protocol analytics — using GraphQL or SQL indexers with reproducible queries, clear time boundaries, and source attribution.',
  'Use GraphQL or SQL indexers to answer historical questions that raw RPC cannot serve efficiently. Workflow: (1) Normalize the request into objective, entities (wallet/pool/token/protocol), and an absolute UTC time range — convert relative times like "past 7 days" to explicit UTC start/end and state the conversion. (2) Resolve endpoint availability: subgraph via `mantle-cli indexer subgraph --endpoint <url> --query <graphql> --json`, or SQL via `mantle-cli indexer sql --endpoint <url> --query <sql> --json`. If no endpoint is configured, STOP and use the Blocked Output Format — NEVER fabricate an endpoint URL. (3) Select source by availability and latency. (4) Build the query from references/query-templates.md. (5) Execute with pagination and deterministic ordering. (6) Normalize units/decimals before aggregation. (7) Output with query provenance, tool warnings, and caveats. Guardrails: confirm chain scope is Mantle; use absolute UTC timestamps; keep SQL read-only (no mutations); do not merge datasets of mismatched granularity without labeling; distinguish "no data" from "query failure"; propagate tool warnings (e.g. hasNextPage=true, SQL truncation); disclose suspected indexer lag. Emit results using the structured Mantle Historical Data Report format, or the BLOCKED variant when an endpoint is missing.',
  array['historical data', 'wallet activity', 'graphql subgraph', 'sql indexer', 'protocol analytics', 'time-windowed metrics'],
  'onchain-data',
  true
);

insert into skills (slug, name, description, instructions, trigger_keywords, execution_type, is_official) values (
  'portfolio-analyst',
  'Mantle Portfolio Analyst',
  'Builds deterministic, read-only wallet analysis on Mantle — enumerating native and ERC-20 balances, DeFi positions (Aave V3 lending, V3 LP, Merchant Moe LB LP), and token allowances — then highlights approval/liquidation risk in a structured report.',
  'Produce deterministic, read-only Mantle wallet analysis using mantle-cli read-only commands only (do NOT connect to the MCP server; never construct or send transactions). Confirm inputs (wallet_address, network mainnet/sepolia, optional token/spender scope) and validate the wallet and chain context (`registry validate`, `chain info`, `chain status`). Determine token/spender scope from user input or the registry. Then execute these MANDATORY steps in exact order, each returning a result before the next: (4) native balance `account balance`; (5) ERC-20 balances `account token-balances --tokens <list>` covering ALL scoped tokens — never skip, even if native balance is zero; (6) Aave V3 positions `aave positions` (aggregate collateral/debt USD and health factor; aTokens are assets, debtTokens are liabilities; flag at_risk/liquidatable); (7) V3 LP `lp positions` (Agni/Fluxion, tick ranges, in-range status); (8) Merchant Moe LB `lp lb-positions`; (9) allowances `account allowances --pairs <token:spender,...>`. Use `token info` for missing metadata and keep unresolved fields as unknown. Classify approval risk as low/medium/high/critical (critical = is_unlimited=true or value >= 2^255), always with a rationale, and surface high/critical approvals at the top. Handle partial results (partial/possible_missing_reserves flags, collateral_enabled checks against ltv_bps, LB coverage/scan_radius limits). Validate checksummed addresses and reject the zero address. Keep both raw and normalized values, lowering confidence when decimals are unknown. Run the self-check that all six mandatory tool calls returned before writing the fixed-structure Mantle Portfolio Report with explicit coverage/partial gaps.',
  array['wallet balances', 'token holdings', 'aave positions', 'lp positions', 'token allowances', 'approval risk'],
  'onchain-data',
  true
);
