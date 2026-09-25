# Demo video script (target 2:50, hard limit 3:00)

The core segment (0:20–1:50) is 90 seconds of the solution running with Bob visibly driving it.
Record the Bob IDE on the left and the live Signalbox panel (`npm run signalbox`) on the right.

| Time | On screen | Voice-over |
| --- | --- | --- |
| 0:00–0:15 | Signalbox panel: wave 1 green, wave 2 at danger, the map full of rust stations, control tower waiting | "Everyone wants AI agents working in parallel. Nobody trusts them to: they overwrite each other and break each other's code. Railways solved this 150 years ago with interlocking. This is interlocking for IBM Bob." |
| 0:15–0:30 | Dispatcher desk: type "Start all green wave-1 blocks" → the dispatch appears → paste it into Bob Agent mode | "I ask the signal box in plain words. It answers from the ledger and writes the dispatch. Bob's dispatcher agent starts one subagent per green block, all in parallel." |
| 0:30–0:45 | Control tower: BOB-1, BOB-2, BOB-3 lanes light up; map stations get agent tags and shrink live as Bob edits | "Three Bob subagents, three blocks, at the same time. Each one claims its files. Nobody else can touch them." |
| 0:45–0:55 | A fourth lane flashes amber, HELD AT SIGNAL; amber pulse on the wave-2 station | "This one tried to jump ahead into wave two. Interlocking refused it: the signal stays red until wave one clears." |
| 0:55–1:15 | Click **⚡ Simulate chaos: SPAD** → screen flashes red, CHAOS DRILL banner, "caught in 8 ms", station blinks; 6 s later "restored from git" | "Now chaos. A stray edit hits a file no agent owns. Caught in eight milliseconds, every release is locked, and six seconds later it's restored from git. Nobody's work was touched." |
| 1:15–1:35 | A subagent's release → red FAULT lane + banner with the failing test → Bob fixes the code → CLEARED, commit hash on the board | "Every release runs four checks on an isolated copy. Here viem silently rounds a value ethers rejected. Fault caught, nothing committed. Bob fixes the code, not the test, and the block commits on its own." |
| 1:35–1:50 | Wave 1 cleared → wave-2 signals turn green; desk: "Show the riskiest remaining block" | "When a wave clears, the next signals turn green. The desk tells us the riskiest block left, and why." |
| 1:50–2:20 | Time-lapse (4–8x) of wave 2; then the finished map: 0 legacy calls, 6/6 blocks | "Six blocks, two waves, [N] Bob subagents, up to [P] at once. [F] faults caught before they ever reached a commit." |
| 2:20–2:40 | Deployed site with `?tour`: guided replay, the chaos drill and the fault replayed, "Ledger verified" badge | "Every event, including the chaos drill, is in a hash-chained ledger. Anyone can replay the run and verify nothing was tampered with." |
| 2:40–2:50 | Impact table | "Signalbox: parallel Bob subagents you can actually trust." |

**The 90-second cut** (if judges only watch the core): 0:15–1:35 above. It shows Agent mode
(dispatcher), subagents in parallel (control tower), interlocking (held at signal), safety (chaos
drill) and self-correction (fault → fix → clear).

Recording tips:
- Short on time? Open `https://ramadan904.github.io/bob-chainguard/?tour` after `npm run finalize` and a
  merge. The tour narrates the real run by itself (about 45–90 seconds), which gives you a clean segment.
- Speed up long Bob thinking segments, but show the real subagent names and timestamps.
- Do the chaos drill **between two releases** so no agent's release lands in the 6-second window.
- Never show `.env` or any key.
