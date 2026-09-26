# Problem & Solution Statement

<!-- Limit: 500 words. `npm run finalize` fills every {{value}} from the ledger and writes the paste-ready
     version to docs/submission/final/. Edit wording here, never the numbers. -->

## Problem

You put three AI agents on one codebase to go three times faster. By morning one has renamed a
function the other two still call, another has "fixed" a failing test by rewriting the test, and
you are looking at a 4,000-line diff nobody can review, with no record of which agent did what.
So you throw it away and go back to one agent at a time.

That is where multi-agent development stalls today. The agents are capable; what's missing is a
control layer that lets them work at once without trusting each other.

## Solution: Signalbox

**Every Bob agent at once. Nothing unproven gets in.** Signalbox is that control layer for IBM Bob,
built on railway interlocking: no train enters a section until its signal is green.

1. **Blocks and waves.** chainguard scans the code and its import graph and splits the change into
   blocks, one per subagent. Blocks in a wave share no files; a wave opens only after earlier waves clear.
2. **Signals.** A Bob subagent must claim its block before editing. The claim is refused, and
   recorded, while its wave is closed or another agent holds the files.
3. **Track circuit.** A block is released only when four checks pass:
   - **Scope:** nothing outside the block changed (otherwise a SPAD, signal passed at danger).
   - **Contract:** no export that other code still imports was removed.
   - **Legacy scan:** no old-library calls remain.
   - **Tests:** behavior tests pass on an isolated git worktree holding only cleared work plus this
     block, so parallel agents can neither cause nor hide each other's failures.
4. **One commit per block,** signed by its agent. A failing block stays uncommitted until fixed or
   rolled back; everyone else keeps working.
5. **Control tower.** Every move lands in a SHA-256 hash-chained ledger, shown live and replayable.

**The safety proof** makes the guarantee visible in one click: three agents enter three blocks at
once, one goes rogue, edits outside its block and breaks an export. It is caught before commit and
rolled back, stray file included, while the other two commit untouched. The verdict is recomputed
from the ledger in the browser: zero collisions, ledger verified, parallel agents safe.

The real test: Bob's dispatcher (Agent mode) runs parallel subagents that migrate an ERC-20 wallet
dApp from ethers v5 and web3.js to viem and wagmi: 72 legacy call sites, 6 blocks, 2 waves.

## Impact

| Metric | Result |
| --- | --- |
| Legacy call sites | {{calls_before}} → {{calls_after}} |
| Blocks cleared by Bob subagents | {{blocks}}, {{agents}} agents, up to {{peak}} in parallel |
| Faults caught before commit | {{faults}} (e.g. {{fault_example}}) |
| Refused claims / chaos drills caught | {{denied}} / {{drills}}, none reached a commit |
| Behavior tests | 22 / 22, never modified |
| Wall-clock time | {{wall_clock}} |

Swap the rule pack (Moment.js → date-fns ships too) and the same control layer protects any large parallel-agent change.
