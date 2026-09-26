// Names of the crew on the shift that covers `hour` (0-23).
export function onDuty(crew, hour) {
  var shift = hour < 12 ? 'early' : 'late'
  return crew.filter((c) => c.shift === shift).map((c) => c.name)
}
