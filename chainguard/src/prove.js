// `signalbox prove`: the safety proof. Opens a real signal box on samples/proof-yard in a throwaway
// git repository and runs three scripted drill agents as three processes at the same time:
// drill-1 and drill-2 make the correct change and release; drill-3 edits a file outside its block
// and renames an export another file imports. The track circuit catches drill-3, it rolls back
// (block and stray file), and the other two release and commit. The verdict comes from the
// ledger. Nothing touches the calling repository. Drill agents are scripts, not IBM Bob.

import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { init, readLedger, audit, packOf, loadState } from './signalbox.js'
import { proofVerdict } from './signalbox-state.js'
import { gitSnapshots, buildAtlas } from './atlas.js'

const here = dirname(fileURLToPath(import.meta.url))
const BIN = join(here, '..', 'bin', 'signalbox.js')
export const FIXTURE = join(here, '..', '..', 'samples', 'proof-yard')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// One CLI call as its own process, like an agent in its own terminal.
function agent(cwd, args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [BIN, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (out += d))
    p.on('close', (code) => resolve({ code, out: out.trim() }))
  })
}

export async function prove({ pace = 0, keep = false, onOpen = () => {}, onEvent = () => {}, onStep = () => {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'signalbox-proof-'))
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', encoding: 'utf8' })
  let seen = 0
  const flush = () => {
    const all = readLedger(dir)
    for (const e of all.slice(seen)) onEvent(e)
    seen = all.length
  }
  const step = async (text) => {
    flush()
    onStep(text)
    if (pace) await sleep(pace)
  }
  try {
    cpSync(FIXTURE, dir, { recursive: true, filter: (src) => !src.includes('node_modules') })
    git('init', '-q')
    git('config', 'user.email', 'proof@signalbox.local')
    git('config', 'user.name', 'signalbox proof')
    git('config', 'core.autocrlf', 'false')
    git('add', '.')
    git('commit', '-qm', 'proof yard: base')

    init(dir, { scanPath: 'src', pack: 'pack.json', testCmd: 'node --test "src/__tests__/*.test.js"', allow: [] })
    const openPack = packOf(dir, loadState(dir))
    onOpen(buildAtlas(gitSnapshots(join(dir, 'src'), openPack.rules), openPack))
    const tasks = Object.values(loadState(dir).tasks)
    const bad = tasks.find((t) => t.files.some((f) => f.includes('/fares/')))
    const good = tasks.filter((t) => t !== bad)
    const crew = [...good.map((t, k) => ({ task: t, name: `drill-${k + 1}` })), { task: bad, name: `drill-${good.length + 1}` }]
    await step(`signal box open: ${tasks.length} green blocks`)

    // Three agents claim at the same moment, each from its own process.
    await Promise.all(crew.map((c) => agent(dir, ['claim', c.task.id, '--agent', c.name])))
    await step(`${crew.length} drill agents in section at once`)

    // The correct change: var -> const in each good block. The bad agent also strays.
    for (const c of crew) {
      for (const f of c.task.files) writeFileSync(join(dir, f), readFileSync(join(dir, f), 'utf8').replace(/\bvar\s/g, 'const '))
    }
    const fares = bad.files.find((f) => f.endsWith('fares.js'))
    writeFileSync(join(dir, fares), readFileSync(join(dir, fares), 'utf8').replace('export function fare(', 'export function fareCents('))
    writeFileSync(join(dir, 'src/index.js'), `${readFileSync(join(dir, 'src/index.js'), 'utf8')}// drill-3: edited outside its block\n`)
    await step(`${crew.at(-1).name} edits src/index.js outside its block and renames fare()`)

    const caught = await agent(dir, ['release', bad.id, '--agent', crew.at(-1).name])
    await step(`${crew.at(-1).name}: FAULT, nothing committed`)

    await agent(dir, ['rollback', bad.id, '--agent', crew.at(-1).name, '--strays', 'src/index.js'])
    await step(`${crew.at(-1).name} rolled back: block and stray file restored`)

    const releases = await Promise.all(good.map((t, k) => agent(dir, ['release', t.id, '--agent', `drill-${k + 1}`])))
    await step(`${releases.filter((r) => r.code === 0).length} blocks cleared and committed`)

    const events = readLedger(dir)
    const chain = await audit(dir)
    const verdict = { ...proofVerdict(events), audit: chain.ok, chainHead: chain.chain.head || null }
    verdict.ok = verdict.ok && chain.ok && caught.code !== 0 && verdict.spads > 0 && verdict.contractBreaks > 0
    const pack = packOf(dir, loadState(dir))
    const atlas = buildAtlas(gitSnapshots(join(dir, 'src'), pack.rules), pack)
    flush()
    return { dir: keep ? dir : null, events, atlas, verdict, recordedAt: new Date().toISOString() }
  } finally {
    if (!keep) rmSync(dir, { recursive: true, force: true })
  }
}

export function verdictLine(v) {
  return v.ok ? 'All changes proven. Zero collisions. Ledger verified.' : 'Proof FAILED: see the checks above.'
}

