# Demo video script (target 2:50, hard limit 3:00)

The core segment (0:20–1:50) is 90 seconds of the solution running with Bob visibly driving it.
Record the Bob IDE on the left and the live Signalbox panel (`npm run signalbox`) on the right.

| Time | On screen | Voice-over |
| --- | --- | --- |
| 0:00–0:10 | Signalbox panel: the headline, the wave schedule, the Control Tower switch **IBM Bob run · ◆ Safety proof** | "Everyone wants AI agents working in parallel. Nobody trusts them: they overwrite each other and break each other's code. Signalbox is railway interlocking for IBM Bob subagents." |
| 0:10–0:25 | **IBM Bob run** tab: BOB-1, BOB-2, BOB-3 lanes working at once (time-lapse of your recording), one lane amber HELD AT SIGNAL | "These are IBM Bob subagents migrating a real dApp in parallel. Each owns a block; one tried to jump ahead and was held at the signal." |
| 0:25–0:32 | Desk: type **simulate bad agent** (or click the **◆ Safety proof** tab) | "But what happens when an agent goes rogue? Watch." |
| 0:32–0:45 | DRILL-1, DRILL-2, DRILL-3 enter three blocks at the same moment | "Three agents, three blocks, the same instant." |
| **0:45–0:58** | **The peak:** DRILL-3 edits outside its block and breaks an export → the screen pulses red for 3 s, `index.js` flares, FAULT | "The third one edits a file it doesn't own and breaks an export someone else uses. Caught before it can commit." |
| **0:58–1:08** | **ROLLED BACK** stamps across the map; the other two lanes release and commit | "Rolled back, stray file restored. The other two never noticed: they pass all four checks and commit." |
| **1:08–1:20** | Full-screen verdict line by line: **All changes proven. Zero collisions. Ledger verified. Parallel agents safe.** Hold on the ledger head. | "Zero collisions, and the ledger is re-verified right here in the browser." |
| 1:20–1:30 | Click **Back to the IBM Bob run** → finished map, 0 legacy calls, 6/6 blocks | "That is the same signal box Bob ran under. This is how multiple Bob subagents work safely on one codebase." |
| 1:30–2:30 *(optional)* | `?tour` replay of the Bob run; **Ledger verified** → **Tamper test**; rule pack → Moment | "Anyone can replay the run and verify it. And it isn't only Web3." |
| last 10 s | Impact table | "Signalbox: parallel Bob subagents you can actually trust." |

**The 90-second cut is 0:00–1:30, and its centre is 0:32–1:20:** rogue agent → red alarm →
ROLLED BACK → the other two commit → the full-screen verdict. The ready clip
`docs/submission/media/proof.webm` is exactly that segment.

**Say it plainly on camera:** the DRILL agents are scripted, on a small fixture repo, so the rogue
behaviour is guaranteed and repeatable; the BOB lanes are IBM Bob. Judges trust a demo that labels
itself.

Recording tips:
- **Ready-made clips:** `docs/submission/media/proof.webm` is the 0:25–1:20 segment already
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
