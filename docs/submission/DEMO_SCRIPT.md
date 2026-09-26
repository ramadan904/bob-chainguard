# Demo video script (target 2:50, hard limit 3:00)

The core segment (0:20–1:50) is 90 seconds of the solution running with Bob visibly driving it.
Record the Bob IDE on the left and the live Signalbox panel (`npm run signalbox`) on the right.

| Time | On screen | Voice-over |
| --- | --- | --- |
| 0:00–0:10 | Signalbox panel: the headline, the wave schedule, wave 1 green, wave 2 red | "Everyone wants AI agents working in parallel. Nobody trusts them: they overwrite each other and break each other's code. Railways solved this with interlocking. This is interlocking for IBM Bob." |
| 0:10–0:22 | Desk: type **start all safe wave 1** → the dispatch appears → paste it into Bob (Agent mode) | "I ask the signal box. Only Bob can start Bob, so it hands Bob the exact dispatch: one subagent per green block." |
| 0:22–0:40 | Control tower: BOB-1, BOB-2, BOB-3 light up at once; stations shrink as Bob edits; one lane flashes amber, HELD AT SIGNAL | "Three Bob subagents, three blocks, at the same time. This one tried to jump into wave two: refused. The signal stays red until wave one clears." |
| 0:40–1:05 | Desk: type **simulate bad agent** (or click **◆ Prove safety**) → DRILL-1/2/3 enter at once → DRILL-3 goes red, `index.js` flashes, FAULT → rolled back → the other two commit → **"All changes proven. Zero collisions. Ledger verified."** | "What if an agent goes rogue? Three drill agents enter at once; the third edits outside its block and breaks an export. Caught before commit, rolled back, stray file restored, and the other two commit untouched. Zero collisions, and the ledger re-verifies in the browser." |
| 1:05–1:20 | Back to the Bob run: a Bob subagent's FAULT with the failing test → Bob fixes the code → CLEARED with its commit hash; wave 2 turns green | "The same checks run on every Bob release. Here viem silently rounds a value ethers rejected: fault, nothing committed. Bob fixes the code, not the test." |
| 1:20–1:30 | Finished map: 0 legacy calls, 6/6 blocks; the train graph's PARALLEL band at ×3 | "[blocks] blocks, [agents] Bob subagents, up to [peak] at once (read them from `reports/submission-numbers.md`). Every change proven before it was committed." |
| 1:30–2:30 *(optional)* | Deployed site: `?tour` replays the whole run; click **Ledger verified** → **Tamper test** breaks the chain at one event; flip the rule pack to Moment → date-fns | "Anyone can replay the run and verify it in their own browser. And it isn't only Web3." |
| last 10 s | Impact table | "Signalbox: parallel Bob subagents you can actually trust." |

**The 90-second cut is 0:00–1:30.** It shows Agent mode (dispatcher), subagents in parallel
(control tower), interlocking (held at signal), a rogue agent caught (safety proof) and
self-correction (fault → fix → clear).

**Say it plainly on camera:** the safety proof's DRILL agents are scripted, on a small fixture repo,
so the rogue behaviour is guaranteed and repeatable; the BOB lanes are IBM Bob. Judges trust a
demo that labels itself.

Recording tips:
- **Ready-made clips:** `docs/submission/media/proof.webm` is the 0:40–1:05 segment already
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
