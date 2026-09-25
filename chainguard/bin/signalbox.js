#!/usr/bin/env node
import { init, claim, extend, release, rollback, loadState, readLedger, repoRoot, SignalboxError, DEFAULT_TEST } from '../src/signalbox.js'
import { summary, describe } from '../src/signalbox-state.js'

const USAGE = `signalbox - interlocking for parallel Bob subagents

Usage:
  signalbox init [--scan legacy-dapp/src] [--test "${DEFAULT_TEST}"] [--force]
  signalbox claim <block> --agent <name> [--also a,b]    enter a block (refused while its signal is at danger)
  signalbox extend <block> <file...> --agent <name>      add files to your block
  signalbox release <block> --agent <name> [--no-commit] run scope, contract, scan and isolated tests; commit the block if clear
  signalbox rollback <block> --agent <name>              restore the block's files and free it
  signalbox status                                       the signal box panel, as text
  signalbox log                                          the train describer (every event)
  signalbox serve [--port 4700]                          live panel for the Atlas UI

Exit codes: 0 ok, 1 refused or fault, 2 usage error.`

function parseArgs(argv) {
  const [cmd, ...rest] = argv
  const opts = { _: [] }
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a.startsWith('--no-')) opts[a.slice(5)] = false
    else if (a === '--force') opts.force = true
    else if (a.startsWith('--')) opts[a.slice(2)] = rest[++i]
    else opts._.push(a)
  }
  return { cmd, opts }
}

const LAMP = { danger: '● DANGER  ', clear: '● CLEAR   ', occupied: '● OCCUPIED', fault: '● FAULT   ', cleared: '✓ CLEARED ' }

function printStatus(root) {
  const state = loadState(root)
  const s = summary(state)
  console.log(`signal box  base ${state.base.slice(0, 7)}  ${s.cleared}/${s.total} blocks cleared  agents: ${s.agents.join(', ') || 'none'}${s.spads ? `  SPADs: ${s.spads}` : ''}`)
  console.log('')
  for (const t of Object.values(state.tasks).sort((a, b) => a.wave - b.wave || a.id.localeCompare(b.id))) {
    const who = t.agent && !t.commit ? t.agent : t.commit ? t.commit.slice(0, 7) : ''
    console.log(`  W${t.wave}  ${t.id.padEnd(16)} ${LAMP[t.state]}  ${who.padEnd(10)} ${t.files.map((f) => f.split('/').pop()).join(' ')}`)
    if (t.state === 'fault') for (const line of faultLines(t.lastVerify)) console.log(`        ${line}`)
  }
}

function faultLines(v) {
  const out = []
  if (!v) return out
  const c = v.checks
  if (!c.scope.ok) out.push(`scope: SPAD, edited outside any block: ${c.scope.outside.join(', ')}`)
  if (!c.contract.ok) out.push(`contract: removed exports ${c.contract.removed.map((r) => `${r.file.split('/').pop()}#${r.name}`).join(', ')}`)
  if (!c.scan.ok) out.push(`scan: ${c.scan.remaining} legacy call sites left (${Object.entries(c.scan.byFile).filter(([, n]) => n).map(([f, n]) => `${f.split('/').pop()}:${n}`).join(', ')})`)
  if (!c.tests.ok) {
    out.push(`tests: ${c.tests.summary || `exit ${c.tests.exitCode}`}`)
    for (const f of c.tests.failures || []) out.push(`  ${f}`)
    if (!c.tests.failures?.length) for (const l of (c.tests.tail || []).slice(-10)) out.push(`  | ${l}`)
  }
  return out
}

async function main() {
  const { cmd, opts } = parseArgs(process.argv.slice(2))
  const root = repoRoot()
  const [block, ...files] = opts._
  switch (cmd) {
    case 'init': {
      const e = init(root, { scanPath: opts.scan, testCmd: opts.test, force: opts.force })
      console.log(describe(e))
      printStatus(root)
      return 0
    }
    case 'claim':
      claim(root, block, opts.agent, { also: opts.also ? opts.also.split(',') : [] })
      console.log(`GREEN ${block}: ${opts.agent} may enter. Edit only these files:`)
      for (const f of (() => { const t = loadState(root).tasks[block]; return [...t.files, ...t.extra] })()) console.log(`  ${f}`)
      return 0
    case 'extend':
      extend(root, block, opts.agent, files)
      console.log(`${block} now also holds ${files.join(', ')}`)
      return 0
    case 'release': {
      console.log(`${block}: running track circuit (scope, contract, scan, isolated tests)...`)
      const r = release(root, block, opts.agent, { commit: opts.commit !== false })
      const c = r.verify.checks
      const mark = (ok) => (ok ? 'ok  ' : 'FAIL')
      console.log(`  scope     ${mark(c.scope.ok)}`)
      console.log(`  contract  ${mark(c.contract.ok)}`)
      console.log(`  scan      ${mark(c.scan.ok)} ${c.scan.remaining} legacy call sites left`)
      console.log(`  tests     ${mark(c.tests.ok)} ${c.tests.summary || ''}`)
      if (!r.ok) {
        console.log(`FAULT ${block}: fix the failing checks and release again, or roll back.`)
        for (const line of faultLines(r.verify)) console.log(`  ${line}`)
        return 1
      }
      console.log(r.clear ? `CLEARED ${block} -> commit ${r.clear.commit.slice(0, 7)}` : `CLEAR ${block} (not committed)`)
      return 0
    }
    case 'rollback': {
      const e = rollback(root, block, opts.agent)
      console.log(`ROLLED BACK ${block}: restored ${e.files.join(', ') || 'nothing'}`)
      return 0
    }
    case 'status':
      printStatus(root)
      return 0
    case 'log':
      for (const e of readLedger(root)) console.log(`${e.at.slice(11, 19)}  ${describe(e)}`)
      return 0
    case 'serve': {
      const { serve } = await import('../src/signalbox-server.js')
      await serve(root, { port: Number(opts.port || 4700) })
      return null
    }
    default:
      console.error(USAGE)
      return 2
  }
}

main().then(
  (code) => { if (code != null) process.exitCode = code },
  (err) => {
    if (err instanceof SignalboxError) {
      console.error(err.message)
      process.exitCode = 1
    } else {
      console.error(err)
      process.exitCode = 2
    }
  },
)

