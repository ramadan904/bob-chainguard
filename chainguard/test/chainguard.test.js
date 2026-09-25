import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { scanSource, scanDir, compare, localImports } from '../src/scan.js'
import { buildPlan, computeWaves, planToMarkdown } from '../src/plan.js'
import { RULES } from '../src/rules.js'

const fixture = fileURLToPath(new URL('./fixtures/app/src', import.meta.url))
const cli = fileURLToPath(new URL('../bin/chainguard.js', import.meta.url))
const ids = (src) => scanSource(src).map((f) => f.ruleId)

test('rule ids are unique', () => {
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length)
})

test('detects ethers v5 patterns', () => {
  assert.deepEqual(ids("import { ethers } from 'ethers'"), ['ETH001'])
  assert.ok(ids('const p = new ethers.providers.Web3Provider(window.ethereum)').includes('ETH002'))
  assert.ok(ids('const x = BigNumber.from(1)').includes('ETH004'))
  assert.ok(ids('const s = provider.getSigner()').includes('ETH005'))
  assert.ok(ids('const v = ethers.utils.parseEther("1")').includes('ETH007'))
  assert.ok(ids("contract.on('Transfer', h)").includes('ETH009'))
  assert.ok(ids('const z = ethers.constants.AddressZero').includes('ETH010'))
  assert.ok(ids('await c.callStatic.transfer(a, b)').includes('ETH012'))
  assert.ok(ids("await provider.send('eth_requestAccounts', [])").includes('ETH015'))
  assert.ok(ids('setStatus(err.reason || err.message)').includes('ETH016'))
  assert.ok(ids('const sig = await signer.signMessage(message)').includes('ETH014'))
  assert.ok(!ids('const sig = await signer.signMessage({ account, message })').includes('ETH014'), 'viem walletClient call')
})

test('detects web3.js patterns', () => {
  assert.deepEqual(ids("import Web3 from 'web3'"), ['W3J001'])
  assert.ok(ids('const c = new web3.eth.Contract(abi, a)').includes('W3J003'))
  assert.ok(ids('c.methods.balanceOf(a).call()').includes('W3J004'))
  assert.ok(ids("web3.utils.toWei('1')").includes('W3J005'))
  assert.ok(ids('await web3.eth.getBlockNumber()').includes('W3J006'))
  assert.ok(ids("c.getPastEvents('Transfer', {})").includes('W3J008'))
})

test('does not flag viem code', () => {
  const viem = [
    "import { createPublicClient, http, formatUnits, parseEther } from 'viem'",
    "const client = createPublicClient({ chain: sepolia, transport: http(url) })",
    "const bal = await client.readContract({ address, abi, functionName: 'balanceOf', args: [a] })",
    'const fee = gasLimit * gasPrice',
    'const unwatch = client.watchContractEvent({ address, abi, eventName: "Transfer", onLogs })',
    'items.add(x); set.add(y)',
  ].join('\n')
  assert.deepEqual(scanSource(viem), [])
})

test('ignores comments but not code after URLs', () => {
  const r = scanDir(fixture)
  const client = r.findings.filter((f) => f.file === 'lib/client.js').map((f) => f.ruleId)
  assert.deepEqual(client.sort(), ['ETH001', 'ETH003'])
})

test('scanDir summarizes files and resolves local imports', () => {
  const r = scanDir(fixture)
  assert.equal(r.filesScanned, 4)
  assert.equal(r.filesAffected, 2)
  assert.equal(r.legacyFreePercent, 50)
  assert.deepEqual(r.imports['ui/Balance.jsx'], ['lib/client.js'])
  assert.deepEqual(r.imports['ui/Clean.jsx'], ['lib/math.js'])
})

test('localImports finds relative specifiers only', () => {
  assert.deepEqual(localImports("import a from './a'\nimport b from 'b'\nconst c = await import('../c.js')"), ['./a', '../c.js'])
})

test('computeWaves orders dependents after dependencies, through clean files', () => {
  const imports = { 'c.js': ['b.js'], 'b.js': ['a.js'], 'a.js': [], 'd.js': [] }
  // b.js is clean: c.js still depends on a.js through it.
  assert.deepEqual(computeWaves(new Set(['a.js', 'c.js', 'd.js']), imports), { 'a.js': 1, 'c.js': 2, 'd.js': 1 })
})

test('computeWaves survives import cycles', () => {
  const w = computeWaves(new Set(['a.js', 'b.js']), { 'a.js': ['b.js'], 'b.js': ['a.js'] })
  assert.ok(w['a.js'] >= 1 && w['b.js'] >= 1)
})

