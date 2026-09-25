import '@fontsource/ibm-plex-sans-condensed/500.css'
import '@fontsource/ibm-plex-sans-condensed/600.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import './styles.css'
import staticAtlas from './data/atlas-data.json'
import momentAtlas from './data/atlas-moment.json'
import { layoutAtlas, LABEL_OFFSET } from './layout.js'
import { dependentsOf, baselineIndex } from './state.js'
import { buildStops, findingsAt, signalStateAt, blockIndex, faultsCaught, checkLamps, stripRoot } from './signal.js'
import { reduce, describe, summary, timeline, verifyChain, canonical } from '../../chainguard/src/signalbox-state.js'
import { ask, EXAMPLES } from '../../chainguard/src/dispatch.js'
import { blastRadius as blastOf, blockRisk as riskOf, crewStats, tourStep, towerLanes } from './insights.js'

// A recorded ledger (from a real Bob run) ships with the static build for replay. Optional.
const ledgerModules = import.meta.glob('./data/ledger.json', { eager: true, import: 'default' })
const staticLedger = Object.values(ledgerModules)[0] || []

const SVGNS = 'http://www.w3.org/2000/svg'
const $ = (sel) => document.querySelector(sel)

function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  setAttrs(node, attrs)
  node.append(...children.flat(Infinity).filter((c) => c != null && c !== false))
  return node
}
function s(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVGNS, tag)
  setAttrs(node, attrs)
  node.append(...children.flat(Infinity).filter((c) => c != null && c !== false))
  return node
}
function setAttrs(node, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
    else node.setAttribute(k, v === true ? '' : v)
  }
}

// ------------------------------------------------------------------ model

const model = {
  mode: 'replay', // live | replay | baseline
  atlas: staticAtlas,
  events: staticLedger,
  live: null,
  stop: 0,
  follow: true,
  selected: null,
  focusTask: null,
  focusRule: null,
  blast: null,
  playing: null,
}
let layout
let lineColor
let view

// Before a signal box is opened there is still a real plan (from the baseline scan): show it
// with every block waiting, exactly as `signalbox init` would open it.
function planOnlyState() {
  const a = model.atlas
  return reduce([{ t: 'init', at: new Date(0).toISOString(), base: '', scanDir: a.root, allow: [], plan: { waves: a.plan.waves, tasks: a.plan.tasks.map((t) => ({ ...t, files: t.files.map((f) => `${a.root}/${f}`) })) } }])
}

function derive() {
  const { atlas, events } = model
  const stops = buildStops(atlas, events)
  const i = Math.max(0, Math.min(stops.length - 1, model.stop))
  const atHead = i === stops.length - 1
  let findings = findingsAt(atlas, events, i, stops)
  if (model.mode === 'live' && atHead && model.live) {
    findings = {}
    for (const f of model.live.present) findings[f] = model.live.findings[f] || []
  }
  const sb = signalStateAt(events, i, stops) || planOnlyState()
  const base = atlas.snapshots[baselineIndex(atlas)]
  return {
    stops, i, atHead, findings, sb,
    blocks: blockIndex(sb),
    baseline: base.findings,
    event: stops[i].kind === 'event' ? events[stops[i].event] : null,
    faults: stops[i].kind === 'event' ? faultsCaught(events, stops[i].event) : 0,
    opened: events.length > 0,
  }
}

function stationStatus(id) {
  const list = view.findings[id]
  if (!list) return { status: 'absent', count: 0, baseline: 0 }
  const count = list.length
  const baseline = view.baseline[id]?.length || 0
  return { status: count > 0 ? 'legacy' : baseline > 0 ? 'migrated' : 'clean', count, baseline }
}

// ------------------------------------------------------------------ map

let stationNodes = {}
let edgeNodes = []

const stationRadius = (count) => (count > 0 ? 9 + 2.4 * Math.sqrt(count) : 8)

