import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, extname, sep, posix } from 'node:path'
import { RULES } from './rules.js'

const SOURCE_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte'])
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '.next', '__tests__'])

// True for a scannable source path (posix, relative): right extension, not a test,
// not under a skipped directory.
export function isSourcePath(rel) {
  const parts = rel.split('/')
  if (parts.slice(0, -1).some((p) => SKIP_DIRS.has(p))) return false
  const name = parts[parts.length - 1]
  return SOURCE_EXTS.has(extname(name)) && !/\.(test|spec)\.\w+$/.test(name)
}

export function listSourceFiles(root) {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else if (isSourcePath(name)) out.push(full)
    }
  }
  walk(root)
  return out.sort()
}

// Strip line comments and whole-line block comment content so documentation
// mentioning legacy APIs does not count as a finding.
function codeOf(line, state) {
  let code = line
  if (state.inBlock) {
    const end = code.indexOf('*/')
    if (end === -1) return ''
    code = code.slice(end + 2)
    state.inBlock = false
  }
  code = code.replace(/\/\*.*?\*\//g, '')
  const open = code.indexOf('/*')
  if (open !== -1) {
    state.inBlock = true
    code = code.slice(0, open)
  }
  const lc = code.search(/(^|[^:])\/\//)
  if (lc !== -1) code = code.slice(0, lc + 1)
  return code
}

export function scanSource(text, file = '<input>', rules = RULES) {
  const findings = []
  const state = { inBlock: false }
  text.split(/\r?\n/).forEach((line, i) => {
    const code = codeOf(line, state)
    if (!code.trim()) return
    for (const rule of rules) {
      if (rule.pattern.test(code)) {
        findings.push({ ruleId: rule.id, lib: rule.lib, severity: rule.severity, file, line: i + 1, snippet: line.trim().slice(0, 160) })
      }
    }
  })
  return findings
}

// Local (relative) imports of a module, as specifiers.
export function localImports(text) {
  const specs = []
  for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*|require\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) specs.push(m[1])
  return specs
}

function resolveImport(fromFile, spec, known) {
  const base = posix.normalize(posix.join(posix.dirname(fromFile), spec))
  for (const cand of [base, ...[...SOURCE_EXTS].map((e) => base + e), ...[...SOURCE_EXTS].map((e) => `${base}/index${e}`)]) {
    if (known.has(cand)) return cand
  }
  return null
}

// Scan in-memory sources: entries = [{ rel, text }], rel posix-relative to root.
export function scanEntries(root, entries, rules = RULES) {
  const known = new Set(entries.map((e) => e.rel))
  const findings = []
  const imports = {}
  for (const { rel, text } of entries) {
    findings.push(...scanSource(text, rel, rules))
    imports[rel] = localImports(text).map((s) => resolveImport(rel, s, known)).filter(Boolean)
  }
  return { ...summarize(root, entries.length, findings, rules), imports }
}

export function scanDir(root, rules = RULES) {
  const entries = listSourceFiles(root).map((full) => ({
    rel: relative(root, full).split(sep).join('/'),
    text: readFileSync(full, 'utf8'),
  }))
  return scanEntries(root, entries, rules)
}

export function summarize(root, filesScanned, findings, rules = RULES) {
  const byRule = {}
  const byFile = {}
  const byLib = {}
  for (const f of findings) {
    byRule[f.ruleId] = (byRule[f.ruleId] || 0) + 1
    byFile[f.file] = (byFile[f.file] || 0) + 1
    byLib[f.lib] = (byLib[f.lib] || 0) + 1
  }
  const filesAffected = Object.keys(byFile).length
  return {
    tool: 'chainguard',
    root: String(root),
    scannedAt: new Date().toISOString(),
    rulesActive: rules.length,
    filesScanned,
    filesAffected,
    legacyFreePercent: filesScanned === 0 ? 100 : Math.round(((filesScanned - filesAffected) / filesScanned) * 1000) / 10,
    totals: {
      findings: findings.length,
      errors: findings.filter((f) => f.severity === 'error').length,
      warnings: findings.filter((f) => f.severity === 'warning').length,
    },
    byLib,
    byRule,
    byFile,
    findings,
  }
}

export function compare(before, after) {
  const pct = (a, b) => (a === 0 ? 0 : Math.round(((a - b) / a) * 1000) / 10)
  return {
    findingsBefore: before.totals.findings,
    findingsAfter: after.totals.findings,
    findingsRemovedPercent: pct(before.totals.findings, after.totals.findings),
    filesAffectedBefore: before.filesAffected,
    filesAffectedAfter: after.filesAffected,
    legacyFreeBefore: before.legacyFreePercent,
    legacyFreeAfter: after.legacyFreePercent,
    newRules: Object.keys(after.byRule).filter((id) => !before.byRule[id]),
  }
}
