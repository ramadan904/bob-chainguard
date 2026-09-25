// Signalbox operations: the side-effecting half (git, filesystem, test runs).
// Every operation appends one or more events to .signalbox/ledger.jsonl; state is always
// re-derived from that ledger with reduce(), so the ledger is the single source of truth and
// doubles as the replay record for the UI.

import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, mkdtempSync, symlinkSync, readdirSync, copyFileSync, renameSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { scanDir, scanSource } from './scan.js'
import { buildPlan } from './plan.js'
import { reduce, canClaim, blockFiles, ownerOf, isProtected } from './signalbox-state.js'

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

function append(root, event) {
  const e = { at: new Date().toISOString(), ...event }
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

export function init(root, { scanPath = 'legacy-dapp/src', testCmd = DEFAULT_TEST, allow = DEFAULT_ALLOW, protect = DEFAULT_PROTECT, force = false } = {}) {
  const p = ledgerPath(root)
  if (existsSync(p) && !force) throw new SignalboxError('A signalbox ledger already exists. Use --force to archive it and start over.')
  if (existsSync(p)) renameSync(p, p.replace(/\.jsonl$/, `.${Date.now()}.jsonl`))
  const report = scanDir(join(root, scanPath))
  const plan = buildPlan(report, { scanPath })
  const base = git(root, ['rev-parse', 'HEAD']).trim()
  return append(root, {
    t: 'init',
    base,
    scanDir: scanPath,
    testCmd,
    allow,
    protect,
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
  return files.filter((f) => !f.startsWith('.signalbox/'))
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

export function checkContract(root, files) {
  const removed = []
  for (const f of files) {
    const before = headText(root, f)
    if (before == null || !/\.(m?[jt]sx?|cjs)$/.test(f)) continue
    const after = readWorking(root, f)
    if (after == null) {
      removed.push({ file: f, name: '(file deleted)' })
      continue
    }
    const now = exportsOf(after)
    for (const name of exportsOf(before)) if (!now.has(name)) removed.push({ file: f, name })
  }
  return { ok: removed.length === 0, removed }
}

export function checkScan(root, files) {
  const byFile = {}
  const findings = {}
  let remaining = 0
  for (const f of files) {
    const text = readWorking(root, f)
    if (text == null || !/\.(m?[jt]sx?|cjs|vue|svelte)$/.test(f)) continue
    const list = scanSource(text, f)
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
      if (!existsSync(dst) && existsSync(dirname(dst))) symlinkSync(join(root, nm), dst, 'dir')
    }
    const started = Date.now()
    const r = spawnSync('sh', ['-c', state.testCmd], { cwd: wt, encoding: 'utf8', timeout: timeoutMs, env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' } })
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
    const t = state.tasks[taskId]
    if (!t) throw new SignalboxError(`unknown block ${taskId}`)
    if (t.agent !== agent) throw new SignalboxError(`${agent} does not occupy ${taskId}${t.agent ? ` (${t.agent} does)` : ''}`)
    const files = blockFiles(t)
    // Allow-listed paths that changed (package.json, lockfile) travel with the block that changed them.
    const allowed = modifiedFiles(root).filter((f) => ownerOf(state, f) === 'allow' && !f.startsWith('.signalbox/') && /package(-lock)?\.json$/.test(f))
    const checks = {
      scope: checkScope(root, state, taskId),
      contract: checkContract(root, files),
      scan: checkScan(root, files),
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