function buildMap() {
  layout = layoutAtlas(model.atlas.files)
  lineColor = Object.fromEntries(layout.lines.map((l) => [l.dir, l.color]))
  stationNodes = {}
  edgeNodes = []
  const svg = $('#map')
  svg.replaceChildren()
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`)
  svg.style.setProperty('--map-w', `${layout.width}px`)

  const defs = s('defs', {},
    s('pattern', { id: 'grid', width: 24, height: 24, patternUnits: 'userSpaceOnUse' }, s('path', { d: 'M24 0H0V24', class: 'grid-line' })))
  const gGrid = s('rect', { x: 0, y: 0, width: layout.width, height: layout.height, fill: 'url(#grid)' })
  const gEdges = s('g', { class: 'edges' })
  for (const e of layout.edges) {
    const p = s('path', { d: e.path, class: 'edge', stroke: lineColorOf(e.to) })
    edgeNodes.push({ ...e, node: p })
    gEdges.append(p)
  }
  const gLines = s('g', { class: 'lines' })
  for (const l of layout.lines) {
    const label = l.dir.toUpperCase()
    const bw = 22 + label.length * 9
    gLines.append(
      s('line', { x1: l.x, x2: l.x, y1: l.y1, y2: l.y2, class: 'line-casing' }),
      s('line', { x1: l.x, x2: l.x, y1: l.y1, y2: l.y2, class: 'line', stroke: l.color, style: `color:${l.color}` }),
      s('g', { class: 'line-badge', transform: `translate(${l.x},${l.y1 - 26})` },
        s('rect', { x: -bw / 2, y: -14, width: bw, height: 28, rx: 14, fill: l.color, style: `color:${l.color}` }),
        s('text', { x: 0, y: 4.5, 'text-anchor': 'middle', fill: readableOn(l.color) }, label)),
    )
  }
  const gStations = s('g', { class: 'stations' })
  for (const st of Object.values(layout.stations)) {
    const ring = s('circle', { class: 'st-ring', cx: st.x, cy: st.y, r: 8 })
    const block = s('circle', { class: 'st-block', cx: st.x, cy: st.y, r: 16 })
    const count = s('text', { class: 'st-count', x: st.x, y: st.y + 4, 'text-anchor': 'middle' })
    const check = s('path', { class: 'st-check', d: `M${st.x - 4},${st.y}l3,3l5,-6` })
    const tick = s('rect', { class: 'st-tick', x: st.x + 5, y: st.y - 2, width: 9, height: 4, rx: 1, fill: lineColor[st.dir] })
    const halo = s('circle', { class: 'st-halo', cx: st.x, cy: st.y, r: 26 })
    const label = s('text', { class: 'st-label', x: st.x + LABEL_OFFSET, y: st.y + 5 }, st.name)
    const waveText = s('text', { x: 9, y: 13, 'text-anchor': 'middle' })
    const wave = s('g', { class: 'st-wave', transform: `translate(${st.x - 48},${st.y - 9})` }, s('rect', { width: 18, height: 18, rx: 3 }), waveText)
    const agentText = s('text', { x: 8, y: 11.5 })
    const agent = s('g', { class: 'st-agent', transform: `translate(${st.x + LABEL_OFFSET},${st.y + 12})` }, s('rect', { class: 'st-agent-bg', height: 16, rx: 8 }), agentText)
    const g = s('g', {
      class: 'station', tabindex: 0, role: 'button', 'data-id': st.id,
      onclick: () => select(st.id),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(st.id) } },
      onmouseenter: () => peek(st.id),
      onmouseleave: () => peek(null),
    }, halo, block, tick, ring, check, count, wave, label, agent, s('circle', { class: 'st-hit', cx: st.x, cy: st.y, r: 22 }), s('title', {}, st.id))
    stationNodes[st.id] = { g, ring, count, st, waveText, agent, agentText }
    gStations.append(g)
  }
  svg.append(defs, gGrid, gEdges, gLines, gStations)
}

function lineColorOf(stationId) {
  return lineColor[layout.stations[stationId]?.dir] || '#888'
}

// Dark or light label text, whichever reads better on a line colour (WCAG relative luminance).
function readableOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#0b0f19' : '#ffffff'
}

function peek(id) {
  for (const e of edgeNodes) e.node.classList.toggle('peek', id != null && (e.from === id || e.to === id))
}

function taskFiles(taskId) {
  const t = view.sb.tasks[taskId]
  const strip = stripRoot(view.sb.scanDir)
  return t ? [...t.files, ...t.extra].map(strip) : []
}

function updateMap() {
  const focus = new Set(
    model.focusTask ? taskFiles(model.focusTask)
    : model.focusRule ? Object.entries(view.findings).filter(([, l]) => l.some(([id]) => id === model.focusRule)).map(([f]) => f)
    : [],
  )
  const spadNow = new Set(liveViolations().map((v) => v.file))
  const heldNow = new Set(view.event?.t === 'deny' ? taskFiles(view.event.task) : [])
  const drill = activeDrill()
  if (drill) spadNow.add(stripRoot(view.sb.scanDir)(drill.file))
  const broken = new Set((drill?.usedBy || []).map(stripRoot(view.sb.scanDir)))
  const blast = model.blast && layout.stations[model.blast] ? blastRadius(model.blast) : null
  const related = new Set()
  if (model.selected) {
    related.add(model.selected)
    for (const f of model.atlas.files.find((f) => f.id === model.selected)?.imports || []) related.add(f)
    for (const f of dependentsOf(model.atlas, model.selected)) related.add(f)
  }
  const risk = model.heat ? blockRisk() : null
  for (const [id, n] of Object.entries(stationNodes)) {
    const { status, count } = stationStatus(id)
    const b = view.blocks[id]
    n.g.dataset.status = status
    n.g.dataset.block = spadNow.has(id) ? 'spad' : b ? b.state : 'none'
    n.g.classList.toggle('held', heldNow.has(id))
    n.g.classList.toggle('broken', broken.has(id))
    const r = risk && b && view.sb.tasks[b.task]?.state !== 'cleared' ? risk[b.task] : null
    if (r) n.g.dataset.risk = r.level
    else delete n.g.dataset.risk
    n.ring.setAttribute('r', stationRadius(count))
    n.count.textContent = count > 0 ? String(count) : ''
    const task = b && view.sb.tasks[b.task]
    n.waveText.textContent = task ? String(task.wave) : ''
    n.g.classList.toggle('has-wave', Boolean(task))
    const occupied = b && (b.state === 'occupied' || b.state === 'fault') && b.agent
    n.agentText.textContent = occupied ? b.agent.toUpperCase() : ''
    n.agent.querySelector('rect').setAttribute('width', occupied ? 16 + b.agent.length * 7.4 : 0)
    n.agent.style.setProperty('--c', occupied ? agentColor(b.agent) : '')
    n.g.setAttribute('aria-label', `${id}: ${status === 'legacy' ? `${count} legacy call sites` : status}${b ? `, block ${b.task} ${b.state}${occupied ? ` by ${b.agent}` : ''}` : ''}`)
    n.g.classList.toggle('selected', model.selected === id)
    n.g.classList.toggle('dim', blast ? !blast.has(id) : (focus.size > 0 && !focus.has(id)) || (!focus.size && related.size > 0 && !related.has(id)))
    n.g.classList.toggle('blast', Boolean(blast && blast.has(id) && blast.get(id) > 0))
    n.g.classList.toggle('blast-src', Boolean(blast && blast.get(id) === 0))
    if (blast?.has(id)) n.g.style.setProperty('--d', String(blast.get(id)))
  }
  for (const e of edgeNodes) {
    const on = model.selected && (e.from === model.selected || e.to === model.selected)
    e.node.classList.toggle('on', Boolean(on))
    e.node.style.stroke = ''
  }
}

function flashTouched(files) {
  for (const f of files) {
    const n = stationNodes[f]
    if (!n) continue
    n.g.classList.remove('touched')
    void n.g.getBBox()
    n.g.classList.add('touched')
  }
}

// ------------------------------------------------------------------ masthead

const shown = {}
function tween(key, el, to) {
  const from = shown[key] ?? to
  shown[key] = to
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) return void (el.textContent = String(to))
  const t0 = performance.now()
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 600)
    el.textContent = String(Math.round(from + (to - from) * (1 - (1 - k) ** 3)))
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function buildStats() {
  const cell = (key, label) =>
    h('div', { class: `stat stat-${key}` }, h('dt', {}, label), h('dd', {}, h('span', { class: 'num', id: `stat-${key}` }), h('span', { class: 'sub', id: `stat-${key}-sub` })))
  $('#stats').replaceChildren(
    cell('calls', 'Legacy call sites'),
    cell('blocks', 'Blocks cleared'),
    cell('agents', 'Agents on the network'),
    cell('faults', 'Faults caught'),
  )
}

function updateStats() {
  const calls = Object.values(view.findings).reduce((n, l) => n + l.length, 0)
  const baseCalls = Object.values(view.baseline).reduce((n, l) => n + l.length, 0)
  const sum = summary(view.sb)
  tween('calls', $('#stat-calls'), calls)
  $('#stat-calls-sub').textContent = baseCalls - calls > 0 ? `−${baseCalls - calls} since baseline` : 'baseline'
  tween('blocks', $('#stat-blocks'), sum.cleared)
  $('#stat-blocks-sub').textContent = `of ${sum.total} in ${view.sb.waves} waves`
  tween('agents', $('#stat-agents'), sum.agents.length)
  $('#stat-agents-sub').textContent = sum.agents.join(' · ') || (view.opened ? 'none' : 'box not opened')
  tween('faults', $('#stat-faults'), view.faults)
  $('#stat-faults-sub').textContent = view.faults ? 'stopped before commit' : ''
  document.body.dataset.done = String(calls === 0)
  const files = Object.keys(view.findings).length || 1
  const clean = Object.values(view.findings).filter((l) => l.length === 0).length
  const pct = Math.round((clean / files) * 100)
  $('#health-fill').style.width = `${pct}%`
  $('#health-label').textContent = `Network health ${pct}% · ${clean} of ${files} stations free of legacy calls`
  $('#health').setAttribute('aria-valuenow', String(pct))
  const badge = $('#mode')
  badge.dataset.mode = model.mode
  badge.textContent = model.mode === 'live' ? (view.atHead ? 'Live' : 'Live · paused') : model.mode === 'replay' ? 'Replay' : 'Baseline'
}

// ------------------------------------------------------------------ signal box panel (board)

const CHECK_LETTER = { scope: 'S', contract: 'C', scan: 'L', tests: 'T' }
const CHECK_NAME = { scope: 'Scope', contract: 'Contract', scan: 'Legacy scan', tests: 'Isolated tests' }
const STATUS_TEXT = { danger: 'AT DANGER', clear: 'CLEAR', occupied: 'OCCUPIED', fault: 'FAULT', cleared: 'CLEARED' }

function flap(text, width, cls = '') {
  const padded = text.toUpperCase().padEnd(width).slice(0, width)
  return h('span', { class: `flap ${cls}` }, [...padded].map((c, i) => h('i', { style: `--i:${i}` }, c === ' ' ? ' ' : c)))
}

function updateBoard() {
  const head = h('div', { class: 'board-row board-head', role: 'row' },
    ['Signal', 'Wave', 'Block', 'Risk', 'Train', 'Track circuit', 'Status'].map((t) => h('span', { role: 'columnheader' }, t)))
  const risk = blockRisk()
  const tasks = Object.values(view.sb.tasks).sort((a, b) => a.wave - b.wave || a.id.localeCompare(b.id))
  const rows = tasks.map((t) => {
    const lamps = checkLamps(t.lastVerify)
    return h('div', {
      class: `board-row st-${t.state}${model.focusTask === t.id ? ' focus' : ''}`,
      role: 'row', tabindex: 0,
      onmouseenter: () => { model.focusTask = t.id; updateMap() },
      onmouseleave: () => { model.focusTask = null; updateMap() },
      onfocus: () => { model.focusTask = t.id; updateMap() },
      onblur: () => { model.focusTask = null; updateMap() },
      onclick: () => select(taskFiles(t.id)[0]),
      onkeydown: (e) => { if (e.key === 'Enter') select(taskFiles(t.id)[0]) },
    },
      h('span', { class: `signal-head s-${t.state}`, 'aria-label': `signal ${STATUS_TEXT[t.state]}` }, h('i', { class: 'lamp red' }), h('i', { class: 'lamp amber' }), h('i', { class: 'lamp green' })),
      h('span', { class: 'wave-plate' }, String(t.wave)),
      h('span', { class: 'block-cell' }, flap(t.id, 14), h('span', { class: 'dest' }, taskFiles(t.id).map((f) => f.split('/').pop().replace(/\.(jsx?|tsx?)$/, '')).join(' · '))),
      h('span', { class: `risk r-${risk[t.id].level}`, title: `${t.findings || 0} legacy call sites · ${risk[t.id].reach} dependent files outside the block` }, risk[t.id].level.toUpperCase()),
      h('span', { class: 'train' }, t.agent && !t.commit ? t.agent.toUpperCase() : t.commit ? t.commit.slice(0, 7) : '—'),
      h('span', { class: 'lamps' }, lamps.map((l) => h('span', { class: `chk ${l.state}`, title: `${CHECK_NAME[l.key]}: ${l.state}` }, CHECK_LETTER[l.key]))),
      flap(STATUS_TEXT[t.state], 9, 'status'),
    )
  })
  $('#board-rows').replaceChildren(head, ...rows)
}

// ------------------------------------------------------------------ train describer

function updateDescriber() {
  const list = $('#describer')
  if (!view.opened) {
    list.replaceChildren(h('li', { class: 'td-empty' }, 'The signal box has not been opened yet. Run ', h('code', {}, 'npm run sb -- init'), ', then give each Bob subagent its block prompt.'))
    return
  }
  const upto = view.stops[view.i].event
  const items = model.events.slice(0, upto + 1).map((e, k) => ({ e, k })).reverse().slice(0, 40)
  list.replaceChildren(...items.map(({ e, k }) => {
    const kind = e.t === 'verify' ? (e.ok ? 'verify-ok' : 'fault') : e.t
    return h('li', { class: `td td-${kind}${k === upto ? ' now' : ''}` },
      h('button', { onclick: () => goTo(view.stops.findIndex((s) => s.event === k)) },
        h('time', {}, e.at.slice(11, 19)),
        h('span', { class: 'td-text' }, describe(e)),
        kind === 'fault' ? h('span', { class: 'td-why' }, faultReasons(e).join(' · ')) : null))
  }))
}

function faultReasons(v) {
  const c = v.checks || {}
  const out = []
  if (c.scope && !c.scope.ok) out.push(`SPAD: ${c.scope.outside.map((f) => f.split('/').pop()).join(', ')}`)
  if (c.contract && !c.contract.ok) out.push(`contract: ${c.contract.removed.map((r) => `${r.file.split('/').pop()}#${r.name}`).join(', ')}`)
  if (c.scan && !c.scan.ok) out.push(`scan: ${c.scan.remaining} left`)
  if (c.tests && !c.tests.ok) out.push(`tests: ${c.tests.failures?.[0]?.replace(/^(×|✗|FAIL)\s+/, '') || c.tests.summary}`)
  return out
}

// ------------------------------------------------------------------ control tower
// One lane per Bob subagent, straight from the ledger: what it holds, what it just did, and
// whether interlocking is holding it at a signal. Live mode streams it; replay steps through it.

const LANE_TEXT = { working: 'In section', held: 'Held at signal', fault: 'Fault · fixing', off: 'Off duty', standby: 'Standing by' }

function agentColor(agent) {
  const order = [...new Set(model.events.filter((e) => e.t === 'claim' || e.t === 'deny').map((e) => e.agent))]
  const k = order.indexOf(agent)
  return AGENT_COLORS[(k < 0 ? 0 : k) % AGENT_COLORS.length]
}

function updateTower() {
  const upto = view.opened ? view.stops[view.i].event : -1
  const lanes = view.opened && upto != null ? towerLanes(model.events, upto) : []
  const sum = summary(view.sb)
  const green = Object.values(view.sb.tasks).filter((t) => t.state === 'clear')
  const held = lanes.filter((l) => l.status === 'held').length
  $('#tower-sub').textContent = lanes.length
    ? `${sum.agents.length} Bob subagent${sum.agents.length === 1 ? '' : 's'} in section · ${held} held at a signal · ${green.length} green block${green.length === 1 ? '' : 's'} waiting`
    : `${green.length} green block${green.length === 1 ? '' : 's'} waiting for Bob subagents. Lanes open as agents claim them.`
  const cards = lanes.map((l) => {
    const t = l.task && view.sb.tasks[l.task]
    return h('li', { class: `lane l-${l.status}${l.fresh ? ' fresh' : ''}`, style: `--c:${agentColor(l.agent)}`, tabindex: 0,
      onclick: () => l.task && select(taskFiles(l.task)[0]),
      onkeydown: (e) => { if (e.key === 'Enter' && l.task) select(taskFiles(l.task)[0]) },
      onmouseenter: () => { model.focusTask = l.task || l.heldFor; updateMap() },
      onmouseleave: () => { model.focusTask = null; updateMap() },
    },
      h('div', { class: 'lane-top' },
        h('span', { class: 'lane-name' }, l.agent.toUpperCase()),
        h('span', { class: `signal-head s-${{ working: 'occupied', held: 'danger', fault: 'fault', off: 'cleared', standby: 'clear' }[l.status]}` }, h('i', { class: 'lamp red' }), h('i', { class: 'lamp amber' }), h('i', { class: 'lamp green' }))),
      h('p', { class: 'lane-status' }, LANE_TEXT[l.status]),
      h('p', { class: 'lane-block' }, t ? [h('b', {}, l.task), ` · wave ${t.wave} · `, taskFiles(l.task).map((f) => f.split('/').pop()).join(', ')] : l.status === 'off' ? 'Block cleared and committed' : l.status === 'held' ? 'Waiting at the signal, holding nothing' : '—'),
      l.heldFor ? h('p', { class: 'lane-held' }, h('b', {}, `Refused ${l.heldFor}: `), l.reason.replace(/^signal at danger: /, '')) : h('p', { class: 'lane-last' }, h('time', {}, l.last.at.slice(11, 19)), ' ', describe(l.last)),
      h('p', { class: 'lane-stats' }, h('b', {}, String(l.clears)), ' cleared · ', h('b', { class: l.faults ? 'f' : '' }, String(l.faults)), ' faults · ', h('b', { class: l.denies ? 'd' : '' }, String(l.denies)), ' refused'))
  })
  const ghosts = lanes.length ? [] : green.slice(0, 4).map((t, k) => h('li', { class: 'lane l-ghost' },
    h('div', { class: 'lane-top' }, h('span', { class: 'lane-name' }, `LANE ${k + 1}`)),
    h('p', { class: 'lane-status' }, 'Awaiting a subagent'),
    h('p', { class: 'lane-block' }, h('b', {}, t.id), ` · wave ${t.wave} · signal green`)))
  $('#lanes').replaceChildren(...cards, ...ghosts)
  document.body.classList.toggle('held-now', view.event?.t === 'deny')
}

// The drill whose stray edit is on the tracks at the current stop (it ends with a drill-end).
function activeDrill() {
  if (!view.opened) return null
  const upto = view.stops[view.i].event
  for (let k = upto; k >= 0; k--) {
    const e = model.events[k]
    if (e.t === 'drill-end') return null
    if (e.t === 'drill') return e
  }
  return null
}

function chaosFlash() {
  document.body.classList.remove('chaos')
  void document.body.offsetWidth
  document.body.classList.add('chaos')
  setTimeout(() => document.body.classList.remove('chaos'), 1600)
}

async function runDrill(kind, btn) {
  const all = document.querySelectorAll('.chaos-btn')
  all.forEach((b) => (b.disabled = true))
  try {
    const r = await fetch(`./api/drill?kind=${kind}`, { method: 'POST' })
    const body = await r.json()
    if (!r.ok) showCaption({ kind: 'fault', text: body.error })
  } catch (err) {
    showCaption({ kind: 'fault', text: `Drill failed: ${err.message}` })
  }
  setTimeout(() => all.forEach((b) => (b.disabled = false)), 7000)
  btn.blur()
}

function updateTowerActions() {
  const el = $('#tower-actions')
  if (model.mode === 'live') {
    if (el.dataset.mode === 'live') return
    el.dataset.mode = 'live'
    el.replaceChildren(
      h('button', { class: 'chaos-btn', title: 'Makes a real edit to a file no agent holds. The checks catch it, then the file is restored from git.', onclick: (e) => runDrill('spad', e.currentTarget) }, h('span', { 'aria-hidden': 'true' }, '⚡ '), 'Simulate chaos: SPAD'),
      h('button', { class: 'chaos-btn alt', title: 'Renames an export other files still import. The contract check catches it, then the file is restored from git.', onclick: (e) => runDrill('contract', e.currentTarget) }, 'Break a contract'))
    return
  }
  const first = model.events.findIndex((e) => e.t === 'drill')
  el.dataset.mode = model.mode
  el.replaceChildren(...(first < 0 ? [] : [h('button', { class: 'chaos-btn', onclick: () => { stopTour(); goTo(view.stops.findIndex((st) => st.event === first)); chaosFlash() } }, h('span', { 'aria-hidden': 'true' }, '⚡ '), 'Replay the chaos drill')]))
}

// ------------------------------------------------------------------ dispatcher desk
// Plain-language questions answered from the signal box state at the current stop, by the same
// deterministic desk Bob calls as `sb ask`. "Start …" answers with the dispatch to give Bob.

function askDesk(question) {
  const input = $('#ask-input')
  if (question != null) input.value = question
  const q = input.value.trim()
  const a = ask(q, { state: view.sb, files: model.atlas.files, selected: model.selected })
  const out = $('#ask-answer')
  out.dataset.intent = a.intent
  out.replaceChildren(...[
    h('p', { class: 'ask-q' }, h('span', {}, '›'), q || 'help'),
    h('p', { class: 'ask-a' }, a.text),
    a.lines?.length ? h('ul', { class: 'ask-lines' }, a.lines.map((l) => h('li', {}, a.intent === 'help' || a.intent === 'unknown' ? h('button', { class: 'ask-chip', onclick: () => askDesk(l) }, l) : l))) : null,
    a.prompt ? h('div', { class: 'prompt' },
      h('div', { class: 'prompt-head' }, h('p', { class: 'eyebrow' }, 'Dispatch for Bob (Agent mode)'), h('button', { class: 'copy', onclick: (e) => copy(a.prompt, e.currentTarget) }, 'Copy')),
      h('pre', {}, a.prompt)) : null,
  ].filter(Boolean))
  out.hidden = false
  if (a.blast && layout.stations[a.blast]) {
    model.blast = a.blast
    select(a.blast)
  } else if (a.focus && view.sb.tasks[a.focus]) {
    model.focusTask = a.focus
    updateMap()
    updateBoard()
  }
}

function buildDesk() {
  $('#ask').replaceChildren(
    h('form', { class: 'ask-form', onsubmit: (e) => { e.preventDefault(); askDesk() } },
      h('label', { for: 'ask-input', class: 'ask-label' }, 'Dispatcher'),
      h('input', { id: 'ask-input', type: 'text', autocomplete: 'off', placeholder: 'Ask the signal box… “Why is w2-lib at danger?”  (press / )' }),
      h('button', { type: 'submit', class: 'ask-go' }, 'Ask')),
    h('div', { class: 'ask-examples' }, EXAMPLES.slice(0, 4).map((x) => h('button', { type: 'button', class: 'ask-chip', onclick: () => askDesk(x) }, x))),
    h('div', { class: 'ask-answer', id: 'ask-answer', hidden: true, 'aria-live': 'polite' }),
    h('p', { class: 'ask-note' }, 'Answers are computed from the ledger by keyword intents, not a language model. Bob Agent mode uses the same desk from its terminal: ', h('code', {}, 'npm run -s sb -- ask "…"'), '.'))
}

// ------------------------------------------------------------------ train graph

const AGENT_COLORS = ['#ffb000', '#33b1ff', '#ff7eb6', '#42be65', '#08bdba', '#d4bbff', '#fa4d56', '#a7f0ba']

function updateGraph() {
  const el = $('#graph')
  const full = timeline(model.events)
  if (!full) {
    el.replaceChildren(h('p', { class: 'graph-empty' }, 'Bars appear here as Bob subagents claim blocks.'))
    return
  }
  const upto = view.stops[view.i].event
  const tl = timeline(model.events.slice(0, upto + 1))
  const now = Date.parse(model.events[upto].at)
  const agents = [...new Set(full.runs.map((r) => r.agent))]
  const color = agentColor
  const tasks = [...full.tasks].sort((a, b) => a.wave - b.wave || a.id.localeCompare(b.id))
  const W = Math.max(640, el.clientWidth || 900)
  const left = 150
  const right = 24
  const rowH = 30
  const top = 26
  const H = top + tasks.length * rowH + 30
  const span = Math.max(1, full.t1 - full.t0)
  const x = (t) => left + ((t - full.t0) / span) * (W - left - right)
  const rowY = Object.fromEntries(tasks.map((t, i) => [t.id, top + i * rowH]))

  const g = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'graph', role: 'img', 'aria-label': `Train graph: ${tl.runs.length} block occupations by ${agents.length} agents` })
  // time axis: minute marks
  const stepMs = [10e3, 30e3, 60e3, 120e3, 300e3, 600e3, 900e3, 1800e3, 3600e3].find((m) => span / m <= 8) || 7200e3
  for (let t = 0; t <= span; t += stepMs) {
    const xx = x(full.t0 + t)
    g.append(s('line', { x1: xx, x2: xx, y1: top - 6, y2: H - 24, class: 'g-grid' }),
      s('text', { x: xx, y: H - 8, class: 'g-axis', 'text-anchor': 'middle' }, t >= 60e3 ? `+${Math.round(t / 60e3)}m` : `+${Math.round(t / 1e3)}s`))
  }
  let lastWave = null
  for (const t of tasks) {
    const y = rowY[t.id]
    if (t.wave !== lastWave) {
      g.append(s('line', { x1: 8, x2: W - right, y1: y - 3, y2: y - 3, class: 'g-wave' }))
      lastWave = t.wave
    }
    g.append(s('text', { x: 12, y: y + rowH / 2 + 1, class: 'g-row' }, `W${t.wave}  ${t.id}`))
  }
  for (const r of tl.runs) {
    const y = rowY[r.task] + 7
    const end = r.end ?? now
    const bar = s('g', { class: `g-run o-${r.outcome}` },
      s('rect', { x: x(r.start), y, width: Math.max(3, x(end) - x(r.start)), height: rowH - 14, rx: 3, fill: color(r.agent), style: `color:${color(r.agent)}` }),
      x(end) - x(r.start) > 44 ? s('text', { x: x(r.start) + 6, y: y + 12, class: 'g-agent' }, r.agent.toUpperCase()) : null,
      r.verifies.map((v) => s('rect', { x: x(v.at) - 2, y: y - 4, width: 4, height: rowH - 6, rx: 1, class: v.ok ? 'g-ok' : 'g-fault' }, s('title', {}, v.ok ? 'track circuit clear' : `fault: ${v.failed.join(', ')}`))),
      r.outcome === 'cleared' ? s('circle', { cx: x(end), cy: y + (rowH - 14) / 2, r: 5, class: 'g-clear' }) : null,
      r.outcome === 'rolled-back' ? s('path', { d: `M${x(end) - 4},${y}l8,${rowH - 14}M${x(end) + 4},${y}l-8,${rowH - 14}`, class: 'g-rollback' }) : null,
      s('title', {}, `${r.agent} in ${r.task}: ${r.outcome}`))
    g.append(bar)
  }
  for (const e of model.events.slice(0, upto + 1).filter((e) => e.t === 'deny' && rowY[e.task] != null)) {
    const xx = x(Date.parse(e.at))
    const y = rowY[e.task] + rowH / 2
    g.append(s('path', { d: `M${xx},${y - 6}l6,6l-6,6l-6,-6z`, class: 'g-deny' }, s('title', {}, `${e.agent} held at signal`)))
  }
  g.append(s('line', { x1: x(now), x2: x(now), y1: top - 10, y2: H - 22, class: 'g-now' }))
  el.replaceChildren(g, h('ul', { class: 'g-legend' }, agents.map((a) => h('li', {}, h('i', { style: `background:${color(a)}` }), a))))
}

// ------------------------------------------------------------------ alert strip

// Edits happening right now that no occupied block owns (or that touch protected files).
function liveViolations() {
  if (model.mode !== 'live' || !view.atHead || !model.live) return []
  return Object.entries(model.live.owners || {}).filter(([, o]) => o === null || o === 'protected').map(([f, o]) => ({ file: f, protected: o === 'protected' }))
}

function drillAlert(e) {
  return h('div', { class: 'alert spad chaos' },
    h('strong', {}, 'Chaos drill'),
    h('span', {}, `${e.kind === 'contract' ? `${e.renamed.from} renamed in` : 'Stray edit to'} ${e.file}. Caught in ${e.detectMs} ms: `, [e.caught.scope, e.caught.contract].filter(Boolean).join(' · ')),
    h('span', { class: 'alert-note' }, 'Every release is refused while this edit is on the tracks. The signal box restores the file from git.'))
}

function updateAlert() {
  const e = view.event
  const el = $('#alert')
  let content = null
  const live = liveViolations()
  const drill = activeDrill()
  if (drill && e?.t !== 'drill') {
    content = drillAlert(drill)
  } else if (live.length && e?.t !== 'drill') {
    content = h('div', { class: 'alert spad' },
      h('strong', {}, 'SPAD in progress'),
      h('span', {}, live.map((v) => `${v.file}${v.protected ? ' (protected)' : ''}`).join(', ')),
      h('span', { class: 'alert-note' }, 'No occupied block owns this edit. Every release is refused until it is claimed or reverted.'))
  } else if (e?.t === 'drill') {
    content = drillAlert(e)
  } else if (e?.t === 'drill-end') {
    content = h('div', { class: 'alert rollback' }, h('strong', {}, 'Drill over'), h('span', {}, `${e.file} ${e.restored ? 'restored from git' : 'left as is (someone changed it)'} after ${(e.heldMs / 1000).toFixed(1)} s. No agent's work was touched.`))
  } else if (e?.t === 'verify' && !e.ok) {
    const spad = e.checks.scope && !e.checks.scope.ok
    content = h('div', { class: `alert ${spad ? 'spad' : 'fault'}` },
      h('strong', {}, spad ? 'SPAD' : 'Fault'),
      h('span', {}, `${e.task} · ${e.agent}: `, faultReasons(e).join(' · ')),
      h('span', { class: 'alert-note' }, 'Block held. Nothing was committed.'))
  } else if (e?.t === 'deny') {
    content = h('div', { class: 'alert held' }, h('strong', {}, 'Held at signal'), h('span', {}, `${e.agent} → ${e.task}: ${e.reason}`))
  } else if (e?.t === 'recover') {
    content = h('div', { class: 'alert rollback' }, h('strong', {}, 'Recovered'), h('span', {}, `${e.task}: ${e.files.length} files restored from the black-box recorder (${e.from.slice(0, 19)}).`))
  } else if (e?.t === 'rollback') {
    content = h('div', { class: 'alert rollback' }, h('strong', {}, 'Rolled back'), h('span', {}, `${e.task}: ${e.files.length} files restored. Other blocks kept running.`))
  } else if (e?.t === 'clear') {
    content = h('div', { class: 'alert cleared' }, h('strong', {}, 'Cleared'), h('span', {}, `${e.task} by ${e.agent} committed as ${e.commit.slice(0, 7)}. Scope, contract, scan and isolated tests passed.`))
  }
  el.replaceChildren(...(content ? [content] : []))
}

