// Signalbox interlocking state. Pure functions with no Node imports: the CLI, the live server
// and the browser UI all derive state from the same ledger with this reducer.
//
// Railway terms, mapped to parallel agents:
//   block      a task's files. One agent at a time may occupy it.
//   signal     whether an agent may enter a block: DANGER until every earlier wave has cleared.
//   occupied   an agent has claimed the block and is editing it.
//   fault      the block's last verification failed; the agent must fix it or roll back.
//   cleared    verification passed and the block was committed on its own.
//   SPAD       "signal passed at danger": an edit to a file no occupied block owns.

export const TASK_STATES = ['danger', 'clear', 'occupied', 'fault', 'cleared']

export function reduce(events) {
  const init = events.find((e) => e.t === 'init')
  if (!init) return null
  const tasks = {}
  for (const t of init.plan.tasks) {
    tasks[t.id] = { id: t.id, wave: t.wave, files: [...t.files], extra: [], prompt: t.prompt, findings: t.findings, agent: null, since: null, lastVerify: null, commit: null, attempts: 0, rollbacks: 0 }
  }
  const spads = []
  for (const e of events) {
    const task = e.task && tasks[e.task]
    switch (e.t) {
      case 'claim':
        if (!task) break
        task.agent = e.agent
        task.since = e.at
        task.lastVerify = null
        break
      case 'extend':
        if (task) for (const f of e.files) if (!task.files.includes(f) && !task.extra.includes(f)) task.extra.push(f)
        break
      case 'verify':
        if (!task) break
        task.lastVerify = e
        task.attempts++
        for (const f of e.checks?.scope?.outside || []) spads.push({ at: e.at, file: f, task: e.task, agent: e.agent })
        break
      case 'clear':
        if (!task) break
        task.commit = e.commit
        task.clearedAt = e.at
        break
      case 'rollback':
        if (!task) break
        task.agent = null
        task.since = null
        task.lastVerify = null
        task.rollbacks++
        break
    }
  }
  const state = { base: init.base, scanDir: init.scanDir, testCmd: init.testCmd, allow: init.allow || [], waves: init.plan.waves, tasks, spads, startedAt: init.at }
  for (const t of Object.values(tasks)) t.state = taskState(state, t)
  return state
}

function taskState(state, t) {
  if (t.commit) return 'cleared'
  if (t.agent) return t.lastVerify && !t.lastVerify.ok ? 'fault' : 'occupied'
  return waveOpen(state, t.wave) ? 'clear' : 'danger'
}

// A wave's signal is green once every task in every earlier wave has cleared.
export function waveOpen(state, wave) {
  return Object.values(state.tasks).every((t) => t.wave >= wave || t.commit)
}

export function blockFiles(task) {
  return [...task.files, ...task.extra]
}

// Interlocking check for a claim. Returns { ok } or { ok: false, reason, blocking }.
export function canClaim(state, taskId, agent) {
  const t = state.tasks[taskId]
  if (!t) return { ok: false, reason: `unknown block ${taskId}`, blocking: [] }
  if (t.commit) return { ok: false, reason: `${taskId} is already cleared`, blocking: [] }
  if (t.agent && t.agent !== agent) return { ok: false, reason: `${taskId} is occupied by ${t.agent}`, blocking: [taskId] }
  if (!waveOpen(state, t.wave)) {
    const blocking = Object.values(state.tasks).filter((o) => o.wave < t.wave && !o.commit).map((o) => o.id)
    return { ok: false, reason: `signal at danger: wave ${t.wave} opens when ${blocking.join(', ')} clear`, blocking }
  }
  const mine = new Set(blockFiles(t))
  const overlap = Object.values(state.tasks).filter((o) => o.id !== taskId && o.agent && !o.commit && blockFiles(o).some((f) => mine.has(f)))
  if (overlap.length) return { ok: false, reason: `files are held by ${overlap.map((o) => `${o.id} (${o.agent})`).join(', ')}`, blocking: overlap.map((o) => o.id) }
  return { ok: true }
}

// Who owns a modified file right now: an occupied block, an allow-listed path, or nobody (SPAD).
export function ownerOf(state, file) {
  for (const t of Object.values(state.tasks)) if (t.agent && !t.commit && blockFiles(t).includes(file)) return t.id
  if (state.allow.some((p) => matchGlob(p, file))) return 'allow'
  return null
}

export function matchGlob(pattern, path) {
  const re = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*')}$`)
  return re.test(path)
}

