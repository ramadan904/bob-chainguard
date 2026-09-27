# IBM Bob Usage Statement

**Every agent finished. The build didn't.** Bob can run several subagents in parallel; the hard part
is trusting what they do together: one agent's change breaking another's, a test "fixed" by editing
it, a diff nobody can review. We built
Signalbox as the control layer that makes Bob's parallelism safe on one codebase, and designed every
part of it around Bob's capabilities.

## How Signalbox is built for Bob

| Bob capability | How Signalbox uses it |
| --- | --- |
| **Agent mode, multi-step orchestration** | A generated **dispatcher** prompt turns one Bob agent into the conductor: it reads the signal box, starts a subagent for every green block, handles faults and moves wave by wave. |
| **Subagents + parallel tasks** | The planner splits a change into blocks that share no files, so a whole wave of Bob subagents can work at once. Each gets its own prompt with the claim → edit → release protocol. |
| **Tool use (MCP)** | `signalbox mcp` exposes the signal box as MCP tools (`signalbox_claim`, `signalbox_release`, `signalbox_ask`, …). A fault comes back as a tool error naming every failing check, so Bob can fix and retry. |
| **Document understanding** | Each subagent prompt points Bob at the migration playbook and lists the traps its files hit (e.g. viem's `parseUnits` silently rounding, async `recoverMessageAddress`). |
| **Self-correction** | Release runs four checks on an isolated copy; Bob gets the failing test, never the chance to edit it (tests are protected). |
| **Code review** | The ledger records which agent changed which block, so a Bob reviewer can audit the whole run. |

## Why this matters for Bob

The signal box gives Bob's parallel subagents guarantees:
- every agent has an exclusive block and a green signal before it starts;
- every change passes an independent track circuit before it is committed;
- every failure stays contained to one block.

## What we proved

The **safety proof** runs the same engine with three agents at once, one of them rogue. In the
recorded run the rogue's out-of-block edit and contract break were caught before commit and rolled
back, the other two blocks committed alone, and the ledger showed **zero collisions**. Those agents
are scripted so the misbehaviour is guaranteed; they exercise exactly the checks a Bob subagent faces.

Also shipped for Bob: `npm run bob:prep` / `bob:open` / `bob:retake` to set up, open and retake a
Bob run, and a runbook with the exact prompts.

## Honest status

We did not complete the recorded end-to-end migration of the demo dApp by IBM Bob before the
deadline, so this statement reports no Bob-run numbers. Everything above is built, tested (93 tests,
Linux and Windows) and live at https://bob-chainguard.vercel.app/.

## watsonx

Not used.
