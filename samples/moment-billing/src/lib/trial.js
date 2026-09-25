import moment from 'moment'
import { parse } from './dates.js'

const TRIAL_DAYS = 14

export function trialEnds(signupIso) {
  return parse(signupIso).add(TRIAL_DAYS, 'days').endOf('day')
}

export function inTrial(signupIso, now = moment()) {
  return now.isBefore(trialEnds(signupIso))
}

export function trialLabel(signupIso) {
  const end = trialEnds(signupIso)
  return end.isAfter(moment()) ? `Trial ends ${end.fromNow()}` : 'Trial over'
}
