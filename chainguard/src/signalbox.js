// Signalbox operations: the side-effecting half (git, filesystem, test runs).
// Every operation appends one or more events to .signalbox/ledger.jsonl; state is always
// re-derived from that ledger with reduce(), so the ledger is the single source of truth and
// doubles as the replay record for the UI.

import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, mkdtempSync, symlinkSync, readdirSync, copyFileSync, renameSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { scanDir, scanSource } from './scan.js'
import { buildPlan } from './plan.js'
import { loadPack } from './pack.js'
import { reduce, canClaim, blockFiles, ownerOf, isProtected, canonical, verifyChain } from './signalbox-state.js'

export const DEFAULT_ALLOW = ['legacy-dapp/package.json', 'legacy-dapp/package-lock.json', '.signalbox/**', 'reports/**', 'bob_sessions/**', 'atlas/src/data/**']
export const DEFAULT_TEST = 'npm test --prefix legacy-dapp'
// Paths no agent may change: the behavior contract (tests) and the machinery that judges agents.
export const DEFAULT_PROTECT = ['**/__tests__/**', '**/*.test.*', '**/*.spec.*', 'chainguard/**', '.github/**', 'docs/MIGRATION_PLAYBOOK.md']

export class SignalboxError extends Error {}

export function repoRoot(cwd = process.cwd()) {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim()
}

const git = (root, args, opts = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, ...opts })

export function ledgerPath(root) {
  return join(root, '.signalbox', 'ledger.jsonl')
}

export function readLedger(root) {
  const p = ledgerPath(root)
  if (!existsSync(p)) return []
  return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

export const sha256 = (text) => createHash('sha256').update(text).digest('hex')

// Appends one event, chained to the previous one (see verifyChain in signalbox-state.js).
function append(root, event) {
  const events = readLedger(root)
  const prev = events.length ? events[events.length - 1].h ?? null : null
  const e = { at: new Date().toISOString(), ...event, prev }
  e.h = sha256(`${prev ?? ''}${canonical(e)}`)
  mkdirSync(dirname(ledgerPath(root)), { recursive: true })
  appendFileSync(ledgerPath(root), JSON.stringify(e) + '\n')
  return e
}

export function loadState(root) {
  const state = reduce(readLedger(root))
  if (!state) throw new SignalboxError('No signalbox here yet. Run: signalbox init')
  return state
}

// Serialize git-touching operations between agents running in parallel.
function withLock(root, fn) {
  const lock = join(root, '.signalbox', 'lock')
  mkdirSync(dirname(lock), { recursive: true })
  const deadline = Date.now() + 120_000
  for (;;) {
    try {
      mkdirSync(lock)
      break
    } catch {
      // Stale lock from a crashed agent: older than 10 minutes.
      try { if (Date.now() - statSync(lock).mtimeMs > 600_000) rmSync(lock, { recursive: true, force: true }) } catch { /* raced */ }
      if (Date.now() > deadline) throw new SignalboxError('Timed out waiting for another agent to finish (lock .signalbox/lock)')
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150)
    }
  }
  try {
    return fn()
  } finally {
    rmSync(lock, { recursive: true, force: true })
  }
}

// ------------------------------------------------------------------ init

export function init(root, { scanPath = 'legacy-dapp/src', testCmd = DEFAULT_TEST, allow = DEFAULT_ALLOW, protect = DEFAULT_PROTECT, pack: packPath = null, force = false } = {}) {
  const p = ledgerPath(root)
  if (existsSync(p) && !force) throw new SignalboxError('A signalbox ledger already exists. Use --force to archive it and start over.')
  if (existsSync(p)) renameSync(p, p.replace(/\.jsonl$/, `.${Date.now()}.jsonl`))
  const pack = loadPack(packPath && join(root, packPath))
  const report = scanDir(join(root, scanPath), pack.rules)
  const plan = buildPlan(report, { scanPath, pack })
  const base = git(root, ['rev-parse', 'HEAD']).trim()
  return append(root, {
    t: 'init',
    base,
    scanDir: scanPath,
    testCmd,
    allow,
    protect,
    pack: packPath,
    plan: { waves: plan.waves, totalFindings: plan.totalFindings, tasks: plan.tasks.map(({ id, wave, files, findings, prompt }) => ({ id, wave, files, findings, prompt: withProtocol(prompt, id) })) },
  })
}

