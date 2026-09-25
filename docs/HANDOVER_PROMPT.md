# Handover prompt (paste everything below the line into the new assistant)

---

You are taking over an in-progress hackathon project. Read this whole brief before doing anything. Then confirm what you understood in five bullet points, and ask me which step I'm on before changing anything.

## Who I am and how to help me
- I'm the builder, competing in the **IBM Bob 2.0 Hackathon** (lablab.ai). The deadline is **Sun Sep 27 2026, 11:00 AM EDT / 15:00 UTC**. I want to submit on Sep 27 in the morning.
- I'm not deeply technical with git and GitHub. Give me **click-by-click steps and exact commands**, one step at a time, and tell me what I should see after each one.
- Never invent results. Every number in the project must come from real scans, the real ledger or a real build.

## The project: "Signalbox: interlocking for parallel IBM Bob subagents"
- Repo (public): https://github.com/ramadan904/bob-chainguard
- Live site (Vercel, deployed from `main`): https://bob-chainguard.vercel.app/ (backup: https://ramadan904.github.io/bob-chainguard/ on GitHub Pages)
- Deck: https://bob-chainguard.vercel.app/deck.html
- Guided replay: https://bob-chainguard.vercel.app/?tour
- Vercel deploys `main` to production and every branch push as a preview. GitHub Pages also deploys `main` (the backup link).
- Works on Windows, macOS and Linux (CI runs the full suite on Windows too). Needs Node.js 20+ (22 LTS recommended); `sb doctor` checks it.
- Working branch: `claude/dazzling-ptolemy-c288r3`. `main` gets updated by merging a pull request from that branch, and every push to `main` redeploys the site automatically (workflow `deploy panel`, about 1 minute).

**The idea:** running several AI agents on one codebase at once usually ends in collisions, broken contracts and edited tests. Signalbox applies railway *interlocking* to IBM Bob subagents:
1. `chainguard` scans the code and reads the import graph. It plans the change as **blocks** (the files one subagent owns) grouped in **waves**; blocks in the same wave never share files.
2. A **Bob dispatcher agent** starts one subagent per block whose signal is green. Wave N opens only when every earlier wave has cleared.
3. Each subagent must `claim` its block. The claim is refused if the wave isn't open or the files are held by another agent.
4. `release` runs the **track circuit**, four checks:
   - **scope:** no edits outside any block (an outside edit is a "SPAD", signal passed at danger)
   - **contract:** no export that other files still import was removed
   - **legacy scan:** zero old-library calls left in the block
   - **tests:** the behavior tests run on an **isolated git worktree** containing only the cleared work plus this block

   If all pass, the block is committed on its own, with a `Signalbox-Agent: bob-N` trailer. If not, the agent fixes and releases again, or rolls back.
5. Every event is appended to `.signalbox/ledger.jsonl`, which is **SHA-256 hash-chained** (tamper-evident). A web panel shows everything live and replays the run.

**The demo codebase:** `legacy-dapp/`, an ERC-20 wallet dApp on ethers v5 + web3.js 1.x. Bob migrates it to viem 2 + wagmi 3. Baseline: **72 legacy call sites in 10 of 18 files**, planned as **6 blocks in 2 waves**. There are **22 behavior tests** in `legacy-dapp/src/lib/__tests__/` that must pass unchanged.

## Repository map
- `chainguard/`: zero-dependency Node CLI and engine.
  - `bin/chainguard.js`: `scan | plan | atlas | rules`, with `--pack` for rule packs.
  - `bin/signalbox.js`: `init | claim | extend | release | rollback | next | ask | why | risk | drill | drill-end | mcp | prompt | status | log | report | audit | doctor | install-hook | checkpoints | recover | export | serve`.
  - `src/signalbox-mcp.js`: `sb mcp`, an MCP server (stdio) exposing the signal box as tools for Bob. Setup in `docs/BOB_MCP.md`.
  - `src/dispatch.js`: the dispatcher desk behind `sb ask` and the panel's command bar (keyword intents over the ledger, no model). Also blast radius and block risk.
  - `src/signalbox.js`: operations (ledger, locks, the four checks, isolated worktree tests, commits, checkpoints, audit).
  - `src/signalbox-state.js`: a pure reducer shared by the CLI and the browser (states, `canClaim`, `metrics`, `timeline`, `verifyChain`, `describe`).
  - `src/signalbox-server.js`: live server with a JSON snapshot endpoint and server-sent events.
  - `src/plan.js`: waves from the import graph. "Provider" files, which export legacy objects, go *after* their callers: expand → migrate → contract.
  - `src/rules.js`: 25 Web3 rules plus rule-pack loading. `packs/moment-to-date-fns.json` is a second pack.
