import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reduce, canClaim, ownerOf, matchGlob, summary, metrics, timeline } from '../src/signalbox-state.js'
import { init, claim, extend, release, rollback, loadState, readLedger, exportsOf, installHook, hookCheck, checkpoint, listCheckpoints, recover, checkContract, importersOf, SignalboxError } from '../src/signalbox.js'

const plan = {
  waves: 2,
  tasks: [
    { id: 'w1-a', wave: 1, files: ['src/a.js'], findings: 1, prompt: '' },
    { id: 'w1-b', wave: 1, files: ['src/b.js'], findings: 1, prompt: '' },
    { id: 'w2-c', wave: 2, files: ['src/c.js'], findings: 1, prompt: '' },
  ],
}
const ev = (t, extra = {}) => ({ at: '2026-09-25T00:00:00Z', t, ...extra })

test('reduce: waves open only after every earlier block clears', () => {
  let s = reduce([ev('init', { base: 'abc', plan, allow: [] })])
  assert.deepEqual(Object.values(s.tasks).map((t) => t.state), ['clear', 'clear', 'danger'])
  s = reduce([ev('init', { base: 'abc', plan, allow: [] }), ev('claim', { task: 'w1-a', agent: 'x' }), ev('clear', { task: 'w1-a', agent: 'x', commit: 'c1' })])
  assert.equal(s.tasks['w2-c'].state, 'danger')
  s = reduce([...[ev('init', { base: 'abc', plan, allow: [] })], ev('clear', { task: 'w1-a', commit: 'c1' }), ev('clear', { task: 'w1-b', commit: 'c2' })])
  assert.equal(s.tasks['w2-c'].state, 'clear')
})

test('reduce: fault after a failed verify, free again after rollback', () => {
  const base = [ev('init', { base: 'abc', plan, allow: [] }), ev('claim', { task: 'w1-a', agent: 'x' })]
  assert.equal(reduce(base).tasks['w1-a'].state, 'occupied')
  const bad = [...base, ev('verify', { task: 'w1-a', agent: 'x', ok: false, checks: { scope: { ok: false, outside: ['src/z.js'] } } })]
  assert.equal(reduce(bad).tasks['w1-a'].state, 'fault')
  assert.equal(reduce(bad).spads.length, 1)
  assert.equal(reduce([...bad, ev('rollback', { task: 'w1-a', agent: 'x', files: [] })]).tasks['w1-a'].state, 'clear')
})

test('canClaim: danger, occupied, overlap', () => {
  const s = reduce([ev('init', { base: 'abc', plan, allow: [] }), ev('claim', { task: 'w1-a', agent: 'x' }), ev('extend', { task: 'w1-a', agent: 'x', files: ['src/b.js'] })])
  assert.match(canClaim(s, 'w2-c', 'y').reason, /signal at danger/)
  assert.match(canClaim(s, 'w1-a', 'y').reason, /occupied by x/)
  assert.match(canClaim(s, 'w1-b', 'y').reason, /held by w1-a/)
  assert.equal(canClaim(s, 'w1-a', 'x').ok, true)
  assert.deepEqual(summary(s).agents, ['x'])
})

test('ownerOf and matchGlob', () => {
  const s = reduce([ev('init', { base: 'abc', plan, allow: ['pkg/**', '*.lock'] }), ev('claim', { task: 'w1-a', agent: 'x' })])
  assert.equal(ownerOf(s, 'src/a.js'), 'w1-a')
  assert.equal(ownerOf(s, 'src/b.js'), null)
  assert.equal(ownerOf(s, 'pkg/deep/x.json'), 'allow')
  assert.ok(matchGlob('*.lock', 'yarn.lock') && !matchGlob('*.lock', 'a/yarn.lock'))
})

test('exportsOf finds declarations, lists and default', () => {
  const names = exportsOf('export function a(){}\nexport const b = 1\nexport async function c(){}\nexport { d, e as f }\nexport default X')
  assert.deepEqual([...names].sort(), ['a', 'b', 'c', 'd', 'default', 'f'])
})

