# Demo video script (target 2:50, hard limit 3:00)

The rules require at least 90 seconds of the solution running and a clear demonstration of Bob.
The Atlas is the stage: open it full-screen in the dark theme and keep coming back to it.

| Time | On screen | Voice-over |
| --- | --- | --- |
| 0:00–0:20 | Atlas at the baseline stop: rust stations everywhere, **72** in the masthead | "This is a real ERC-20 wallet dApp drawn as a transit map. Folders are lines, files are stations. Every rust ring is a call into web3.js or ethers v5: 72 of them in 10 files. web3.js is sunset, and teams keep putting this migration off." |
| 0:20–0:40 | Click `units.js`: call sites with source lines and viem replacements. Hover a tunnel | "chainguard found every call site and knows the viem replacement. It also reads the import graph, so it knows units.js must be migrated before the files that use it." |
| 0:40–0:55 | Scroll to the departures board, hover a wave-2 row so its stations light up | "That graph becomes Bob's timetable: six tasks in three waves. Tasks in a wave touch different files, so they run as parallel Bob subagents. Each row carries a ready-made prompt." |
| 0:55–1:10 | Bob IDE: onboarding answer, then the playbook opened as context (4x speed) | "Bob reads the whole repo and our migration playbook before it touches anything." |
| 1:10–1:40 | Bob running wave 2 as two parallel tasks (split screen) | "Wave two: two Bob subagents at once, each editing its own files and running the tests." |
| 1:40–2:00 | A red test (viem `parseUnits` rounding), then Bob fixing the implementation and the test turning green | "The dangerous part: viem silently rounds where ethers threw. Our behavior tests catch it, and Bob fixes the code, not the test." |
| 2:00–2:30 | Back to Atlas: press **play**. Stations turn from rust to steel checks, the board flips from SCHEDULED to BOARDING to ARRIVED, and 72 counts down to 0 | "Every stop on this timeline is a real commit, scanned by chainguard. Here is Bob's migration, replayed." |
| 2:30–2:50 | Terminal: `npm test` green, `npm run guard` exit 0. Then the impact table | "All 22 behavior tests pass unchanged. [Manual estimate] of work done in [measured time]. And CI now blocks any new legacy code. That's bob-chainguard." |

Recording tips:
- Record the Atlas at 1440×900 or larger.
- Use Sepolia with a faucet-funded demo wallet, and hide browser extensions and bookmarks.
- Never show `.env` or the wallet's seed or private key screens.
