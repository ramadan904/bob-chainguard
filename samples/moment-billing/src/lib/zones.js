import moment from 'moment-timezone'

// Invoices are issued at 09:00 in the customer's own time zone.
export function issueTime(dayIso, zone) {
  return moment.tz(`${dayIso} 09:00`, zone).utc()
}

export function toUnix(m) {
  return m.unix()
}

export function fromUnix(seconds) {
  return moment.unix(seconds).utc()
}
