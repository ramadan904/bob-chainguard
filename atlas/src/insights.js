// Derived insights for the panel and the guided tour. Pure functions over atlas data and the
// signal box ledger, so they are unit-tested without a browser.
import { reduce, timeline } from '../../chainguard/src/signalbox-state.js'

// Blast radius and block risk live with the dispatcher so the CLI and Bob can use them too.
export { blastRadius, blockRisk } from '../../chainguard/src/dispatch.js'

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
    case 'drill':
      step.kind = 'chaos'
      step.file = e.file
      step.text = `Chaos drill: ${e.kind === 'contract' ? `${e.renamed.from} is renamed in ${e.file.split('/').pop()}, breaking ${e.usedBy.length} importer${e.usedBy.length === 1 ? '' : 's'}` : `a stray edit hits ${e.file.split('/').pop()}, a file no agent holds`}. Caught in ${e.detectMs} ms. Every release is refused while it is on the tracks.`
      step.dwell = 4600
      break
    case 'drill-end':
      step.kind = 'restored'
      step.text = `${e.file.split('/').pop()} ${e.restored ? 'restored from git' : 'left as is'}. The agents' blocks were never touched.`
      step.dwell = 2600
      break
    default:
      step.text = e.t
  }
  return step
}

// Control tower: one lane per Bob subagent at ledger event `upto`. An agent gets a lane the first
// time it claims or is refused a block. `fresh` marks the agent that produced event `upto`.
export function towerLanes(events, upto) {
  if (!events.length) return []
  const seen = events.slice(0, upto + 1)
  const order = [...new Set(events.filter((e) => e.t === 'claim' || e.t === 'deny').map((e) => e.agent))]
  const lanes = new Map()
  for (let k = 0; k < seen.length; k++) {
    const e = seen[k]
    if (!order.includes(e.agent)) continue
    const l = lanes.get(e.agent) || { agent: e.agent, index: order.indexOf(e.agent), status: 'standby', task: null, claims: 0, clears: 0, faults: 0, denies: 0, last: null, lastIndex: -1 }
    if (e.t === 'claim') { l.claims++; l.task = e.task; l.status = 'working' }
    if (e.t === 'deny') { l.denies++; l.status = 'held'; l.heldFor = e.task; l.reason = e.reason }
    if (e.t === 'verify') { if (!e.ok) l.faults++; l.status = e.ok ? 'working' : 'fault' }
    if (e.t === 'clear') { l.clears++; l.task = null; l.status = 'off' }
    if (e.t === 'rollback') { l.task = null; l.status = 'off' }
    if (e.t === 'recover') { l.task = e.task; l.status = 'working' }
    if (e.t !== 'deny') { l.heldFor = null; l.reason = null }
    l.last = e
    l.lastIndex = k
    lanes.set(e.agent, l)
  }
  // Operator rollbacks name "dispatcher (operator, over bob-2)": free that agent's block too.
  for (const e of seen) {
    const over = e.t === 'rollback' && /over ([^)]+)\)/.exec(e.agent || '')?.[1]
    const l = over && lanes.get(over)
    if (l && l.task === e.task && Date.parse(e.at) >= Date.parse(l.last.at)) { l.task = null; l.status = 'off'; l.last = e }
  }
  return [...lanes.values()].sort((a, b) => a.index - b.index).map((l) => ({ ...l, fresh: l.lastIndex === upto }))
}
