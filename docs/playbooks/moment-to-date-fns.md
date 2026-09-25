# Playbook: Moment.js to date-fns

Rule pack: `chainguard/packs/moment-to-date-fns.json`. Open a signal box with it:

```bash
npm run -s sb -- init --scan <your-src-dir> --pack chainguard/packs/moment-to-date-fns.json --test "<your test command>"
```

## Hard rules
1. Keep every exported name and call signature stable. Other blocks import them.
2. Never edit tests (they are protected). If one fails, the implementation is wrong.
3. Functions that returned formatted strings still return the same strings. Check against the tests.

## Known traps
| Trap | Moment | date-fns | Do |
| --- | --- | --- | --- |
| Format tokens | `YYYY-MM-DD`, `Do`, `A` | `yyyy-MM-dd`, `do`, `a` | Translate every token. `YYYY` in date-fns is the ISO week-numbering year and throws unless you opt in |
| Mutation | `m.add(1, 'day')` mutates `m` | `addDays(d, 1)` returns a new Date | Assign the result, and check callers that relied on mutation |
| Parsing | `moment('2026-09-25')` parses loosely | `new Date('2026-09-25')` is UTC midnight; `parseISO` is local | Use `parseISO` for ISO strings, `parse(str, fmt, new Date())` otherwise |
| diff argument order | `a.diff(b, 'days')` | `differenceInDays(a, b)` | Same order, but pick the matching `differenceIn*` function |
| Relative time | `m.fromNow()` | `formatDistanceToNow(d, { addSuffix: true })` | Keep `addSuffix` or "ago" disappears |
| Locale | global `moment.locale('fr')` | per call `{ locale: fr }` | Pass the locale explicitly |

## Mapping
| Moment | date-fns |
| --- | --- |
| `moment()` | `new Date()` |
| `moment(str)` | `parseISO(str)` |
| `m.format(fmt)` | `format(d, fmt)` (translated tokens) |
| `m.add(n, 'days')` / `m.subtract(n, 'months')` | `addDays(d, n)` / `subMonths(d, n)` |
| `m.startOf('day')` / `m.endOf('month')` | `startOfDay(d)` / `endOfMonth(d)` |
| `a.isBefore(b)` / `a.isSame(b, 'day')` | `isBefore(a, b)` / `isSameDay(a, b)` |
| `a.diff(b, 'minutes')` | `differenceInMinutes(a, b)` |
| `m.fromNow()` | `formatDistanceToNow(d, { addSuffix: true })` |
| `moment.unix(s)` / `m.unix()` | `fromUnixTime(s)` / `getUnixTime(d)` |
| `m.isValid()` | `isValid(d)` |