// ------------------------------------------------------------------ timeline

function buildTimeline() {
  const n = view.stops.length
  const ticks = view.stops.map((stop, i) =>
    h('button', {
      class: `tick k-${stop.type || 'commit'}`, style: `--pos:${n === 1 ? 0 : (i / (n - 1)) * 100}%`, 'data-i': i,
      'aria-label': stop.kind === 'event' ? describe(model.events[stop.event]) : `${stop.label}: ${stop.title}`,
      onclick: () => goTo(i),
    }, h('span', { class: 'tick-dot' }), n <= 12 ? h('span', { class: 'tick-label' }, stop.kind === 'event' ? stop.label : stop.label) : null))
  const play = h('button', { class: 'play', id: 'play', 'aria-label': 'Replay', onclick: togglePlay, disabled: n < 2 },
    s('svg', { viewBox: '0 0 16 16', width: 14, height: 14 }, s('path', { d: 'M4 2.5v11l9-5.5z', fill: 'currentColor' })))
  const tour = h('button', { class: 'tour-btn', id: 'tour', onclick: () => (model.tour ? stopTour() : startTour()), disabled: !view.opened, title: view.opened ? 'Guided replay with captions' : 'Available once the signal box has a run' }, 'Tour')
  $('#timeline').replaceChildren(
    play,
    tour,
    h('div', { class: `track${n === 1 ? ' pending' : ''}` }, h('div', { class: 'track-fill', id: 'track-fill' }), ticks,
      n === 1 ? h('span', { class: 'track-note' }, 'Bob subagents arrive here →') : null),
    h('div', { class: 'commit', id: 'commit' }),
  )
}

