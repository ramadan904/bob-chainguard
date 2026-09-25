# Problem & Solution Statement

<!-- Limit: 500 words. Replace every [bracketed] value with the real number from reports/ before submitting. -->

## Problem

Thousands of Ethereum dApp frontends still run on **web3.js 1.x** and **ethers v5**. ChainSafe
sunset web3.js in March 2025, and ethers v5 was superseded by v6. The ecosystem has moved to
**viem + wagmi**. Teams know they need to migrate, and they keep postponing it because:

- **It touches everything.** Providers, signers, contracts, events, unit math and error handling
  all change at once. `BigNumber` becomes native `bigint`, event callbacks become log batches,
  and sync helpers become async.
- **Silent behavior changes.** Some translations look right and are wrong. For example, viem's
  `parseUnits('0.0000001', 6)` returns `0n` where ethers threw an error, so a user could submit
  a zero-value transfer without noticing.
- **Progress is hard to measure or protect.** Nobody knows how much legacy code is left, and
  new legacy calls slip back in through copy-pasted snippets.

A manual migration of even a small dApp takes days of focused senior time, and the risk is
highest exactly where the money moves.

## Solution: bob-chainguard

bob-chainguard turns that migration into a measured, parallel, test-guarded workflow run by
**IBM Bob 2.0**:

1. **Measure.** `chainguard` is a zero-dependency scanner with 25 rules for ethers v5 and web3.js
   APIs. On our sample ERC-20 wallet dApp it found **72 legacy call sites in 10 of 18 files**
   (`reports/baseline.md`).
2. **Plan.** chainguard reads the import graph and generates a **Bob task plan**: waves of tasks
   that touch disjoint files, where each wave only depends on earlier ones. Each task is a
   ready-made prompt for a Bob subagent, so independent modules migrate **in parallel**.
3. **Migrate with Bob.** Bob reads the repo and our migration playbook (document
   understanding), then runs each wave in Agent mode. It edits the files and runs the tests, and
   when a test fails it fixes the implementation, not the test.
4. **Verify.** 22 behavior tests act as the contract. They were written against the legacy code
   and never modified, so a pass means the behavior was preserved, not just that the code compiles.
5. **Guard.** Once the scan reaches zero, CI switches to `npm run guard`, and any new ethers or
   web3.js call fails the pull request.

## Impact

| Metric | Before | After Bob |
| --- | --- | --- |
| Legacy call sites | 72 | [0] |
| Files on legacy APIs | 10 / 18 | [0 / N] |
| Behavior tests passing | 22 / 22 | [22 / 22] |
| Migration time | [manual estimate, e.g. ~2 days] | [measured, e.g. X h Y min] |
| Bundle size (gzip) | [550 kB] | [after] |
| Silent-bug traps caught by tests | n/a | [N] |

The same workflow applies to any legacy-to-modern library migration. Swap the rule set and the
playbook, and chainguard plus Bob handle a large, risky upgrade as a measured sequence of
parallel, verified steps.