export function summary(state) {
  const list = Object.values(state.tasks)
  const count = (s) => list.filter((t) => t.state === s).length
  return { total: list.length, cleared: count('cleared'), occupied: count('occupied'), fault: count('fault'), clear: count('clear'), danger: count('danger'), agents: [...new Set(list.filter((t) => t.agent && !t.commit).map((t) => t.agent))], spads: state.spads.length }
}

// One line per ledger event: the train describer shared by the CLI log and the UI.
export function describe(e) {
  switch (e.t) {
    case 'init': return `signal box opened at ${e.base.slice(0, 7)}: ${e.plan.tasks.length} blocks in ${e.plan.waves} waves`
    case 'claim': return `${e.agent} entered ${e.task}`
    case 'deny': return `${e.agent} held at signal for ${e.task}: ${e.reason}`
    case 'extend': return `${e.agent} extended ${e.task} with ${e.files.join(', ')}`
    case 'verify': return `${e.task} track circuit ${e.ok ? 'clear' : 'FAULT'}${e.checks.tests.summary ? ` (${e.checks.tests.summary})` : ''}`
    case 'clear': return `${e.task} cleared by ${e.agent} -> ${e.commit.slice(0, 7)}`
    case 'rollback': return `${e.agent || 'operator'} rolled back ${e.task} (${e.files.length} files restored)`
    default: return JSON.stringify(e)
  }
}

// Occupancy intervals and outcomes per block, from the ledger alone. Feeds `signalbox report`
// and the train graph. Times are epoch milliseconds.
export function timeline(events) {
  const init = events.find((e) => e.t === 'init')
  if (!init) return null
  const t0 = Date.parse(init.at)
  const open = {}
  const runs = [] // { task, agent, start, end, outcome: 'cleared'|'rolled-back'|'open', verifies: [{at, ok, failed:[check]}] }
  for (const e of events) {
    const at = Date.parse(e.at)
    if (e.t === 'claim') open[e.task] = { task: e.task, agent: e.agent, start: at, end: null, outcome: 'open', verifies: [] }
    const run = open[e.task]
    if (!run) continue
    if (e.t === 'verify') run.verifies.push({ at, ok: e.ok, failed: Object.entries(e.checks || {}).filter(([, c]) => !c.ok).map(([k]) => k) })
    if (e.t === 'clear' || e.t === 'rollback') {
      run.end = at
      run.outcome = e.t === 'clear' ? 'cleared' : 'rolled-back'
      runs.push(run)
      delete open[e.task]
    }
  }
  runs.push(...Object.values(open))
  const last = events.length ? Date.parse(events[events.length - 1].at) : t0
  return { t0, t1: Math.max(last, t0 + 1), runs, tasks: init.plan.tasks.map((t) => ({ id: t.id, wave: t.wave })) }
}

export function metrics(events) {
  const tl = timeline(events)
  if (!tl) return null
  const state = reduce(events)
  const verifies = events.filter((e) => e.t === 'verify')
  const faults = verifies.filter((e) => !e.ok)
  const byCheck = { scope: 0, contract: 0, scan: 0, tests: 0 }
  for (const f of faults) for (const [k, c] of Object.entries(f.checks || {})) if (!c.ok && k in byCheck) byCheck[k]++
  // Peak number of blocks occupied at the same time.
  const edges = tl.runs.flatMap((r) => [[r.start, 1], [r.end ?? tl.t1, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let cur = 0
  let peak = 0
  for (const [, d] of edges) peak = Math.max(peak, (cur += d))
  const cleared = Object.values(state.tasks).filter((t) => t.commit)
  const lastClear = events.filter((e) => e.t === 'clear').map((e) => Date.parse(e.at)).sort((a, b) => b - a)[0]
  const busy = tl.runs.reduce((ms, r) => ms + ((r.end ?? tl.t1) - r.start), 0)
  return {
    blocks: Object.keys(state.tasks).length,
    cleared: cleared.length,
    waves: state.waves,
    agents: [...new Set(tl.runs.map((r) => r.agent))],
    peakParallel: peak,
    claims: events.filter((e) => e.t === 'claim').length,
    denied: events.filter((e) => e.t === 'deny').length,
    verifies: verifies.length,
    faults: faults.length,
    faultsByCheck: byCheck,
    spads: state.spads.length,
    rollbacks: events.filter((e) => e.t === 'rollback').length,
    wallClockMs: (lastClear ?? tl.t1) - tl.t0,
    agentBusyMs: busy,
    firstTimeRight: cleared.filter((t) => t.attempts === 1).length,
  }
}
