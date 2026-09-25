import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compilePack, DEFAULT_PACK } from '../src/rules.js'
import { loadPack } from '../src/pack.js'
import { scanSource } from '../src/scan.js'
import { buildPlan } from '../src/plan.js'
import { scanDir } from '../src/scan.js'
import { init, claim, release, loadState } from '../src/signalbox.js'

const momentPack = fileURLToPath(new URL('../packs/moment-to-date-fns.json', import.meta.url))
const ids = (pack, src) => scanSource(src, 'x.js', pack.rules).map((f) => f.ruleId)

test('default pack is the Web3 pack', () => {
  assert.equal(loadPack(null), DEFAULT_PACK)
  assert.equal(DEFAULT_PACK.from, 'ethers v5 / web3.js')
})

test('compilePack validates packs', () => {
  assert.throws(() => compilePack({}), /"name" is required/)
  assert.throws(() => compilePack({ name: 'a', from: 'b', to: 'c', playbook: 'd', rules: [] }), /non-empty/)
  const base = { name: 'a', from: 'b', to: 'c', playbook: 'd' }
  assert.throws(() => compilePack({ ...base, rules: [{ id: 'X', title: 't', pattern: '(', replacement: 'r' }] }), /invalid pattern/)
  assert.throws(() => compilePack({ ...base, rules: [{ id: 'X', title: 't', pattern: 'a', replacement: 'r' }, { id: 'X', title: 't', pattern: 'b', replacement: 'r' }] }), /duplicate/)
})

test('moment pack detects Moment usage and ignores date-fns', () => {
  const pack = loadPack(momentPack)
  assert.deepEqual(ids(pack, "import moment from 'moment'"), ['MOM001'])
  assert.ok(ids(pack, "const d = moment(input).add(2, 'days')").includes('MOM004'))
  assert.ok(ids(pack, "label = m.format('YYYY-MM-DD')").includes('MOM003'))
  assert.ok(ids(pack, 'const ago = m.fromNow()').includes('MOM008'))
  assert.ok(ids(pack, 'const n = a.diff(b)').includes('MOM005'))
  const dateFns = [
    "import { format, addDays, differenceInDays, formatDistanceToNow } from 'date-fns'",
    "const label = format(d, 'yyyy-MM-dd')",
    'const later = addDays(d, 2)',
    'const ago = formatDistanceToNow(d, { addSuffix: true })',
  ].join('\n')
  assert.deepEqual(scanSource(dateFns, 'y.js', pack.rules), [])
})

test('plans and prompts use the pack', () => {
  const pack = loadPack(momentPack)
  const root = mkdtempSync(join(tmpdir(), 'cg-pack-'))
  try {
    mkdirSync(join(root, 'lib'))
    writeFileSync(join(root, 'lib/dates.js'), "import moment from 'moment'\nexport const label = (d) => moment(d).format('YYYY-MM-DD')\n")
    writeFileSync(join(root, 'Clock.jsx'), "import { label } from './lib/dates.js'\nimport moment from 'moment'\nexport const Clock = () => moment().fromNow()\n")
    const plan = buildPlan(scanDir(root, pack.rules), { pack, scanPath: 'src' })
    assert.equal(plan.pack, 'moment-to-date-fns')
    assert.deepEqual(plan.tasks.map((t) => [t.wave, t.files]), [[1, ['src/lib/dates.js']], [2, ['src/Clock.jsx']]])
    assert.match(plan.tasks[0].prompt, /from Moment\.js to date-fns/)
    assert.match(plan.tasks[0].prompt, /@docs\/playbooks\/moment-to-date-fns\.md/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('e2e: a signal box opened with a pack scans with that pack', () => {
  const root = mkdtempSync(join(tmpdir(), 'sb-pack-'))
  const run = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' })
  try {
    run('init', '-q')
    run('config', 'user.email', 't@example.com')
    run('config', 'user.name', 't')
    mkdirSync(join(root, 'src'))
    mkdirSync(join(root, 'packs'))
    writeFileSync(join(root, 'packs/m.json'), JSON.stringify({ name: 'm', from: 'Moment.js', to: 'date-fns', playbook: 'p.md', rules: [{ id: 'MOM001', title: 'moment import', pattern: "from\\s+['\"]moment['\"]", replacement: 'date-fns' }] }))
    writeFileSync(join(root, 'src/dates.js'), "import moment from 'moment'\nexport const now = () => moment()\n")
    writeFileSync(join(root, 'check.js'), "console.log(' Tests  1 passed (1)')\n")
    run('add', '.')
    run('commit', '-qm', 'moment app')
    init(root, { scanPath: 'src', testCmd: 'node check.js', allow: ['packs/**'], pack: 'packs/m.json' })
    const [t] = Object.values(loadState(root).tasks)
    assert.equal(loadState(root).pack, 'packs/m.json')
    claim(root, t.id, 'bob-1')
    let r = release(root, t.id, 'bob-1')
    assert.equal(r.verify.checks.scan.remaining, 1, 'still on Moment: the pack rule fires')
    writeFileSync(join(root, 'src/dates.js'), 'export const now = () => new Date()\n')
    r = release(root, t.id, 'bob-1')
    assert.equal(r.ok, true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
