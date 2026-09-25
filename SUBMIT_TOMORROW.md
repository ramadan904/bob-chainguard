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
npm ci --prefix legacy-dapp && npm ci --prefix atlas
git tag before-bob
```

Then follow **docs/BOB_RUNBOOK.md**:
1. Give Bob the "expand step" prompt (section 0), and let it commit.
2. `npm run -s sb -- init` → `npm run -s sb -- install-hook` → `npm run -s sb -- doctor` (all lines must say ok).
3. `npm run signalbox`, then open http://localhost:4700 next to Bob.
4. Start screen recording. Give Bob the **dispatcher prompt** (section 2).
5. When everything is cleared: the cleanup prompt (section 4).

Save Bob's session summary screenshots into `bob_sessions/` as you go. **Every team member** needs them.

If something goes wrong mid-run, the retake steps are at the bottom of the runbook.

## 2. Finalize (one command)

```bash
npm run finalize
```

It must end with "Warnings: None". It writes `reports/submission-numbers.md`. Those are your numbers.

```bash
git add .signalbox/ledger.jsonl reports/ atlas/src/data/ bob_sessions/
git commit -m "Finalize: Bob run reports and replay"
git push
```

Then merge to `main` again (step 0's link). The live panel and the deck's results slide now show the real run.

## 3. Media

- **Video (≤ 3 min):** follow docs/submission/DEMO_SCRIPT.md. Upload to YouTube (unlisted is fine).
  Easy segment: open `https://bob-chainguard.vercel.app/?tour` and record it. It narrates your real run by itself.
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

**Problem & Solution statement:** docs/submission/PROBLEM_SOLUTION.md
**IBM Bob Usage statement:** docs/submission/IBM_BOB_USAGE.md
Replace every [bracket] with the numbers from `reports/submission-numbers.md`. Keep each under 500 words.

## 5. After submitting

Fill in the post-hackathon feedback form. It's needed for the $100 participant reward.
