// The dispatcher's question desk. Plain-language commands in, answers computed from the live
// signal box state out. Pure and deterministic (keyword intents, no model behind it): the CLI
// `signalbox ask` gives it to Bob Agent mode as a tool, and the panel's command bar uses it too.
// It never moves a train itself: "start" answers with the exact dispatch for Bob to carry out.

import { canClaim, blockFiles, summary } from './signalbox-state.js'

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

export const EXAMPLES = [
  'Start all green wave-1 blocks',
  'Simulate a bad agent',
  'Show the riskiest remaining block',
  'Why is w2-lib at danger?',
  'Who is working right now?',
  'Blast radius of lib/units.js',
  'Any faults?',
]

const strip = (scanDir) => (f) => (f.startsWith(`${scanDir}/`) ? f.slice(scanDir.length + 1) : f)
const short = (f) => f.split('/').pop()

// Which block or file the question is about: an exact block id, then a file name.
function mentioned(q, state, files, scanDir) {
  const text = q.toLowerCase()
  const task = Object.values(state.tasks).find((t) => text.includes(t.id.toLowerCase()))
  if (task) return { task }
  const rel = strip(scanDir)
  const byName = files
    .map((f) => f.id)
    .sort((a, b) => b.length - a.length)
    .find((id) => {
      if (text.includes(id.toLowerCase())) return true
      // A bare name ("units") counts only when it is long enough not to be an ordinary word.
      const bare = short(id).toLowerCase().replace(/\.[^.]+$/, '')
      return bare.length >= 4 && new RegExp(`\\b${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)
    })
  if (!byName) return {}
  const owner = Object.values(state.tasks).find((t) => blockFiles(t).map(rel).includes(byName))
  return { file: byName, task: owner }
}

function explain(state, t, rel) {
  const where = `${t.id} (wave ${t.wave}: ${blockFiles(t).map((f) => short(rel(f))).join(', ')})`
  switch (t.state) {
    case 'danger': {
      const v = canClaim(state, t.id, '?')
      return `${where} is at DANGER: ${v.reason.replace(/^signal at danger: /, "")}. Interlocking will refuse any claim until then.`
    }
    case 'clear':
      return `${where} is GREEN and free. A dispatcher can start a Bob subagent on it now.`
    case 'occupied':
      return `${where} is OCCUPIED by ${t.agent} since ${t.since.slice(11, 19)} UTC. No other agent may touch its files.`
    case 'fault': {
      const c = t.lastVerify.checks
      const why = []
      if (!c.scope.ok) why.push(`edits outside the block (${c.scope.outside.map(short).join(', ')})`)
      if (!c.contract.ok) why.push(`removed exports still in use (${c.contract.removed.map((r) => r.name).join(', ')})`)
      if (!c.scan.ok) why.push(`${c.scan.remaining} legacy call sites left`)
      if (!c.tests.ok) why.push(`failing test: ${(c.tests.failures?.[0] || c.tests.summary || '').replace(/^(×|✗|FAIL)\s+/, '')}`)
      return `${where} is at FAULT after ${t.attempts} release attempt(s): ${why.join('; ')}. ${t.agent} must fix and release again, or roll back.`
    }
    case 'cleared':
      return `${where} is CLEARED: committed as ${t.commit.slice(0, 7)} by its agent after all four checks passed.`
    default:
      return where
  }
}

function dispatchPrompt(ready, used) {
  let n = 0
  const names = ready.map(() => {
    do n++
    while (used.has(`bob-${n}`))
    return `bob-${n}`
  })
  return [
    'You are the Signalbox dispatcher. Start these subagents in parallel, one per block:',
    ...ready.map((t, k) => `- ${names[k]}: block ${t.id}. Its task: run \`npm run -s sb -- prompt ${t.id} --agent ${names[k]}\` and follow that prompt exactly (claim, edit only the block's files, release, fix faults).`),
    'Do not start any other block. When a subagent finishes, run `npm run -s sb -- next` and report which signals turned green.',
  ].join('\n')
}

// ctx: { state (reduce()), files ([{ id, imports }], ids relative to state.scanDir), selected? }
// Returns { intent, text, lines?, prompt?, focus? } — `focus` is a block id or file for the UI.
export function ask(question, { state, files = [], selected = null }) {
  const q = String(question || '').trim()
  const text = q.toLowerCase()
  const rel = strip(state.scanDir)
  const tasks = Object.values(state.tasks).sort((a, b) => a.wave - b.wave || a.id.localeCompare(b.id))
  const about = mentioned(q, state, files, state.scanDir)
  const risk = () => blockRisk(files, tasks, (t) => blockFiles(t).map(rel))

  if (!q || /^(help|\?|what can you do)/.test(text)) {
    return { intent: 'help', text: 'Ask about the signal box in plain words. It answers from the ledger; Bob carries out the moves.', lines: EXAMPLES }
  }

  // Actions: the panel carries these out (live: for real; deployed site: the recorded proof).
  if (/\b(chaos|drill|spad|stray|break (a |the )?contract)\b/.test(text)) {
    const kind = /contract/.test(text) ? 'contract' : 'spad'
    return {
      intent: 'drill',
      action: 'drill',
      kind,
      text: kind === 'contract'
        ? 'Chaos drill: rename an export other files still import, in a file no agent holds. The contract check names every importer; git restores the file after 6 s.'
        : 'Chaos drill: a real stray edit to the most-imported file no agent holds. The scope check flags the SPAD in milliseconds; git restores it after 6 s.',
      lines: [`CLI: npm run -s sb -- drill ${kind} --hold 6`],
    }
  }

  if (/\b(prove|proof|safety|safe\s+to|bad agent|rogue|misbehav|simulate)\b/.test(text) && !/\bwhy\b/.test(text)) {
    return {
      intent: 'prove',
      action: 'prove',
      text: 'Safety proof: three drill agents enter three blocks at once on a throwaway fixture repo. One edits outside its block and breaks an export. Watch the interlocking catch it, roll it back, and let the other two commit.',
      lines: ['CLI: npm run -s sb -- prove   (add --pace 1500 to watch it)'],
    }
  }
  if (/\b(start|dispatch|launch|send|begin|go|run)\b/.test(text) && !/\bwhy\b/.test(text)) {
    const wave = Number(/wave[\s-]*(\d+)/.exec(text)?.[1]) || null
    const pool = tasks.filter((t) => !wave || t.wave === wave)
    const ready = pool.filter((t) => t.state === 'clear')
    if (!ready.length) {
      const held = pool.find((t) => t.state === 'danger')
      return {
        intent: 'dispatch',
        text: held ? `Nothing to start${wave ? ` in wave ${wave}` : ''}: ${explain(state, held, rel)}` : `Nothing to start${wave ? ` in wave ${wave}` : ''}: every block is occupied or cleared.`,
        lines: pool.filter((t) => t.state !== 'cleared').map((t) => `${t.id}: ${t.state}${t.agent && !t.commit ? ` (${t.agent})` : ''}`),
        focus: held?.id || null,
      }
    }
    const used = new Set(tasks.flatMap((t) => (t.agent ? [t.agent] : [])))
    return {
      intent: 'dispatch',
      text: `${ready.length} green block${ready.length > 1 ? 's' : ''} ready${wave ? ` in wave ${wave}` : ''}. Only Bob can start Bob subagents: paste this dispatch into Bob (Agent mode) and it starts one per block, all in parallel.`,
      lines: ready.map((t) => `${t.id} · wave ${t.wave} · ${blockFiles(t).map((f) => short(rel(f))).join(', ')}`),
      prompt: dispatchPrompt(ready, used),
      focus: ready[0].id,
    }
  }

  if (/\b(blast|impact|ripple|depends? on|who uses|what uses|downstream)\b/.test(text)) {
    const file = about.file || (about.task ? rel(blockFiles(about.task)[0]) : selected)
    if (!file) return { intent: 'blast', text: 'Which file? For example: "blast radius of lib/units.js".' }
    const radius = [...blastRadius(files, file)].filter(([, d]) => d > 0).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    return {
      intent: 'blast',
      text: radius.length ? `A change to ${file} can reach ${radius.length} file${radius.length > 1 ? 's' : ''}.` : `Nothing imports ${file}: a change there stays local.`,
      lines: radius.map(([f, d]) => `${d} hop${d > 1 ? 's' : ''} · ${f}`),
      focus: file,
      blast: file,
    }
  }

  if (/\b(risk|riskiest|risky|dangerous|hardest|biggest)\b/.test(text)) {
    const r = risk()
    const open = tasks.filter((t) => t.state !== 'cleared').sort((a, b) => r[b.id].score - r[a.id].score || a.id.localeCompare(b.id))
    if (!open.length) return { intent: 'risk', text: 'Every block is cleared. No risk left on the network.' }
    const top = open[0]
    return {
      intent: 'risk',
      text: `Riskiest remaining block: ${top.id} (${r[top.id].level.toUpperCase()}). ${top.findings || 0} legacy call sites and ${r[top.id].reach} file${r[top.id].reach === 1 ? '' : 's'} outside it depend on it. ${explain(state, top, rel)}`,
      lines: open.map((t) => `${r[t.id].level.toUpperCase().padEnd(4)} ${t.id} · score ${r[t.id].score} · ${t.state}`),
      focus: top.id,
    }
  }

  if (/\b(why|explain|what'?s wrong|stuck|held|danger|red)\b/.test(text)) {
    const t = about.task
      || (selected && tasks.find((x) => blockFiles(x).map(rel).includes(selected)))
      || tasks.find((x) => x.state === 'fault')
      || tasks.find((x) => x.state === 'danger')
    if (!t) return { intent: 'why', text: about.file ? `${about.file} is not in any block: the migration does not touch it.` : 'No signal is at danger or fault right now.' }
    return { intent: 'why', text: explain(state, t, rel), focus: t.id }
  }

  if (/\b(fault|faults|failing|failed|broken|errors?)\b/.test(text)) {
    const bad = tasks.filter((t) => t.state === 'fault')
    return bad.length
      ? { intent: 'faults', text: `${bad.length} block${bad.length > 1 ? 's are' : ' is'} at fault. Nothing from ${bad.length > 1 ? 'them' : 'it'} was committed.`, lines: bad.map((t) => explain(state, t, rel)), focus: bad[0].id }
      : { intent: 'faults', text: `No faults right now.${state.spads.length ? ` ${state.spads.length} SPAD(s) were caught earlier and never committed.` : ''}` }
  }

  if (/\b(who|agents?|working|busy|occupied|status|progress|how far|done|left|next|ready)\b/.test(text)) {
    const s = summary(state)
    const busy = tasks.filter((t) => t.agent && !t.commit)
    return {
      intent: 'status',
      text: `${s.cleared}/${s.total} blocks cleared. ${busy.length ? `${busy.length} agent${busy.length > 1 ? 's' : ''} in section` : 'No agent in section'}, ${s.clear} green waiting, ${s.danger} at danger${s.fault ? `, ${s.fault} at fault` : ''}.`,
      lines: tasks.map((t) => `${t.id.padEnd(15)} ${t.state.toUpperCase()}${t.agent && !t.commit ? ` · ${t.agent}` : ''}${t.commit ? ` · ${t.commit.slice(0, 7)}` : ''}`),
    }
  }

  if (about.task || about.file) {
    return about.task ? { intent: 'why', text: explain(state, about.task, rel), focus: about.task.id } : { intent: 'blast', text: `${about.file} is not in any block.`, focus: about.file }
  }
  return { intent: 'unknown', text: 'Not sure what you mean. Try one of these:', lines: EXAMPLES }
}