// ------------------------------------------------------------------ end to end on a real git repo

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'signalbox-e2e-'))
  const run = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' })
  run('init', '-q')
  run('config', 'user.email', 't@example.com')
  run('config', 'user.name', 't')
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'src/a.js'), "import { ethers } from 'ethers'\nexport const one = () => BigNumber.from(1)\nexport const keep = 1\n")
  writeFileSync(join(root, 'src/b.js'), "import Web3 from 'web3'\nexport const two = 2\n")
  writeFileSync(join(root, 'src/c.js'), "import { keep } from './a.js'\nimport { ethers } from 'ethers'\nexport const three = keep + 2\n")
  // The "test suite": fails while src/a.js contains the word BROKEN.
  writeFileSync(join(root, 'check.js'), "const fs = require('fs'); if (fs.readFileSync('src/a.js','utf8').includes('BROKEN')) { console.log(' Tests  1 failed | 1 passed (2)'); process.exit(1) } console.log(' Tests  2 passed (2)')\n")
  run('add', '.')
  run('commit', '-qm', 'legacy')
  return { root, run }
}

test('e2e: claim, fault, fix, clear, commit only the block', () => {
  const { root, run } = makeRepo()
  try {
    init(root, { scanPath: 'src', testCmd: 'node check.js', allow: [] })
    const blocks = loadState(root).tasks
    const a = Object.values(blocks).find((t) => t.files.includes('src/a.js'))
    const c = Object.values(blocks).find((t) => t.files.includes('src/c.js'))
    assert.ok(a.wave < c.wave, 'c imports a, so it waits for a later wave')
    assert.throws(() => claim(root, c.id, 'bob-2'), SignalboxError)

    claim(root, a.id, 'bob-1')
    writeFileSync(join(root, 'src/a.js'), "export const one = () => 1n // BROKEN\nexport const keep = 1\n")
    let r = release(root, a.id, 'bob-1')
    assert.equal(r.ok, false)
    assert.equal(r.verify.checks.tests.ok, false)
    assert.equal(r.verify.checks.tests.failed, 1)

    writeFileSync(join(root, 'src/a.js'), 'export const one = () => 1n\nexport const keep = 1\n')
    writeFileSync(join(root, 'src/b.js'), 'export const two = 2\n') // same block: planner grouped a.js and b.js
    r = release(root, a.id, 'bob-1')
    assert.equal(r.ok, true, JSON.stringify(r.verify.checks))
    const changed = execFileSync('git', ['show', '--name-only', '--format=', r.clear.commit], { cwd: root, encoding: 'utf8' }).trim()
    assert.equal(changed, 'src/a.js\nsrc/b.js')
    assert.match(execFileSync('git', ['log', '-1', '--format=%B'], { cwd: root, encoding: 'utf8' }), /Signalbox-Agent: bob-1/)
    assert.equal(loadState(root).tasks[a.id].state, 'cleared')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('e2e: SPAD, broken contract and rollback', () => {
  const { root } = makeRepo()
  try {
    init(root, { scanPath: 'src', testCmd: 'node check.js', allow: [] })
    const a = Object.values(loadState(root).tasks).find((t) => t.files.includes('src/a.js'))
    claim(root, a.id, 'bob-1')
    writeFileSync(join(root, 'src/a.js'), 'export const one = () => 1n\n') // drops `keep`
    writeFileSync(join(root, 'src/c.js'), "import { keep } from './a.js'\nexport const three = keep + 2 // edited outside the block\n")
    const r = release(root, a.id, 'bob-1')
    assert.equal(r.ok, false)
    assert.deepEqual(r.verify.checks.scope.outside, ['src/c.js'])
    assert.deepEqual(r.verify.checks.contract.removed, [{ file: 'src/a.js', name: 'keep', usedBy: ['src/c.js'] }])

    // Extending the block to c.js is refused: c.js belongs to a later block? No: it is unowned, so it is allowed.
    extend(root, a.id, 'bob-1', ['src/c.js'])
    assert.ok(loadState(root).tasks[a.id].extra.includes('src/c.js'))

    rollback(root, a.id, 'bob-1')
    assert.match(readFileSync(join(root, 'src/a.js'), 'utf8'), /keep/)
    assert.match(readFileSync(join(root, 'src/c.js'), 'utf8'), /ethers/)
    assert.equal(loadState(root).tasks[a.id].state, 'clear')
    assert.deepEqual(readLedger(root).map((e) => e.t), ['init', 'claim', 'verify', 'extend', 'rollback'])
    assert.ok(!existsSync(join(root, '.signalbox', 'lock')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('metrics: parallelism, faults by check, first-time-right', () => {
  const at = (sec) => new Date(Date.UTC(2026, 8, 25, 0, 0, sec)).toISOString()
  const events = [
    { t: 'init', at: at(0), base: 'b', plan, allow: [] },
    { t: 'claim', at: at(1), task: 'w1-a', agent: 'x' },
    { t: 'claim', at: at(2), task: 'w1-b', agent: 'y' },
    { t: 'verify', at: at(3), task: 'w1-a', agent: 'x', ok: false, checks: { scope: { ok: true }, contract: { ok: true }, scan: { ok: true }, tests: { ok: false } } },
    { t: 'verify', at: at(4), task: 'w1-b', agent: 'y', ok: true, checks: { scope: { ok: true }, contract: { ok: true }, scan: { ok: true }, tests: { ok: true } } },
    { t: 'clear', at: at(4), task: 'w1-b', agent: 'y', commit: 'c1' },
    { t: 'verify', at: at(6), task: 'w1-a', agent: 'x', ok: true, checks: { scope: { ok: true }, contract: { ok: true }, scan: { ok: true }, tests: { ok: true } } },
    { t: 'clear', at: at(6), task: 'w1-a', agent: 'x', commit: 'c2' },
  ]
  const m = metrics(events)
  assert.equal(m.peakParallel, 2)
  assert.equal(m.faults, 1)
  assert.deepEqual(m.faultsByCheck, { scope: 0, contract: 0, scan: 0, tests: 1 })
  assert.equal(m.firstTimeRight, 1)
  assert.equal(m.wallClockMs, 6000)
  assert.deepEqual(timeline(events).runs.map((r) => [r.task, r.outcome, r.verifies.length]), [['w1-b', 'cleared', 1], ['w1-a', 'cleared', 2]])
})

test('e2e: pre-commit hook blocks direct commits of block files but not releases', () => {
  const { root, run } = makeRepo()
  try {
    init(root, { scanPath: 'src', testCmd: 'node check.js', allow: [] })
    installHook(root)
    // Point the hook at this checkout's CLI (the temp repo has no chainguard/ folder).
    const hook = join(root, '.git/hooks/pre-commit')
    writeFileSync(hook, `#!/bin/sh\nexec node ${JSON.stringify(new URL('../bin/signalbox.js', import.meta.url).pathname)} hook-check\n`, { mode: 0o755 })
    const a = Object.values(loadState(root).tasks).find((t) => t.files.includes('src/a.js'))
    claim(root, a.id, 'bob-1')
    writeFileSync(join(root, 'src/a.js'), 'export const one = () => 1n\nexport const keep = 1\n')
    writeFileSync(join(root, 'src/b.js'), 'export const two = 2\n')
    run('add', 'src/a.js')
    assert.deepEqual(hookCheck(root), ['src/a.js'])
    assert.throws(() => run('commit', '-qm', 'bypass'))
    run('reset', '-q')
    const r = release(root, a.id, 'bob-1')
    assert.equal(r.ok, true)
    assert.ok(r.clear.commit)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('e2e: operator rollback frees a block held by a stuck agent', () => {
  const { root } = makeRepo()
  try {
    init(root, { scanPath: 'src', testCmd: 'node check.js', allow: [] })
    const a = Object.values(loadState(root).tasks).find((t) => t.files.includes('src/a.js'))
    claim(root, a.id, 'bob-1')
    assert.throws(() => rollback(root, a.id, 'dispatcher'), /--operator/)
    const e = rollback(root, a.id, 'dispatcher', { operator: true })
    assert.equal(e.agent, 'dispatcher (operator, over bob-1)')
    assert.equal(loadState(root).tasks[a.id].state, 'clear')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('e2e: tests and the checker are protected from agents', () => {
  const { root, run } = makeRepo()
  try {
    mkdirSync(join(root, 'src/__tests__'))
    writeFileSync(join(root, 'src/__tests__/a.test.js'), 'expect(1).toBe(1)\n')
    run('add', '.')
    run('commit', '-qm', 'add test')
    init(root, { scanPath: 'src', testCmd: 'node check.js', allow: [] })
    const a = Object.values(loadState(root).tasks).find((t) => t.files.includes('src/a.js'))
    claim(root, a.id, 'bob-1')
    assert.throws(() => extend(root, a.id, 'bob-1', ['src/__tests__/a.test.js']), /protected/)
    assert.equal(readLedger(root).at(-1).t, 'deny')

    writeFileSync(join(root, 'src/a.js'), 'export const one = () => 1n\nexport const keep = 1\n')
    writeFileSync(join(root, 'src/b.js'), 'export const two = 2\n')
    writeFileSync(join(root, 'src/__tests__/a.test.js'), '// weakened\n')
    const r = release(root, a.id, 'bob-1')
    assert.equal(r.ok, false)
    assert.deepEqual(r.verify.checks.scope.protected, ['src/__tests__/a.test.js'])

    run('add', 'src/__tests__/a.test.js')
    assert.deepEqual(hookCheck(root), ['src/__tests__/a.test.js'])
    assert.deepEqual(hookCheck(root, { SIGNALBOX_COMMIT: '1' }), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('e2e: black-box checkpoints survive a rogue git checkout', () => {
  const { root, run } = makeRepo()
  try {
    init(root, { scanPath: 'src', testCmd: 'node check.js', allow: [] })
    const a = Object.values(loadState(root).tasks).find((t) => t.files.includes('src/a.js'))
    claim(root, a.id, 'bob-1')
    writeFileSync(join(root, 'src/a.js'), 'export const one = () => 1n // hours of work\nexport const keep = 1\n')
    assert.equal(checkpoint(root).length, 1)
    assert.equal(checkpoint(root).length, 0, 'unchanged content is not saved twice')

    run('checkout', '--', '.') // another agent breaks the rules
    assert.doesNotMatch(readFileSync(join(root, 'src/a.js'), 'utf8'), /hours of work/)

    const e = recover(root, a.id, 'dispatcher')
    assert.match(readFileSync(join(root, 'src/a.js'), 'utf8'), /hours of work/)
    assert.deepEqual(e.files, ['src/a.js'])
    assert.equal(readLedger(root).at(-1).t, 'recover')
    assert.ok(listCheckpoints(root, a.id).length >= 1)
    assert.throws(() => recover(root, 'nope', 'x'), /unknown block/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('contract: exports retire once unused (expand -> migrate -> contract)', () => {
  const { root, run } = makeRepo()
  try {
    writeFileSync(join(root, 'src/d.js'), "import * as all from './b.js'\nexport default all\n")
    run('add', '.')
    run('commit', '-qm', 'namespace import of b')
    assert.deepEqual(importersOf(root, 'src/a.js', 'src').map((u) => [u.file, [...u.names]]), [['src/c.js', ['keep']]])
    assert.equal(importersOf(root, 'src/b.js', 'src')[0].names, '*')

    // `one` is unused: removing it is fine. `keep` is imported by c.js: removing it is not.
    writeFileSync(join(root, 'src/a.js'), 'export const keep = 1\n')
    let c = checkContract(root, ['src/a.js'], 'src')
    assert.equal(c.ok, true)
    assert.deepEqual(c.retired, [{ file: 'src/a.js', name: 'one' }])
    writeFileSync(join(root, 'src/a.js'), 'export const other = 1\n')
    c = checkContract(root, ['src/a.js'], 'src')
    assert.deepEqual(c.removed.map((r) => [r.name, r.usedBy]), [['keep', ['src/c.js']]])

    // Deleting a file is a contract break while anything still imports it.
    rmSync(join(root, 'src/b.js'))
    assert.equal(checkContract(root, ['src/b.js'], 'src').removed[0].name, '(file deleted)')
    rmSync(join(root, 'src/d.js'))
    assert.equal(checkContract(root, ['src/b.js'], 'src').ok, true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
