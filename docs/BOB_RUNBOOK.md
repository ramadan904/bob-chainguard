# Hackathon runbook: Bob subagents under the signal box

The migration is done by IBM Bob, never by hand. Signalbox keeps Bob's parallel subagents
safe and makes everything they do visible and replayable. This runbook is the demo.

> Bob's UI changes between releases. Mode and button names below follow the challenge wording
> (Agent mode, parallel tasks, subagents, document understanding). Check the exact names against
> the official Bob 2.0 Hackathon Guide.

## 0. Setup (≈20 min)

> Shortcut: `npm run bob:prep` does everything in this section up to the prompts and prints them;
> after Bob's expand commit, `npm run bob:open` opens the signal box, runs doctor, prints the
> dispatcher prompt and starts the live panel.

```bash
cp .env.example .env
npm ci --prefix legacy-dapp && npm ci --prefix atlas
npm test                                   # chainguard, dApp behavior and signalbox tests
git tag before-bob && git push origin before-bob
```

Ask Bob (Agent mode) for the **expand step** first: the new libraries and new modules are added
next to the old ones, and nothing uses them yet. This is what lets the blocks migrate in parallel
later (see "Expand → migrate → contract" in the playbook):

```text
Read @docs/MIGRATION_PLAYBOOK.md, sections "Expand → migrate → contract" and "Clients".
Do only the expand step:
1. In legacy-dapp, add viem@2, wagmi@3 and @tanstack/react-query@5 as dependencies.
2. Create legacy-dapp/src/lib/viem.js exporting chain, publicClient, getWalletClient(account) and
   hasInjectedWallet(), exactly as in the playbook.
3. Create legacy-dapp/src/wagmi.js and wrap <App /> in legacy-dapp/src/main.jsx with WagmiProvider
   and QueryClientProvider.
Do not change any other file. Run npm test --prefix legacy-dapp and npm run build --prefix legacy-dapp,
then commit "Expand: add viem and wagmi alongside ethers and web3".
```

Open the signal box and put the live panel on screen:

```bash
npm run -s sb -- init          # scans, plans 6 blocks in 2 waves, writes .signalbox/ledger.jsonl
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

> **Optional, recommended:** connect Signalbox to Bob as MCP tools first (`docs/BOB_MCP.md`).
> Then Bob claims, releases and asks with native tool calls (`signalbox_claim`,
> `signalbox_release`, `signalbox_ask`…) instead of shell commands. Same ledger, same checks.

Give this to Bob's top-level agent (Agent mode, subagents / parallel tasks enabled):

```text
You are the dispatcher for a migration that runs under Signalbox interlocking.
Loop until `npm run -s sb -- next` prints ALL BLOCKS CLEARED:
1. Run `npm run -s sb -- next` (add --json if you prefer structured output). For anything you
   need to decide, ask the signal box in plain words, e.g.
   `npm run -s sb -- ask "start all green wave-1 blocks"`, `... ask "riskiest remaining block"`,
   `... why <block>`. Its answers come from the ledger; act on them.
2. Interlocking proof, once, at the start: while wave 1 is running, start one extra subagent on
   a wave-2 block. Its claim must be REFUSED ("signal at danger"). Report the refusal and end
   that subagent; do not retry until `next` lists the block as READY.
3. For every READY block, start a parallel subagent
   named bob-<n> (n = 1, 2, 3...). Give it exactly the output of
   `npm run -s sb -- prompt <block> --agent bob-<n>` as its task. Run the subagents of a wave
   in parallel; never start a block whose signal is at DANGER.
4. Wait for the subagents of the wave to finish. If a subagent reports a FAULT it could not fix
   after two releases, tell it to roll back, then start a fresh subagent on that block. If a
   subagent stops responding, free its block with
   `npm run -s sb -- rollback <block> --agent dispatcher --operator`.
5. After each wave, summarize what cleared, what faulted and why (from `npm run -s sb -- log`).
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
- The **control tower** shows one lane per Bob subagent: what it holds, what it just did, and
  an amber "Held at signal" lane (plus an amber pulse on the map) for the refused wave-2 claim.

### 2a. Safety proof (the rogue-agent moment, about 20 s)

Any time the panel is open, click **◆ Prove safety** (or type *simulate bad agent* in the Desk).
Three scripted drill agents enter three blocks of a small fixture repo at once; one strays and
breaks a contract; it is caught, rolled back, and the other two commit. It runs in a throwaway
repository, so it never touches Bob's run or its ledger: safe to do mid-run.

### 2b. Chaos drill on the real repo

While wave 1 is running, **between two releases**, click **⚡ Simulate chaos: SPAD** in the
control tower (or run `npm run -s sb -- drill spad --hold 6`). The signal box makes a real stray
edit to the most-imported file no agent holds. The scope check catches it in milliseconds, the
map and screen flash red, and after 6 seconds the file is restored from git. **Break a contract**
does the same with a renamed export and lights up every file that still imports it. Both are in
the hash-chained ledger, so the public replay shows them too.

If an agent releases during those 6 seconds, its release is refused (scope fault): that's the
interlock working, and the agent simply releases again. For a Bob-driven version, give one
subagent this prompt instead:

```text
Chaos subagent: claim <block> as bob-chaos, then deliberately also edit
legacy-dapp/src/config.js (a file outside your block) and release. Report exactly what the
signal box says. Then roll back your block with
`npm run -s sb -- rollback <block> --agent bob-chaos` and stop.
```

## 3. The contract step

The last wave includes the block that owns `lib/clients.js`. Its prompt says "Contract step": by
then every caller imports from `lib/viem.js`, so the old exports can go. If a wave-1 subagent left
an import of `readProvider` behind, the contract check names that file and the release is
refused. That's a good moment for the video: the interlock protecting code another agent owns.

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
- [ ] `npm run finalize`. It runs the guard, tests and build, measures the bundle against
      `reports/baseline-bundle.json`, and writes the Signalbox report, the log, `reports/after.md` and
      `reports/submission-numbers.md` (every number for the statements). It also bundles the ledger
      for the deployed replay. Fix anything under "Warnings" first.
- [ ] Commit `.signalbox/ledger.jsonl reports/ atlas/src/data/ bob_sessions/`, push, merge to
      `main`, and deploy (docs/submission/CHECKLIST.md: GitHub Pages, Netlify or Vercel).
- [ ] Paste the numbers into `docs/submission/*.md` and recount the words.

## Retakes (recording often takes a few attempts)

The ledger and the code must go back together, or the replay will show events that don't match
the commits. One command does all of it (it shows what it will reset; add `--yes` to do it):

```bash
npm run bob:retake            # dry run: what goes back
npm run bob:retake -- --yes   # keep the attempt on practice-HHMM, reset, fresh box, doctor
```

By hand, from the repo root, with nothing you want to keep uncommitted:

```bash
git branch practice-$(date +%H%M)                 # keep the attempt, just in case
git reset --hard <commit before 'signalbox: clear ...' commits>   # the "Expand: ..." commit
npm run -s sb -- init --force                     # archives the old ledger as .signalbox/ledger.<time>.jsonl
rm -rf .signalbox/checkpoints
npm run -s sb -- doctor
```

Only the final take's ledger gets exported (`npm run atlas`) and committed.
