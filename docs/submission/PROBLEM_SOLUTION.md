# Problem & Solution Statement

<!-- Limit: 500 words. `npm run finalize` fills every {{value}} from the ledger and writes the paste-ready
     version to docs/submission/final/. Edit wording here, never the numbers. -->

## Problem

Parallel AI agents are fast, and nobody trusts them. Put two on one repository and they overwrite
each other's files. One renames a function another still calls. One makes a failing test pass by
editing the test. What comes back is a single diff too large to review, with no record of which
agent changed what, or whether any one change was safe on its own.

So teams run one agent at a time, and the work that needs parallel agents most, large migrations
and upgrades, stays slow.

## Solution

Signalbox is interlocking for IBM Bob subagents: the rules railways use to run many trains on one
network without collisions.

1. **Blocks and waves.** chainguard scans the code and its import graph and splits the change into
   blocks, one per subagent. Blocks in a wave share no files; a wave depends only on earlier waves.
2. **Signals.** A subagent must claim its block before editing. The claim is refused, and recorded,
   while an earlier wave is still open or another agent holds the files.
3. **Track circuit.** A block is released only when four checks pass:
   - **Scope:** nothing outside the block was edited (otherwise it is a SPAD, a signal passed at danger).
   - **Contract:** no export that other code still imports was removed or renamed.
   - **Legacy scan:** no old-library calls remain in the block.
   - **Tests:** the behavior tests pass on an isolated git worktree holding only cleared work plus
     this block, so parallel agents can neither cause nor hide each other's failures.
4. **One commit per block.** A clear block is committed alone and signed by its agent. A failing
   block stays uncommitted until the agent fixes it or rolls back, and everyone else keeps working.
5. **Control tower.** Every move is written to a SHA-256 hash-chained ledger and shown live: one
   lane per Bob subagent, refused claims in amber, faults with the failing test. A chaos button
   makes a real stray edit; the checks catch it in milliseconds and git restores it.

The test case is an ERC-20 wallet dApp that Bob migrates from ethers v5 and web3.js (sunset in
2025) to viem and wagmi: 72 legacy call sites in 10 files, planned as 6 blocks in 2 waves.

## Impact

| Metric | Result |
| --- | --- |
| Legacy call sites | {{calls_before}} → {{calls_after}} |
| Blocks cleared by Bob subagents | {{blocks}}, {{agents}} agents, up to {{peak}} in parallel |
| Faults caught before commit | {{faults}} (e.g. {{fault_example}}) |
| Refused claims / chaos drills caught | {{denied}} / {{drills}}, none reached a commit |
| Behavior tests | 22 / 22, never modified |
| Wall-clock time | {{wall_clock}} |

Swap the rule pack (a Moment.js → date-fns pack ships too) and the same interlocking protects any large parallel-agent change.
