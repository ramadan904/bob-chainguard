# IBM Bob Usage Statement

<!-- Limit: 500 words. `npm run finalize` fills every {{value}} from the ledger and bob_sessions/ and writes the
     paste-ready version to docs/submission/final/. Edit wording here, never the numbers. -->

Bob isn't a helper in this project; Bob is the workforce. Every change to `legacy-dapp/src`
between tag `before-bob` and the final commit was made by a Bob subagent inside a signal-box
block. The ledger (`.signalbox/ledger.jsonl`) records who changed what and which checks it passed.
We built the harness: the chainguard scanner and planner, Signalbox interlocking, the behavior
tests and the live panel.

## How Bob's capabilities are used

| Bob capability | Where it does the work | Evidence |
| --- | --- | --- |
| **Full repository context + document understanding** | Onboarding: Bob reads the README, the migration playbook and the baseline report, walks lib → hooks → components and names the riskiest parts. Every subagent works from the playbook's mapping and traps tables. | {{shots_onboarding}} |
| **Agent mode, multi-step orchestration** | A **dispatcher** Bob agent loops: reads `sb status`, starts subagents for every block whose signal is CLEAR, waits for the wave, handles faults, summarizes the log, and moves to the next wave. | {{shots_dispatcher}} |
| **Subagents + parallel tasks** | One subagent per block, and the blocks of a wave run at the same time: {{agents}} subagents, up to {{peak}} in parallel, on disjoint files guaranteed by the signal box. | ledger: `claim` events with overlapping times |
| **Agent mode, terminal + edits** | Each subagent runs the protocol itself: `claim` → edit → `release` (isolated tests) → fix and release again, or `rollback`. | {{shots_subagents}}, commits tagged `Signalbox-Agent: bob-N` |
| **Tool use (MCP)** | Bob's agents call the signal box as MCP tools (`signalbox_claim`, `signalbox_release`, `signalbox_ask`); a fault returns as a tool error naming every failing check. | {{shots_mcp}} |
| **Self-correction** | {{faults}} faults caught before commit and fixed by Bob, e.g. {{fault_example}}. Bob fixed the implementation, never the test. | `verify` events with `ok: false`, then `clear` |
| **Code review** | Bob reviews `before-bob..HEAD` using the ledger to see which agent changed which block. | {{shots_review}} |

## Why this showcases Bob

Parallel agents are only useful if they're safe. The signal box turns Bob's subagents from "several
chats editing the same repo" into a coordinated crew:
- Every agent has an exclusive block and a green signal before it starts.
- Every change passes an independent track circuit before it's committed.
- Every failure stays contained to one block.

The dispatcher is itself a Bob agent, so the planning, coordination and recovery are Bob's
multi-step reasoning, not a script.

## Results

- Legacy call sites: {{calls_before}} → {{calls_after}}. Blocks: {{blocks}} cleared in {{waves}} waves.
- Faults caught before commit: {{faults}}. Claims refused at signal: {{denied}}. Chaos drills caught: {{drills}}. Tests: {{tests}}.
- Wall clock: {{wall_clock}}.
- Bobcoins used: {{bobcoins}}.

## watsonx

Not used.
