import moment from 'moment'

// All dates in the app go through here: ISO strings in, Moment objects out.
export function parse(iso) {
  const m = moment(iso, moment.ISO_8601, true)
  if (!m.isValid()) throw new Error(`invalid date: ${iso}`)
  return m
}

export function today() {
  return moment().startOf('day')
}

export function formatDay(m) {
  return m.format('DD MMM YYYY')
}

export function formatStamp(m) {
  return m.format('YYYY-MM-DD HH:mm')
}
