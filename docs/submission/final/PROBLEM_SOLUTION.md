# Problem & Solution Statement

## Problem

You put three AI agents on one codebase to go three times faster. By morning one has renamed a
function the other two still call, another has "fixed" a failing test by rewriting the test, and
you are looking at a 4,000-line diff nobody can review, with no record of which agent did what.
So you throw it away and go back to one agent at a time.

The agents are capable; what's missing is a control layer that lets them work at once without
trusting each other.

## Solution: Signalbox

**Every Bob agent at once. Nothing unproven gets in.** Signalbox is that control layer for IBM Bob
subagents, built on railway interlocking: no train enters a section until its signal is green.

1. **Blocks and waves.** chainguard scans the code and its import graph and splits a change into
   blocks, one per subagent. Blocks in a wave share no files; a wave opens only after earlier waves clear.
2. **Signals.** An agent must claim its block before editing. The claim is refused, and recorded,
   while its wave is closed or another agent holds the files.
3. **Track circuit.** A block is released only when four checks pass: scope (nothing outside the
   block changed), exported contract (nothing others import was removed), legacy scan, and behavior
   tests on an isolated git worktree, so parallel agents can neither cause nor hide each other's failures.
4. **One commit per block,** signed by its agent. A failing block stays uncommitted until fixed or
   rolled back; everyone else keeps working.
5. **Control tower.** Every move lands in a SHA-256 hash-chained ledger, shown live and replayable.

## The safety proof

One click: three agents enter three blocks at once, as separate processes on the real engine. One
goes rogue, editing outside its block and renaming an export another file imports. Recorded run:

| Result | Value |
| --- | --- |
| Agents at once | 3 |
| Rogue changes caught before commit | 1 (scope + contract) |
| Stray file restored on rollback | src/index.js |
| Blocks cleared and committed alone | 2 |
| Collisions | 0 |
| Ledger | 10 SHA-256 chained events, re-verified in the browser and audited against git |

The proof agents are scripted so the rogue behaviour is guaranteed and repeatable.

## Built and verified

- 93 automated tests pass on Linux and Windows in CI, including the safety proof end to end.
- A second rule pack (Moment.js → date-fns) runs the full protocol in CI.
- Bob-ready: an MCP server exposes claim / release / ask as native tools, and every block gets a
  generated subagent prompt with the protocol and the known migration traps.
- The target migration is planned: an ERC-20 wallet dApp on ethers v5 + web3.js → viem + wagmi,
  72 legacy call sites in 10 of 18 files, 6 blocks in 2 waves, 22 behavior tests.

**Honest status:** the recorded end-to-end migration by IBM Bob was not completed before the
deadline, so we report no Bob numbers. Every number above comes from a real run of the system.