function updateTimeline() {
  const n = view.stops.length
  document.querySelectorAll('.tick').forEach((t) => {
    const i = Number(t.dataset.i)
    t.classList.toggle('current', i === view.i)
    t.classList.toggle('past', i < view.i)
  })
  $('#track-fill').style.width = n === 1 ? '0%' : `${(view.i / (n - 1)) * 100}%`
  const stop = view.stops[view.i]
  const when = new Date(stop.at).toISOString().slice(11, 19)
  const parts = stop.kind === 'event'
    ? [h('span', { class: 'subject' }, describe(model.events[stop.event])), h('span', { class: 'when' }, `${when} UTC · ${view.i + 1}/${n}`)]
    : [h('span', { class: 'mono' }, stop.label), ' ', h('span', { class: 'subject' }, stop.title), h('span', { class: 'when' }, `${view.i + 1}/${n}`)]
  if (model.mode === 'live' && !view.atHead) parts.push(h('button', { class: 'follow', onclick: () => { model.follow = true; goTo(n - 1) } }, 'Back to live'))
  if (!view.opened && n === 1) parts.push(h('span', { class: 'hint' }, 'Baseline only. Open the signal box and start Bob subagents to see them here.'))
  $('#commit').replaceChildren(...parts)
}

function goTo(i) {
  const n = view.stops.length
  model.stop = Math.max(0, Math.min(n - 1, i))
  model.follow = model.stop === n - 1
  render()
}

