import '@fontsource/ibm-plex-sans-condensed/500.css'
import '@fontsource/ibm-plex-sans-condensed/600.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import './styles.css'
import atlas from './data/atlas-data.json'
import { layoutAtlas, LABEL_OFFSET } from './layout.js'
import { stationStatus, taskStatus, snapshotStats, taskOf, dependentsOf, historyOf, baselineIndex } from './state.js'

const SVGNS = 'http://www.w3.org/2000/svg'
const $ = (sel) => document.querySelector(sel)

function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  setAttrs(node, attrs)
  node.append(...children.flat().filter((c) => c != null && c !== false))
  return node
}
function s(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVGNS, tag)
  setAttrs(node, attrs)
  node.append(...children.flat().filter((c) => c != null && c !== false))
  return node
}
function setAttrs(node, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
    else node.setAttribute(k, v === true ? '' : v)
  }
}

const layout = layoutAtlas(atlas.files)
const lineColor = Object.fromEntries(layout.lines.map((l) => [l.dir, l.color]))
const baseIdx = baselineIndex(atlas)

const state = {
  snap: atlas.snapshots.length - 1,
  selected: null,
  focusTask: null,
  focusRule: null,
  playing: null,
}

// ------------------------------------------------------------------ map

const stationNodes = {}
const edgeNodes = []

function stationRadius(count) {
  return count > 0 ? 9 + 2.4 * Math.sqrt(count) : 8
}

