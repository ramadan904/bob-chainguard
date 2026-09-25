# bob-chainguard

**Signalbox: interlocking for parallel IBM Bob subagents.** Railways let many trains share
one network safely: a train enters a block only on a green signal, one train per block, and the
block is released only after a track circuit proves it clear. Signalbox does the same for Bob
subagents changing one codebase at the same time, and shows it live on a transit-map signal box.
Built for the IBM Bob 2.0 Hackathon (Sep 25–27, 2026).

```
 chainguard scan+plan ──► signal box ──► Bob dispatcher ──► Bob subagents (parallel, one per block)
 72 legacy call sites     6 blocks,      reads status,      claim ─► edit ─► release
 import graph             3 waves        starts subagents            │
                                                                     ▼
            live panel ◄── ledger ◄── clear + commit block  ◄── track circuit: scope · contract ·
            (transit map,                 or FAULT / rollback      legacy scan · isolated tests
             replayable)
```

## Signalbox

```bash
npm run -s sb -- init                                   # plan blocks and waves, open the ledger
npm run signalbox                                       # live panel at http://localhost:4700
npm run -s sb -- claim w1-lib-1 --agent bob-1           # refused while the signal is at danger
npm run -s sb -- release w1-lib-1 --agent bob-1         # scope, contract, scan, isolated tests -> commit
npm run -s sb -- rollback w1-lib-1 --agent bob-1        # restore only this block
npm run -s sb -- next [--json]                          # what a dispatcher may start now
npm run -s sb -- report --out reports/signalbox-report.md   # impact numbers from the ledger
npm run -s sb -- install-hook                           # pre-commit guard: block files only via release
npm run -s sb -- status | log | prompt <block>
```

- **Blocks and waves.** chainguard's import graph splits the change into blocks of disjoint files.
  Wave N's signals turn green only when every block of earlier waves has cleared.
- **Interlocking.** A claim is refused if the signal is at danger, another agent occupies the
  block, or its files are held elsewhere.
- **Track circuit on release.** Four checks:
  - scope: an edit that no occupied block owns is a SPAD and blocks everyone
  - exported contract: no export removed or renamed
  - legacy scan: zero call sites left in the block
  - behavior tests: run in a throwaway `git worktree` holding HEAD plus only this block, so
    parallel agents can't cause or mask each other's failures
- **Commit or roll back.** A clear block is committed alone with a `Signalbox-Agent` trailer. A
  faulty one stays uncommitted until it's fixed or rolled back.
- **Ledger.** `.signalbox/ledger.jsonl` is append-only and is the single source of truth. The CLI,
  the live server and the UI derive state from it with the same pure reducer.
- **Protected paths.** Tests, `chainguard/`, CI and the playbook can't be claimed, extended into
  or committed while the box is open. An agent that "fixes" a failing test by editing it gets a
  fault, not a pass.
- **Live SPAD.** While `signalbox serve` runs, an edit no occupied block owns flashes red on the
  map within a second, before anyone tries to release.
- **No bypass.** The pre-commit hook refuses direct commits of files in an uncleared block. An
  operator can free a stuck agent's block with `rollback --operator`, and the event records who
  overrode whom.
- **Train graph.** A railway-style time chart of which agent occupied which block when. Overlapping
  bars are Bob subagents working in parallel, and every track circuit run is marked.
- **Live panel.** `signalbox serve` streams ledger events and a rescan on every file change.
  Deployed statically, the UI replays the recorded ledger.

- **Tamper-evident ledger.** Every event is SHA-256 chained to the previous one. `npm run -s sb -- audit`
  verifies the chain and checks that every cleared block's commit exists on the branch, is signed by
  the agent the ledger names, and changed only that block's files. CI runs it, and the panel re-verifies
  the chain in the browser ("Ledger verified").
- **Review every agent's change.** Each cleared block's real diff ships with the panel. Open a
  block and click "Review bob-N's change".
- **Blast radius.** Pick a file to see every file that depends on it, ripple by ripple.
- **Risk scores.** Each block is ranked HIGH, MED or LOW by its legacy call sites plus 3 × the files that
  depend on it, so reviewers know where to look hardest.
- **Pull request bot.** `.github/workflows/signalbox-pr.yml` keeps one Signalbox comment updated on every
  pull request: legacy calls before and after, the signal box report, and the ledger audit.
