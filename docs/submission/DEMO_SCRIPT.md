# Demo video script (target 2:50, hard limit 3:00)

The core segment (0:20–1:50) is 90 seconds of the solution running with Bob visibly driving it.
Record the Bob IDE on the left and the live Signalbox panel (`npm run signalbox`) on the right.

| Time | On screen | Voice-over |
| --- | --- | --- |
| 0:00–0:20 | Signalbox panel, all signals at danger except wave 1; the map full of rust stations | "Everyone wants AI agents working in parallel. Nobody trusts them to: they overwrite each other, break each other's code and hand you one giant diff. Railways solved this over 150 years ago with interlocking. This is interlocking for IBM Bob." |
| 0:20–0:35 | Bob dispatcher prompt running; it reads `sb status` and starts two subagents | "One Bob agent is the dispatcher. It reads the signal box and starts a subagent for every block with a green signal. Wave one: two subagents in parallel." |
| 0:35–0:55 | Panel: two blocks turn amber, BOB-1 and BOB-2 tags, stations shrink live as Bob edits | "Each subagent claims its block. Nobody else can touch those files. As Bob edits, the map updates live." |
| 0:55–1:15 | bob-2 releases → track circuit → red FAULT banner with the failing test; describer line in red | "Before a block is released, the signal box runs the tests on an isolated copy with only that block's changes. Here viem silently rounds a value that ethers rejected. Fault caught, nothing committed, and bob-1 kept working." |
| 1:15–1:30 | Bob fixes the implementation; release → CLEARED, commit hash on the board | "Bob reads the failure and fixes the code, not the test. The block clears and is committed on its own, signed by its agent." |
| 1:30–1:50 | Wave 1 cleared → wave 2 signals turn green automatically; a third agent held at signal earlier shows in the describer | "When a wave clears, the next signals turn green. An agent that tried to jump ahead was held at the signal." |
| 1:50–2:20 | Time-lapse (4–8x) of waves 2 and 3; then the finished map: 0 legacy calls, 6/6 blocks | "Six blocks, three waves, [N] Bob subagents. [N] faults caught before they ever reached a commit." |
| 2:20–2:40 | Deployed site: press play to replay the ledger | "Every event is in a ledger. The deployed site replays the real run, so reviewers can see what happened and why it was safe." |
| 2:40–2:50 | Impact table | "Signalbox: parallel Bob subagents you can actually trust." |

Recording tips:
- Speed up long Bob thinking segments, but show the real subagent names and timestamps.
- Never show `.env` or any key.
