# Hackathon runbook: Bob subagents under the signal box

The migration is done by IBM Bob, never by hand. Signalbox keeps Bob's parallel subagents
safe and makes everything they do visible and replayable. This runbook is the demo.

> Bob's UI changes between releases. Mode and button names below follow the challenge wording
> (Agent mode, parallel tasks, subagents, document understanding). Check the exact names against
> the official Bob 2.0 Hackathon Guide.

## 0. Setup (≈20 min)

```bash
cp .env.example .env
npm ci --prefix legacy-dapp && npm ci --prefix atlas
npm test                                   # chainguard, dApp behavior and signalbox tests
git tag before-bob && git push origin before-bob
```

Ask Bob (Agent mode) to add the target libraries first, so no block has to touch `package.json`:

```text
In legacy-dapp, add viem@2, wagmi@3 and @tanstack/react-query@5 as dependencies. Do not change
any source file. Run npm test --prefix legacy-dapp, then commit "Add viem and wagmi".
```

Open the signal box and put the live panel on screen:

```bash
npm run -s sb -- init          # scans, plans 6 blocks in 3 waves, writes .signalbox/ledger.jsonl
npm run -s sb -- install-hook  # block files can only be committed by `release` (no bypass)
npm run -s sb -- doctor        # preflight: clean tree, hook, deps, UI built, tests green on HEAD
npm run signalbox              # builds the UI and serves it live at http://localhost:4700
```

Arrange the screen for recording: Bob IDE on the left, the Signalbox panel on the right.

## 1. Onboarding: Bob explains the codebase (document understanding)

```text
Read @README.md, @docs/MIGRATION_PLAYBOOK.md and @reports/baseline.md, then walk
legacy-dapp/src. Explain how wallet connection, ERC-20 reads, transfers, signing and the activity
feed flow through lib -> hooks -> components, and which parts depend on ethers v5 versus web3.js.
List the three riskiest parts of a viem/wagmi migration.
```

## 2. The dispatcher: one Bob agent orchestrates the subagents

Give this to Bob's top-level agent (Agent mode, subagents / parallel tasks enabled):

```text
You are the dispatcher for a migration that runs under Signalbox interlocking.
Loop until `npm run -s sb -- next` prints ALL BLOCKS CLEARED:
1. Run `npm run -s sb -- next` (add --json if you prefer structured output).
2. For every READY block, start a parallel subagent
   named bob-<n> (n = 1, 2, 3...). Give it exactly the output of
   `npm run -s sb -- prompt <block> --agent bob-<n>` as its task. Run the subagents of a wave
   in parallel; never start a block whose signal is at DANGER.
3. Wait for the subagents of the wave to finish. If a subagent reports a FAULT it could not fix
   after two releases, tell it to roll back, then start a fresh subagent on that block. If a
   subagent stops responding, free its block with
   `npm run -s sb -- rollback <block> --agent dispatcher --operator`.
4. After each wave, summarize what cleared, what faulted and why (from `npm run -s sb -- log`).
Never edit files yourself and never bypass the signal box.
Never run git commands (commit, stash, checkout, reset, clean) and never let a subagent run them:
other subagents are editing at the same time, and release/rollback already handle git.
If the signal box refuses something, report the reason. Do not work around it.
```

What each subagent does (it's in its prompt): `claim` → edit only its block → `release`. Release
runs four checks: scope, exported contract, legacy scan, and the behavior tests on an isolated git
worktree. If they pass, it commits the block alone. If not, it fixes the problem and releases
again, or rolls back.

What judges see on the panel:
- Blocks turn amber with the agent's name as soon as they are claimed.
- Station sizes shrink live as Bob edits.
- A fault flashes red with the failing test, and the block stays uncommitted.
- A SPAD banner appears if an agent edits outside its block.
- When a wave clears, the next wave's signals turn green.

## 3. Setup files for the hooks block

The `w2-hooks` block also owns app setup (`src/wagmi.js`, `src/main.jsx`), as the playbook says.
Its subagent must run `npm run -s sb -- extend w2-hooks legacy-dapp/src/wagmi.js legacy-dapp/src/main.jsx --agent <name>`
before touching them. If it forgets, the release fails with a SPAD. That's a great moment to keep in the video.

## 4. Cleanup and guard

```text
Every block is CLEARED. Remove ethers and web3 from legacy-dapp/package.json, reinstall, make
npm run build and npm test pass, run npm run report, and commit "Remove ethers and web3".
```

Then switch CI to blocking: in `.github/workflows/ci.yml` replace the scan step with `npm run guard`.

## 5. Code review by Bob

```text
Review the diff between tag before-bob and HEAD as a senior reviewer. Use `npm run -s sb -- log`
to see which agent changed which block and which faults were caught. Look for behavior changes the
tests would not catch (event ordering, bigint/number mixing in the UI, user-facing error messages,
receipt status handling). List findings with file:line.
```

## 6. Evidence for the submission

- [ ] Bob session summary screenshots for the dispatcher and every subagent, from **every** team
      member, in `bob_sessions/`.
- [ ] `npm run -s sb -- report --out reports/signalbox-report.md`,
      `npm run -s sb -- log > reports/signalbox-log.txt` and `npm run report`, then commit
      `.signalbox/ledger.jsonl` and `reports/`. The report has every number the statements need.
- [ ] `npm run atlas` (exports the ledger into the static build), commit `atlas/src/data/`, then
      deploy `atlas/` (docs/submission/CHECKLIST.md). The deployed site replays the real run.
- [ ] Fill the numbers in `docs/submission/*.md` from the ledger: blocks, agents, faults caught,
      SPADs, rollbacks, wall-clock time.
