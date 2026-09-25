# IBM Bob Usage Statement

<!-- Limit: 500 words. Fill the [bracketed] parts from the ledger (`npm run -s sb -- log`) and bob_sessions/. -->

Bob isn't a helper in this project; Bob is the workforce. Every change to `legacy-dapp/src`
between tag `before-bob` and the final commit was made by a Bob subagent inside a signal-box
block. The ledger (`.signalbox/ledger.jsonl`) records who changed what and which checks it passed.
We built the harness: the chainguard scanner and planner, Signalbox interlocking, the behavior
tests and the live panel.

## How Bob's capabilities are used

| Bob capability | Where it does the work | Evidence |
| --- | --- | --- |
| **Full repository context + document understanding** | Onboarding: Bob reads the README, the migration playbook and the baseline report, walks lib → hooks → components and names the riskiest parts. Every subagent works from the playbook's mapping and traps tables. | `bob_sessions/[member]-onboarding.png` |
| **Agent mode, multi-step orchestration** | A **dispatcher** Bob agent loops: reads `sb status`, starts subagents for every block whose signal is CLEAR, waits for the wave, handles faults, summarizes the log, and moves to the next wave. | `bob_sessions/[member]-dispatcher.png` |
| **Subagents + parallel tasks** | One subagent per block, and the blocks of a wave run at the same time: [N] subagents, up to [N] in parallel, on disjoint files guaranteed by the signal box. | ledger: `claim` events with overlapping times |
| **Agent mode, terminal + edits** | Each subagent runs the protocol itself: `claim` → edit → `release` (isolated tests) → fix and release again, or `rollback`. | `bob_sessions/[member]-[block].png`, commits tagged `Signalbox-Agent: bob-N` |
| **Self-correction** | [N] faults caught and fixed by Bob before commit, e.g. [block]: viem `parseUnits` rounded instead of throwing; the test failed, and Bob fixed the implementation, not the test. | `verify` events with `ok: false`, then `clear` |
| **Code review** | Bob reviews `before-bob..HEAD` using the ledger to see which agent changed which block. | `bob_sessions/[member]-review.png` |

## Why this showcases Bob

Parallel agents are only useful if they're safe. The signal box turns Bob's subagents from "several
chats editing the same repo" into a coordinated crew:
- Every agent has an exclusive block and a green signal before it starts.
- Every change passes an independent track circuit before it's committed.
- Every failure stays contained to one block.

The dispatcher is itself a Bob agent, so the planning, coordination and recovery are Bob's
multi-step reasoning, not a script.

## Results

- Legacy call sites: 72 → [0]. Blocks: [6/6] cleared in [3] waves.
- Faults caught before commit: [N]. SPADs: [N]. Rollbacks: [N]. Tests: 22/22, unmodified.
- Wall clock: [X min]. Bobcoins: [N].

## watsonx

Not used.
