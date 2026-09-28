# Signalbox report

Generated from `.signalbox/ledger.jsonl`. Every number below is computed from recorded events.

| Metric | Value |
| --- | --- |
| Blocks cleared | 6 / 6 in 2 waves |
| Bob subagents | 6 (bob-2, bob-3, bob-1, bob-5, bob-6, bob-4) |
| Peak blocks occupied at once | 3 |
| Claims / refused at signal | 6 / 1 |
| Track circuit runs / faults caught before commit | 8 / 0 |
| Faults by check | scope 0 · contract 0 · legacy scan 0 · tests 0 |
| SPADs (edits outside any block) | 0 |
| Rollbacks | 0 |
| Blocks cleared on the first release | 4 / 6 |
| Wall clock, box opened to last clear | 4 h 23 min |
| Agent time in blocks (sum) | 5 min 31 s |

## Blocks

| Wave | Block | Agent(s) | Releases | Outcome | Commit |
| --- | --- | --- | --- | --- | --- |
| 1 | w1-hooks | bob-3 | 2 | cleared | `c8264c5` |
| 1 | w1-lib-1 | bob-1 | 1 | cleared | `8a041a2` |
| 1 | w1-lib-2 | bob-2 | 2 | cleared | `fc38ec6` |
| 2 | w2-components | bob-6 | 1 | cleared | `8d9889c` |
| 2 | w2-hooks | bob-5 | 1 | cleared | `7125ffa` |
| 2 | w2-lib | bob-4 | 1 | cleared | `e3fa6b9` |

## Faults caught

