# IBM Bob Usage Statement

> **Timing note:** the IBM Bob run reported here was recorded on 27–28 Sep 2026, after the IBM Bob 2.0
> Hackathon submission deadline (27 Sep, 15:00 UTC). The version submitted before the deadline is kept
> unchanged in `LONG_DESCRIPTION.txt` and `IBM_BOB_USAGE.txt` in this folder.


**Every agent finished. The build didn't.** Bob can run several subagents in parallel; the hard part
is trusting what they do together: one agent's change breaking another's, a test "fixed" by editing
it, a diff nobody can review.
Signalbox is the control layer that makes Bob's parallelism safe to use on one codebase.

Here Bob isn't a helper; Bob is the workforce. Every change to `legacy-dapp/src` between tag
`before-bob` and the final commit was made by Bob: the expand step in one Bob session, then the whole
migration by Bob subagents inside signal-box blocks, and the
hash-chained ledger (`.signalbox/ledger.jsonl`) records who changed what and which checks it passed.
We built the harness: the scanner and planner, the interlocking, the behavior tests and the panel.

## How Bob's capabilities are used

| Bob capability | Where it does the work | Evidence |
| --- | --- | --- |
| **Full repository context + document understanding** | Onboarding: Bob reads the README, playbook and baseline report, walks lib → hooks → components and names the riskiest parts. Every subagent works from the playbook's mapping and traps. | `bob_sessions/ramadan-onboarding.png` |
| **Agent mode, multi-step orchestration** | A **dispatcher** Bob agent reads the signal box, starts a subagent for every CLEAR block, handles faults and moves wave by wave. | `.signalbox/ledger.jsonl`: the dispatcher's refused wave-2 claim, then 6 claims |
| **Subagents + parallel tasks** | One subagent per block, a whole wave at once: 6 subagents, up to 3 in parallel, on files the signal box keeps disjoint. | ledger: `claim` events with overlapping times |
| **Agent mode, terminal + edits** | Each subagent runs the protocol itself: `claim` → edit → `release` (isolated tests) → fix and release again, or `rollback`. | 6 commits `signalbox: clear <block>`, tagged `Signalbox-Agent: bob-1` … `bob-6` |
| **Self-verification** | Every block passed scope, contract, legacy scan and the 22 behavior tests on an isolated worktree before its commit; no fault occurred in this run, so no fix-and-retry was needed. Tests were never modified. | `verify` events, all `ok: true` |

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

- Legacy call sites: 72 → 0. Blocks: 6/6 cleared in 2 waves.
- Faults caught before commit: 0. Claims refused at signal: 1. Chaos drills caught: 0. Tests: passed, unmodified.
- Bob's parallel run: 4 min 17 s from the first claim to the last clear (00:07–00:11 UTC, 28 Sep).
- Bob's cost: about 5.1 Bobcoins for all three sessions (onboarding 0.46, expand 1.17, dispatcher run 3.47).

## watsonx

Not used.
