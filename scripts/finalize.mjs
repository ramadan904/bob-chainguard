#!/usr/bin/env node
// One command after the recorded Bob run: every report the submission needs, the replay
// bundle for the deployed panel, and paste-ready statements with every number filled in.
// Everything is computed from the ledger, real scans and a real build. Nothing is typed in.

import { execSync, execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { readLedger } from '../chainguard/src/signalbox.js'
import { metrics, reduce } from '../chainguard/src/signalbox-state.js'
import { renderStatement } from '../chainguard/src/statements.js'

const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
const run = (cmd, opts = {}) => execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts })
const step = (msg) => console.log(`\n▸ ${msg}`)
const kb = (n) => `${Math.round(n / 1024)} kB`
const dur = (ms) => (ms >= 3600e3 ? `${Math.floor(ms / 3600e3)} h ${Math.round((ms % 3600e3) / 60e3)} min` : `${Math.max(1, Math.round(ms / 60e3))} min`)

const events = readLedger(root)
const state = reduce(events)
if (!state) {
  console.error('No signal box ledger found (.signalbox/ledger.jsonl). Run the Bob migration first (docs/BOB_RUNBOOK.md).')
  process.exit(1)
}
const m = metrics(events)
const warnings = []
if (m.cleared < m.blocks) warnings.push(`${m.blocks - m.cleared} block(s) not cleared yet`)

step('Legacy scan (guard)')
let guardOk = true
try { run('node chainguard/bin/chainguard.js scan legacy-dapp/src --fail-on warning') } catch { guardOk = false; warnings.push('npm run guard fails: legacy call sites remain') }
const scan = JSON.parse(run('node chainguard/bin/chainguard.js scan legacy-dapp/src --format json'))
const base = JSON.parse(readFileSync(join(root, 'reports/baseline.json'), 'utf8'))
console.log(`  ${base.totals.findings} → ${scan.totals.findings} legacy call sites`)

