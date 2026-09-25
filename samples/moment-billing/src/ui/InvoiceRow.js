import { formatDay } from '../lib/dates.js'
import { parse } from '../lib/dates.js'
import { nextRenewal } from '../lib/billing.js'

export function invoiceRow(inv) {
  const due = parse(inv.issuedAt).add(30, 'days')
  const overdue = !inv.paidAt && due.isBefore()
  return {
    number: inv.number,
    issued: formatDay(parse(inv.issuedAt)),
    due: formatDay(due),
    status: inv.paidAt ? 'paid' : overdue ? 'overdue' : 'open',
    renews: formatDay(nextRenewal(inv.startedAt, inv.plan)),
  }
}