// Each task prompt carries the interlocking protocol, so a Bob subagent can run it cold.
export function withProtocol(prompt, id) {
  return [
    prompt,
    '',
    'Signalbox protocol (mandatory):',
    `1. Before editing, run: npm run -s sb -- claim ${id} --agent <your-agent-name>. If it is refused, stop and report why.`,
    `2. Edit only the files of your block. If you must touch another file, first run: npm run -s sb -- extend ${id} <path> --agent <your-agent-name>`,
    `3. When done, run: npm run -s sb -- release ${id} --agent <your-agent-name>. It checks scope, exported contract, legacy scan and tests on an isolated copy, then commits your block.`,
    '4. If release reports a fault, read the failing check, fix it and release again. If you cannot fix it, run: npm run -s sb -- rollback ' + id + ' --agent <your-agent-name>',
    '',
    'Hard rules (other agents are editing this repository at the same time):',
    '- Never run git commands (no commit, stash, checkout, reset, restore, clean). release commits for you; rollback restores for you. A stash or checkout would destroy other agents\' work.',
    '- Never edit tests, chainguard/ or the playbook. They are protected; the signal box rejects the change. If a test fails, the implementation is wrong.',
    '- Never run npm install or change package.json. Dependencies are already installed.',
    '- Use the same agent name in every command. Stop when release prints CLEARED and report the commit hash.',
  ].join('\n')
}

// ------------------------------------------------------------------ claim / extend

export function claim(root, taskId, agent, { also = [] } = {}) {
  if (!agent) throw new SignalboxError('Pass --agent <name> so the signal box knows which train is entering')
  return withLock(root, () => {
    const state = loadState(root)
    checkpoint(root, state)
    const verdict = canClaim(state, taskId, agent)
    if (!verdict.ok) {
      append(root, { t: 'deny', task: taskId, agent, reason: verdict.reason, blocking: verdict.blocking })
      throw new SignalboxError(`DENIED ${taskId}: ${verdict.reason}`)
    }
    const e = append(root, { t: 'claim', task: taskId, agent })
    if (also.length) extendUnlocked(root, taskId, agent, also)
    return e
  })
}

export function extend(root, taskId, agent, files) {
  return withLock(root, () => extendUnlocked(root, taskId, agent, files))
}

function extendUnlocked(root, taskId, agent, files) {
  const state = loadState(root)
  const t = state.tasks[taskId]
  if (!t || t.agent !== agent) throw new SignalboxError(`${agent} does not occupy ${taskId}`)
  const rel = files.map((f) => normalize(root, f))
  for (const f of rel) {
    if (isProtected(state, f)) {
      append(root, { t: 'deny', task: taskId, agent, reason: `${f} is protected (tests and the signal box itself cannot be changed by agents)`, blocking: [] })
      throw new SignalboxError(`DENIED: ${f} is protected. Fix the implementation, not the tests or the checker.`)
    }
    const owner = ownerOf(state, f)
    if (owner && owner !== taskId && owner !== 'allow') {
      append(root, { t: 'deny', task: taskId, agent, reason: `${f} is held by ${owner}`, blocking: [owner] })
      throw new SignalboxError(`DENIED: ${f} is held by ${owner}`)
    }
  }
  return append(root, { t: 'extend', task: taskId, agent, files: rel })
}

function normalize(root, f) {
  return relative(root, resolve(root, f)).split(sep).join('/')
}

// ------------------------------------------------------------------ checks

