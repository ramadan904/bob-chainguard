// Transit-map layout. Pure functions: atlas data in, geometry out.
//
// Each directory is a vertical line. Stations (files) sit on their line, top to bottom by
// import depth, so everything a file depends on is above it. Imports between lines are drawn
// as schematic tunnels that arrive through the gap on the consumer line's left.

export const LABEL_OFFSET = 32
// Rough rendered width of a station label (IBM Plex Sans Condensed 500, 13.5px).
export const labelWidth = (name) => name.length * 7 + 4

// Luminous line colours that hold up on the night (default) and day themes alike.
export const LINE_COLORS = ['#4589ff', '#24c26a', '#ff5fa2', '#f5b301', '#12c7c3', '#ff8a3d', '#a78bfa']

// Lines ordered by the directory-level import graph: a directory comes after every directory
// it imports from. Ties break on mean file depth, then name.
export function orderDirs(files) {
  const dirOf = Object.fromEntries(files.map((f) => [f.id, f.dir]))
  const deps = {}
  const depths = {}
  for (const f of files) {
    ;(deps[f.dir] ||= new Set())
    ;(depths[f.dir] ||= []).push(f.depth)
    for (const i of f.imports) if (dirOf[i] && dirOf[i] !== f.dir) deps[f.dir].add(dirOf[i])
  }
  const level = {}
  const visiting = new Set()
  const walk = (d) => {
    if (level[d] !== undefined) return level[d]
    if (visiting.has(d)) return 0
    visiting.add(d)
    let l = 0
    for (const x of deps[d]) l = Math.max(l, walk(x) + 1)
    visiting.delete(d)
    return (level[d] = l)
  }
  const dirs = Object.keys(deps)
  dirs.forEach(walk)
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length
  return dirs.sort((a, b) => level[a] - level[b] || mean(depths[a]) - mean(depths[b]) || a.localeCompare(b))
}

export function layoutAtlas(files, { gap = 66, lineGap = 210, padLeft = 110, padRight = 190, padTop = 110, padBottom = 70 } = {}) {
  const dirs = orderDirs(files)
  const maxDepth = Math.max(0, ...files.map((f) => f.depth))

  // Rows: each depth gets as many slots as its most crowded line needs.
  const count = (dir, d) => files.filter((f) => f.dir === dir && f.depth === d).length
  const slots = Array.from({ length: maxDepth + 1 }, (_, d) => Math.max(1, ...dirs.map((dir) => count(dir, d))))
  const rowStart = []
  slots.reduce((acc, n, d) => ((rowStart[d] = acc), acc + n * gap), padTop)
  const height = rowStart[maxDepth] + slots[maxDepth] * gap + padBottom

  const lines = dirs.map((dir, i) => ({ dir, color: LINE_COLORS[i % LINE_COLORS.length], x: padLeft + i * lineGap }))
  const lineOf = Object.fromEntries(lines.map((l) => [l.dir, l]))

  const stations = {}
  for (const dir of dirs) {
    for (let d = 0; d <= maxDepth; d++) {
      const here = files.filter((f) => f.dir === dir && f.depth === d).sort((a, b) => a.name.localeCompare(b.name))
      const offset = ((slots[d] - here.length) * gap) / 2
      here.forEach((f, k) => {
        stations[f.id] = { id: f.id, name: f.name, dir, depth: d, x: lineOf[dir].x, y: rowStart[d] + offset + k * gap + gap / 2 }
      })
    }
  }
  for (const l of lines) {
    const ys = Object.values(stations).filter((s) => s.dir === l.dir).map((s) => s.y)
    l.y1 = Math.min(...ys) - gap * 0.55
    l.y2 = Math.max(...ys) + gap * 0.55
  }

  // Cross-line imports only; same-line neighbours are already joined by the line itself.
  const edges = []
  for (const f of files) {
    for (const dep of f.imports) {
      const a = stations[dep]
      const b = stations[f.id]
      if (a && b && a.dir !== b.dir) edges.push({ from: dep, to: f.id })
    }
  }
  // Each consumer line gets a bundle of lanes in the gap on its left; spread them apart.
  const laneUse = {}
  edges.sort((e1, e2) => stations[e1.from].x - stations[e2.from].x || stations[e1.to].y - stations[e2.to].y)
  for (const e of edges) {
    const a = stations[e.from]
    const b = stations[e.to]
    const side = b.x > a.x ? -1 : 1
    const k = (laneUse[`${b.dir}|${side}`] = (laneUse[`${b.dir}|${side}`] ?? -1) + 1)
    const lane = b.x + side * (lineGap * 0.5 - 22 - k * 7)
    // Leave from past the source label (labels sit to the right of stations) so tunnels never cross text.
    const start = side < 0 ? { x: a.x + LABEL_OFFSET + labelWidth(a.name) + 8, y: a.y } : a
    e.path = tunnelPath(start, b, lane)
  }

  const width = padLeft + (dirs.length - 1) * lineGap + padRight
  return { width, height, lines, stations, edges }
}

// Schematic tunnel: leave a horizontally, turn down the lane at `laneX`, arrive at b horizontally.
// Corners are rounded with radius `rad` (clamped when the stations are close).
export function tunnelPath(a, b, laneX, rad = 10) {
  const sx = Math.sign(laneX - a.x) || 1
  const ex = Math.sign(b.x - laneX) || 1
  const sy = Math.sign(b.y - a.y) || 1
  const rr = Math.max(0, Math.min(rad, Math.abs(b.y - a.y) / 2, Math.abs(laneX - a.x), Math.abs(b.x - laneX)))
  return [
    `M${r(a.x)},${r(a.y)}`,
    `H${r(laneX - sx * rr)}`,
    `Q${r(laneX)},${r(a.y)} ${r(laneX)},${r(a.y + sy * rr)}`,
    `V${r(b.y - sy * rr)}`,
    `Q${r(laneX)},${r(b.y)} ${r(laneX + ex * rr)},${r(b.y)}`,
    `H${r(b.x)}`,
  ].join('')
}

const r = (n) => Math.round(n * 10) / 10
