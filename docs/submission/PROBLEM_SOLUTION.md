# Problem & Solution Statement

<!-- Limit: 500 words. `npm run finalize` fills every {{value}} from the ledger and writes the paste-ready
     version to docs/submission/final/. Edit wording here, never the numbers. -->

## Problem

AI agents can now change code in parallel, and every team that tries it hits the same wall.
Two agents edit the same file. One agent quietly renames a function another agent's code depends
on. A third "fixes" a failing test by changing the test. The result is one huge diff nobody can review.

So teams fall back to one agent at a time, and large migrations stay slow, exactly where
parallel agents should help most.

## Solution: Signalbox, interlocking for parallel Bob subagents

Railways solved "many trains, one network" with **interlocking**. Signalbox applies it to IBM Bob
subagents working on one repository:

1. **Blocks.** chainguard scans the repo and reads the import graph. It splits the change into
   blocks (one per subagent task) and orders them into waves, so no block depends on a block in
   its own or a later wave.
2. **Signals.** A Bob subagent must `claim` its block. The signal box refuses the claim while an
   earlier wave is uncleared or another agent holds the files. Only one train per block.
3. **Track circuit.** An agent can only `release` its block when four checks pass:
   - scope: no edits outside any block, otherwise it's flagged as a SPAD ("signal passed at danger")
   - exported contract: nothing other code imports was removed or renamed
   - legacy scan: no old-library calls left in the block
   - behavior tests: run on an **isolated git worktree** holding only cleared work plus this block,
     so parallel agents can neither cause nor mask each other's failures
4. **Commit or roll back.** A clear block is committed on its own and tagged with its agent. A
   faulty block stays uncommitted until the agent fixes it or rolls it back, and the other agents
   keep working.
5. **Live control tower.** Every step lands in a hash-chained ledger, streamed to a transit-map
   panel: one lane per Bob subagent, refused claims flash amber, faults show the failing test. A
   chaos button makes a real stray edit; the checks catch it in milliseconds and git restores it.

We proved it on a real ERC-20 wallet dApp: Bob migrates it from ethers v5 + web3.js (web3.js was
sunset in 2025) to viem/wagmi. That's 72 legacy call sites in 10 files, split into 6 blocks in 2 waves.

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
