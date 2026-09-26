// The aspect a signal shows for the number of clear blocks ahead of it.
export function aspect(blocksClear) {
  var aspects = ['red', 'yellow', 'double yellow', 'green']
  return aspects[Math.min(Math.max(blocksClear, 0), aspects.length - 1)]
}
