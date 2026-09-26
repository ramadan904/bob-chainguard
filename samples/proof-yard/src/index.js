import { fare } from './fares/fares.js'
import { aspect } from './signals/aspects.js'
import { onDuty } from './crew/roster.js'

// A departure card: what the passenger pays, what the signal shows, who drives.
export function departure({ km, blocksClear, crew, hour }) {
  return { fare: fare(km), signal: aspect(blocksClear), drivers: onDuty(crew, hour) }
}
