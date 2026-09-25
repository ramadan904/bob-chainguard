import { describe, it, expect } from 'vitest'
import { orderDirs, layoutAtlas, tunnelPath } from '../src/layout.js'
import { stationStatus, taskStatus, snapshotStats, dependentsOf, historyOf } from '../src/state.js'

const files = [
  { id: 'lib/a.js', name: 'a.js', dir: 'lib', depth: 0, imports: [] },
  { id: 'lib/b.js', name: 'b.js', dir: 'lib', depth: 1, imports: ['lib/a.js'] },
  { id: 'hooks/h.js', name: 'h.js', dir: 'hooks', depth: 2, imports: ['lib/b.js'] },
  { id: 'ui/C.jsx', name: 'C.jsx', dir: 'ui', depth: 3, imports: ['hooks/h.js', 'lib/a.js'] },
]

const snap = (short, findings) => {
  const n = Object.values(findings).reduce((s, l) => s + l.length, 0)
  return {
    short, commit: short, time: 0, subject: short,
    filesScanned: 4, filesAffected: Object.keys(findings).length,
    totals: { findings: n, errors: n, warnings: 0 },
    byLib: { 'ethers-v5': n },
    present: files.map((f) => f.id),
    findings,
  }
}
const atlas = {
  files,
  plan: { waves: 2, tasks: [
    { id: 'w1-lib', wave: 1, files: ['lib/a.js', 'lib/b.js'], prompt: '' },
    { id: 'w2-hooks', wave: 2, files: ['hooks/h.js'], prompt: '' },
  ] },
  snapshots: [
    snap('s0', { 'lib/a.js': [['ETH001', 1, 'x']], 'lib/b.js': [['ETH004', 2, 'y'], ['ETH004', 3, 'z']], 'hooks/h.js': [['ETH005', 1, 'q']] }),
    snap('s1', { 'lib/b.js': [['ETH004', 2, 'y']], 'hooks/h.js': [['ETH005', 1, 'q']] }),
    snap('s2', {}),
  ],
}

describe('layout', () => {
  it('orders lines by the directory import graph', () => {
    expect(orderDirs(files)).toEqual(['lib', 'hooks', 'ui'])
  })
  it('puts every file below the files it imports', () => {
    const { stations } = layoutAtlas(files)
    for (const f of files) for (const dep of f.imports) expect(stations[dep].y).toBeLessThan(stations[f.id].y)
  })
  it('draws tunnels only between different lines', () => {
    const { edges } = layoutAtlas(files)
    expect(edges.map((e) => `${e.from}>${e.to}`).sort()).toEqual(['hooks/h.js>ui/C.jsx', 'lib/a.js>ui/C.jsx', 'lib/b.js>hooks/h.js'])
    for (const e of edges) expect(e.path).toMatch(/^M[\d.]+,[\d.]+H.*V.*H[\d.]+$/)
  })
  it('keeps tunnel corners inside tight gaps', () => {
    expect(tunnelPath({ x: 0, y: 0 }, { x: 100, y: 4 }, 50)).toBe('M0,0H48Q50,0 50,2V2Q50,4 52,4H100')
  })
})

describe('state', () => {
  it('classifies stations', () => {
    expect(stationStatus(atlas, 0, 'lib/b.js')).toEqual({ status: 'legacy', count: 2, baseline: 2 })
    expect(stationStatus(atlas, 1, 'lib/a.js').status).toBe('migrated')
    expect(stationStatus(atlas, 1, 'ui/C.jsx').status).toBe('clean')
  })
  it('tracks task progress', () => {
    expect(taskStatus(atlas, 0, atlas.plan.tasks[0])).toEqual({ status: 'SCHEDULED', remaining: 3, total: 3 })
    expect(taskStatus(atlas, 1, atlas.plan.tasks[0])).toEqual({ status: 'BOARDING', remaining: 1, total: 3 })
    expect(taskStatus(atlas, 2, atlas.plan.tasks[0]).status).toBe('ARRIVED')
  })
  it('summarizes a snapshot against the baseline', () => {
    expect(snapshotStats(atlas, 1)).toMatchObject({ calls: 2, baselineCalls: 4, clear: 2, arrived: 0, tasks: 2 })
    expect(snapshotStats(atlas, 2)).toMatchObject({ calls: 0, arrived: 2 })
  })
  it('walks the graph and history', () => {
    expect(dependentsOf(atlas, 'lib/a.js').sort()).toEqual(['lib/b.js', 'ui/C.jsx'])
    expect(historyOf(atlas, 'lib/b.js')).toEqual([2, 1, 0])
  })
})
