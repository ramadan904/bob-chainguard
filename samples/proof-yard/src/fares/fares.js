// Fare for a journey in cents: a base charge plus a rate per whole kilometre.
export function fare(km) {
  var base = 250
  var perKm = 40
  return base + perKm * Math.max(0, Math.round(km))
}
