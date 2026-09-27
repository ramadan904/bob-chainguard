# Demo video script (target 2:50, hard limit 3:00)

The story in one line: **Every Bob agent at once. Nothing unproven gets in.** The first 90 seconds
go from the human pain to the proof. Record the Bob IDE on the left and the live Signalbox panel
(`npm run signalbox`) on the right for the Bob segments.

| Time | On screen | Voice-over |
| --- | --- | --- |
| 0:00–0:07 | Black. White text fades in: **"Every agent finished. The build didn't."** | *(silence, then)* "Every agent finished. The build didn't." |
| 0:07–0:20 | A huge `git diff` scrolling; a red failing test; the panel's map with 72 red stations | "You let three AI agents loose on one codebase. One renamed a function the others still call. One 'fixed' a test by rewriting it. Now nobody can tell which change broke the build, and the whole night's work goes in the bin. So teams stop trusting agents in parallel." |
| 0:20–0:32 | Signalbox panel: **"Every Bob agent at once. Nothing unproven gets in."**; the Control Tower with the IBM Bob tab: 6 blocks, 2 waves | "Signalbox is railway interlocking for IBM Bob. No agent enters a block until its signal is green. No change gets in until it is proven." |
| 0:32–0:40 | Desk: type **simulate bad agent** | "Watch what happens when one agent goes rogue." |
| 0:40–0:48 | DRILL-1, DRILL-2, DRILL-3 enter three blocks at the same instant | "Three agents. Three blocks. Same instant." |
| **0:48–1:02** | DRILL-3 edits outside its block and breaks an export → 4 s red alarm, `index.js` flares, FAULT | "The third one touches a file it doesn't own and breaks something the others depend on. Caught before it can commit." |
| **1:02–1:12** | **ROLLED BACK** stamps across the map; the other two lanes pass all four checks and commit | "Rolled back automatically. Stray file restored. The other two never noticed." |
| **1:12–1:26** | The finale: signals turn green, **"Parallel agents are now safe."**, badges, then *All changes proven. Zero collisions. Ledger verified.* Hold. | *(two beats of silence)* "All changes proven. Zero collisions. Ledger verified." |
| 1:26–1:30 | The closing line appears: **"This is the missing control layer for multi-agent development."** | "This is the missing control layer for multi-agent development." |

**The 90-second cut is exactly the table above.** Pain (0:00–0:20) → the idea (0:20–0:32) → the rogue
agent (0:32–1:12) → the release (1:12–1:30). Record it from https://bob-chainguard.vercel.app/ ; the
ready clip `docs/submission/media/proof.webm` covers 0:40–1:30 (re-record with `npm run record:proof`).
It claims nothing about a Bob run: the BOB side shows the plan, the proof uses labelled drill agents.

**Ready-made, no editing:** `docs/submission/media/demo.webm` (70 s, 1920×1080, on-screen captions,
no voice) is this cut recorded end to end: `npm run record:demo`. Upload it as is, or talk over it.
Recording by hand? Open https://bob-chainguard.vercel.app/?still (a first visit without `?still` plays
the parallel run by itself), or press **▶ Watch 3 agents run at once** instead of typing in the desk.

**If you complete a recorded IBM Bob run**, insert 15 s of it after 0:32 (BOB-1/2/3 working at once,
one held at the signal) and say: "These are IBM Bob's own subagents under the same signal box."

### If there is no recorded Bob run (honest cut, about 90 s)

| Time | On screen | Voice-over |
| --- | --- | --- |
| 0:00–0:16 | The huge `git diff` scrolling; a red test run | The same pain opening as above. |
| 0:16–0:30 | Panel headline **"Every Bob agent at once. Nothing unproven gets in."**; the wave schedule: 72 legacy call sites planned as 6 blocks in 2 waves | "Signalbox is the control layer for parallel IBM Bob agents. It plans a change as blocks no two agents share, and opens waves like railway signals." |
| 0:30–0:40 | Desk: **start all safe wave 1** → the dispatch prompt for Bob; then open a block's subagent prompt with its traps | "It hands Bob's dispatcher the exact job: one subagent per green block, each with the protocol and the traps its files hit." |
| 0:40–1:20 | Desk: **simulate bad agent** → three agents at once → rogue → red alarm → ROLLED BACK → the other two commit → the finale | "Now the hard case: three agents at once, and one goes rogue…" (as above, 0:44–1:24) |
| 1:20–1:30 | The **What we proved** slide | "Every number you saw came from a real run. Every Bob agent at once. Nothing unproven gets in." |

Don't show or say anything about Bob migrating the dApp in this cut: the statements say plainly
that the recorded Bob run wasn't completed.

**Say it plainly on camera:** the DRILL agents are scripted, on a small fixture repo, so the rogue
behaviour is guaranteed and repeatable; the BOB lanes are IBM Bob. Judges trust a demo that labels
itself.

Recording tips:
- **Ready-made clips:** `docs/submission/media/proof.webm` covers 0:44–1:24 already
  (the safety proof, 1920×1080, about 25 s; `npm run record:proof` re-records it). After
  `npm run finalize`, `npm run record:tour` records the whole guided replay (it ends with the
  proof) and `npm run record:deck` every slide, 5 s each. They land in
  `docs/submission/media/` as .webm, plus .mp4 if ffmpeg is installed. First time only:
  `npm i --no-save playwright && npx playwright install chromium`.
- Short on time? Open `https://bob-chainguard.vercel.app/?tour` after `npm run finalize` and a
  merge. The tour narrates the real run by itself (about 45–90 seconds), which gives you a clean segment.
- Speed up long Bob thinking segments, but show the real subagent names and timestamps.
- Do the chaos drill **between two releases** so no agent's release lands in the 6-second window.
- Never show `.env` or any key.
