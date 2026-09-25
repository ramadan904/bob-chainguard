import { parse, today } from './dates.js'

// Next renewal after `from` for a monthly or yearly plan, anchored on the start date.
export function nextRenewal(startIso, plan, from = today()) {
  const start = parse(startIso)
  const step = plan === 'yearly' ? 'years' : 'months'
  let next = start.clone()
  while (!next.isAfter(from)) next = next.add(1, step)
  return next
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
