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

If something goes wrong mid-run, the retake steps are at the bottom of the runbook.

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
- **Slides:** open the deck link → **Save as PDF** button (in the print dialog, turn on "Background graphics").
  `docs/submission/Signalbox-deck.pdf` is the pre-run version, if you're short on time.
- **Cover image:** `docs/submission/media/cover-baseline.png`, or a screenshot of the finished panel (better).

## 4. The lablab.ai form: copy and paste

**Title:** Signalbox: interlocking for parallel IBM Bob subagents

**Short description:**
Many Bob subagents, one codebase, no collisions. Signalbox gives each agent an exclusive block of files, opens waves like railway signals, and proves every change (scope, contracts, legacy scan, isolated tests) before it is committed.

**Long description:**
Everyone wants AI agents working in parallel, but they collide: they edit the same files, break
functions other agents depend on, and "fix" failing tests by editing the tests. Signalbox brings
railway interlocking to IBM Bob 2.0.
- chainguard scans the repo, reads the import graph and plans the change as blocks in waves.
- A Bob dispatcher agent starts one subagent per green block.
- Each subagent claims its block and edits only those files.
- Releasing a block runs a track circuit: scope, exported contract, legacy scan, and the
  behavior tests on an isolated git worktree. A clear block is committed alone and signed by its
  agent. A faulty block is fixed or rolled back while the other agents keep working.
- A live transit-map panel shows agents occupying blocks, faults and the train graph, and the
  deployed site replays the recorded run.
- Safety nets: protected tests, a live SPAD alarm, a pre-commit guard and a black-box recorder.

We proved it by having Bob migrate a real ERC-20 wallet dApp from ethers v5 + web3.js to
viem/wagmi. Rule packs make it work for any migration (a Moment.js → date-fns pack is included).

**Tags:** IBM Bob, Agentic AI, Multi-agent, Developer Tools, Code Migration, Web3, viem

**Repository:** https://github.com/ramadan904/bob-chainguard
**Application URL:** https://bob-chainguard.vercel.app/

**Problem & Solution statement:** paste `docs/submission/final/PROBLEM_SOLUTION.md`
**IBM Bob Usage statement:** paste `docs/submission/final/IBM_BOB_USAGE.md`
`npm run finalize` writes both with every number filled in from the ledger and prints their word
counts (each must be ≤ 500). Name Bob screenshots in `bob_sessions/` by what they show, e.g.
`alice-onboarding.png`, `alice-dispatcher.png`, `alice-mcp.png`, `alice-review.png`,
`bob-w1-lib-1.png`, so they land in the right rows. Optional: put your Bobcoins total in
`bob_sessions/bobcoins.txt`.

## 5. After submitting

Fill in the post-hackathon feedback form. It's needed for the $100 participant reward.
