// Behavior contract for the Moment.js -> date-fns migration. Every assertion goes through the
// module's own functions and compares plain values (strings, numbers, epoch ms), so the same tests
// pass before and after the migration. Agents may not edit this file (Signalbox protects tests).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse, formatDay, formatStamp } from '../lib/dates.js'
import { nextRenewal, daysLeft, prorate } from '../lib/billing.js'
import { trialEnds, inTrial } from '../lib/trial.js'
import { monthlyRevenue, averageTimeToPay } from '../lib/reports.js'
import { issueTime, toUnix, fromUnix } from '../lib/zones.js'
import { invoiceRow } from '../ui/InvoiceRow.js'

test('dates: strict ISO parsing and formatting', () => {
  assert.equal(formatDay(parse('2026-03-05')), '05 Mar 2026')
  assert.equal(formatStamp(parse('2026-03-05T14:07:00')), '2026-03-05 14:07')
  assert.throws(() => parse('05/03/2026'), /invalid date/)
  assert.throws(() => parse('2026-02-30'), /invalid date/)
})

test('billing: renewals, days left and proration', () => {
  const from = parse('2026-03-10')
  assert.equal(formatDay(nextRenewal('2026-01-31', 'monthly', from)), '31 Mar 2026')
  assert.equal(formatDay(nextRenewal('2025-06-01', 'yearly', from)), '01 Jun 2026')
  assert.equal(formatDay(nextRenewal('2026-03-10', 'monthly', from)), '10 Apr 2026', 'a renewal on the day itself rolls to the next period')
  assert.equal(daysLeft('2026-01-31', 'monthly', from), 21)
  assert.equal(prorate(3100, '2026-01-31', 'monthly', from), 2100)
})

test('trial: 14 days, ending at the end of the day', () => {
  assert.equal(trialEnds('2026-03-01').valueOf(), parse('2026-03-15T23:59:59.999').valueOf())
  assert.equal(inTrial('2026-03-01', parse('2026-03-15T12:00')), true)
  assert.equal(inTrial('2026-03-01', parse('2026-03-16T00:00')), false)
})

test('reports: monthly revenue buckets and time to pay', () => {
  const invoices = [
    { issuedAt: '2026-01-02', paidAt: '2026-01-03', amountCents: 1000 },
    { issuedAt: '2026-01-20', paidAt: '2026-01-31T23:00', amountCents: 500 },
    { issuedAt: '2026-02-01', paidAt: '2026-02-02', amountCents: 700 },
    { issuedAt: '2025-11-01', paidAt: '2025-11-02', amountCents: 999 },
  ]
  assert.deepEqual(monthlyRevenue(invoices, '2026-01-15', '2026-02-10'), { '2026-01': 1500, '2026-02': 700 })
  assert.match(averageTimeToPay(invoices.slice(0, 1)), /day/)
})

test('zones: invoices issue at 09:00 local time', () => {
  assert.equal(issueTime('2026-03-05', 'America/New_York').valueOf(), Date.UTC(2026, 2, 5, 14, 0))
  assert.equal(issueTime('2026-07-05', 'America/New_York').valueOf(), Date.UTC(2026, 6, 5, 13, 0), 'daylight saving')
  assert.equal(toUnix(parse('2026-03-05T00:00:00Z')), 1772668800)
  assert.equal(fromUnix(1772668800).valueOf(), Date.UTC(2026, 2, 5))
})

test('invoice row: issued, due in 30 days, paid', () => {
  const row = invoiceRow({ number: 'INV-7', issuedAt: '2026-03-05', paidAt: '2026-03-06', startedAt: '2026-01-05', plan: 'monthly' })
  assert.deepEqual({ issued: row.issued, due: row.due, status: row.status }, { issued: '05 Mar 2026', due: '04 Apr 2026', status: 'paid' })
})
