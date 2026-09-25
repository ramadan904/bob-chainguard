// Joins the two real data sources the UI shows: git history (Atlas snapshots) and the
// signal box ledger. Pure functions.
import { reduce } from '../../chainguard/src/signalbox-state.js'

export const stripRoot = (scanDir) => (f) => (f.startsWith(`${scanDir}/`) ? f.slice(scanDir.length + 1) : f)

// One timeline stop per ledger event when a signal box exists, otherwise one per commit.
export function buildStops(atlas, events) {
  if (!events.length) return atlas.snapshots.map((s, i) => ({ kind: 'commit', snap: i, at: s.time, label: s.short, title: s.subject }))
  return events.map((e, i) => ({ kind: 'event', event: i, at: Date.parse(e.at), snap: snapshotAt(atlas, events, i), type: stopType(e), label: e.t }))
}

function stopType(e) {
  if (e.t === 'verify') return e.ok ? 'verify-ok' : 'fault'
  return e.t
}

// The commit snapshot in force at ledger event i: the last cleared block's commit, or the base.
export function snapshotAt(atlas, events, i) {
  const idx = (sha) => atlas.snapshots.findIndex((s) => s.commit === sha)
  for (let k = i; k >= 0; k--) {
    const e = events[k]
    if (e.t === 'clear' && idx(e.commit) !== -1) return idx(e.commit)
    if (e.t === 'init') {
      const j = idx(e.base)
      if (j !== -1) return j
      const t = Date.parse(e.at)
      let best = 0
      atlas.snapshots.forEach((s, n) => { if (s.time <= t) best = n })
      return best
    }
  }
  return atlas.snapshots.length - 1
}

// Legacy call sites per station at a stop, as { file: [[rule, line, snippet]] }. Starts from the
// commit snapshot and overlays what verify events recorded for uncommitted work; a clear or a
// rollback drops the overlay again (the commit snapshot or HEAD content is then authoritative).
export function findingsAt(atlas, events, stop, stops) {
  const s = stops[stop]
  const snap = atlas.snapshots[s.snap]
  const out = {}
  for (const f of snap.present) out[f] = snap.findings[f] || []
  if (s.kind !== 'event') return out
  const init = events.find((e) => e.t === 'init')
  const strip = stripRoot(init?.scanDir || '')
  const overlay = {}
  for (let k = 0; k <= s.event; k++) {
    const e = events[k]
    if (e.t === 'clear' || e.t === 'rollback') for (const f of e.files || []) delete overlay[strip(f)]
    if (e.t === 'verify') {
      for (const [f, n] of Object.entries(e.checks?.scan?.byFile || {})) {
        overlay[strip(f)] = e.checks.scan.findings?.[f] || Array.from({ length: n }, () => ['?', 0, ''])
      }
    }
  }
  return { ...out, ...overlay }
}

export function signalStateAt(events, stop, stops) {
  if (!events.length) return null
  return reduce(events.slice(0, stops[stop].event + 1))
}

// Map station id -> { task, state, agent } for blocks that hold it.
export function blockIndex(sb) {
  const out = {}
  if (!sb) return out
  const strip = stripRoot(sb.scanDir)
  for (const t of Object.values(sb.tasks)) for (const f of [...t.files, ...t.extra]) out[strip(f)] = { task: t.id, state: t.state, agent: t.agent }
  return out
}

export function faultsCaught(events, uptoEvent) {
  return events.slice(0, uptoEvent + 1).filter((e) => e.t === 'verify' && !e.ok).length
}

export function checkLamps(verify) {
  const keys = ['scope', 'contract', 'scan', 'tests']
  if (!verify) return keys.map((k) => ({ key: k, state: 'off' }))
  return keys.map((k) => ({ key: k, state: verify.checks?.[k]?.ok ? 'ok' : 'fail' }))
}
