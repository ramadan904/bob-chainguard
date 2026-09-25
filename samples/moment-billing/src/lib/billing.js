import { parse, today } from './dates.js'

// Next renewal after `from` for a monthly or yearly plan, anchored on the start date.
export function nextRenewal(startIso, plan, from = today()) {
  const start = parse(startIso)
  const step = plan === 'yearly' ? 'years' : 'months'
  // Count whole periods from the start date (never step from the previous renewal: Jan 31 + 1
  // month is Feb 28, and stepping again would drift to Mar 28).
  let n = 0
  while (!start.clone().add(n, step).isAfter(from)) n++
  return start.clone().add(n, step)
}

// Days left in the current period, for proration on upgrade.
export function daysLeft(startIso, plan, from = today()) {
  const renewal = nextRenewal(startIso, plan, from)
  return renewal.diff(from, 'days')
}

export function prorate(amountCents, startIso, plan, from = today()) {
  const renewal = nextRenewal(startIso, plan, from)
  const period = renewal.diff(renewal.clone().subtract(1, plan === 'yearly' ? 'years' : 'months'), 'days')
  return Math.round((amountCents * daysLeft(startIso, plan, from)) / period)
}
