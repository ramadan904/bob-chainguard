import { describe, it, expect } from 'vitest'
import { blastRadius, blockRisk, crewStats, tourStep, faultReasons } from '../src/insights.js'

const files = [
  { id: 'lib/a.js', imports: [] },
  { id: 'lib/b.js', imports: ['lib/a.js'] },
  { id: 'ui/C.jsx', imports: ['lib/b.js'] },
  { id: 'ui/D.jsx', imports: [] },
]
const at = (s) => new Date(Date.UTC(2026, 8, 26, 0, 0, s)).toISOString()
const plan = { waves: 2, tasks: [{ id: 'w1', wave: 1, files: ['src/lib/a.js'], findings: 5, prompt: '' }, { id: 'w2', wave: 2, files: ['src/ui/C.jsx'], findings: 1, prompt: '' }] }
const bad = { scope: { ok: true, outside: [] }, contract: { ok: true, removed: [] }, scan: { ok: true, remaining: 0 }, tests: { ok: false, failures: ['× parseAmount > rejects more decimals than the asset supports 8ms'] } }
const good = { scope: { ok: true }, contract: { ok: true }, scan: { ok: true }, tests: { ok: true } }
const events = [
  { t: 'init', at: at(0), base: 'b', scanDir: 'src', allow: [], plan },
  { t: 'claim', at: at(1), task: 'w1', agent: 'bob-1' },
  { t: 'deny', at: at(2), task: 'w2', agent: 'bob-2', reason: 'signal at danger: wave 2 opens when w1 clear' },
  { t: 'verify', at: at(3), task: 'w1', agent: 'bob-1', ok: false, checks: bad },
  { t: 'verify', at: at(5), task: 'w1', agent: 'bob-1', ok: true, checks: good },
  { t: 'clear', at: at(5), task: 'w1', agent: 'bob-1', commit: 'abcdef1234' },
  { t: 'claim', at: at(6), task: 'w2', agent: 'bob-2' },
]

describe('insights', () => {
  it('walks the blast radius with hop distances', () => {
    expect([...blastRadius(files, 'lib/a.js')]).toEqual([['lib/a.js', 0], ['lib/b.js', 1], ['ui/C.jsx', 2]])
    expect(blastRadius(files, 'ui/D.jsx').size).toBe(1)
  })
  it('ranks block risk by findings and reach', () => {
    const r = blockRisk(files, [{ id: 'x', findings: 2 }, { id: 'y', findings: 9 }, { id: 'z', findings: 0 }], (t) => ({ x: ['lib/a.js'], y: ['ui/D.jsx'], z: ['ui/C.jsx'] })[t.id])
    expect(r.x).toMatchObject({ reach: 2, score: 8, level: 'med' })
    expect(r.y).toMatchObject({ reach: 0, score: 9, level: 'high' })
    expect(r.z.level).toBe('low')
  })
  it('keeps a per-agent record', () => {
    const crew = crewStats(events, events.length - 1)
    expect(crew.map((a) => [a.agent, a.cleared, a.releases, a.faults, a.active])).toEqual([['bob-1', 1, 2, 1, null], ['bob-2', 0, 0, 0, 'w2']])
    expect(crew[0].ms).toBe(4000)
  })
  it('captions the tour in plain words', () => {
    expect(tourStep(events, 0).text).toMatch(/2 blocks in 2 waves\. Only wave 1's 1 blocks get a green signal/)
    expect(tourStep(events, 2)).toMatchObject({ kind: 'held', focus: 'w2' })
    const fault = tourStep(events, 3)
    expect(fault.kind).toBe('fault')
    expect(fault.text).toMatch(/a test failed: parseAmount > rejects more decimals than the asset supports\./)
    expect(fault.dwell).toBeGreaterThan(3000)
    expect(tourStep(events, 5).text).toMatch(/committed alone as abcdef1\. Wave 2 signals turn green: 1 more block can start/)
  })
  it('explains every kind of fault', () => {
    const r = faultReasons({ checks: { scope: { ok: false, outside: ['src/x/y.js'] }, contract: { ok: false, removed: [{ name: 'keep' }] }, scan: { ok: false, remaining: 3 }, tests: { ok: true } } })
    expect(r).toEqual(['edit outside its block (y.js)', 'removed an export others still use (keep)', '3 legacy call sites left'])
  })
})
