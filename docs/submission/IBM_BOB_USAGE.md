# IBM Bob Usage Statement

<!-- Limit: 500 words. `npm run finalize` fills every {{value}} from the ledger and bob_sessions/ and writes the
     paste-ready version to docs/submission/final/. Edit wording here, never the numbers. -->

**Every agent finished. The build didn't.** Bob can run several subagents in parallel; the hard part
is trusting what they do together: one agent's change breaking another's, a test "fixed" by editing
it, a diff nobody can review.
Signalbox is the control layer that makes Bob's parallelism safe to use on one codebase.

Here Bob isn't a helper; Bob is the workforce. Every change to `legacy-dapp/src` between tag
`before-bob` and the final commit was made by a Bob subagent inside a signal-box block, and the
hash-chained ledger (`.signalbox/ledger.jsonl`) records who changed what and which checks it passed.
We built the harness: the scanner and planner, the interlocking, the behavior tests and the panel.

## How Bob's capabilities are used

| Bob capability | Where it does the work | Evidence |
| --- | --- | --- |
| **Full repository context + document understanding** | Onboarding: Bob reads the README, playbook and baseline report, walks lib → hooks → components and names the riskiest parts. Every subagent works from the playbook's mapping and traps. | {{shots_onboarding}} |
| **Agent mode, multi-step orchestration** | A **dispatcher** Bob agent reads the signal box, starts a subagent for every CLEAR block, handles faults and moves wave by wave. | {{shots_dispatcher}} |
| **Subagents + parallel tasks** | One subagent per block, a whole wave at once: {{agents}} subagents, up to {{peak}} in parallel, on files the signal box keeps disjoint. | ledger: `claim` events with overlapping times |
| **Agent mode, terminal + edits** | Each subagent runs the protocol itself: `claim` → edit → `release` (isolated tests) → fix and release again, or `rollback`. | {{shots_subagents}}, commits tagged `Signalbox-Agent: bob-N` |
| **Tool use (MCP)** | Bob's agents call the signal box as MCP tools (`signalbox_claim`, `signalbox_release`, `signalbox_ask`); a fault returns as a tool error naming every failing check. | {{shots_mcp}} |
| **Self-correction** | {{faults}} faults caught before commit and fixed by Bob, e.g. {{fault_example}}. Bob fixed the implementation, never the test. | `verify` events with `ok: false`, then `clear` |
| **Code review** | Bob reviews `before-bob..HEAD` using the ledger to see which agent changed which block. | {{shots_review}} |

## Why this showcases Bob

The signal box gives Bob's parallel subagents guarantees:
- Every agent has an exclusive block and a green signal before it starts.
- Every change passes an independent track circuit before it's committed.
- Every failure stays contained to one block.

The dispatcher is itself a Bob agent: planning, coordination and recovery are Bob's reasoning.

The **safety proof** stress-tests the same signal box: three agents at once, one rogue, caught
before commit and rolled back while the others commit. Its agents are scripted so the rogue is
guaranteed; Bob's subagents face the same checks.

## Results

- Legacy call sites: {{calls_before}} → {{calls_after}}. Blocks: {{blocks}} cleared in {{waves}} waves.
- Faults caught before commit: {{faults}}. Claims refused at signal: {{denied}}. Chaos drills caught: {{drills}}. Tests: {{tests}}.
- Wall clock: {{wall_clock}}.
- Bobcoins used: {{bobcoins}}.

## watsonx

Not used.
