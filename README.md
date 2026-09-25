# bob-chainguard

**IBM Bob 2.0 migrates a legacy web3.js + ethers v5 dApp frontend to viem/wagmi, while
`chainguard` measures the legacy code, plans the work as parallel Bob subagent tasks, and guards
CI against regressions.** Built for the IBM Bob 2.0 Hackathon (Sep 25–27, 2026).

```
 scan ───────► plan ───────────► Bob waves (parallel subagents) ───► verify ───────► guard
 chainguard    import-graph        Agent mode + playbook docs          22 behavior     CI fails on
 72 findings   waves of disjoint   edit, run tests, fix                tests + scan    any new legacy
               tasks               implementation                      = 0             call
```

## Why

web3.js was sunset in 2025, ethers v5 was superseded by v6, and the ecosystem has moved to viem
and wagmi. The migration touches providers, signers, contracts, events, big-number math and error
handling all at once. Some translations are silently wrong: viem's `parseUnits` rounds where
ethers threw. Teams postpone the migration because they can't size it, split it up, or prove it's safe.

## What's in the repo

| Path | What |
| --- | --- |
| `legacy-dapp/` | ERC-20 wallet dApp on Sepolia (React + Vite) written against **ethers v5 + web3.js 1.x**: connect, balances, send with preflight, sign-in message, live activity feed. This is the "before" state Bob migrates. |
| `legacy-dapp/src/lib/__tests__/` | 22 behavior tests, library-agnostic. They are the migration contract and must pass unchanged afterwards. |
| `chainguard/` | Zero-dependency Node CLI: 25 detection rules, text/JSON/Markdown reports, before/after deltas, import-graph task planner, CI gate. |
| `docs/MIGRATION_PLAYBOOK.md` | Instructions Bob follows: mapping table, hard rules, known traps. |
| `docs/BOB_RUNBOOK.md` | Step-by-step plan for running the migration with Bob during the hackathon. |
| `reports/` | `baseline.md/json` (before), `bob-task-plan.md` (generated prompts), `timings.md`, `after.md` (generated after the run). |
| `docs/submission/` | Statement drafts, demo video script, submission checklist. |
| `bob_sessions/` | Bob session summary screenshots (required for submission). |

## Quick start

```bash
cp .env.example .env              # defaults work; never commit .env
npm ci --prefix legacy-dapp
npm test                          # chainguard unit tests + dApp behavior tests
npm run dev                       # http://localhost:5173 (needs a browser wallet on Sepolia)

npm run scan                      # findings vs reports/baseline.json
npm run plan                      # regenerate reports/bob-task-plan.md
npm run report                    # reports/after.md with the before/after table
npm run guard                     # exit 1 if any legacy call remains (CI gate after migration)
```

### chainguard CLI

```bash
node chainguard/bin/chainguard.js rules
node chainguard/bin/chainguard.js scan <dir> [--format text|json|md] [--out file] [--baseline before.json] [--fail-on error|warning|none]
node chainguard/bin/chainguard.js plan <dir> [--format md|json] [--out file]
```

It works on any JS/TS/JSX/TSX/Vue/Svelte frontend, not just this sample.

## Baseline (before Bob)

| Metric | Value |
| --- | --- |
| Files scanned | 18 |
| Files on legacy Web3 APIs | 10 |
| Legacy call sites | 72 (57 ethers v5, 15 web3.js) |
| Bob task plan | 6 tasks in 3 waves |
| Behavior tests | 22 / 22 passing |

Full breakdown: [reports/baseline.md](reports/baseline.md). Results after the Bob run go in
[reports/after.md](reports/after.md) and [docs/submission/IBM_BOB_USAGE.md](docs/submission/IBM_BOB_USAGE.md).

## Security

This repo uses the official hackathon template's `.gitignore` and `.bobignore` (plus wallet-material
patterns) and its [SECURITY.MD](SECURITY.MD). The dApp never handles private keys: signing goes
through the injected browser wallet. The signature test vector was produced with a throwaway
random wallet, and only its public address is kept.

Note: the template's `.gitignore` ignores any path containing `token`, `secret` or `password`, and
`.bobignore` hides `*config.json` from Bob. Name files accordingly (for example `erc20.js`, not
`token.js`), or they will silently never be committed.

## License

[MIT](LICENSE)
