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
- `scripts/bob.mjs` (`npm run bob:prep` / `bob:open` / `bob:retake`): the run helpers; retake goes back to the expand commit with a fresh signal box after a failed take. Prep checks the machine, installs, tests, tags `before-bob` and prints the onboarding + expand prompts; open (only after Bob's expand commit) opens the box, runs doctor, prints the dispatcher prompt and starts the panel.
- `scripts/record-tour.mjs` (`npm run record:tour` / `record:deck`): 1920×1080 clips of the guided replay and the deck for the video (needs `npm i --no-save playwright && npx playwright install chromium` once).
- `scripts/prove-pack.mjs` (`npm run prove:pack`): runs the whole protocol on `samples/moment-billing` with the Moment.js pack; CI runs it.
- `scripts/finalize.mjs` (`npm run finalize`): also writes paste-ready statements to `docs/submission/final/`; guard, tests, a check that test files are unchanged since tag `before-bob`, build + gzip bundle size against `reports/baseline-bundle.json` (549 kB), audit, reports, replay bundle. Writes `reports/submission-numbers.md`.
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
- **All building is done and live on `main`** (Vercel + GitHub Pages redeploy on every merge). 91 tests pass on Linux and Windows in CI.
- Panel features: wave schedule, control tower (one lane per Bob subagent), desk (`sb ask`), risk heatmap, "Ledger verified" + tamper test, rule-pack switcher, train graph with a parallelism band, chaos drill buttons (live mode only), guided tour, "Bob at work" screenshot gallery (appears once `bob_sessions/` has screenshots), 11–12-slide deck whose results slide reads the real ledger.
- Run helpers: `npm run bob:prep`, `npm run bob:open`, `npm run bob:retake`, `npm run finalize`, `npm run record:tour`, `npm run record:deck`.
- **Not done yet (this is what I need help with):** the real IBM Bob run, the screenshots, finalize, the video and the lablab.ai submission. **The migration must be done by IBM Bob, not by you or by me**, because it's what the judges score. `legacy-dapp/src` is still the untouched "before" code (72 legacy call sites, 22/22 tests), and that's correct.
- Do **not** suggest new features. Help me finish the steps below.

## What's left, in order (help me with exactly this)
1. **Prep** on my computer (Node 20+, Git):
   ```bash
   git clone https://github.com/ramadan904/bob-chainguard && cd bob-chainguard   # or: git pull
   npm run bob:prep
   ```
   Every line must say `ok`. It installs dependencies, runs all tests, tags `before-bob` and prints two prompts. Then `git push origin before-bob`.
2. **Bob, part 1** (Agent mode): paste the **onboarding** prompt, then the **expand step** prompt that `bob:prep` printed. Bob adds viem/wagmi alongside the old libraries and commits "Expand: …". Screenshot each Bob session summary: `bob_sessions/<myname>-onboarding.png`, `<myname>-expand.png`.
3. **Open the signal box:** `npm run bob:open`. It refuses until the expand commit exists, then runs doctor (all `ok`), prints the **dispatcher prompt** and serves the live panel at http://localhost:4700.
   - Optional but strong: connect the MCP tools first (`docs/BOB_MCP.md`) so Bob calls `signalbox_claim` / `signalbox_release` as tools. Screenshot it as `<myname>-mcp.png`.
4. **Bob, part 2 — record this:** Bob on the left, the panel on the right, screen recording on. Paste the dispatcher prompt. Bob starts subagents bob-1, bob-2… in parallel; one wave-2 claim is deliberately refused; faults get fixed; waves clear.
   - During wave 1, **between two releases**, click **⚡ Simulate chaos: SPAD** in the panel (it edits a file for 6 s, catches it, restores it).
   - Screenshot the dispatcher and each subagent: `<myname>-dispatcher.png`, `<myname>-w1-lib-1.png`, …
   - If a take goes wrong: `npm run bob:retake -- --yes` (keeps the attempt on a branch, resets to the expand commit, fresh signal box), then paste the dispatcher prompt again.
5. **Bob, part 3:** when every block is cleared, paste the cleanup prompt (runbook section 4: remove ethers and web3) and then the review prompt (section 5). Screenshots: `<myname>-cleanup.png`, `<myname>-review.png`. **Every team member** needs Bob screenshots in `bob_sessions/` (hackathon rule). Check none shows a key or `.env` value.
6. **Finalize:** `npm run finalize`. It must end with "Warnings: None" (fix what it lists). It writes the reports, the replay, the gallery and **paste-ready statements in `docs/submission/final/`** with every number filled in and word counts printed. Then:
   ```bash
   git add .signalbox/ledger.jsonl reports/ atlas/src/data/ atlas/public/bob/ bob_sessions/ docs/submission/final/
   git commit -m "Finalize: Bob run reports and replay"
   git push
   ```
   Then merge to `main`: open https://github.com/ramadan904/bob-chainguard/compare/main...<my branch> → Create pull request → Merge. Check https://bob-chainguard.vercel.app/?tour replays the run.
7. **Media:**
   - `npm run record:tour` and `npm run record:deck` make 1920×1080 clips in `docs/submission/media/` (first time: `npm i --no-save playwright && npx playwright install chromium`).
   - Video **≤ 3 min** following `docs/submission/DEMO_SCRIPT.md` (the 90-second cut is the core: desk → dispatch → parallel lanes → held at signal → chaos → fault → fix → clear). Upload to YouTube (unlisted is fine).
   - Slides: open https://bob-chainguard.vercel.app/deck.html → **Save as PDF** with background graphics on.
   - Cover image: a screenshot of the finished panel (or `docs/submission/media/cover-baseline.png`).
8. **Submit on lablab.ai before Sun Sep 27, 11:00 AM EDT (aim for 9:00):** use the text in `SUBMIT_TOMORROW.md` (title, descriptions, tags), repo https://github.com/ramadan904/bob-chainguard, app URL https://bob-chainguard.vercel.app/, paste the two files from `docs/submission/final/`, upload the video link, deck PDF, cover and Bob screenshots. Then fill in the post-hackathon feedback form (needed for the $100 reward).

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