function buildMap() {
  const svg = $('#map')
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`)
  svg.style.setProperty('--map-w', `${layout.width}px`)
  svg.style.setProperty('--map-h', `${layout.height}px`)

  const defs = s('defs', {},
    s('pattern', { id: 'grid', width: 24, height: 24, patternUnits: 'userSpaceOnUse' },
      s('path', { d: 'M24 0H0V24', class: 'grid-line' })),
  )
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
    const task = taskOf(atlas, st.id)
    const ring = s('circle', { class: 'st-ring', cx: st.x, cy: st.y, r: 8 })
    const count = s('text', { class: 'st-count', x: st.x, y: st.y + 4, 'text-anchor': 'middle' })
    const check = s('path', { class: 'st-check', d: `M${st.x - 4},${st.y}l3,3l5,-6` })
    const tick = s('rect', { class: 'st-tick', x: st.x + 5, y: st.y - 2, width: 9, height: 4, rx: 1, fill: lineColor[st.dir] })
    const halo = s('circle', { class: 'st-halo', cx: st.x, cy: st.y, r: 26 })
    const label = s('text', { class: 'st-label', x: st.x + LABEL_OFFSET, y: st.y + 5 }, st.name)
    const wave = task
      ? s('g', { class: 'st-wave', transform: `translate(${st.x - 48},${st.y - 9})` },
          s('rect', { width: 18, height: 18, rx: 3 }),
          s('text', { x: 9, y: 13, 'text-anchor': 'middle' }, String(task.wave)))
      : null
    const g = s('g', {
      class: 'station', tabindex: 0, role: 'button', 'data-id': st.id,
      onclick: () => select(st.id),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(st.id) } },
      onmouseenter: () => peek(st.id),
      onmouseleave: () => peek(null),
    }, halo, tick, ring, check, count, wave, label, s('circle', { class: 'st-hit', cx: st.x, cy: st.y, r: 22 }), s('title', {}, st.id))
    stationNodes[st.id] = { g, ring, count, st }
    gStations.append(g)
  }

  svg.append(defs, gGrid, gEdges, gLines, gStations)
}

function peek(id) {
  for (const e of edgeNodes) e.node.classList.toggle('peek', id != null && (e.from === id || e.to === id))
}

function updateMap() {
  const focusFiles = new Set(
    state.focusTask ? atlas.plan.tasks.find((t) => t.id === state.focusTask)?.files || []
    : state.focusRule ? Object.entries(atlas.snapshots[state.snap].findings).filter(([, list]) => list.some(([id]) => id === state.focusRule)).map(([f]) => f)
    : [],
  )
  const related = new Set()
  if (state.selected) {
    related.add(state.selected)
    for (const f of atlas.files.find((f) => f.id === state.selected)?.imports || []) related.add(f)
    for (const f of dependentsOf(atlas, state.selected)) related.add(f)
  }
  for (const [id, n] of Object.entries(stationNodes)) {
    const { status, count } = stationStatus(atlas, state.snap, id)
    n.g.dataset.status = status
    n.ring.setAttribute('r', stationRadius(count))
    n.count.textContent = count > 0 ? String(count) : ''
    n.g.setAttribute('aria-label', `${id}: ${status === 'legacy' ? `${count} legacy call sites` : status}`)
    n.g.classList.toggle('selected', state.selected === id)
    n.g.classList.toggle('dim', (focusFiles.size > 0 && !focusFiles.has(id)) || (!focusFiles.size && related.size > 0 && !related.has(id)))
  }
  for (const e of edgeNodes) {
    const on = state.selected && (e.from === state.selected || e.to === state.selected)
    e.node.classList.toggle('on', Boolean(on))
    e.node.style.stroke = on ? lineColor[layout.stations[e.to].dir] : ''
  }
}

// ------------------------------------------------------------------ stats

const shown = {}
function tween(key, el, to, fmt = String) {
  const from = shown[key] ?? to
  shown[key] = to
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) return void (el.textContent = fmt(to))
  const t0 = performance.now()
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 600)
    const e = 1 - (1 - k) ** 3
    el.textContent = fmt(Math.round(from + (to - from) * e))
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function buildStats() {
  const cell = (key, label) =>
    h('div', { class: `stat stat-${key}` }, h('dt', {}, label), h('dd', {}, h('span', { class: 'num', id: `stat-${key}` }), h('span', { class: 'sub', id: `stat-${key}-sub` })))
  $('#stats').append(
    cell('calls', 'Legacy call sites'),
    cell('clear', 'Stations clear'),
    cell('split', 'ethers v5 / web3.js'),
    cell('tasks', 'Bob tasks arrived'),
  )
}

function updateStats() {
  const st = snapshotStats(atlas, state.snap)
  tween('calls', $('#stat-calls'), st.calls)
  const removed = st.baselineCalls - st.calls
  $('#stat-calls-sub').textContent = removed > 0 ? `−${removed} since baseline` : 'baseline'
  tween('clear', $('#stat-clear'), st.clear)
  $('#stat-clear-sub').textContent = `of ${st.stations}`
  $('#stat-split').textContent = `${st.ethers} / ${st.web3}`
  $('#stat-split-sub').textContent = ''
  tween('tasks', $('#stat-tasks'), st.arrived)
  $('#stat-tasks-sub').textContent = `of ${st.tasks} in ${atlas.plan.waves} waves`
  document.body.dataset.done = String(st.calls === 0)
}

// ------------------------------------------------------------------ departures board

function flap(text, width) {
  const padded = text.toUpperCase().padEnd(width).slice(0, width)
  return h('span', { class: 'flap' }, [...padded].map((c, i) => h('i', { style: `--i:${i}` }, c === ' ' ? ' ' : c)))
}

function buildBoard() {
  const head = h('div', { class: 'board-row board-head', role: 'row' },
    ['Wave', 'Task', 'Stations', 'Calls', 'Status'].map((t) => h('span', { role: 'columnheader' }, t)))
  $('#board-rows').replaceChildren(head)
}

function updateBoard() {
  const rows = atlas.plan.tasks.map((t) => {
    const ts = taskStatus(atlas, state.snap, t)
    const names = t.files.map((f) => f.split('/').pop().replace(/\.(jsx?|tsx?)$/, '')).join(' · ')
    return h('div', {
      class: `board-row status-${ts.status.toLowerCase()}${state.focusTask === t.id ? ' focus' : ''}`,
      role: 'row', tabindex: 0,
      onmouseenter: () => { state.focusTask = t.id; updateMap() },
      onmouseleave: () => { state.focusTask = null; updateMap() },
      onfocus: () => { state.focusTask = t.id; updateMap() },
      onblur: () => { state.focusTask = null; updateMap() },
      onclick: () => select(t.files[0]),
      onkeydown: (e) => { if (e.key === 'Enter') select(t.files[0]) },
    },
      h('span', { class: 'wave-plate' }, String(t.wave)),
      flap(t.id, 16),
      h('span', { class: 'dest' }, names),
      h('span', { class: 'calls' }, `${ts.remaining}/${ts.total}`),
      flap(ts.status, 9),
    )
  })
  $('#board-rows').replaceChildren($('#board-rows').firstChild, ...rows)
}

// ------------------------------------------------------------------ timeline

function buildTimeline() {
  const n = atlas.snapshots.length
  const ticks = atlas.snapshots.map((snap, i) =>
    h('button', {
      class: 'tick', style: `--pos:${n === 1 ? 0 : (i / (n - 1)) * 100}%`, 'data-i': i,
      'aria-label': `${snap.short}: ${snap.subject} (${snap.totals.findings} legacy call sites)`,
      onclick: () => goTo(i),
    }, h('span', { class: 'tick-dot' }), h('span', { class: 'tick-label' }, snap.short)))
  const play = h('button', { class: 'play', id: 'play', 'aria-label': 'Replay the migration', onclick: togglePlay, disabled: n < 2 },
    s('svg', { viewBox: '0 0 16 16', width: 14, height: 14 }, s('path', { d: 'M4 2.5v11l9-5.5z', fill: 'currentColor' })))
  $('#timeline').append(
    play,
    h('div', { class: `track${n === 1 ? ' pending' : ''}` }, h('div', { class: 'track-fill', id: 'track-fill' }), ticks,
      n === 1 ? h('span', { class: 'track-note' }, 'Bob waves arrive here →') : null),
    h('div', { class: 'commit', id: 'commit' }),
  )
}

function updateTimeline() {
  const n = atlas.snapshots.length
  const snap = atlas.snapshots[state.snap]
  document.querySelectorAll('.tick').forEach((t) => {
    const i = Number(t.dataset.i)
    t.classList.toggle('current', i === state.snap)
    t.classList.toggle('past', i < state.snap)
    t.classList.toggle('baseline', i === baseIdx)
  })
  $('#track-fill').style.width = n === 1 ? '0%' : `${(state.snap / (n - 1)) * 100}%`
  const when = new Date(snap.time).toISOString().slice(0, 16).replace('T', ' ')
  $('#commit').replaceChildren(...[
    h('span', { class: 'mono' }, snap.short), ' ',
    h('span', { class: 'subject' }, snap.subject),
    h('span', { class: 'when' }, `${when} UTC · ${state.snap + 1}/${n}`),
    n === 1 ? h('span', { class: 'hint' }, 'Only the baseline exists so far. Commit each Bob wave and run npm run atlas to replay the migration here.') : null,
  ].filter(Boolean))
}

function goTo(i) {
  state.snap = Math.max(0, Math.min(atlas.snapshots.length - 1, i))
  render()
}

function togglePlay() {
  if (state.playing) return stopPlay()
  if (state.snap === atlas.snapshots.length - 1) goTo(0)
  $('#play').classList.add('on')
  state.playing = setInterval(() => {
    if (state.snap >= atlas.snapshots.length - 1) return stopPlay()
    goTo(state.snap + 1)
  }, 1400)
}
function stopPlay() {
  clearInterval(state.playing)
  state.playing = null
  $('#play').classList.remove('on')
}

// ------------------------------------------------------------------ panel

function sparkline(values) {
  const w = 220
  const hgt = 44
  const max = Math.max(1, ...values.filter((v) => v != null))
  const xs = (i) => (values.length === 1 ? w / 2 : (i / (values.length - 1)) * (w - 12) + 6)
  const ys = (v) => hgt - 6 - (v / max) * (hgt - 14)
  const pts = values.map((v, i) => (v == null ? null : [xs(i), ys(v)])).filter(Boolean)
  return s('svg', { viewBox: `0 0 ${w} ${hgt}`, class: 'spark', role: 'img', 'aria-label': `Legacy call sites per snapshot: ${values.map((v) => v ?? '–').join(', ')}` },
    s('line', { x1: 0, x2: w, y1: hgt - 6, y2: hgt - 6, class: 'spark-base' }),
    pts.length > 1 ? s('polyline', { points: pts.map((p) => p.join(',')).join(' '), class: 'spark-line' }) : null,
    values.map((v, i) => (v == null ? null : s('circle', { cx: xs(i), cy: ys(v), r: i === state.snap ? 4.5 : 2.5, class: i === state.snap ? 'spark-now' : 'spark-dot' }))),
  )
}

function overviewPanel() {
  const snap = atlas.snapshots[state.snap]
  const byRule = {}
  for (const list of Object.values(snap.findings)) for (const [id] of list) byRule[id] = (byRule[id] || 0) + 1
  const ranked = Object.entries(byRule).sort((a, b) => b[1] - a[1])
  const max = ranked[0]?.[1] || 1
  return [
    h('p', { class: 'eyebrow' }, 'Network overview'),
    h('h2', {}, snap.totals.findings ? 'Legacy lines still in service' : 'All stations cleared'),
    h('p', { class: 'lede' },
      snap.totals.findings
        ? `${snap.filesAffected} of ${snap.filesScanned} files still call ethers v5 or web3.js. Station size shows how many call sites remain. Numbered plates are the Bob wave that migrates it. Select a station, a board row or a pattern below.`
        : 'No ethers v5 or web3.js call sites remain. CI now blocks any new ones with npm run guard.'),
    ranked.length ? h('p', { class: 'eyebrow' }, 'Patterns by frequency') : null,
    h('ul', { class: 'rules' }, ranked.map(([id, n]) => {
      const r = atlas.rules[id]
      return h('li', {},
        h('button', {
          class: `rule${state.focusRule === id ? ' on' : ''}`,
          'aria-pressed': String(state.focusRule === id),
          onclick: () => { state.focusRule = state.focusRule === id ? null : id; renderPanel(); updateMap() },
        },
          h('span', { class: 'rule-id' }, id),
          h('span', { class: 'rule-title' }, r.title),
          h('span', { class: 'rule-n' }, String(n)),
          h('span', { class: 'rule-bar', style: `--w:${(n / max) * 100}%` })))
    })),
    state.focusRule ? h('p', { class: 'replace' }, h('span', {}, 'Replace with'), atlas.rules[state.focusRule].replacement) : null,
  ]
}

function stationPanel(id) {
  const file = atlas.files.find((f) => f.id === id)
  const st = stationStatus(atlas, state.snap, id)
  const task = taskOf(atlas, id)
  const ts = task && taskStatus(atlas, state.snap, task)
  const list = atlas.snapshots[state.snap].findings[id] || []
  const deps = dependentsOf(atlas, id)
  const hist = historyOf(atlas, id)
  const link = (f) => h('button', { class: 'chip-link', onclick: () => select(f) },
    h('span', { class: 'dot', style: `background:${lineColor[layout.stations[f].dir]}` }), f)
  const statusText = { legacy: `${st.count} legacy call site${st.count === 1 ? '' : 's'}`, migrated: `Migrated: ${st.baseline} call sites removed`, clean: 'Never used legacy APIs', absent: 'Not present in this snapshot' }[st.status]

  return [
    h('div', { class: 'station-head' },
      h('button', { class: 'back', onclick: () => select(null), 'aria-label': 'Back to overview' }, '←'),
      h('span', { class: 'line-pill', style: `background:${lineColor[file.dir]}` }, file.dir.toUpperCase()),
      h('span', { class: `status-pill s-${st.status}` }, st.status)),
    h('h2', { class: 'file-name' }, file.name),
    h('p', { class: 'path mono' }, `${atlas.root}/${id}`),
    h('p', { class: 'lede' }, statusText),
    task ? h('div', { class: 'service' },
      h('span', { class: 'wave-plate' }, String(task.wave)),
      h('div', {}, h('strong', {}, task.id), h('span', {}, `Wave ${task.wave} · ${ts.status.toLowerCase()} · ${ts.remaining}/${ts.total} calls in task`))) : null,
    atlas.snapshots.length > 1 ? h('div', { class: 'history' }, h('p', { class: 'eyebrow' }, 'Call sites over time'), sparkline(hist)) : null,
    list.length ? h('p', { class: 'eyebrow' }, 'Call sites') : null,
    list.length ? h('ol', { class: 'findings' }, groupByLine(list).map(({ line, snippet, rules }) => {
      const worst = rules.some((id) => atlas.rules[id].severity === 'error') ? 'error' : 'warning'
      return h('li', { class: `sev-${worst}` },
        h('div', { class: 'f-head' }, h('span', { class: 'f-line mono' }, `L${line}`),
          rules.map((id) => h('span', { class: `rule-id sev-${atlas.rules[id].severity}` }, id))),
        h('code', { class: 'snippet' }, snippet),
        rules.map((id) => h('p', { class: 'f-to' },
          h('strong', {}, atlas.rules[id].title), h('span', { 'aria-hidden': 'true' }, ' → '), atlas.rules[id].replacement)))
    })) : null,
    task && st.status === 'legacy' ? h('div', { class: 'prompt' },
      h('div', { class: 'prompt-head' }, h('p', { class: 'eyebrow' }, 'Bob task prompt'),
        h('button', { class: 'copy', onclick: (e) => copy(task.prompt, e.currentTarget) }, 'Copy')),
      h('pre', {}, task.prompt)) : null,
    h('div', { class: 'connections' },
      h('div', {}, h('p', { class: 'eyebrow' }, `Imports (${file.imports.length})`), file.imports.length ? file.imports.map(link) : h('p', { class: 'none' }, 'Nothing local')),
      h('div', {}, h('p', { class: 'eyebrow' }, `Used by (${deps.length})`), deps.length ? deps.map(link) : h('p', { class: 'none' }, 'Entry point'))),
  ]
}

function groupByLine(list) {
  const out = []
  for (const [rule, line, snippet] of list) {
    const last = out[out.length - 1]
    if (last && last.line === line) last.rules.push(rule)
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
  const panel = $('#panel')
  panel.replaceChildren(...(state.selected ? stationPanel(state.selected) : overviewPanel()).flat().filter((c) => c != null && c !== false))
}

// ------------------------------------------------------------------ wiring

function select(id) {
  state.selected = id && layout.stations[id] ? id : null
  state.focusRule = null
  const hash = state.selected ? `#${state.selected}` : ' '
  history.replaceState(null, '', hash)
  renderPanel()
  updateMap()
  if (state.selected && matchMedia('(max-width: 960px)').matches) $('#panel').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function render() {
  updateStats()
  updateMap()
  updateBoard()
  updateTimeline()
  renderPanel()
}

function initTheme() {
  const btn = $('#theme')
  const saved = (() => { try { return localStorage.getItem('atlas-theme') } catch { return null } })()
  if (saved) document.documentElement.dataset.theme = saved
  btn.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches
    const next = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('atlas-theme', next) } catch { /* private mode */ }
  })
}

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return
  if (e.key === 'ArrowLeft') goTo(state.snap - 1)
  else if (e.key === 'ArrowRight') goTo(state.snap + 1)
  else if (e.key === 'Escape') select(null)
})

$('#route').textContent = `${atlas.root} · ethers v5 + web3.js → viem + wagmi`
buildMap()
buildStats()
buildBoard()
buildTimeline()
initTheme()
state.selected = layout.stations[decodeURIComponent(location.hash.slice(1))] ? decodeURIComponent(location.hash.slice(1)) : null
render()
