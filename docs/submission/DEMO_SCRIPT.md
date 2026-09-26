# Demo video script (target 2:50, hard limit 3:00)

The story in one line: **Every Bob agent at once. Nothing unproven gets in.** The first 90 seconds
go from the human pain to the proof. Record the Bob IDE on the left and the live Signalbox panel
(`npm run signalbox`) on the right for the Bob segments.

| Time | On screen | Voice-over |
| --- | --- | --- |
| 0:00–0:08 | Black screen, then a terminal scrolling a huge `git diff` (4,000+ lines) | "You put three AI agents on one codebase to go three times faster." |
| 0:08–0:16 | The diff keeps scrolling; cut to a red test run | "By morning, one renamed a function the other two still call. One 'fixed' a failing test by rewriting the test. Nobody can review this. So you throw it away, and go back to one agent at a time." |
| 0:16–0:25 | Signalbox panel: **"Every Bob agent at once. Nothing unproven gets in."**, the wave schedule, the Control Tower | "Railways solved many trains on one track a century ago: no train enters a section until its signal is green. Signalbox is that signal box, for IBM Bob." |
| 0:25–0:38 | **IBM Bob run** tab: BOB-1, BOB-2, BOB-3 working at once (time-lapse); one lane amber, HELD AT SIGNAL | "Here, IBM Bob's subagents migrate a real dApp in parallel. Each owns a block. One tried to jump ahead: refused." |
| 0:38–0:44 | Desk: type **simulate bad agent** | "Now the hard question: what happens when an agent goes rogue?" |
| 0:44–0:52 | DRILL-1, DRILL-2, DRILL-3 enter three blocks at the same instant | "Three agents. Three blocks. Same instant." |
| **0:52–1:03** | DRILL-3 edits outside its block and breaks an export → 3 s red alarm, `index.js` flares, FAULT | "The third one touches a file it doesn't own and breaks something the others depend on. Caught before it can commit." |
| **1:03–1:12** | **ROLLED BACK** stamps across the map; the other two lanes pass all four checks and commit | "Rolled back. The stray file restored. The other two never noticed." |
| **1:12–1:24** | The finale: three signals turn green, **"Parallel agents safe."**, badges *Ledger verified · 0 collisions · 1 caught*. Hold. | *(let it land for two beats)* "Zero collisions. Every change proven. The ledger re-verified in your browser." |
| 1:24–1:30 | **Back to the IBM Bob run**; the side-by-side table: same rows, same engine | "Same signal box Bob ran under. Every Bob agent at once. Nothing unproven gets in." |
| 1:30–2:30 *(optional)* | `?tour` replay of the Bob run; **Ledger verified** → **Tamper test**; rule pack → Moment | "Anyone can replay the run and verify it. And it isn't only Web3." |

**The 90-second cut is 0:00–1:30.** Pain (0:00–0:16) → the idea (0:16–0:25) → Bob in parallel
(0:25–0:38) → the rogue agent (0:38–1:12) → the release (1:12–1:24) → the promise (1:24–1:30).
Don't rush the finale: two seconds of silence on "Parallel agents safe." is the moment judges remember.
The ready clip `docs/submission/media/proof.webm` covers 0:44–1:24.

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