- `atlas/`: the web panel (Vite, plain JS + SVG, IBM Plex fonts, night theme by default).
  - `src/main.js`: the panel, including the **control tower** (one lane per Bob subagent, amber when a claim is refused), the **⚡ Simulate chaos** buttons (live mode: a real stray edit or contract break, caught, restored from git after 6 s, recorded as `drill`/`drill-end` in the ledger) and the **dispatcher desk**, the **risk heatmap** toggle on the map, the **Verify it yourself** dialog (click the ledger badge; includes a tamper test on an in-memory copy) and the **rule-pack switcher** (Web3 ↔ Moment → date-fns on `samples/moment-billing`, a sample app).
  - `src/insights.js`: blast radius, risk, crew stats, tour captions.
  - `src/signal.js`: joins the ledger with git history.
  - `src/layout.js`: the transit-map layout.
  - `deck.html` + `src/deck.js`: the 11-slide pitch deck. Its results slide reads the real ledger.
  - Data: `atlas/src/data/atlas-data.json` and `atlas/src/data/ledger.json`, written by `npm run atlas` / `npm run finalize`.
- `legacy-dapp/`: the dApp being migrated. Its tests are the behavior contract.
- `scripts/finalize.mjs` (`npm run finalize`): guard, tests, a check that test files are unchanged since tag `before-bob`, build + gzip bundle size against `reports/baseline-bundle.json` (549 kB), audit, reports, replay bundle. Writes `reports/submission-numbers.md`.
- `docs/BOB_RUNBOOK.md`: the exact Bob prompts: expand step, dispatcher, cleanup, review, retakes.
- `docs/MIGRATION_PLAYBOOK.md`: the ethers/web3 → viem/wagmi mapping and traps.
- `docs/REHEARSAL.md`: a full dry run done by hand on a throwaway clone. It proved the tooling works end to end.
- `docs/submission/`:
  - `PROBLEM_SOLUTION.md` and `IBM_BOB_USAGE.md` (each **≤ 500 words**, with `{{value}}` placeholders that `npm run finalize` fills into `docs/submission/final/`)
  - `DEMO_SCRIPT.md` (video ≤ 3 min)
  - `CHECKLIST.md`
  - `Signalbox-deck.pdf` (the pre-run version)
  - `media/cover-baseline.png` (1920×1080 cover)
- `SUBMIT_TOMORROW.md`: the ordered plan, with copy-paste text for every lablab.ai form field.
- CI (`.github/workflows/`):
  - `ci.yml`: tests, builds, atlas, audit, scan summary.
  - `pages.yml`: deploys `atlas/dist` from `main`.
  - `signalbox-pr.yml`: bot comment on pull requests.

## Status right now
- Done, tested (79 tests: 39 chainguard/signalbox, 22 dApp, 18 panel) and pushed on the branch: everything above.
- Already live on `main`: the panel with the night colours.
- **Not yet on `main`** (needs one more PR merge): the deck, the hash-chained ledger + audit + "Ledger verified" badge, "Review bob-N's change" diffs, blast radius, crew roster, risk scores, the PR bot, and the guided tour. To merge: open https://github.com/ramadan904/bob-chainguard/compare/main...claude/dazzling-ptolemy-c288r3 → Create pull request → Merge pull request → Confirm merge.
- **Not done yet:** the real Bob run. **The migration must be done by IBM Bob, not by you or by me**, because it's what the judges score. `legacy-dapp/src` is still the untouched "before" code, and that's correct.

## What's left, in order (help me with exactly this)
1. Merge the PR above, so the site has every feature.
2. On my computer:
   ```bash
   git clone https://github.com/ramadan904/bob-chainguard && cd bob-chainguard
   npm ci --prefix legacy-dapp && npm ci --prefix atlas
   npm test
   git tag before-bob
   ```
