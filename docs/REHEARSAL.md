# Rehearsal log (Sep 25): the full run, played by hand on a throwaway clone

Before the real Bob run, the whole runbook was rehearsed on a disposable clone, with a person
playing six subagents. It checks the tooling, not Bob. The migrated code was thrown away: in this
repository, the migration is done by Bob. The rehearsal only exists to make sure Bob's run can't
jam on the tooling.

| Step | Result |
| --- | --- |
| Expand commit (viem, wagmi, `lib/viem.js`, `wagmi.js`, providers) | tests 22/22, build ok |
| `sb init` / `install-hook` / `doctor` | 6 blocks in 2 waves; doctor all ok |
| Wave 1: bob-1, bob-2, bob-3 in parallel; a wave-2 claim refused at signal | 3 blocks occupied at once |
| bob-2's first release | **fault**: viem `parseUnits` rounded instead of throwing; fixed, cleared |
| Wave 2: contract step deletes `lib/clients.js` (no importers left), `useErc20`, `TransferForm` | all cleared first time |
| Cleanup: uninstall ethers and web3 | `npm run guard` 0 findings, tests 22/22, build ok |
| Bundle (gzip) | 550 kB → 163 kB |
| Wall clock, box opened → last clear | 2 min 40 s (hand-typed edits) |

## What the rehearsal changed in the tooling

1. **Expand → migrate → contract.** `lib/clients.js` exports the legacy objects themselves, so it
   can't be migrated before its callers. The contract check became usage-aware, and the planner
   schedules such providers after their callers.
2. **ETH014 false positive.** viem's `walletClient.signMessage({ ... })` matched the ethers rule. The
   rule now requires a non-object argument.
3. **Symlinked `node_modules`** showed up as an unowned change. Paths under node_modules are ignored.
4. **wagmi 3 API.** Mutation hooks use `mutate` / `mutateAsync`; noted in the playbook.
