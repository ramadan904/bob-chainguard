import { execFileSync } from 'node:child_process'
import { relative, resolve, posix, sep } from 'node:path'
import { scanDir, scanEntries, isSourcePath } from './scan.js'
import { buildPlan } from './plan.js'
import { DEFAULT_PACK } from './rules.js'

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

// One scan per commit that touched `dir`, oldest first, plus the working tree when it has
// uncommitted changes there. Every snapshot is a real scan of real code.
export function gitSnapshots(dir, rules = DEFAULT_PACK.rules) {
  const top = git(dir, ['rev-parse', '--show-toplevel']).trim()
  const sub = relative(top, resolve(dir)).split(sep).join('/')
  const log = git(top, ['log', '--reverse', '--format=%H%x1f%ct%x1f%s', '--', sub]).trim()
  const snapshots = []
  for (const line of log ? log.split('\n') : []) {
    const [commit, time, subject] = line.split('\x1f')
    const paths = git(top, ['ls-tree', '-r', '--name-only', commit, '--', sub]).split('\n').filter(Boolean)
    const entries = paths
      .map((p) => ({ path: p, rel: posix.relative(sub, p) }))
      .filter((e) => isSourcePath(e.rel))
      .map((e) => ({ rel: e.rel, text: git(top, ['show', `${commit}:${e.path}`]) }))
    snapshots.push({ commit, time: Number(time) * 1000, subject, report: scanEntries(sub, entries, rules) })
  }
  if (git(top, ['status', '--porcelain', '--', sub]).trim() || snapshots.length === 0) {
    snapshots.push({ commit: null, time: Date.now(), subject: 'Working tree (uncommitted)', report: scanDir(dir, rules) })
  }
  return { root: sub, snapshots }
}

// Longest import chain below each file (files importing nothing sit at depth 0).
export function importDepths(imports) {
  const depth = {}
  const visiting = new Set()
  const walk = (f) => {
    if (depth[f] !== undefined) return depth[f]
    if (visiting.has(f)) return 0
    visiting.add(f)
    let d = 0
    for (const dep of imports[f] || []) d = Math.max(d, walk(dep) + 1)
    visiting.delete(f)
    return (depth[f] = d)
  }
  Object.keys(imports).forEach(walk)
  return depth
}

export function buildAtlas({ root, snapshots }, pack = DEFAULT_PACK) {
  // Union of files and import edges across history, so stations never jump around.
  const imports = {}
  for (const s of snapshots) {
    for (const [f, deps] of Object.entries(s.report.imports)) imports[f] = [...new Set([...(imports[f] || []), ...deps])]
  }
  const depth = importDepths(imports)
  const files = Object.keys(imports).sort().map((id) => {
    const dir = posix.dirname(id)
    return { id, name: posix.basename(id), dir: dir === '.' ? 'app' : dir, depth: depth[id], imports: imports[id] }
  })

  // The plan is fixed at the first snapshot that still had legacy code: it is the schedule Bob follows.
  const baseline = snapshots.find((s) => s.report.totals.findings > 0) || snapshots[0]
  const plan = buildPlan(baseline.report, { scanPath: root, pack })
  const usedRules = new Set(snapshots.flatMap((s) => s.report.findings.map((f) => f.ruleId)))

  return {
    tool: 'chainguard-atlas',
    pack: { name: pack.name, from: pack.from, to: pack.to },
    generatedAt: new Date().toISOString(),
    root,
    rules: Object.fromEntries([...usedRules].sort().map((id) => {
      const { title, replacement, lib, severity } = pack.byId[id]
      return [id, { title, replacement, lib, severity }]
    })),
    files,
    plan: {
      waves: plan.waves,
      tasks: plan.tasks.map((t) => ({ ...t, files: t.files.map((f) => posix.relative(root, f)) })),
    },
    snapshots: snapshots.map((s) => {
      const byFile = {}
      for (const f of s.report.findings) (byFile[f.file] ||= []).push([f.ruleId, f.line, f.snippet])
      return {
        commit: s.commit,
        short: s.commit ? s.commit.slice(0, 7) : 'working',
        time: s.time,
        subject: s.subject,
        filesScanned: s.report.filesScanned,
        filesAffected: s.report.filesAffected,
        totals: s.report.totals,
        byLib: s.report.byLib,
        present: Object.keys(s.report.imports).sort(),
        findings: byFile,
      }
    }),
  }
}