3. Follow `docs/BOB_RUNBOOK.md` with IBM Bob:
   1. Paste the "expand step" prompt into Bob (it adds viem@2, wagmi@3, @tanstack/react-query@5, `src/lib/viem.js`, `src/wagmi.js` and the providers in `main.jsx`, then commits).
   2. `npm run -s sb -- init`, then `npm run -s sb -- install-hook`, then `npm run -s sb -- doctor`. Every line must say ok.
   3. `npm run signalbox`, then open http://localhost:4700 next to Bob and start screen recording.
   4. Paste the **dispatcher prompt** into Bob. Bob starts subagents (bob-1, bob-2…) that claim, edit, release, and fix faults.
   5. When every block is cleared, give Bob the cleanup prompt: remove ethers and web3.
   6. Save **Bob session summary screenshots from every team member** into `bob_sessions/` (the hackathon requires them).
4. `npm run finalize`. It must end with "Warnings: None". Then:
   ```bash
   git add .signalbox/ledger.jsonl reports/ atlas/src/data/ bob_sessions/
   git commit -m "Finalize: Bob run reports and replay"
   git push
   ```
   Then merge to `main` again (a PR from the branch I pushed to).
5. `npm run finalize` wrote paste-ready statements to `docs/submission/final/` with every number filled in. It prints their word counts (each must be **≤ 500**) and warns if a screenshot is missing. Name screenshots by what they show: `name-onboarding.png`, `name-dispatcher.png`, `name-mcp.png`, `name-review.png`, `name-<block>.png`.
6. Media:
   - Video ≤ 3 min, following `DEMO_SCRIPT.md`. An easy segment: record `…/bob-chainguard/?tour`.
   - Slides: open `deck.html` → "Save as PDF" with background graphics on.
   - Cover image: use `media/cover-baseline.png`, or a screenshot of the finished panel.
7. Fill in the lablab.ai form using the text in `SUBMIT_TOMORROW.md`: title, short and long description, tags, repo URL, application URL `https://bob-chainguard.vercel.app/`, the statements, and the Bob screenshots. Then fill in the post-hackathon feedback form (needed for the $100 reward).

## Rules and gotchas you must respect
- **Never fake data** in the final version: no invented numbers, no pre-written ledgers.
- **Never do the migration yourself.** Bob must do it. You help with prompts, errors and the tooling.
- **Never edit** `legacy-dapp/src/lib/__tests__/**`, `chainguard/**`, `.github/**` or `docs/MIGRATION_PLAYBOOK.md` while a signal box is open. They're protected. A human can override the pre-commit guard with `SIGNALBOX_COMMIT=1` only for genuine tooling fixes.
- The repo uses the official hackathon `.gitignore`, which **ignores any path containing `token`, `secret` or `password`**, so never name files like that. `.bobignore` hides `*config.json` from Bob.
- No keys, mnemonics or private keys anywhere in the repo. The dApp signs through the browser wallet.
- `.signalbox/` must stay committed after the run (the ledger is evidence); `.signalbox/lock/` and `.signalbox/checkpoints/` are ignored.
- viem traps the tests catch:
  - `parseUnits` rounds extra decimals silently where ethers threw, so the agent must throw itself.
  - `recoverMessageAddress` is async.
- In wagmi 3, mutation hooks return `mutate` / `mutateAsync`.
- If something goes wrong mid-run, the retake steps are at the bottom of `docs/BOB_RUNBOOK.md`: reset to the "Expand" commit, `sb init --force`, delete checkpoints, run `doctor`.

## Useful commands when debugging
- `npm run -s sb -- status`, `sb next`, `sb log`: see what the agents are doing.
- `npm run -s sb -- ask "why is w2-lib at danger?"`, `sb risk`, `sb why <block>`: the dispatcher desk.
- `npm run -s sb -- drill spad --hold 6` (or `drill contract`): chaos drill from the terminal. Do it between releases.
- `npm run -s sb -- report`: impact numbers.
- `npm run -s sb -- audit`: check the ledger against git.
- `npm run -s sb -- rollback <block> --agent dispatcher --operator`: free a block held by a stuck agent.
- `npm run -s sb -- recover <block> --agent dispatcher`: restore lost in-progress work from the black-box recorder.
- `npm test`: every test suite.
- `npm run build`: build the dApp and the panel.

Start by asking me: "Which step are you on, and what do you see on screen?"
