#!/usr/bin/env node
import { init, claim, extend, release, rollback, loadState, readLedger, repoRoot, writeReplay, installHook, hookCheck, doctor, checkpoint, listCheckpoints, recover, audit, drill, drillEnd, packOf, SignalboxError, DEFAULT_TEST } from '../src/signalbox.js'
import { ask } from '../src/dispatch.js'
import { scanDir } from '../src/scan.js'
import { summary, describe, metrics, timeline } from '../src/signalbox-state.js'
import { writeFileSync } from 'node:fs'
import { resolve as resolvePath, join } from 'node:path'

const USAGE = `signalbox - interlocking for parallel Bob subagents

Usage:
  signalbox init [--scan legacy-dapp/src] [--test "${DEFAULT_TEST}"] [--pack rules.json] [--force]
  signalbox claim <block> --agent <name> [--also a,b]    enter a block (refused while its signal is at danger)
  signalbox extend <block> <file...> --agent <name>      add files to your block
  signalbox release <block> --agent <name> [--no-commit] run scope, contract, scan and isolated tests; commit the block if clear
  signalbox rollback <block> --agent <name> [--operator] restore the block's files and free it
  signalbox next [--json]                                blocks a dispatcher may start now, with prompts
  signalbox report [--out file]                          impact report from the ledger (Markdown)
  signalbox install-hook                                 pre-commit guard: block files only via release
  signalbox doctor [--no-tests]                          preflight before a run or a recording
  signalbox audit                                        verify the ledger hash chain and every cleared commit
  signalbox checkpoints <block>                          black-box copies of a block's in-flight work
  signalbox recover <block> --agent <name> [--from <stamp>]  restore the latest (or a named) checkpoint
  signalbox ask "<question>" [--json]                    plain-language dispatcher desk ("start all green wave-1 blocks",
                                                         "riskiest remaining block", "why is w2-lib at danger?")
  signalbox why <block>                                  why a block's signal shows what it shows
  signalbox drill [spad|contract] [--hold 6]             chaos drill: a real stray edit or contract break, caught
                                                         by the checks, then restored from git after --hold seconds
  signalbox drill-end                                    end a running drill and restore its file
  signalbox prompt <block>                               the subagent prompt for a block
  signalbox status                                       the signal box panel, as text
  signalbox log                                          the train describer (every event)
  signalbox mcp [--root <repo>]                          MCP server on stdio: the signal box as tools for Bob
  signalbox serve [--port 4700] [--dist atlas/dist]       live signal box panel in the browser
  signalbox export [--out atlas/src/data/ledger.json]     ledger for the static replay build

Exit codes: 0 ok, 1 refused or fault, 2 usage error.`

function parseArgs(argv) {
  const [cmd, ...rest] = argv
  const opts = { _: [] }
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a.startsWith('--no-')) opts[a.slice(5)] = false
    else if (a === '--force' || a === '--operator' || a === '--json') opts[a.slice(2)] = true
    else if (a.startsWith('--')) opts[a.slice(2)] = rest[++i]
    else opts._.push(a)
  }
  return { cmd, opts }
}

