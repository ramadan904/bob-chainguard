# moment-billing (sample for the second rule pack)

A small subscription-billing module written against Moment.js, used to show that Signalbox is not
Web3-specific: `chainguard` scans it with `chainguard/packs/moment-to-date-fns.json` and plans the
Moment.js → date-fns migration as blocks and waves, exactly as it does for the dApp. The panel's
rule-pack switcher shows that plan. It is sample code, not a product.

```bash
node chainguard/bin/chainguard.js scan samples/moment-billing/src --pack chainguard/packs/moment-to-date-fns.json
npm run -s sb -- init --scan samples/moment-billing/src --pack chainguard/packs/moment-to-date-fns.json --test "npm test"
```

It has its own behavior tests (`npm test --prefix samples/moment-billing`, 6 tests on node:test).
They compare plain values, so the same tests pass before and after a migration. `npm run
prove:pack` opens a real signal box on it in a throwaway worktree and checks claim, refusal,
the full track circuit (with those tests run in isolation), a chaos drill and the ledger audit.
CI runs it on Linux and Windows.

