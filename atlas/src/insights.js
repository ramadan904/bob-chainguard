// Derived insights for the panel and the guided tour. Pure functions over atlas data and the
// signal box ledger, so they are unit-tested without a browser.
import { reduce, timeline } from '../../chainguard/src/signalbox-state.js'

// Every file that depends on `id` (directly or through other files), with its distance in hops.
export function blastRadius(files, id) {
  const users = {}
  for (const f of files) for (const d of f.imports) (users[d] ||= []).push(f.id)
  const dist = new Map([[id, 0]])
  const queue = [id]
  while (queue.length) {
    const cur = queue.shift()
    for (const u of users[cur] || []) if (!dist.has(u)) { dist.set(u, dist.get(cur) + 1); queue.push(u) }
  }
  return dist
}

// Risk of a block = legacy call sites + 3 × the files outside it that depend on it, ranked within
// the plan into thirds. `filesOf(task)` returns the block's station ids.
export function blockRisk(files, tasks, filesOf) {
  const scored = tasks.map((t) => {
    const own = filesOf(t)
    const reach = new Set()
    for (const f of own) for (const [d] of blastRadius(files, f)) if (!own.includes(d)) reach.add(d)
    return { id: t.id, score: (t.findings || 0) + 3 * reach.size, reach: reach.size }
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  const hi = Math.ceil(scored.length / 3)
  const mid = Math.ceil((2 * scored.length) / 3)
  return Object.fromEntries(scored.map((r, k) => [r.id, { ...r, level: k < hi ? 'high' : k < mid ? 'med' : 'low' }]))
}

// Per-agent record up to ledger event `upto` (inclusive), in order of first appearance.
export function crewStats(events, upto) {
  if (!events.length) return []
  const tl = timeline(events.slice(0, upto + 1))
  const order = [...new Set(timeline(events).runs.map((r) => r.agent))]
  const now = Date.parse(events[upto].at)
  const byAgent = new Map()
  for (const r of tl.runs) {
    const a = byAgent.get(r.agent) || { agent: r.agent, cleared: 0, releases: 0, faults: 0, ms: 0, active: null }
    a.releases += r.verifies.length
    a.faults += r.verifies.filter((v) => !v.ok).length
    if (r.outcome === 'cleared') a.cleared++
    if (r.outcome === 'open') a.active = r.task
    a.ms += (r.end ?? now) - r.start
    byAgent.set(r.agent, a)
  }
  return [...byAgent.values()].sort((x, y) => order.indexOf(x.agent) - order.indexOf(y.agent)).map((a) => ({ ...a, index: order.indexOf(a.agent) }))
}

export function faultReasons(v) {
  const c = v.checks || {}
  const out = []
  if (c.scope && !c.scope.ok) out.push(`edit outside its block (${c.scope.outside.map((f) => f.split('/').pop()).join(', ')})`)
  if (c.contract && !c.contract.ok) out.push(`removed an export others still use (${c.contract.removed.map((r) => r.name).join(', ')})`)
  if (c.scan && !c.scan.ok) out.push(`${c.scan.remaining} legacy call sites left`)
  if (c.tests && !c.tests.ok) out.push(`a test failed: ${(c.tests.failures?.[0] || c.tests.summary || '').replace(/^(×|✗|FAIL)\s+/, '').replace(/\s+\d+ms$/, '')}`)
  return out
}

// Caption for the guided tour at ledger event i: what happened, in plain words, plus how long
// the tour should dwell on it and which block to show.
export function tourStep(events, i) {
  const e = events[i]
  const before = i > 0 ? reduce(events.slice(0, i)) : null
  const after = reduce(events.slice(0, i + 1))
  const step = { kind: e.t, dwell: 1400, focus: e.task || null, text: '' }
  switch (e.t) {
    case 'init': {
      const w1 = Object.values(after.tasks).filter((t) => t.state === 'clear').length
      step.text = `The signal box opens: ${Object.keys(after.tasks).length} blocks in ${after.waves} waves. Only wave 1's ${w1} blocks get a green signal.`
      step.dwell = 3400
      break
    }
    case 'claim':
      step.text = `${e.agent} claims ${e.task}. No other agent can touch these files now.`
      break
    case 'deny':
      step.text = `${e.agent} tries to jump ahead and is held at the signal: ${e.reason}.`
      step.kind = 'held'
      step.dwell = 3200
      break
    case 'extend':
      step.text = `${e.agent} adds ${e.files.map((f) => f.split('/').pop()).join(', ')} to ${e.task}, with the signal box's permission.`
      break
    case 'verify':
      if (e.ok) {
        step.text = `${e.task}: track circuit clear. Scope, contract, legacy scan and isolated tests all pass.`
      } else {
        step.kind = 'fault'
        step.text = `FAULT in ${e.task}: ${faultReasons(e).join('; ')}. Nothing is committed and the other agents keep working.`
        step.dwell = 4200
      }
      break
    case 'clear': {
      const opened = before ? Object.values(after.tasks).filter((t) => t.state === 'clear' && before.tasks[t.id]?.state === 'danger') : []
      step.text = `${e.task} cleared by ${e.agent} and committed alone as ${e.commit.slice(0, 7)}.`
      if (opened.length) step.text += ` Wave ${opened[0].wave} signals turn green: ${opened.length} more block${opened.length > 1 ? 's' : ''} can start.`
      if (Object.values(after.tasks).every((t) => t.commit)) step.text += ' Every block is cleared.'
      step.dwell = opened.length || Object.values(after.tasks).every((t) => t.commit) ? 3800 : 2400
      break
    }
    case 'rollback':
      step.text = `${e.agent} rolls back ${e.task}: ${e.files.length} files restored, nothing else touched.`
      step.dwell = 3000
      break
    case 'recover':
      step.text = `${e.agent} recovers ${e.task} from the black-box recorder.`
      step.dwell = 3000
      break
    default:
      step.text = e.t
  }
  return step
}
