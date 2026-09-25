import moment from 'moment'
import { parse } from './dates.js'

// Revenue per calendar month for the invoices whose paid date falls inside [fromIso, toIso].
export function monthlyRevenue(invoices, fromIso, toIso) {
  const from = parse(fromIso).startOf('month')
  const to = parse(toIso).endOf('month')
  const buckets = {}
  for (const inv of invoices) {
    const paid = parse(inv.paidAt)
    if (!paid.isBetween(from, to, undefined, '[]')) continue
    const key = paid.format('YYYY-MM')
    buckets[key] = (buckets[key] || 0) + inv.amountCents
  }
  return buckets
}

export function averageTimeToPay(invoices) {
  const total = invoices.reduce((ms, inv) => ms + parse(inv.paidAt).diff(parse(inv.issuedAt)), 0)
  return moment.duration(total / Math.max(1, invoices.length)).humanize()
}
