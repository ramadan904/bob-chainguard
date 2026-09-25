#!/usr/bin/env node
// Proves the interlocking is not Web3-specific: opens a real signal box on samples/moment-billing
// with the Moment.js -> date-fns rule pack, in a throwaway git worktree of HEAD, and checks every
// part of the protocol against it. Nothing in this checkout changes. Run in CI.
//   npm ci --prefix samples/moment-billing && node scripts/prove-pack.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const deps = join(repo, 'samples/moment-billing/node_modules')
if (!existsSync(deps)) {
  console.error('Install the sample first: npm ci --prefix samples/moment-billing')
  process.exit(2)
}

const dir = mkdtempSync(join(tmpdir(), 'prove-pack-'))
const wt = join(dir, 'repo')
const results = []
let failed = false
const expect = (name, ok, detail) => {
  results.push(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failed = true
}

try {
  execFileSync('git', ['worktree', 'add', '--detach', '--quiet', wt, 'HEAD'], { cwd: repo })
  symlinkSync(deps, join(wt, 'samples/moment-billing/node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  const lib = await import(new URL('../chainguard/src/signalbox.js', import.meta.url))
  const { reduce } = await import(new URL('../chainguard/src/signalbox-state.js', import.meta.url))

  const opened = lib.init(wt, { scanPath: 'samples/moment-billing/src', pack: 'chainguard/packs/moment-to-date-fns.json', testCmd: 'npm test --prefix samples/moment-billing' })
  const tasks = opened.plan.tasks
  expect('signal box opens with the Moment.js pack', tasks.length > 1 && opened.pack.endsWith('moment-to-date-fns.json'), `${tasks.length} blocks in ${opened.plan.waves} waves`)

  const first = tasks.find((t) => t.wave === 1)
  const later = tasks.find((t) => t.wave > 1)
  lib.claim(wt, first.id, 'bob-1')
  expect(`claim ${first.id} (wave 1)`, reduce(lib.readLedger(wt)).tasks[first.id].agent === 'bob-1')
  let refused = ''
  try { lib.claim(wt, later.id, 'bob-2') } catch (e) { refused = e.message }
  expect(`claim ${later.id} (wave ${later.wave}) is refused`, /signal at danger/.test(refused), refused.replace(/^DENIED \S+: /, ''))

  const r = lib.release(wt, first.id, 'bob-1', { commit: false })
  const c = r.verify.checks
  expect('track circuit: scope and contract pass on untouched code', c.scope.ok && c.contract.ok)
  expect('track circuit: legacy scan finds Moment.js calls', !c.scan.ok && c.scan.remaining > 0, `${c.scan.remaining} left`)
  expect('track circuit: behavior tests run on an isolated worktree', c.tests.ok && c.tests.passed > 0, c.tests.summary)

  const d = lib.drill(wt, { kind: 'contract' })
  expect('chaos drill: contract break caught', Boolean(d.caught.contract), `${d.renamed.from} in ${d.file.split('/').pop()}, caught in ${d.detectMs} ms`)
  expect('chaos drill: file restored from git', lib.drillEnd(wt).restored === true)

  const audit = await lib.audit(wt)
  expect('ledger hash chain verifies', audit.ok, `${audit.events} events`)
} catch (err) {
  expect('unexpected error', false, err.message)
} finally {
  try { execFileSync('git', ['worktree', 'remove', '--force', wt], { cwd: repo, stdio: 'ignore' }) } catch { /* gone */ }
  rmSync(dir, { recursive: true, force: true })
}

console.log('Signalbox on the Moment.js -> date-fns pack (samples/moment-billing)\n')
console.log(results.join('\n'))
process.exitCode = failed ? 1 : 0
