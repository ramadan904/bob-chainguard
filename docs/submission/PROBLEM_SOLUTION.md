# Problem & Solution Statement

<!-- Limit: 500 words. Replace every [bracketed] value with the real number from the ledger before submitting. -->

## Problem

AI agents can now change code in parallel, and every team that tries it hits the same wall.
Two agents edit the same file. One agent quietly renames a function another agent's code depends
on. A third "fixes" a failing test by changing the test. The result is one huge diff that nobody
can review, with no record of which agent did what or whether any single change was safe on its own.

So teams fall back to one agent at a time. Large, risky changes such as migrations, upgrades and
API renames stay slow, exactly where parallel agents should help most.

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
5. **Live panel.** Every step is appended to a ledger and streamed to a transit-map signal box:
   blocks light up as agents enter, files shrink as Bob edits, faults flash with the failing test.

We proved it on a real ERC-20 wallet dApp: Bob migrates it from ethers v5 + web3.js (web3.js was
sunset in 2025) to viem/wagmi. That's 72 legacy call sites in 10 files, split into 6 blocks in 3 waves.

## Impact

| Metric | Result |
| --- | --- |
| Legacy call sites | 72 → [0] |
| Blocks cleared by Bob subagents | [6 / 6], [N] agents, up to [N] in parallel |
| Faults caught before commit | [N] (e.g. viem `parseUnits` silently rounding where ethers threw) |
| SPADs and rollbacks | [N] / [N], none reached a commit |
| Behavior tests | 22 / 22, never modified |
| Wall-clock time | [X min] vs [manual estimate] |

Swap the rule set and playbook, and the same interlocking protects any large parallel-agent change.