// ------------------------------------------------------------------ guided tour
// Replays the ledger like a film: dwells on faults, clears and held signals, opens the block in
// question, and captions each step in plain words. Everything shown is the recorded run.

function startTour() {
  if (!view.opened) return
  stopPlay()
  stopTour()
  document.body.classList.add('touring')
  $('#tour').classList.add('on')
  model.tour = { i: 0 }
  goTo(0)
  select(null)
  tourTick()
}

function tourTick() {
  if (!model.tour) return
  const stop = view.stops[view.i]
  const step = tourStep(model.events, stop.event)
  const files = step.focus ? taskFiles(step.focus) : []
  if (['fault', 'clear', 'held', 'rollback', 'recover'].includes(step.kind) && files[0]) select(files[0])
  else if (step.kind === 'chaos' && step.file) select(stripRoot(view.sb.scanDir)(step.file))
  else if (step.kind === 'init') select(null)
  showCaption(step)
  if (step.kind === 'chaos') chaosFlash()
  model.tour.timer = setTimeout(() => {
    if (!model.tour) return
    if (view.i >= view.stops.length - 1) return finishTour()
    goTo(view.i + 1)
    tourTick()
  }, step.dwell)
}

function finishTour() {
  const base = Object.values(view.baseline).reduce((n, l) => n + l.length, 0)
  const now = Object.values(view.findings).reduce((n, l) => n + l.length, 0)
  const sum = summary(view.sb)
  select(null)
  showCaption({ kind: 'done', text: `${sum.cleared} of ${sum.total} blocks cleared by ${crewStats(model.events, view.stops[view.i].event).length} Bob subagents. Legacy call sites: ${base} → ${now}. Every step is in a hash-chained ledger.` })
  model.tour.timer = setTimeout(stopTour, 6000)
}