export function modifiedFiles(root) {
  const out = git(root, ['status', '--porcelain', '-uall', '-z'])
  const files = []
  const parts = out.split('\0').filter(Boolean)
  for (let i = 0; i < parts.length; i++) {
    const code = parts[i].slice(0, 2)
    files.push(parts[i].slice(3))
    if (code.startsWith('R') || code.startsWith('C')) i++ // rename source follows
  }
  // node_modules can be a symlink (pnpm, workspaces), which `node_modules/` in .gitignore misses.
  return files.filter((f) => !f.startsWith('.signalbox/') && !f.split('/').includes('node_modules'))
}

export function exportsOf(text) {
  const names = new Set()
  for (const m of text.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (name) names.add(name)
    }
  }
  if (/export\s+default\b/.test(text)) names.add('default')
  return names
}

function headText(root, file) {
  try {
    return git(root, ['show', `HEAD:${file}`], { stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

function readWorking(root, file) {
  const p = join(root, file)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

export function checkScope(root, state, taskId) {
  const changed = modifiedFiles(root)
  const outside = changed.filter((f) => ownerOf(state, f) === null)
  const protectedFiles = changed.filter((f) => ownerOf(state, f) === 'protected')
  return { ok: outside.length === 0 && protectedFiles.length === 0, outside: [...outside, ...protectedFiles], protected: protectedFiles }
}

// Which names each working-tree source file imports from `target` (repo-relative path).
// Returns [{ file, names: Set | '*' }]. Test files count: they are consumers too.
export function importersOf(root, target, searchDir) {
  const out = []
  const exts = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '/index.js', '/index.ts']
  const walk = (dir) => {
    for (const d of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (d.name === 'node_modules' || d.name.startsWith('.')) continue
      const rel = dir ? `${dir}/${d.name}` : d.name
      if (d.isDirectory()) walk(rel)
      else if (/\.(m?[jt]sx?|cjs)$/.test(d.name) && rel !== target) {
        const text = readFileSync(join(root, rel), 'utf8')
        const names = importedNames(text, (spec) => exts.some((e) => normalize(root, join(dirname(rel), spec + e)) === target))
        if (names) out.push({ file: rel, names })
      }
    }
  }
  if (existsSync(join(root, searchDir))) walk(searchDir)
  return out
}

function importedNames(text, isTarget) {
  let names = null
  const add = (n) => { if (names !== '*') (names ||= new Set()).add(n) }
  for (const m of text.matchAll(/(?:import|export)\s+([\s\S]*?)\s+from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
    if (!isTarget(m[2])) continue
    const clause = m[1].replace(/^type\s+/, '')
    if (/\*\s+as\s+\w+/.test(clause) || clause.trim() === '*') { names = '*'; continue }
    const braces = clause.match(/\{([^}]*)\}/)
    if (braces) for (const part of braces[1].split(',')) { const n = part.trim().split(/\s+as\s+/)[0].trim(); if (n) add(n) }
    const def = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim()
    if (def && !/^(import|export)$/.test(def)) add('default')
  }
  for (const m of text.matchAll(/(?:import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) if (isTarget(m[1])) names = '*'
  return names
}

// Exported contract: an export may disappear only once nothing imports it any more
// (expand -> migrate -> contract). Removals nobody depends on are reported as `retired`.
export function checkContract(root, files, searchDir = '.') {
  const removed = []
  const retired = []
  for (const f of files) {
    const before = headText(root, f)
    if (before == null || !/\.(m?[jt]sx?|cjs)$/.test(f)) continue
    const after = readWorking(root, f)
    const now = after == null ? new Set() : exportsOf(after)
    const gone = [...exportsOf(before)].filter((n) => !now.has(n))
    if (!gone.length && after != null) continue
    const users = importersOf(root, f, searchDir)
    const usedBy = (n) => users.filter((u) => u.names === '*' || u.names.has(n)).map((u) => u.file)
    if (after == null && users.length) removed.push({ file: f, name: '(file deleted)', usedBy: users.map((u) => u.file) })
    for (const name of gone) {
      const by = usedBy(name)
      if (by.length) removed.push({ file: f, name, usedBy: by })
      else retired.push({ file: f, name })
    }
  }
  return { ok: removed.length === 0, removed, retired }
}

// The rule pack the box was opened with (recorded in the init event).
export function packOf(root, state) {
  return loadPack(state.pack && join(root, state.pack))
}

export function checkScan(root, files, rules) {
  const byFile = {}
  const findings = {}
  let remaining = 0
  for (const f of files) {
    const text = readWorking(root, f)
    if (text == null || !/\.(m?[jt]sx?|cjs|vue|svelte)$/.test(f)) continue
    const list = scanSource(text, f, rules)
    byFile[f] = list.length
    findings[f] = list.map((x) => [x.ruleId, x.line, x.snippet])
    remaining += list.length
  }
  return { ok: remaining === 0, remaining, byFile, findings }
}

// Run the tests on an isolated worktree: HEAD (every cleared block) plus only this block's
// working-tree files. Other agents' half-finished edits can't make this block fail or pass.
export function checkTests(root, state, files, { timeoutMs = 300_000 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'signalbox-'))
  const wt = join(dir, 'track')
  try {
    git(root, ['worktree', 'add', '--detach', '--quiet', wt, 'HEAD'])
    for (const f of files) {
      const src = join(root, f)
      const dst = join(wt, f)
      if (existsSync(src)) {
        mkdirSync(dirname(dst), { recursive: true })
        copyFileSync(src, dst)
      } else {
        rmSync(dst, { force: true })
      }
    }
    for (const nm of nodeModuleDirs(root)) {
      const dst = join(wt, nm)
      // Junctions need no admin rights on Windows; elsewhere a plain directory symlink.
      if (!existsSync(dst) && existsSync(dirname(dst))) symlinkSync(join(root, nm), dst, process.platform === 'win32' ? 'junction' : 'dir')
    }
    const started = Date.now()
    // shell: true uses sh on Linux/macOS and cmd.exe on Windows.
    const r = spawnSync(state.testCmd, { shell: true, cwd: wt, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 32 << 20, env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' } })
    const out = `${r.stdout || ''}\n${r.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, '')
    const lines = out.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim())
    const summaryLine = [...lines].reverse().find((l) => /^\s*Tests\s+/.test(l)) || ''
    const passed = Number(summaryLine.match(/(\d+) passed/)?.[1] || 0)
    const failed = Number(summaryLine.match(/(\d+) failed/)?.[1] || 0)
    const failures = [...new Set(lines.filter((l) => /^\s*(×|✗|FAIL)\s/.test(l)).map((l) => l.trim()))].slice(0, 12)
    return { ok: r.status === 0, exitCode: r.status, passed, failed, summary: summaryLine.trim(), failures, tail: lines.slice(-30), ms: Date.now() - started }
  } finally {
    try { git(root, ['worktree', 'remove', '--force', wt], { stdio: 'ignore' }) } catch { /* already gone */ }
    rmSync(dir, { recursive: true, force: true })
  }
}

function nodeModuleDirs(root) {
  const out = []
  if (existsSync(join(root, 'node_modules'))) out.push('node_modules')
  for (const d of readdirSync(root, { withFileTypes: true })) {
    if (d.isDirectory() && !d.name.startsWith('.') && existsSync(join(root, d.name, 'node_modules'))) out.push(`${d.name}/node_modules`)
  }
  return out
}

// ------------------------------------------------------------------ release / rollback

export function release(root, taskId, agent, { commit = true, runTests = true } = {}) {
  return withLock(root, () => {
    const state = loadState(root)
    checkpoint(root, state)
    const t = state.tasks[taskId]
    if (!t) throw new SignalboxError(`unknown block ${taskId}`)
    if (t.agent !== agent) throw new SignalboxError(`${agent} does not occupy ${taskId}${t.agent ? ` (${t.agent} does)` : ''}`)
    const files = blockFiles(t)
    // Allow-listed paths that changed (package.json, lockfile) travel with the block that changed them.
    const allowed = modifiedFiles(root).filter((f) => ownerOf(state, f) === 'allow' && !f.startsWith('.signalbox/') && /package(-lock)?\.json$/.test(f))
    const checks = {
      scope: checkScope(root, state, taskId),
      contract: checkContract(root, files, state.scanDir),
      scan: checkScan(root, files, packOf(root, state).rules),
    }
    checks.tests = runTests ? checkTests(root, state, [...files, ...allowed]) : { ok: true, skipped: true }
    const ok = Object.values(checks).every((c) => c.ok)
    const verify = append(root, { t: 'verify', task: taskId, agent, ok, checks })
    if (!ok || !commit) return { ok, verify }

    const paths = [...files, ...allowed].filter((f) => existsSync(join(root, f)) || headText(root, f) != null)
    git(root, ['add', '-A', '--', ...paths])
    const staged = git(root, ['diff', '--cached', '--name-only', '--', ...paths]).trim()
    let sha = git(root, ['rev-parse', 'HEAD']).trim()
    if (staged) {
      git(root, ['commit', '--quiet', '-m', `signalbox: clear ${taskId}`, '-m', `Block cleared by ${agent}: scope, contract, scan (${checks.scan.remaining} left) and tests (${checks.tests.summary || 'skipped'}) passed.\n\nSignalbox-Agent: ${agent}\nSignalbox-Block: ${taskId}`, '--', ...paths], { env: { ...process.env, SIGNALBOX_COMMIT: '1' } })
      sha = git(root, ['rev-parse', 'HEAD']).trim()
    }
    const clear = append(root, { t: 'clear', task: taskId, agent, commit: sha, files: paths })
    return { ok, verify, clear }
  })
}

export function rollback(root, taskId, agent, { operator = false } = {}) {
  return withLock(root, () => {
    const state = loadState(root)
    checkpoint(root, state)
    const t = state.tasks[taskId]
    if (!t) throw new SignalboxError(`unknown block ${taskId}`)
    if (t.commit) throw new SignalboxError(`${taskId} is already cleared; revert its commit ${t.commit.slice(0, 7)} instead`)
    // An operator may free a block whose agent crashed or went quiet; the event records both.
    if (t.agent && t.agent !== agent && !operator) throw new SignalboxError(`${taskId} is occupied by ${t.agent} (an operator can override with --operator)`)
    const by = t.agent && t.agent !== agent ? `${agent} (operator, over ${t.agent})` : agent
    const restored = []
    for (const f of blockFiles(t)) {
      if (headText(root, f) != null) {
        git(root, ['checkout', 'HEAD', '--', f])
        restored.push(f)
      } else if (existsSync(join(root, f))) {
        rmSync(join(root, f))
        restored.push(f)
      }
    }
    return append(root, { t: 'rollback', task: taskId, agent: by, files: restored })
  })
}

export function writeReplay(root, out) {
  writeFileSync(out, JSON.stringify(readLedger(root)))
}

// ------------------------------------------------------------------ pre-commit guard

const HOOK = `#!/bin/sh
# Installed by signalbox: files that belong to a signal-box block may only be committed by
# \`signalbox release\` (which sets SIGNALBOX_COMMIT=1). Everything else commits normally.
exec node "$(git rev-parse --show-toplevel)/chainguard/bin/signalbox.js" hook-check
`

export function installHook(root) {
  const dir = git(root, ['rev-parse', '--git-path', 'hooks']).trim()
  const path = resolve(root, dir, 'pre-commit')
  mkdirSync(dirname(path), { recursive: true })
  if (existsSync(path) && !readFileSync(path, 'utf8').includes('signalbox')) throw new SignalboxError(`${path} already exists and is not ours; add a call to 'signalbox hook-check' to it yourself`)
  writeFileSync(path, HOOK, { mode: 0o755 })
  return path
}

// Returns the staged files that only a release may commit (empty = commit allowed).
export function hookCheck(root, env = process.env) {
  if (env.SIGNALBOX_COMMIT === '1' || !existsSync(ledgerPath(root))) return []
  const state = reduce(readLedger(root))
  if (!state) return []
  const guarded = new Set(Object.values(state.tasks).filter((t) => !t.commit).flatMap((t) => blockFiles(t)))
  const staged = git(root, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean)
  // Protected paths (tests, the checker) can't be committed while the box is open, except by a
  // human who sets SIGNALBOX_COMMIT=1 on purpose.
  return staged.filter((f) => guarded.has(f) || isProtected(state, f))
}

// ------------------------------------------------------------------ preflight

export function doctor(root, { runTests = true } = {}) {
  const checks = []
  const add = (name, ok, detail) => checks.push({ name, ok, detail })
  const [major, minor] = process.versions.node.split('.').map(Number)
  add('Node.js 20 or newer', major > 20 || (major === 20 && minor >= 0), `found ${process.versions.node}${major < 20 ? ' (install Node 22 LTS from nodejs.org)' : ''}`)
  const events = readLedger(root)
  const state = reduce(events)
  add('signal box opened', Boolean(state), state ? `${Object.keys(state.tasks).length} blocks, base ${state.base.slice(0, 7)}` : 'run: npm run -s sb -- init')
  const dirty = modifiedFiles(root).filter((f) => !state || ownerOf(state, f) === null || ownerOf(state, f) === 'protected')
  add('no unowned changes', dirty.length === 0, dirty.length ? `would be SPADs: ${dirty.slice(0, 5).join(', ')}${dirty.length > 5 ? '...' : ''}` : 'working tree clean outside blocks')
  const hook = resolve(root, git(root, ['rev-parse', '--git-path', 'hooks']).trim(), 'pre-commit')
  add('pre-commit guard', existsSync(hook) && readFileSync(hook, 'utf8').includes('signalbox'), existsSync(hook) ? hook : 'run: npm run -s sb -- install-hook')
  const nm = nodeModuleDirs(root)
  add('dependencies installed', nm.some((d) => d.startsWith('legacy-dapp')), nm.join(', ') || 'run: npm ci --prefix legacy-dapp')
  add('live panel built', existsSync(join(root, 'atlas', 'dist', 'index.html')), 'npm run signalbox builds it')
  if (runTests && state) {
    const t = checkTests(root, state, [])
    add('tests pass on HEAD (isolated)', t.ok, t.summary || `exit ${t.exitCode}`)
  }
  return checks
}

// ------------------------------------------------------------------ black-box recorder
// Agents share one working tree. If one of them runs `git stash` or `git checkout .` against the
// rules, every other agent's in-flight work would be lost. So the signal box keeps content-
// addressed copies of every occupied block's changed files, taken on every signal box command and
// (under `serve`) on every file change. `recover` puts the latest copy back.

const MAX_CHECKPOINTS = 30
const checkpointDir = (root, task) => join(root, '.signalbox', 'checkpoints', task)

export function listCheckpoints(root, task) {
  const dir = checkpointDir(root, task)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, 'manifest.json')))
    .sort()
    .map((d) => ({ stamp: d, dir: join(dir, d), ...JSON.parse(readFileSync(join(dir, d, 'manifest.json'), 'utf8')) }))
}

export function checkpoint(root, state = reduce(readLedger(root))) {
  if (!state) return []
  const changed = new Set(modifiedFiles(root))
  const saved = []
  for (const t of Object.values(state.tasks)) {
    if (!t.agent || t.commit) continue
    const files = blockFiles(t).filter((f) => changed.has(f) && existsSync(join(root, f)))
    if (!files.length) continue
    const hash = createHash('sha1')
    for (const f of files) hash.update(f).update('\0').update(readFileSync(join(root, f))).update('\0')
    const digest = hash.digest('hex').slice(0, 12)
    const all = listCheckpoints(root, t.id)
    if (all.at(-1)?.digest === digest) continue
    const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${digest}`
    const dir = join(checkpointDir(root, t.id), stamp)
    for (const f of files) {
      mkdirSync(dirname(join(dir, 'files', f)), { recursive: true })
      copyFileSync(join(root, f), join(dir, 'files', f))
    }
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ at: new Date().toISOString(), task: t.id, agent: t.agent, digest, files }))
    for (const old of all.slice(0, Math.max(0, all.length + 1 - MAX_CHECKPOINTS))) rmSync(old.dir, { recursive: true, force: true })
    saved.push({ task: t.id, stamp, files })
  }
  return saved
}

export function recover(root, taskId, agent, { stamp } = {}) {
  return withLock(root, () => {
    const state = loadState(root)
    const t = state.tasks[taskId]
    if (!t) throw new SignalboxError(`unknown block ${taskId}`)
    const all = listCheckpoints(root, taskId)
    const cp = stamp ? all.find((c) => c.stamp === stamp) : all.at(-1)
    if (!cp) throw new SignalboxError(`no checkpoint for ${taskId}${stamp ? ` named ${stamp}` : ''}`)
    checkpoint(root, state) // the current state becomes a checkpoint too, so recovering is undoable
    for (const f of cp.files) {
      mkdirSync(dirname(join(root, f)), { recursive: true })
      copyFileSync(join(cp.dir, 'files', f), join(root, f))
    }
    return append(root, { t: 'recover', task: taskId, agent, from: cp.stamp, files: cp.files })
  })
}

// ------------------------------------------------------------------ audit

// Independent check that the ledger tells the truth: the hash chain is intact, and every cleared
// block's commit exists on this branch, is signed by the agent the ledger names, and changed
// only the files the ledger says it did.
export async function audit(root) {
  const events = readLedger(root)
  const findings = []
  const chain = await verifyChain(events, async (t) => sha256(t))
  if (!chain.ok) findings.push(`hash chain broken: ${chain.reason}`)
  else if (!chain.chained && events.length) findings.push('ledger is not hash-chained (written by an older signalbox)')
  const clears = events.filter((e) => e.t === 'clear')
  for (const e of clears) {
    try {
      git(root, ['cat-file', '-e', `${e.commit}^{commit}`], { stdio: 'ignore' })
    } catch {
      findings.push(`${e.task}: commit ${e.commit.slice(0, 7)} does not exist`)
      continue
    }
    try {
      git(root, ['merge-base', '--is-ancestor', e.commit, 'HEAD'], { stdio: 'ignore' })
    } catch {
      findings.push(`${e.task}: commit ${e.commit.slice(0, 7)} is not on this branch`)
    }
    const body = git(root, ['log', '-1', '--format=%B', e.commit])
    const signed = body.match(/^Signalbox-Agent:\s*(.+)$/m)?.[1]?.trim()
    const isBlockCommit = /^signalbox: clear /m.test(body)
    if (isBlockCommit && signed !== e.agent) findings.push(`${e.task}: commit signed by ${signed || 'nobody'}, ledger says ${e.agent}`)
    if (isBlockCommit) {
      const changed = git(root, ['show', '--name-only', '--format=', e.commit]).split('\n').filter(Boolean)
      const extra = changed.filter((f) => !(e.files || []).includes(f))
      if (extra.length) findings.push(`${e.task}: commit also changed ${extra.join(', ')}`)
    }
  }
  return { ok: findings.length === 0, events: events.length, clears: clears.length, chain, findings }
}

// ------------------------------------------------------------------ chaos drill
// A fire drill for the interlocking, done for real: the signal box makes a genuine stray edit to a
// file no agent holds (a SPAD) or renames an export other files still import (a contract break),
// runs the same checks a release would, records what they caught, and later restores the file
// from git. The drill is in the ledger as `drill` / `drill-end`, so a replay shows it too.

function drillCandidates(root, state) {
  const changed = new Set(modifiedFiles(root))
  return git(root, ['ls-files', '--', state.scanDir]).split('\n').filter(Boolean)
    .filter((f) => /\.(m?[jt]sx?)$/.test(f) && !changed.has(f) && ownerOf(state, f) === null)
}

export function drill(root, { kind = 'spad', by = 'operator' } = {}) {
  if (!['spad', 'contract'].includes(kind)) throw new SignalboxError(`unknown drill ${kind} (use spad or contract)`)
  return withLock(root, () => {
    const state = loadState(root)
    if (readLedger(root).some((e, k, all) => e.t === 'drill' && !all.slice(k + 1).some((x) => x.t === 'drill-end' && x.file === e.file))) {
      throw new SignalboxError('a chaos drill is already running; end it first (signalbox drill-end)')
    }
    // Most-imported files first: the ripple on the map is the point of the drill.
    const ranked = drillCandidates(root, state)
      .map((f) => ({ f, users: importersOf(root, f, state.scanDir) }))
      .sort((a, b) => b.users.length - a.users.length || a.f.localeCompare(b.f))
    let target = null
    let before = null
    let after = null
    let renamed = null
    for (const { f, users } of ranked) {
      before = readFileSync(join(root, f), 'utf8')
      if (kind === 'spad') {
        target = f
        after = `${before.replace(/\n?$/, '\n')}// chaos drill: stray edit by ${by}, outside every claimed block\n`
        break
      }
      const used = new Set(users.flatMap((u) => (u.names === '*' ? [] : [...u.names])))
      for (const name of exportsOf(before)) {
        if (!used.has(name) || name === 'default') continue
        const re = new RegExp(`(export\\s+(?:async\\s+)?(?:function\\*?|const|let|var|class)\\s+)${name}\\b`)
        if (!re.test(before)) continue
        target = f
        renamed = { from: name, to: `${name}Renamed` }
        after = before.replace(re, `$1${renamed.to}`)
        break
      }
      if (target) break
    }
    if (!target) throw new SignalboxError(`no file is free for a ${kind} drill: every candidate is held by an agent or already modified`)
    const t0 = process.hrtime.bigint()
    writeFileSync(join(root, target), after)
    const scope = checkScope(root, state, null)
    const contract = checkContract(root, [target], state.scanDir)
    const ms = Number(process.hrtime.bigint() - t0) / 1e6
    return append(root, {
      t: 'drill', kind, by, file: target, ...(renamed ? { renamed } : {}),
      caught: { scope: !scope.outside.includes(target) ? null : 'SPAD: edit outside every claimed block', contract: contract.ok ? null : contract.removed.map((r) => `${r.name} still used by ${r.usedBy.join(', ')}`).join('; ') },
      usedBy: [...new Set(contract.removed.flatMap((r) => r.usedBy))],
      detectMs: Math.round(ms * 10) / 10,
      digest: sha256(after),
    })
  })
}

// Ends the running drill: restores the file from git, unless someone changed it since the drill
// wrote it (then it is left alone and the event says so).
export function drillEnd(root, { by = 'operator' } = {}) {
  return withLock(root, () => {
    const events = readLedger(root)
    const open = [...events].reverse().find((e, k, rev) => e.t === 'drill' && !rev.slice(0, k).some((x) => x.t === 'drill-end' && x.file === e.file))
    if (!open) throw new SignalboxError('no chaos drill is running')
    const path = join(root, open.file)
    const untouched = existsSync(path) && sha256(readFileSync(path, 'utf8')) === open.digest
    if (untouched) git(root, ['checkout', 'HEAD', '--', open.file])
    return append(root, { t: 'drill-end', by, file: open.file, restored: untouched, heldMs: Date.now() - Date.parse(open.at) })
  })
}
