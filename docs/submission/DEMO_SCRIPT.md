# Demo video script (target 2:50, hard limit 3:00)

The rules require at least 90 seconds of the solution running and a clear demonstration of Bob.
The 0:25–2:15 section below covers both.

| Time | On screen | Voice-over |
| --- | --- | --- |
| 0:00–0:25 | Legacy dApp running (connect, balance, send form). Then `reports/baseline.md` | "Most dApp frontends still run on web3.js and ethers v5. web3.js is sunset. Migrating to viem is risky, and teams postpone it. chainguard scanned our wallet dApp: 72 legacy call sites in 10 files." |
| 0:25–0:45 | Terminal: `npm run plan`, then scroll `reports/bob-task-plan.md` | "chainguard reads the import graph and writes a Bob task plan: three waves of tasks that touch disjoint files, each one a ready-made prompt." |
| 0:45–1:05 | Bob answering the onboarding prompt (speed up 4x) | "First, Bob reads the whole repo and our migration playbook and explains the code to us." |
| 1:05–1:45 | Bob running wave 2 as parallel subagents; split screen of two tasks | "Each wave runs as parallel Bob subagents. Bob edits the files and runs the tests." |
| 1:45–2:05 | A red test (e.g. parseUnits rounding), then Bob fixing it and the test turning green | "This is the dangerous part: viem silently rounds where ethers threw. Our behavior tests catch it and Bob fixes the implementation, not the test." |
| 2:05–2:20 | `npm run scan` showing 72 -> 0, `npm test` green, `npm run guard` exit 0 | "72 to zero. All 22 behavior tests pass unchanged." |
| 2:20–2:35 | Migrated dApp running: same UI, sending a Sepolia transfer | "Same app, now on viem and wagmi, [X]% smaller bundle." |
| 2:35–2:50 | Impact table from PROBLEM_SOLUTION.md | "[Manual estimate] of work done in [measured time]. And CI now blocks any new legacy code. That's bob-chainguard." |

Recording tips: use Sepolia with a faucet-funded demo wallet, hide browser extensions and
bookmarks, and never show `.env` or the wallet's seed or private key screens.