step('Behavior tests')
let tests = ''
try { tests = run('npm test --prefix legacy-dapp').split('\n').find((l) => /^\s*Tests\s+/.test(l))?.trim() || 'passed' } catch (e) { tests = 'FAILED'; warnings.push('legacy-dapp tests fail') }
let testsChanged = ''
try {
  testsChanged = execFileSync('git', ['diff', '--name-only', 'before-bob', '--', 'legacy-dapp/src/lib/__tests__'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
} catch {
  warnings.push("tag before-bob not found: run `git tag before-bob` on the commit before Bob's changes")
}
if (testsChanged) warnings.push(`test files changed since before-bob: ${testsChanged.split('\n').join(', ')}`)
console.log(`  ${tests}${testsChanged ? ' (TEST FILES CHANGED)' : ', test files unchanged'}`)

step('Production build and bundle size')
let bundle = null
try {
  run('npm run build --prefix legacy-dapp')
  const dir = join(root, 'legacy-dapp/dist/assets')
  let raw = 0
  let gz = 0
  for (const f of readdirSync(dir).filter((f) => /\.(js|css)$/.test(f))) {
    const b = readFileSync(join(dir, f))
    raw += b.length
    gz += gzipSync(b, { level: 9 }).length
  }
  const before = JSON.parse(readFileSync(join(root, 'reports/baseline-bundle.json'), 'utf8'))
  bundle = { before: before.gzipBytes, after: gz, raw, change: Math.round((1 - gz / before.gzipBytes) * 100) }
  console.log(`  ${kb(bundle.before)} → ${kb(bundle.after)} gzip (−${bundle.change}%)`)
} catch { warnings.push('legacy-dapp build fails') }
const pkg = JSON.parse(readFileSync(join(root, 'legacy-dapp/package.json'), 'utf8'))
const stillLegacy = ['ethers', 'web3'].filter((d) => pkg.dependencies?.[d])
if (stillLegacy.length) warnings.push(`still in package.json: ${stillLegacy.join(', ')} (runbook step 4)`)

step('Ledger audit (hash chain + every cleared commit)')
try { console.log('  ' + run('node chainguard/bin/signalbox.js audit').trim().split('\n').join('\n  ')) } catch (e) { warnings.push('signalbox audit failed: the ledger does not match git'); console.log(`  ${e.stdout || ''}`) }

step('Reports')
run('node chainguard/bin/signalbox.js report --out reports/signalbox-report.md')
writeFileSync(join(root, 'reports/signalbox-log.txt'), run('node chainguard/bin/signalbox.js log'))
run('node chainguard/bin/chainguard.js scan legacy-dapp/src --baseline reports/baseline.json --format md --out reports/after.md')
console.log('  reports/signalbox-report.md, reports/signalbox-log.txt, reports/after.md')

step('Replay bundle for the deployed panel')
run('npm run -s atlas')
console.log('  atlas/src/data/atlas-data.json, atlas/src/data/ledger.json, atlas/dist')

// Example fault for the statements: a failing behavior test if there was one, else any fault.
const why = (e) => {
  const c = e.checks
  if (!c.tests.ok) return `a failing test, ${(c.tests.failures?.[0] || c.tests.summary || '').replace(/^(×|✗|FAIL)\s+/, '').replace(/\s+\d+ms$/, '')}`
  if (!c.contract.ok) return `a removed export still in use (${c.contract.removed.map((r) => r.name).join(', ')})`
  if (!c.scan.ok) return `${c.scan.remaining} legacy call sites left`
  return `an edit outside its block (${c.scope.outside.map((f) => f.split('/').pop()).join(', ')})`
}
const fault = events.find((e) => e.t === 'verify' && !e.ok && !e.checks.tests.ok) || events.find((e) => e.t === 'verify' && !e.ok)
const faultExample = fault ? `${fault.task} (${fault.agent}): ${why(fault)}` : 'none'
const numbers = [
  '# Submission numbers',
  '',
  `Generated by \`npm run finalize\` on ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from the ledger, real scans and a real build.`,
  'The paste-ready statements with these numbers filled in are in docs/submission/final/.',
  '',
  '| Placeholder | Value |',
  '| --- | --- |',
  `| Legacy call sites | ${base.totals.findings} → ${scan.totals.findings} |`,
  `| Files on legacy APIs | ${base.filesAffected} / ${base.filesScanned} → ${scan.filesAffected} / ${scan.filesScanned} |`,
  `| Blocks cleared | ${m.cleared} / ${m.blocks} in ${m.waves} waves |`,
  `| Bob subagents / peak in parallel | ${m.agents.length} / ${m.peakParallel} |`,
  `| Faults caught before commit | ${m.faults} (scope ${m.faultsByCheck.scope}, contract ${m.faultsByCheck.contract}, scan ${m.faultsByCheck.scan}, tests ${m.faultsByCheck.tests}) |`,
  `| Example fault | ${faultExample} |`,
  `| SPADs / rollbacks / refused claims | ${m.spads} / ${m.rollbacks} / ${m.denied} |`,
  `| Blocks cleared on the first release | ${m.firstTimeRight} / ${m.cleared} |`,
  `| Behavior tests | ${tests}${testsChanged ? ' (test files changed!)' : ', unmodified'} |`,
  `| Bundle (gzip) | ${bundle ? `${kb(bundle.before)} → ${kb(bundle.after)} (−${bundle.change}%)` : 'build failed'} |`,
  `| Wall clock, box opened → last clear | ${dur(m.wallClockMs)} |`,
  '',
  warnings.length ? `## Warnings\n\n${warnings.map((w) => `- ${w}`).join('\n')}\n` : '## Warnings\n\nNone. Ready to submit.\n',
].join('\n')
writeFileSync(join(root, 'reports/submission-numbers.md'), numbers)

step('Statements (docs/submission/final/)')
// Screenshots are matched by file name: onboarding, dispatcher, mcp, review; the rest are subagents.
const shots = existsSync(join(root, 'bob_sessions')) ? readdirSync(join(root, 'bob_sessions')).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort() : []
const pick = (re) => shots.filter((f) => re.test(f))
const list = (files) => (files.length ? files.map((f) => `\`bob_sessions/${f}\``).join(', ') : null)
const special = /onboard|dispatch|mcp|review/i
const bobcoins = existsSync(join(root, 'bob_sessions/bobcoins.txt')) ? readFileSync(join(root, 'bob_sessions/bobcoins.txt'), 'utf8').match(/\d[\d,.]*/)?.[0] : null
const values = {
  calls_before: base.totals.findings,
  calls_after: scan.totals.findings,
  blocks: `${m.cleared}/${m.blocks}`,
  waves: m.waves,
  agents: m.agents.length,
  peak: m.peakParallel,
  faults: m.faults,
  fault_example: fault ? faultExample : null,
  denied: m.denied,
  drills: m.drillsCaught,
  wall_clock: dur(m.wallClockMs),
  tests: `${tests.replace(/^Tests\s+/, '')}${testsChanged ? ' (TEST FILES CHANGED)' : ', unmodified'}`,
  shots_onboarding: list(pick(/onboard/i)),
  shots_dispatcher: list(pick(/dispatch/i)),
  shots_mcp: list(pick(/mcp/i)),
  shots_review: list(pick(/review/i)),
  shots_subagents: list(shots.filter((f) => !special.test(f))),
  bobcoins,
}
mkdirSync(join(root, 'docs/submission/final'), { recursive: true })
for (const name of ['PROBLEM_SOLUTION.md', 'IBM_BOB_USAGE.md']) {
  const r = renderStatement(readFileSync(join(root, 'docs/submission', name), 'utf8'), values)
  writeFileSync(join(root, 'docs/submission/final', name), r.text)
  console.log(`  ${name}: ${r.words} words${r.missing.length ? `, missing: ${r.missing.join(', ')}` : ''}`)
  if (r.words > 500) warnings.push(`${name} is ${r.words} words (limit 500)`)
  if (r.missing.length) warnings.push(`${name} has no value for: ${r.missing.join(', ')} (screenshots go in bob_sessions/, named e.g. alice-dispatcher.png)`)
}
const warningBlock = warnings.length ? `## Warnings\n\n${warnings.map((w) => `- ${w}`).join('\n')}\n` : '## Warnings\n\nNone. Ready to submit.\n'
writeFileSync(join(root, 'reports/submission-numbers.md'), numbers.replace(/## Warnings[\s\S]*$/, warningBlock))

step('Done')
console.log(readFileSync(join(root, 'reports/submission-numbers.md'), 'utf8').split('\n').slice(5).join('\n'))
console.log(`Commit and deploy:
  git add .signalbox/ledger.jsonl reports/ atlas/src/data/ atlas/public/bob/ bob_sessions/ docs/submission/final/
  git commit -m "Finalize: Bob run reports and replay"
  git push   # then merge to main; the Pages workflow deploys the panel`)
process.exitCode = warnings.length ? 1 : 0