function stopTour() {
  if (model.tour?.timer) clearTimeout(model.tour.timer)
  model.tour = null
  document.body.classList.remove('touring')
  $('#tour')?.classList.remove('on')
  $('#caption')?.classList.remove('show')
}

function showCaption(step) {
  const el = $('#caption')
  el.dataset.kind = step.kind
  el.replaceChildren(h('span', { class: 'cap-kind' }, { fault: 'Fault', held: 'Held at signal', clear: 'Cleared', done: 'Result', init: 'Signal box', rollback: 'Rolled back', recover: 'Recovered', claim: 'Claim', verify: 'Track circuit', extend: 'Extend', chaos: 'Chaos drill', restored: 'Drill over' }[step.kind] || step.kind), h('span', { class: 'cap-text' }, step.text))
  el.classList.remove('show')
  void el.offsetWidth
  el.classList.add('show')
}

function togglePlay() {
  if (model.playing) return stopPlay()
  if (view.i === view.stops.length - 1) goTo(0)
  $('#play').classList.add('on')
  model.playing = setInterval(() => {
    if (view.i >= view.stops.length - 1) return stopPlay()
    goTo(view.i + 1)
  }, 1100)
}
function stopPlay() {
  clearInterval(model.playing)
  model.playing = null
  $('#play')?.classList.remove('on')
}

// ------------------------------------------------------------------ blast radius

function blastRadius(id) {
  return blastOf(model.atlas.files, id)
}

// ------------------------------------------------------------------ risk

function blockRisk() {
  return riskOf(model.atlas.files, Object.values(view.sb.tasks), (t) => taskFiles(t.id))
}

// ------------------------------------------------------------------ crew roster

function crew() {
  if (!view.opened) return []
  return crewStats(model.events, view.stops[view.i].event).map((a) => ({ ...a, color: agentColor(a.agent) }))
}

function crewSection() {
  const list = crew()
  if (!list.length) return null
  const fmt = (ms) => (ms >= 60e3 ? `${Math.floor(ms / 60e3)}m ${Math.round((ms % 60e3) / 1e3)}s` : `${Math.round(ms / 1e3)}s`)
  return [
    h('p', { class: 'eyebrow' }, `Crew · ${list.length} Bob subagent${list.length > 1 ? 's' : ''}`),
    h('ul', { class: 'crew' }, list.map((a) => h('li', { style: `--c:${a.color}` },
      h('span', { class: 'crew-name' }, a.agent.toUpperCase()),
      h('span', { class: 'crew-state' }, a.active ? `in ${a.active}` : a.cleared ? 'off duty' : 'standing by'),
      h('span', { class: 'crew-stats' },
        h('b', {}, String(a.cleared)), ' cleared · ',
        h('b', {}, String(a.releases)), ' releases · ',
        h('b', { class: a.faults ? 'f' : '' }, String(a.faults)), ' faults fixed · ',
        h('b', {}, fmt(a.ms)))))),
  ]
}

// ------------------------------------------------------------------ Bob's change (diff viewer)

function diffFor(task) {
  return task.commit ? model.atlas.snapshots.find((s) => s.commit === task.commit)?.diff || null : null
}

function openDiff(task) {
  const patch = diffFor(task)
  if (!patch) return
  const lines = patch.split('\n')
  const added = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length
  const removed = lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).length
  const cls = (l) => (l.startsWith('diff --git') ? 'd-file' : l.startsWith('@@') ? 'd-hunk' : l.startsWith('+++') || l.startsWith('---') || l.startsWith('index ') ? 'd-meta' : l.startsWith('+') ? 'd-add' : l.startsWith('-') ? 'd-del' : 'd-ctx')
  const dialog = $('#diff')
  dialog.replaceChildren(
    h('div', { class: 'diff-head' },
      h('div', {}, h('p', { class: 'eyebrow' }, `${task.id} · committed ${task.commit.slice(0, 7)}`),
        h('h2', {}, `What ${task.agent || 'the agent'} changed`),
        h('p', { class: 'diff-stat' }, h('span', { class: 'd-add' }, `+${added}`), ' ', h('span', { class: 'd-del' }, `−${removed}`), ' · passed scope, contract, scan and isolated tests before this commit')),
      h('button', { class: 'back', 'aria-label': 'Close', onclick: () => dialog.close() }, '✕')),
    h('pre', { class: 'diff-body' }, lines.map((l) => h('span', { class: cls(l) }, `${l}\n`))),
  )
  dialog.showModal()
}

// ------------------------------------------------------------------ ledger integrity badge

const sha256hex = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join('')

async function updateLedgerBadge() {
  const el = $('#ledger')
  if (!model.events.length || !globalThis.crypto?.subtle) return el.replaceChildren()
  const r = await verifyChain(model.events, sha256hex)
  el.onclick = openVerifier
  el.tabIndex = 0
  el.onkeydown = (e) => { if (e.key === 'Enter') openVerifier() }
  el.dataset.state = !r.chained ? 'unchained' : r.ok ? 'ok' : 'broken'
  el.replaceChildren(!r.chained ? 'Ledger unsigned' : r.ok ? `Ledger verified · ${r.checked} events · ${r.head.slice(0, 8)}` : `Ledger tampered at event ${r.brokenAt + 1}`)
  el.title = !r.chained ? 'Written by an older signalbox without a hash chain' : r.ok ? 'Every event is SHA-256 chained to the previous one and re-verified in your browser' : r.reason
}

// Verify it yourself: re-hash every event in this browser, one by one, then tamper with a copy.
async function openVerifier() {
  const dialog = $('#verify')
  const rows = model.events.map((e, k) => h('li', { class: 'v-row', 'data-k': k },
    h('span', { class: 'v-n' }, String(k + 1).padStart(3, '0')),
    h('span', { class: 'v-text' }, describe(e)),
    h('code', { class: 'v-h' }, (e.h || '—').slice(0, 12))))
  const status = h('p', { class: 'v-status' }, 'Re-hashing every event with SHA-256 in your browser…')
  const tamper = h('button', { class: 'chaos-btn alt', disabled: true, onclick: () => runChain(true) }, 'Tamper test: edit one event')
  dialog.replaceChildren(
    h('div', { class: 'diff-head' },
      h('div', {}, h('p', { class: 'eyebrow' }, 'Tamper-evident ledger'), h('h2', {}, 'Verify it yourself'),
        h('p', { class: 'diff-stat' }, 'Each event stores the hash of the one before it. Change any past event and every hash after it stops matching.')),
      h('button', { class: 'back', 'aria-label': 'Close', onclick: () => dialog.close() }, '✕')),
    status,
    h('ol', { class: 'v-list' }, rows),
    h('div', { class: 'v-actions' }, tamper, h('button', { class: 'heat-btn', onclick: () => runChain(false) }, 'Verify again')))
  dialog.showModal()
  const fast = matchMedia('(prefers-reduced-motion: reduce)').matches
  async function runChain(tampered) {
    tamper.disabled = true
    const events = model.events.map((e) => ({ ...e }))
    // The tamper test rewrites a fault as a pass (or, with no fault, renames an agent) in a copy.
    let victim = -1
    if (tampered) {
      victim = events.findIndex((e) => e.t === 'verify' && !e.ok)
      if (victim >= 0) events[victim].ok = true
      else { victim = events.findIndex((e) => e.agent); if (victim >= 0) events[victim].agent = 'someone-else' }
    }
    rows.forEach((r) => { r.className = 'v-row' })
    let prev = null
    let broken = -1
    for (let k = 0; k < events.length; k++) {
      const e = events[k]
      const want = await sha256hex(`${prev ?? ''}${canonical(e)}`)
      const ok = broken < 0 && (e.prev ?? null) === prev && e.h === want
      if (!ok && broken < 0) broken = k
      rows[k].classList.add(ok ? 'ok' : 'bad')
      if (k === victim) rows[k].classList.add('victim')
      rows[k].querySelector('.v-h').textContent = want.slice(0, 12)
      if (!fast && k % 2 === 0) await new Promise((r) => setTimeout(r, 18))
      if (k === broken || k === victim) rows[k].scrollIntoView({ block: 'nearest' })
      prev = e.h
    }
    status.className = `v-status ${broken < 0 ? 'ok' : 'bad'}`
    status.textContent = broken < 0
      ? `All ${events.length} events verified. Head ${prev?.slice(0, 16)}. This is the same check \`sb audit\` runs in CI.`
      : tampered
        ? `Tampered copy: event ${victim + 1} was edited in memory ("${describe(model.events[victim])}"). The chain breaks at event ${broken + 1}. The real ledger is untouched.`
        : `Chain broken at event ${broken + 1}.`
    tamper.disabled = false
  }
  runChain(false)
}

