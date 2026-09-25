import '@fontsource/ibm-plex-sans-condensed/500.css'
import '@fontsource/ibm-plex-sans-condensed/600.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import './styles.css'
import staticAtlas from './data/atlas-data.json'
import { layoutAtlas, LABEL_OFFSET } from './layout.js'
import { dependentsOf, baselineIndex } from './state.js'
import { buildStops, findingsAt, signalStateAt, blockIndex, faultsCaught, checkLamps, stripRoot } from './signal.js'
import { reduce, describe, summary, timeline } from '../../chainguard/src/signalbox-state.js'

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
    const p = s('path', { d: e.path, class: 'edge' })
    edgeNodes.push({ ...e, node: p })
    gEdges.append(p)
  }
  const gLines = s('g', { class: 'lines' })
  for (const l of layout.lines) {
    const label = l.dir.toUpperCase()
    const bw = 22 + label.length * 9
    gLines.append(
      s('line', { x1: l.x, x2: l.x, y1: l.y1, y2: l.y2, class: 'line-casing' }),
      s('line', { x1: l.x, x2: l.x, y1: l.y1, y2: l.y2, class: 'line', stroke: l.color }),
      s('g', { class: 'line-badge', transform: `translate(${l.x},${l.y1 - 26})` },
        s('rect', { x: -bw / 2, y: -14, width: bw, height: 28, rx: 14, fill: l.color }),
        s('text', { x: 0, y: 4.5, 'text-anchor': 'middle' }, label)),
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
  const related = new Set()
  if (model.selected) {
    related.add(model.selected)
    for (const f of model.atlas.files.find((f) => f.id === model.selected)?.imports || []) related.add(f)
    for (const f of dependentsOf(model.atlas, model.selected)) related.add(f)
  }
  for (const [id, n] of Object.entries(stationNodes)) {
    const { status, count } = stationStatus(id)
    const b = view.blocks[id]
    n.g.dataset.status = status
    n.g.dataset.block = spadNow.has(id) ? 'spad' : b ? b.state : 'none'
    n.ring.setAttribute('r', stationRadius(count))
    n.count.textContent = count > 0 ? String(count) : ''
    const task = b && view.sb.tasks[b.task]
    n.waveText.textContent = task ? String(task.wave) : ''
    n.g.classList.toggle('has-wave', Boolean(task))
    const occupied = b && (b.state === 'occupied' || b.state === 'fault') && b.agent
    n.agentText.textContent = occupied ? b.agent.toUpperCase() : ''
    n.agent.querySelector('rect').setAttribute('width', occupied ? 16 + b.agent.length * 7.4 : 0)
    n.g.setAttribute('aria-label', `${id}: ${status === 'legacy' ? `${count} legacy call sites` : status}${b ? `, block ${b.task} ${b.state}${occupied ? ` by ${b.agent}` : ''}` : ''}`)
    n.g.classList.toggle('selected', model.selected === id)
    n.g.classList.toggle('dim', (focus.size > 0 && !focus.has(id)) || (!focus.size && related.size > 0 && !related.has(id)))
  }
  for (const e of edgeNodes) {
    const on = model.selected && (e.from === model.selected || e.to === model.selected)
    e.node.classList.toggle('on', Boolean(on))
    e.node.style.stroke = on ? lineColor[layout.stations[e.to].dir] : ''
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
    ['Signal', 'Wave', 'Block', 'Train', 'Track circuit', 'Status'].map((t) => h('span', { role: 'columnheader' }, t)))
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
  const color = (a) => AGENT_COLORS[agents.indexOf(a) % AGENT_COLORS.length]
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
      s('rect', { x: x(r.start), y, width: Math.max(3, x(end) - x(r.start)), height: rowH - 14, rx: 3, fill: color(r.agent) }),
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

function updateAlert() {
  const e = view.event
  const el = $('#alert')
  let content = null
  const live = liveViolations()
  if (live.length) {
    content = h('div', { class: 'alert spad' },
      h('strong', {}, 'SPAD in progress'),
      h('span', {}, live.map((v) => `${v.file}${v.protected ? ' (protected)' : ''}`).join(', ')),
      h('span', { class: 'alert-note' }, 'No occupied block owns this edit. Every release is refused until it is claimed or reverted.'))
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
  $('#timeline').replaceChildren(
    play,
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
      h('div', {}, h('strong', {}, t.id), h('span', {}, `Wave ${t.wave} · ${STATUS_TEXT[t.state].toLowerCase()}${t.agent && !t.commit ? ` · ${t.agent}` : ''}${t.commit ? ` · ${t.commit.slice(0, 7)}` : ''}`))),
    checks ? h('ul', { class: 'checks' }, checks.map(([k, ok, text]) => h('li', { class: ok ? 'ok' : 'fail' }, h('b', {}, k), h('span', {}, text)))) : null,
    v && !v.checks.tests.ok && v.checks.tests.failures?.length ? h('pre', { class: 'failures' }, v.checks.tests.failures.join('\n')) : null,
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
  updateTimeline()
  updateGraph()
  renderPanel()
}

function rebuild() {
  view = derive()
  buildMap()
  buildTimeline()
  render()
}

function initTheme() {
  const saved = (() => { try { return localStorage.getItem('atlas-theme') } catch { return null } })()
  if (saved) document.documentElement.dataset.theme = saved
  $('#theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    const next = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('atlas-theme', next) } catch { /* private mode */ }
  })
}

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return
  if (e.key === 'ArrowLeft') goTo(view.i - 1)
  else if (e.key === 'ArrowRight') goTo(view.i + 1)
  else if (e.key === 'Escape') select(null)
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
    model.events = [...model.events, JSON.parse(msg.data)]
    if (model.follow) model.stop = Infinity
    rebuild()
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
  buildStats()
  const live = await connectLive()
  if (!live) {
    model.mode = model.events.length ? 'replay' : 'baseline'
    model.stop = model.events.length ? 0 : Infinity
  }
  $('#route').textContent = `${model.atlas.root} · ethers v5 + web3.js → viem + wagmi`
  view = derive()
  buildMap()
  buildTimeline()
  const hash = decodeURIComponent(location.hash.slice(1))
  model.selected = layout.stations[hash] ? hash : null
  render()
}

let resizeTimer
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => view && updateGraph(), 150) })

start()