test('buildPlan orders waves by the import graph with repo-relative paths', () => {
  const plan = buildPlan(scanDir(fixture), { scanPath: 'app/src' })
  assert.equal(plan.waves, 2)
  // lib/client.js exports a legacy provider object, so it is contracted after its caller.
  assert.deepEqual(plan.tasks.map((t) => [t.wave, t.files, t.contracts]), [
    [1, ['app/src/ui/Balance.jsx'], []],
    [2, ['app/src/lib/client.js'], ['app/src/lib/client.js']],
  ])
  assert.match(planToMarkdown(plan), /## Wave 2/)
})

test('compare reports reduction', () => {
  const before = { totals: { findings: 10 }, filesAffected: 4, legacyFreePercent: 50, byRule: { ETH001: 10 } }
  const after = { totals: { findings: 1 }, filesAffected: 1, legacyFreePercent: 90, byRule: { W3J001: 1 } }
  assert.deepEqual(compare(before, after), {
    findingsBefore: 10, findingsAfter: 1, findingsRemovedPercent: 90,
    filesAffectedBefore: 4, filesAffectedAfter: 1, legacyFreeBefore: 50, legacyFreeAfter: 90, newRules: ['W3J001'],
  })
})

test('CLI --fail-on error exits 1 when legacy code remains', () => {
  assert.throws(() => execFileSync('node', [cli, 'scan', fixture, '--fail-on', 'error'], { stdio: 'pipe' }), (e) => e.status === 1)
  execFileSync('node', [cli, 'scan', fixture], { stdio: 'pipe' })
})

test('atlas: importDepths is the longest import chain', async () => {
  const { importDepths } = await import('../src/atlas.js')
  assert.deepEqual(importDepths({ 'a.js': [], 'b.js': ['a.js'], 'c.js': ['b.js', 'a.js'] }), { 'a.js': 0, 'b.js': 1, 'c.js': 2 })
})

test('atlas: scans every commit that touched the directory', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { gitSnapshots, buildAtlas } = await import('../src/atlas.js')
  const repo = mkdtempSync(join(tmpdir(), 'cg-atlas-'))
  const run = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'pipe' })
  try {
    run('init', '-q')
    run('config', 'user.email', 't@example.com')
    run('config', 'user.name', 't')
    mkdirSync(join(repo, 'src/lib'), { recursive: true })
    writeFileSync(join(repo, 'src/lib/a.js'), "import { ethers } from 'ethers'\nexport const x = BigNumber.from(1)\n")
    writeFileSync(join(repo, 'src/App.jsx'), "import { x } from './lib/a.js'\n")
    run('add', '.')
    run('commit', '-qm', 'legacy')
    writeFileSync(join(repo, 'src/lib/a.js'), "import { parseEther } from 'viem'\nexport const x = 1n\n")
    run('commit', '-qam', 'bob wave 1')
    writeFileSync(join(repo, 'src/App.jsx'), "import { x } from './lib/a.js'\nexport default x\n")
    run('commit', '-qam', 'signalbox: clear w2-app')
    const atlas = buildAtlas(gitSnapshots(join(repo, 'src')))
    assert.equal(atlas.root, 'src')
    assert.deepEqual(atlas.snapshots.map((s) => [s.subject, s.totals.findings]), [['legacy', 2], ['bob wave 1', 0], ['signalbox: clear w2-app', 0]])
    assert.equal(atlas.snapshots[1].diff, undefined, 'only block commits carry a diff')
    assert.match(atlas.snapshots[2].diff, /\+export default x/)
    assert.deepEqual(atlas.files.map((f) => [f.id, f.dir, f.depth]), [['App.jsx', 'app', 1], ['lib/a.js', 'lib', 0]])
    assert.equal(atlas.plan.tasks.length, 1)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('computeWaves: providers of legacy objects wait for their callers', () => {
  const imports = { 'clients.js': [], 'gas.js': ['clients.js', 'units.js'], 'units.js': [], 'Form.jsx': ['gas.js'] }
  const flagged = new Set(['clients.js', 'gas.js', 'units.js', 'Form.jsx'])
  assert.deepEqual(computeWaves(flagged, imports), { 'clients.js': 1, 'units.js': 1, 'gas.js': 2, 'Form.jsx': 3 })
  assert.deepEqual(computeWaves(flagged, imports, new Set(['clients.js'])), { 'clients.js': 3, 'units.js': 1, 'gas.js': 2, 'Form.jsx': 3 })
})

test('buildPlan marks provider files as contract steps', () => {
  const report = {
    root: 'src', totals: { findings: 2 },
    findings: [
      { ruleId: 'ETH003', file: 'lib/clients.js', line: 2, snippet: 'export const provider = new ethers.providers.JsonRpcProvider(url)' },
      { ruleId: 'ETH004', file: 'lib/gas.js', line: 3, snippet: 'return BigNumber.from(x)' },
    ],
    imports: { 'lib/clients.js': [], 'lib/gas.js': ['lib/clients.js'] },
  }
  const plan = buildPlan(report, { scanPath: 'src' })
  const byId = Object.fromEntries(plan.tasks.map((t) => [t.files[0], t]))
  assert.ok(byId['src/lib/gas.js'].wave < byId['src/lib/clients.js'].wave)
  assert.deepEqual(byId['src/lib/clients.js'].contracts, ['src/lib/clients.js'])
  assert.match(byId['src/lib/clients.js'].prompt, /Contract step/)
})

test('isLegacyValueExport tells objects from functions', async () => {
  const { isLegacyValueExport } = await import('../src/plan.js')
  assert.equal(isLegacyValueExport('export const web3 = new Web3(RPC_URL)'), true)
  assert.equal(isLegacyValueExport('export const one = () => BigNumber.from(1)'), false)
  assert.equal(isLegacyValueExport('export const f = async (a) => web3.eth.getGasPrice()'), false)
  assert.equal(isLegacyValueExport('export const g = function () { return ethers.utils.id(x) }'), false)
  assert.equal(isLegacyValueExport('export function h() { return new Web3() }'), false)
})
