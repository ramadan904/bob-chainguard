import { describe, it, expect } from 'vitest'
import { buildStops, snapshotAt, findingsAt, signalStateAt, blockIndex, faultsCaught, checkLamps } from '../src/signal.js'

const atlas = {
  root: 'app/src',
  snapshots: [
    { commit: 'base', short: 'base', time: 1000, subject: 'legacy', present: ['a.js', 'b.js'], findings: { 'a.js': [['ETH001', 1, 'x'], ['ETH004', 2, 'y']], 'b.js': [['W3J001', 1, 'z']] } },
    { commit: 'c1', short: 'c1', time: 5000, subject: 'signalbox: clear w1', present: ['a.js', 'b.js'], findings: { 'b.js': [['W3J001', 1, 'z']] } },
  ],
}
const plan = { waves: 2, tasks: [{ id: 'w1', wave: 1, files: ['app/src/a.js'], prompt: '' }, { id: 'w2', wave: 2, files: ['app/src/b.js'], prompt: '' }] }
const at = (s) => new Date(s * 1000).toISOString()
const events = [
  { t: 'init', at: at(2), base: 'base', scanDir: 'app/src', allow: [], plan },
  { t: 'claim', at: at(3), task: 'w1', agent: 'bob-1' },
  { t: 'verify', at: at(4), task: 'w1', agent: 'bob-1', ok: false, checks: { scope: { ok: true, outside: [] }, contract: { ok: true, removed: [] }, scan: { ok: false, remaining: 1, byFile: { 'app/src/a.js': 1 }, findings: { 'app/src/a.js': [['ETH004', 2, 'y']] } }, tests: { ok: false } } },
  { t: 'clear', at: at(5), task: 'w1', agent: 'bob-1', commit: 'c1', files: ['app/src/a.js'] },
]

describe('signal timeline', () => {
  it('uses commits without a ledger and events with one', () => {
    expect(buildStops(atlas, []).map((s) => s.kind)).toEqual(['commit', 'commit'])
    expect(buildStops(atlas, events).map((s) => s.type)).toEqual(['init', 'claim', 'fault', 'clear'])
  })
  it('maps events to the commit in force', () => {
    expect([0, 1, 2, 3].map((i) => snapshotAt(atlas, events, i))).toEqual([0, 0, 0, 1])
  })
  it('overlays uncommitted scan results until the block clears', () => {
    const stops = buildStops(atlas, events)
    expect(findingsAt(atlas, events, 1, stops)['a.js']).toHaveLength(2)
    expect(findingsAt(atlas, events, 2, stops)['a.js']).toEqual([['ETH004', 2, 'y']])
    expect(findingsAt(atlas, events, 3, stops)['a.js']).toEqual([])
  })
  it('derives block state, owners and fault counts at each stop', () => {
    const stops = buildStops(atlas, events)
    const s2 = signalStateAt(events, 2, stops)
    expect(s2.tasks.w1.state).toBe('fault')
    expect(blockIndex(s2)['a.js']).toEqual({ task: 'w1', state: 'fault', agent: 'bob-1' })
    expect(signalStateAt(events, 3, stops).tasks.w2.state).toBe('clear')
    expect(faultsCaught(events, 3)).toBe(1)
    expect(checkLamps(s2.tasks.w1.lastVerify).map((l) => l.state)).toEqual(['ok', 'ok', 'fail', 'fail'])
    expect(checkLamps(null).every((l) => l.state === 'off')).toBe(true)
  })
})
