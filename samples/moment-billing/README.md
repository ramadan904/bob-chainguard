# moment-billing (sample for the second rule pack)

A small subscription-billing module written against Moment.js, used to show that Signalbox is not
Web3-specific: `chainguard` scans it with `chainguard/packs/moment-to-date-fns.json` and plans the
Moment.js → date-fns migration as blocks and waves, exactly as it does for the dApp. The panel's
rule-pack switcher shows that plan. It is sample code, not a product; nothing is installed here.

```bash
node chainguard/bin/chainguard.js scan samples/moment-billing/src --pack chainguard/packs/moment-to-date-fns.json
npm run -s sb -- init --scan samples/moment-billing/src --pack chainguard/packs/moment-to-date-fns.json --test "npm test"
```
