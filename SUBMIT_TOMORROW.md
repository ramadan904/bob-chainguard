# Submit tomorrow: everything in order

Deadline: **Sun Sep 27, 11:00 AM EDT / 15:00 UTC**. Aim to be done by 09:00 EDT.

## 0. Publish the latest design (2 minutes, do this first)

Open https://github.com/ramadan904/bob-chainguard/compare/main...claude/dazzling-ptolemy-c288r3
→ **Create pull request** → **Merge pull request** → **Confirm merge**.
About a minute later these are live:
- Panel: https://bob-chainguard.vercel.app/ (backup: https://ramadan904.github.io/bob-chainguard/)
- Deck: https://bob-chainguard.vercel.app/deck.html

## 1. The Bob run (the core of the video)

On your computer, in the repo folder:

```bash
git pull
npm run bob:prep
```

`bob:prep` checks Node, installs every dependency, runs all tests, tags `before-bob`, and prints
the first two prompts to paste into Bob (onboarding, then the expand step). Then:
1. Paste the **onboarding** prompt, then the **expand step** prompt into Bob (Agent mode); let it commit.
2. `npm run bob:open`: it refuses to start until the expand commit is in, then opens the signal
   box, installs the guard, runs doctor (every line must say ok), prints the **dispatcher prompt**
   and starts the live panel at http://localhost:4700.
3. Put the panel next to Bob, start screen recording, and paste the dispatcher prompt into Bob.
4. During wave 1, between two releases: click **⚡ Simulate chaos**.
5. When everything is cleared: the cleanup prompt (runbook section 4), then the review prompt (section 5).

Save Bob's session summary screenshots into `bob_sessions/` as you go. **Every team member** needs them.
Name them `<yourname>-<what>.png`, where <what> is `onboarding`, `expand`, `dispatcher`, `mcp`,
`review`, `cleanup` or a block id (`w1-lib-1`). The names become the captions of the
**Bob at work** gallery on the site and in the deck, and fill the evidence column of the statements.

If something goes wrong mid-run: `npm run bob:retake` shows what goes back, and `npm run bob:retake -- --yes` keeps the attempt on a `practice-HHMM` branch, resets to Bob's expand commit and opens a fresh signal box. Then paste the dispatcher prompt again.

## 2. Finalize (one command)

```bash
npm run finalize
```

It must end with "Warnings: None". It writes `reports/submission-numbers.md`. Those are your numbers.

```bash
git add .signalbox/ledger.jsonl reports/ atlas/src/data/ atlas/public/bob/ bob_sessions/ docs/submission/final/
git commit -m "Finalize: Bob run reports and replay"
git push
```

Then merge to `main` again (step 0's link). The live panel and the deck's results slide now show the real run.

## 3. Media

- **Video (≤ 3 min):** follow docs/submission/DEMO_SCRIPT.md. Upload to YouTube (unlisted is fine).
  Easy segment: `npm run record:tour` records the guided replay of your real run as a 1920×1080 clip
  (`docs/submission/media/tour.webm`), and `npm run record:deck` records the slides. First time only:
  `npm i --no-save playwright && npx playwright install chromium`.
- **Slides:** `docs/submission/Signalbox-deck.pdf` is ready (all 12 slides, exported from the live deck).
  If you record a Bob run later, re-export: deck link → **Save as PDF** with "Background graphics" on.
- **Cover image:** `docs/submission/media/cover.png` (1920×1080, the safety proof's verdict). A second
  image of the panel: `docs/submission/media/panel.png`.

## 4. The lablab.ai form: copy and paste

**Title:** Signalbox: every Bob agent at once, nothing unproven gets in

**Short description:**
The missing control layer for multi-agent development. Signalbox lets several IBM Bob subagents change one codebase at the same time: each gets an exclusive block, waves open like railway signals, and every change is proven (scope, contracts, legacy scan, isolated tests) before it is committed. A rogue agent is caught and rolled back while the others keep working.

**Long description:**
You put three AI agents on one codebase to go three times faster. By morning one has renamed a
function the others still call, one has "fixed" a failing test by rewriting it, and the diff is
too big to review. So you go back to one agent at a time. Signalbox is the control layer that
makes Bob's parallelism safe, built on railway interlocking.
- chainguard scans the repo, reads the import graph and plans the change as blocks in waves.
- A Bob dispatcher agent (Agent mode) starts one subagent per green block, in parallel.
- Each subagent claims its block and edits only those files.
- Releasing a block runs a track circuit: scope, exported contract, legacy scan, and the
  behavior tests on an isolated git worktree. A clear block is committed alone and signed by its
  agent; a faulty one is fixed or rolled back while the others keep working.
- The live Control Tower shows Bob's subagents, refused claims, faults and a train graph of the
  parallelism; every event is in a SHA-256 hash-chained ledger anyone can replay and verify.
- **The safety proof:** one click, three agents at once, one goes rogue. Caught before commit,
  rolled back, the other two commit. "Zero collisions. Ledger verified. Parallel agents are now safe."

The demo target, an ERC-20 wallet dApp on ethers v5 + web3.js, is planned for Bob as 6 blocks in 2
waves (72 legacy call sites); the recorded end-to-end Bob migration was not completed before the
deadline, so we report only what ran. Rule packs make it work for any migration (a Moment.js →
date-fns pack is included and proven in CI).

**Tags:** IBM Bob, Agentic AI, Multi-agent, Developer Tools, Code Migration, Web3, viem

**Repository:** https://github.com/ramadan904/bob-chainguard
**Application URL:** https://bob-chainguard.vercel.app/

**Problem & Solution statement:** paste `docs/submission/final/PROBLEM_SOLUTION.md` (already written, honest version: no Bob run)
**IBM Bob Usage statement:** paste `docs/submission/final/IBM_BOB_USAGE.md` (already written; if you later complete the Bob run, `npm run finalize` overwrites both with the real numbers)
`npm run finalize` writes both with every number filled in from the ledger and prints their word
counts (each must be ≤ 500). Name Bob screenshots in `bob_sessions/` by what they show, e.g.
`alice-onboarding.png`, `alice-dispatcher.png`, `alice-mcp.png`, `alice-review.png`,
`bob-w1-lib-1.png`, so they land in the right rows. Optional: put your Bobcoins total in
`bob_sessions/bobcoins.txt`.

## 5. After submitting

Fill in the post-hackathon feedback form. It's needed for the $100 participant reward.