// ------------------------------------------------------------------ side panel

function overviewPanel() {
  const byRule = {}
  for (const list of Object.values(view.findings)) for (const [id] of list) if (id !== '?') byRule[id] = (byRule[id] || 0) + 1
  const ranked = Object.entries(byRule).sort((a, b) => b[1] - a[1])
  const max = ranked[0]?.[1] || 1
  const sum = summary(view.sb)
  const calls = Object.values(view.findings).reduce((n, l) => n + l.length, 0)
  return [
    h('p', { class: 'eyebrow' }, 'Signal box'),
    h('h2', {}, calls === 0 ? 'All blocks cleared' : sum.agents.length ? `${sum.agents.length} agent${sum.agents.length > 1 ? 's' : ''} on the network` : 'Legacy lines in service'),
    h('p', { class: 'lede' }, view.opened
      ? `${sum.cleared} of ${sum.total} blocks cleared. Every block is released only after its scope, exported contract, legacy scan and tests pass on an isolated copy of the code, and is then committed on its own.`
      : 'Bob subagents will each claim a block, the files one task owns. A block\'s signal stays at danger until every earlier wave has cleared.'),
    crewSection(),
    ranked.length ? h('p', { class: 'eyebrow' }, 'Legacy patterns still in service') : null,
    h('ul', { class: 'rules' }, ranked.map(([id, n]) => {
      const r = model.atlas.rules[id]
      return h('li', {},
        h('button', {
          class: `rule${model.focusRule === id ? ' on' : ''}`, 'aria-pressed': String(model.focusRule === id),
          onclick: () => { model.focusRule = model.focusRule === id ? null : id; renderPanel(); updateMap() },
        }, h('span', { class: 'rule-id' }, id), h('span', { class: 'rule-title' }, r?.title || id), h('span', { class: 'rule-n' }, String(n)), h('span', { class: 'rule-bar', style: `--w:${(n / max) * 100}%` })))
    })),
    model.focusRule && model.atlas.rules[model.focusRule] ? h('p', { class: 'replace' }, h('span', {}, 'Replace with'), model.atlas.rules[model.focusRule].replacement) : null,
  ]
}

function blockSection(b) {
  const t = view.sb.tasks[b.task]
  const v = t.lastVerify
  const checks = v ? [
    ['Scope', v.checks.scope.ok, v.checks.scope.ok ? 'Only this block and allow-listed files changed' : `Edited outside any block: ${v.checks.scope.outside.join(', ')}`],
    ['Contract', v.checks.contract.ok, v.checks.contract.ok ? 'Every export is still there' : `Removed: ${v.checks.contract.removed.map((r) => `${r.file.split('/').pop()}#${r.name}`).join(', ')}`],
    ['Scan', v.checks.scan.ok, `${v.checks.scan.remaining} legacy call sites left`],
    ['Tests', v.checks.tests.ok, v.checks.tests.summary || (v.checks.tests.skipped ? 'skipped' : `exit ${v.checks.tests.exitCode}`)],
  ] : null
  return h('div', { class: `block-card s-${t.state}` },
    h('div', { class: 'block-head' },
      h('span', { class: `signal-head s-${t.state}` }, h('i', { class: 'lamp red' }), h('i', { class: 'lamp amber' }), h('i', { class: 'lamp green' })),
      h('div', {}, h('strong', {}, t.id), h('span', {}, `Wave ${t.wave} · ${STATUS_TEXT[t.state].toLowerCase()}${t.agent && !t.commit ? ` · ${t.agent}` : ''}${t.commit ? ` · ${t.commit.slice(0, 7)}` : ''}`)),
      (() => { const r = blockRisk()[t.id]; return h('span', { class: `risk r-${r.level}`, title: `${t.findings || 0} legacy call sites · ${r.reach} dependent files` }, `${r.level.toUpperCase()} RISK`) })()),
    checks ? h('ul', { class: 'checks' }, checks.map(([k, ok, text]) => h('li', { class: ok ? 'ok' : 'fail' }, h('b', {}, k), h('span', {}, text)))) : null,
    v && !v.checks.tests.ok && v.checks.tests.failures?.length ? h('pre', { class: 'failures' }, v.checks.tests.failures.join('\n')) : null,
    diffFor(t) ? h('button', { class: 'diff-open', onclick: () => openDiff(t) }, `Review ${t.agent ? `${t.agent}'s` : 'the'} change`, h('span', {}, ` ${t.commit.slice(0, 7)} →`)) : null,
    t.state !== 'cleared' ? h('div', { class: 'prompt' },
      h('div', { class: 'prompt-head' }, h('p', { class: 'eyebrow' }, 'Subagent prompt'), h('button', { class: 'copy', onclick: (e) => copy(t.prompt, e.currentTarget) }, 'Copy')),
      h('pre', {}, t.prompt)) : null,
  )
}

function stationPanel(id) {
  const file = model.atlas.files.find((f) => f.id === id)
  const st = stationStatus(id)
  const b = view.blocks[id]
  const list = view.findings[id] || []
  const deps = dependentsOf(model.atlas, id)
  const link = (f) => h('button', { class: 'chip-link', onclick: () => select(f) }, h('span', { class: 'dot', style: `background:${lineColor[layout.stations[f]?.dir] || '#888'}` }), f)
  const statusText = { legacy: `${st.count} legacy call site${st.count === 1 ? '' : 's'}`, migrated: `Migrated: ${st.baseline} call sites removed`, clean: 'Never used legacy APIs', absent: 'Not present at this point' }[st.status]
  return [
    h('div', { class: 'station-head' },
      h('button', { class: 'back', onclick: () => select(null), 'aria-label': 'Back to overview' }, '←'),
      h('span', { class: 'line-pill', style: `background:${lineColor[file.dir]}` }, file.dir.toUpperCase()),
      h('span', { class: `status-pill s-${st.status}` }, st.status)),
    h('h2', { class: 'file-name' }, file.name),
    h('p', { class: 'path mono' }, `${model.atlas.root}/${id}`),
    h('p', { class: 'lede' }, statusText),
    b ? blockSection(b) : null,
    (() => {
      const reach = blastRadius(id).size - 1
      return h('div', { class: 'blast-row' },
        h('button', { class: `blast-btn${model.blast === id ? ' on' : ''}`, 'aria-pressed': String(model.blast === id), onclick: () => { model.blast = model.blast === id ? null : id; renderPanel(); updateMap() } },
          model.blast === id ? 'Hide blast radius' : 'Show blast radius'),
        h('span', {}, reach ? `A change here can reach ${reach} file${reach > 1 ? 's' : ''}` : 'Nothing depends on this file'))
    })(),
    list.length ? h('p', { class: 'eyebrow' }, 'Call sites') : null,
    list.length ? h('ol', { class: 'findings' }, groupByLine(list).map(({ line, snippet, rules }) => {
      const known = rules.filter((r) => model.atlas.rules[r])
      const worst = known.some((r) => model.atlas.rules[r].severity === 'error') ? 'error' : 'warning'
      return h('li', { class: `sev-${worst}` },
        h('div', { class: 'f-head' }, h('span', { class: 'f-line mono' }, line ? `L${line}` : ''), known.map((r) => h('span', { class: `rule-id sev-${model.atlas.rules[r].severity}` }, r))),
        snippet ? h('code', { class: 'snippet' }, snippet) : null,
        known.map((r) => h('p', { class: 'f-to' }, h('strong', {}, model.atlas.rules[r].title), h('span', { 'aria-hidden': 'true' }, ' → '), model.atlas.rules[r].replacement)))
    })) : null,
    h('div', { class: 'connections' },
      h('div', {}, h('p', { class: 'eyebrow' }, `Imports (${file.imports.length})`), file.imports.length ? file.imports.map(link) : h('p', { class: 'none' }, 'Nothing local')),
      h('div', {}, h('p', { class: 'eyebrow' }, `Used by (${deps.length})`), deps.length ? deps.map(link) : h('p', { class: 'none' }, 'Entry point'))),
  ]
}

function groupByLine(list) {
  const out = []
  for (const [rule, line, snippet] of list) {
    const last = out[out.length - 1]
    if (last && last.line === line && line) last.rules.push(rule)
    else out.push({ line, snippet, rules: [rule] })
  }
  return out
}

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text)
    btn.textContent = 'Copied'
  } catch {
    btn.textContent = 'Select & copy'
  }
  setTimeout(() => (btn.textContent = 'Copy'), 1600)
}