function askBox(root, question) {
  const state = loadState(root)
  const report = scanDir(join(root, state.scanDir), packOf(root, state).rules)
  const files = Object.entries(report.imports).map(([id, imports]) => ({ id, imports }))
  return ask(question, { state, files })
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
  if (c.scope.protected?.length) out.push(`scope: PROTECTED files changed (tests / checker): ${c.scope.protected.join(', ')}`)
  const unowned = c.scope.outside.filter((f) => !(c.scope.protected || []).includes(f))
  if (unowned.length) out.push(`scope: SPAD, edited outside any block: ${unowned.join(', ')}`)
  if (!c.contract.ok) out.push(`contract: removed exports ${c.contract.removed.map((r) => `${r.file.split('/').pop()}#${r.name}`).join(', ')}`)
  if (!c.scan.ok) out.push(`scan: ${c.scan.remaining} legacy call sites left (${Object.entries(c.scan.byFile).filter(([, n]) => n).map(([f, n]) => `${f.split('/').pop()}:${n}`).join(', ')})`)
  if (!c.tests.ok) {
    out.push(`tests: ${c.tests.summary || `exit ${c.tests.exitCode}`}`)
    for (const f of c.tests.failures || []) out.push(`  ${f}`)
    if (!c.tests.failures?.length) for (const l of (c.tests.tail || []).slice(-10)) out.push(`  | ${l}`)
  }
  return out
}

const dur = (ms) => (ms >= 3600e3 ? `${Math.floor(ms / 3600e3)} h ${Math.round((ms % 3600e3) / 60e3)} min` : ms >= 60e3 ? `${Math.floor(ms / 60e3)} min ${Math.round((ms % 60e3) / 1e3)} s` : `${Math.round(ms / 1e3)} s`)

function reportMarkdown(events) {
  const m = metrics(events)
  if (!m) throw new SignalboxError('No signalbox here yet. Run: signalbox init')
  const tl = timeline(events)
  const state = loadState(repoRoot())
  const lines = [
    '# Signalbox report',
    '',
    'Generated from `.signalbox/ledger.jsonl`. Every number below is computed from recorded events.',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| Blocks cleared | ${m.cleared} / ${m.blocks} in ${m.waves} waves |`,
    `| Bob subagents | ${m.agents.length} (${m.agents.join(', ') || 'none'}) |`,
    `| Peak blocks occupied at once | ${m.peakParallel} |`,
    `| Claims / refused at signal | ${m.claims} / ${m.denied} |`,
    `| Track circuit runs / faults caught before commit | ${m.verifies} / ${m.faults} |`,
    `| Faults by check | scope ${m.faultsByCheck.scope} · contract ${m.faultsByCheck.contract} · legacy scan ${m.faultsByCheck.scan} · tests ${m.faultsByCheck.tests} |`,
    `| SPADs (edits outside any block) | ${m.spads} |`,
    `| Rollbacks | ${m.rollbacks} |`,
    `| Blocks cleared on the first release | ${m.firstTimeRight} / ${m.cleared} |`,
    `| Wall clock, box opened to last clear | ${dur(m.wallClockMs)} |`,
    `| Agent time in blocks (sum) | ${dur(m.agentBusyMs)} |`,
    '',
    '## Blocks',
    '',
    '| Wave | Block | Agent(s) | Releases | Outcome | Commit |',
    '| --- | --- | --- | --- | --- | --- |',
    ...Object.values(state.tasks).sort((a, b) => a.wave - b.wave || a.id.localeCompare(b.id)).map((t) => {
      const runs = tl.runs.filter((r) => r.task === t.id)
      return `| ${t.wave} | ${t.id} | ${[...new Set(runs.map((r) => r.agent))].join(', ') || '—'} | ${t.attempts} | ${t.state} | ${t.commit ? `\`${t.commit.slice(0, 7)}\`` : '—'} |`
    }),
    '',
    '## Faults caught',
    '',
    ...(events.filter((e) => e.t === 'verify' && !e.ok).map((e) => {
      const c = e.checks
      const why = []
      if (!c.scope.ok) why.push(`SPAD ${c.scope.outside.join(', ')}`)
      if (!c.contract.ok) why.push(`removed exports ${c.contract.removed.map((r) => `${r.file.split('/').pop()}#${r.name}`).join(', ')}`)
      if (!c.scan.ok) why.push(`${c.scan.remaining} legacy call sites left`)
      if (!c.tests.ok) why.push(`tests: ${(c.tests.failures || [])[0] || c.tests.summary}`)
      return `- ${e.at.slice(11, 19)} **${e.task}** (${e.agent}): ${why.join('; ')}`
    })),
    '',
  ]
  return lines.join('\n')
}

async function main() {
  const { cmd, opts } = parseArgs(process.argv.slice(2))
  const root = cmd === 'mcp' && opts.root ? null : repoRoot()
  const [block, ...files] = opts._
  switch (cmd) {
    case 'init': {
      const e = init(root, { scanPath: opts.scan, testCmd: opts.test, pack: opts.pack, force: opts.force })
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
      const e = rollback(root, block, opts.agent, { operator: opts.operator !== undefined })
      console.log(`ROLLED BACK ${block}: restored ${e.files.join(', ') || 'nothing'}`)
      return 0
    }
    case 'checkpoints': {
      checkpoint(root)
      const list = listCheckpoints(root, block)
      if (!list.length) console.log(`no checkpoints for ${block}`)
      for (const c of list) console.log(`${c.stamp}  ${c.agent}  ${c.files.join(', ')}`)
      return 0
    }
    case 'recover': {
      const e = recover(root, block, opts.agent || 'operator', { stamp: opts.from })
      console.log(`RECOVERED ${block} from ${e.from}: ${e.files.join(', ')}`)
      return 0
    }
    case 'status':
      checkpoint(root)
      printStatus(root)
      return 0
    case 'next': {
      checkpoint(root)
      const state = loadState(root)
      const list = Object.values(state.tasks)
      const out = {
        done: list.every((t) => t.commit),
        ready: list.filter((t) => t.state === 'clear').map((t) => ({ block: t.id, wave: t.wave, files: [...t.files, ...t.extra], prompt: t.prompt })),
        occupied: list.filter((t) => t.state === 'occupied').map((t) => ({ block: t.id, agent: t.agent })),
        fault: list.filter((t) => t.state === 'fault').map((t) => ({ block: t.id, agent: t.agent, attempts: t.attempts })),
        waiting: list.filter((t) => t.state === 'danger').map((t) => t.id),
      }
      if (opts.json) console.log(JSON.stringify(out, null, 2))
      else {
        if (out.done) console.log('ALL BLOCKS CLEARED')
        for (const r of out.ready) console.log(`READY     ${r.block} (wave ${r.wave}): npm run -s sb -- prompt ${r.block} --agent <name>`)
        for (const r of out.occupied) console.log(`OCCUPIED  ${r.block} by ${r.agent}`)
        for (const r of out.fault) console.log(`FAULT     ${r.block} by ${r.agent} after ${r.attempts} release attempt(s)`)
        if (out.waiting.length) console.log(`WAITING   ${out.waiting.join(', ')}`)
      }
      return 0
    }
    case 'report': {
      const md = reportMarkdown(readLedger(root))
      if (opts.out) {
        writeFileSync(resolvePath(opts.out), md)
        console.log(`wrote ${opts.out}`)
      } else console.log(md)
      return 0
    }
    case 'doctor': {
      const checks = doctor(root, { runTests: opts.tests !== false })
      for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.name.padEnd(30)} ${c.detail}`)
      return checks.every((c) => c.ok) ? 0 : 1
    }
    case 'audit': {
      const r = await audit(root)
      console.log(`ledger: ${r.events} events, ${r.chain.chained ? `hash chain ${r.chain.ok ? 'intact' : 'BROKEN'}${r.chain.head ? ` (head ${r.chain.head.slice(0, 12)})` : ''}` : 'not hash-chained'}`)
      console.log(`cleared blocks checked against git: ${r.clears}`)
      for (const f of r.findings) console.log(`  FAIL  ${f}`)
      console.log(r.ok ? 'AUDIT PASSED' : 'AUDIT FAILED')
      return r.ok ? 0 : 1
    }
    case 'install-hook':
      console.log(`installed ${installHook(root)}`)
      return 0
    case 'hook-check': {
      const blocked = hookCheck(root)
      if (!blocked.length) return 0
      console.error('signalbox: these files cannot be committed directly while the signal box is open:')
      for (const f of blocked) console.error(`  ${f}`)
      console.error('Block files are committed by `npm run -s sb -- release <block> --agent <name>` after the track circuit.')
      console.error('Protected files (tests, chainguard/) cannot be committed while the box is open; a human can override with SIGNALBOX_COMMIT=1.')
      return 1
    }
    case 'prompt': {
      const t = loadState(root).tasks[block]
      if (!t) throw new SignalboxError(`unknown block ${block}`)
      console.log(t.prompt.replaceAll('<your-agent-name>', opts.agent || '<your-agent-name>'))
      return 0
    }
    case 'ask':
    case 'why':
    case 'risk': {
      checkpoint(root)
      const q = cmd === 'ask' ? opts._.join(' ') : cmd === 'why' ? `why ${block || ''}` : 'riskiest remaining block'
      const a = askBox(root, q)
      if (opts.json) console.log(JSON.stringify(a, null, 2))
      else {
        console.log(a.text)
        for (const l of a.lines || []) console.log(`  ${l}`)
        if (a.prompt) console.log(`\n${a.prompt}`)
      }
      return a.intent === 'unknown' ? 1 : 0
    }
    case 'drill': {
      const e = drill(root, { kind: block || 'spad', by: opts.agent || 'operator' })
      console.log(describe(e))
      if (e.caught.scope) console.log(`  scope     CAUGHT  ${e.caught.scope}`)
      if (e.caught.contract) console.log(`  contract  CAUGHT  ${e.caught.contract}`)
      console.log('  every release is refused while this edit is on the tracks')
      const hold = opts.hold === undefined ? null : Number(opts.hold)
      if (hold == null) {
        console.log('end it with: npm run -s sb -- drill-end')
        return 0
      }
      await new Promise((r) => setTimeout(r, hold * 1000))
      const end = drillEnd(root, { by: opts.agent || 'operator' })
      console.log(describe(end))
      return 0
    }
    case 'drill-end': {
      console.log(describe(drillEnd(root, { by: opts.agent || 'operator' })))
      return 0
    }
    case 'log':
      for (const e of readLedger(root)) console.log(`${e.at.slice(11, 19)}  ${describe(e)}`)
      return 0
    case 'export': {
      const out = resolvePath(opts.out || `${root}/atlas/src/data/ledger.json`)
      writeReplay(root, out)
      console.log(`wrote ${readLedger(root).length} events to ${out}`)
      return 0
    }
    case 'mcp': {
      const { serveMcp } = await import('../src/signalbox-mcp.js')
      await serveMcp(opts.root ? repoRoot(resolvePath(opts.root)) : root)
      return 0
    }
    case 'serve': {
      const { serve } = await import('../src/signalbox-server.js')
      await serve(root, { port: Number(opts.port || 4700), ...(opts.dist ? { dist: resolvePath(opts.dist) } : {}) })
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