- **Crew roster.** A record for each Bob subagent: blocks cleared, releases, faults fixed, time in blocks.
- **Black-box recorder.** Every occupied block's in-flight files are saved (content-addressed) on
  every signal box command and every file change. If an agent runs `git stash` or `checkout .`
  anyway, `npm run -s sb -- recover <block>` puts the work back.

### Rule packs: any migration, not just Web3

The Web3 rules (ethers v5 / web3.js → viem + wagmi) are the built-in pack. Any other migration is
a JSON rule pack plus a playbook for Bob:

```bash
node chainguard/bin/chainguard.js rules --pack chainguard/packs/moment-to-date-fns.json
npm run -s sb -- init --scan src --pack chainguard/packs/moment-to-date-fns.json --test "npm test"
```

`chainguard/packs/moment-to-date-fns.json` has 13 rules, and its playbook
([docs/playbooks/moment-to-date-fns.md](docs/playbooks/moment-to-date-fns.md)) includes the
format-token trap (`YYYY` means something else in date-fns). The pack is recorded in the ledger, so
the release checks, the live server and the panel all use the same rules.

The step-by-step run with Bob, including the dispatcher prompt, is in
[docs/BOB_RUNBOOK.md](docs/BOB_RUNBOOK.md).

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
| `chainguard/` | Zero-dependency Node CLI: 25 detection rules, text/JSON/Markdown reports, before/after deltas, import-graph task planner, per-commit history scan, CI gate. |
| `atlas/` | The Signalbox panel (formerly Chainguard Atlas): the codebase as a transit map with live block occupancy, signals, track-circuit lamps, the train describer and replay. |
| `chainguard/src/signalbox*.js` | Interlocking engine, pure state reducer and live server. |
| `docs/MIGRATION_PLAYBOOK.md` | Instructions Bob follows: mapping table, hard rules, known traps. |
| `docs/BOB_RUNBOOK.md` | Step-by-step plan for running the migration with Bob during the hackathon. |
| `reports/` | `baseline.md/json` (before), `bob-task-plan.md` (generated prompts), `timings.md`, `after.md` (generated after the run). |
| `docs/submission/` | Statement drafts, demo video script, submission checklist. |
| `bob_sessions/` | Bob session summary screenshots (required for submission). |

## Quick start

```bash
cp .env.example .env              # defaults work; never commit .env
npm ci --prefix legacy-dapp
npm test                          # chainguard, dApp behavior and atlas tests
npm run dev                       # http://localhost:5173 (needs a browser wallet on Sepolia)

npm run scan                      # findings vs reports/baseline.json
npm run plan                      # regenerate reports/bob-task-plan.md
npm run report                    # reports/after.md with the before/after table
npm run guard                     # exit 1 if any legacy call remains (CI gate after migration)
```

## Chainguard Atlas

```bash
npm ci --prefix atlas
npm run atlas:dev                 # scan history + open the map at http://localhost:5173
npm run atlas                     # scan history + static build in atlas/dist
```

- **Lines are folders, stations are files.** Stations run top to bottom by import depth, so a file
  always sits below everything it imports. Lines are ordered by the folder-level import graph.
- **Station size is the number of legacy call sites.** A rust ring means legacy code, a steel
  check means Bob migrated it, and a plain tick means the file never used legacy APIs.
- **Tunnels are imports between folders.** Select a station to light up what it imports and what
  uses it.
- **The departures board** lists Bob's subagent tasks by wave. Each one moves from SCHEDULED to
  BOARDING to ARRIVED as its call sites disappear from the commits.
- **The timeline** has one stop per commit. Press play (or use ← →) to replay the migration.
- **The station panel** shows every call site with its source line, the viem/wagmi replacement,
  the Bob task prompt (copy button), a per-file history sparkline, and imports and dependents.

Nothing is mocked: `chainguard atlas` checks out every commit that touched `legacy-dapp/src`,
scans it, and writes `atlas/src/data/atlas-data.json`. Before Bob runs there is one snapshot.
Each wave commit adds another.

### chainguard CLI

```bash
node chainguard/bin/chainguard.js rules
node chainguard/bin/chainguard.js scan <dir> [--format text|json|md] [--out file] [--baseline before.json] [--fail-on error|warning|none]
node chainguard/bin/chainguard.js plan <dir> [--format md|json] [--out file]
node chainguard/bin/chainguard.js atlas <dir> [--out file]
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