function renderPanel() {
  const id = model.selected && layout.stations[model.selected] ? model.selected : null
  $('#panel').replaceChildren(...[id ? stationPanel(id) : overviewPanel()].flat(Infinity).filter((c) => c != null && c !== false))
}

// ------------------------------------------------------------------ wiring

function select(id) {
  model.selected = id && layout.stations[id] ? id : null
  model.focusRule = null
  if (model.blast !== model.selected) model.blast = null
  history.replaceState(null, '', model.selected ? `#${model.selected}` : ' ')
  renderPanel()
  updateMap()
  if (model.selected && matchMedia('(max-width: 960px)').matches) $('#panel').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function render() {
  view = derive()
  updateStats()
  updateMap()
  updateBoard()
  updateDescriber()
  updateAlert()
  updateTower()
  updateTowerActions()
  updateTimeline()
  updateGraph()
  renderPanel()
}

function rebuild() {
  updateLedgerBadge()
  view = derive()
  buildMap()
  buildTimeline()
  render()
}

// ------------------------------------------------------------------ rule packs
// The same interlocking on a different migration: the Moment.js → date-fns pack, planned on the
// sample app in samples/moment-billing. Its plan is real (a real scan of real code); it has no
// Bob run, so it opens as a baseline.

function setRoute() {
  const pack = model.atlas.pack || { from: 'ethers v5 / web3.js', to: 'viem + wagmi' }
  $('#route').textContent = `${model.atlas.root} · ${pack.from} → ${pack.to}`
}

function buildPacks() {
  if (model.mode === 'live') return
  const packs = [
    { key: 'home', label: model.home.atlas.pack?.name === 'moment-to-date-fns' ? 'Moment → date-fns' : 'Web3 → viem', atlas: model.home.atlas },
    { key: 'moment', label: 'Moment → date-fns', atlas: momentAtlas, note: 'sample app' },
  ].filter((p, k, all) => k === 0 || p.atlas.pack?.name !== all[0].atlas.pack?.name)
  if (packs.length < 2) return
  const current = model.pack || 'home'
  $('#packs').replaceChildren(h('span', { class: 'packs-label' }, 'Rule pack'), ...packs.map((p) => h('button', {
    class: `pack${p.key === current ? ' on' : ''}`, 'aria-pressed': String(p.key === current),
    onclick: () => switchPack(p.key),
  }, p.label, p.note ? h('small', {}, ` · ${p.note}`) : null)))
}

function switchPack(key) {
  if ((model.pack || 'home') === key) return
  stopTour()
  stopPlay()
  model.pack = key
  if (key === 'home') Object.assign(model, { atlas: model.home.atlas, events: model.home.events, mode: model.home.mode, stop: model.home.stop })
  else Object.assign(model, { atlas: momentAtlas, events: [], mode: 'baseline', stop: Infinity })
  model.selected = null
  model.blast = null
  model.focusRule = null
  model.focusTask = null
  $('#ask-answer').hidden = true
  setRoute()
  buildPacks()
  rebuild()
}

function initHeat() {
  const btn = $('#heat')
  btn.addEventListener('click', () => {
    model.heat = !model.heat
    btn.setAttribute('aria-pressed', String(model.heat))
    $('#map-card').classList.toggle('heat', model.heat)
    updateMap()
  })
}

function initTheme() {
  const saved = (() => { try { return localStorage.getItem('atlas-theme') } catch { return null } })()
  document.documentElement.dataset.theme = saved || 'dark'
  $('#theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    const next = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('atlas-theme', next) } catch { /* private mode */ }
  })
}

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return
  if (e.key === '/') { e.preventDefault(); $('#ask-input').focus(); return }
  if (e.key === 'ArrowLeft') { stopTour(); goTo(view.i - 1) }
  else if (e.key === 'ArrowRight') { stopTour(); goTo(view.i + 1) }
  else if (e.key === 'Escape') { if (model.tour) stopTour(); else select(null) }
})

// Live mode: the page is served by `signalbox serve`. Anywhere else the fetch fails and the
// bundled data (a real recorded run, or the baseline) is replayed instead.
async function connectLive() {
  let snap
  try {
    const r = await fetch('./api/snapshot', { cache: 'no-store' })
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return false
    snap = await r.json()
  } catch {
    return false
  }
  model.mode = 'live'
  model.atlas = snap.atlas
  model.events = snap.ledger
  model.live = snap.live
  model.stop = Infinity
  const es = new EventSource('./api/stream')
  let refetch = null
  es.addEventListener('ledger', (msg) => {
    const e = JSON.parse(msg.data)
    model.events = [...model.events, e]
    if (model.follow) model.stop = Infinity
    rebuild()
    if (e.t === 'drill') chaosFlash()
  })
  es.addEventListener('live', (msg) => {
    const prev = model.live
    model.live = JSON.parse(msg.data)
    const changed = model.live.present.filter((f) => (prev?.findings[f]?.length || 0) !== (model.live.findings[f]?.length || 0))
    render()
    flashTouched([...new Set([...changed, ...model.live.modified])])
  })
  es.addEventListener('head', () => {
    clearTimeout(refetch)
    refetch = setTimeout(async () => {
      try {
        const r = await fetch('./api/snapshot', { cache: 'no-store' })
        const next = await r.json()
        model.atlas = next.atlas
        model.events = next.ledger
        model.live = next.live
        if (model.follow) model.stop = Infinity
        rebuild()
      } catch { /* keep the current view */ }
    }, 300)
  })
  return true
}

async function start() {
  initTheme()
  initHeat()
  buildStats()
  buildDesk()
  const live = await connectLive()
  if (!live) {
    model.mode = model.events.length ? 'replay' : 'baseline'
    model.stop = model.events.length ? 0 : Infinity
  }
  model.home = { atlas: model.atlas, events: model.events, mode: model.mode, stop: model.stop }
  buildPacks()
  setRoute()
  view = derive()
  buildMap()
  buildTimeline()
  updateLedgerBadge()
  const hash = decodeURIComponent(location.hash.slice(1))
  model.selected = layout.stations[hash] ? hash : null
  render()
  // ?tour starts the guided replay on load (handy for recording the demo video).
  if (new URLSearchParams(location.search).has('tour')) setTimeout(startTour, 700)
}

let resizeTimer
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => view && updateGraph(), 150) })

start()
