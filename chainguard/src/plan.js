import { posix } from 'node:path'
import { DEFAULT_PACK } from './rules.js'

const MAX_FILES_PER_TASK = 3

// Wave of each flagged file = 1 + the highest wave among the flagged files it depends on.
// Normally a file depends on the flagged files it imports (directly or through clean files), so
// helpers migrate before their callers. A *provider* (a file that exports legacy objects, e.g.
// `export const provider = new ethers.providers...`) is the reverse: its exports can only change
// once no caller needs them, so it waits for its callers (expand -> migrate -> contract).
// Files in the same wave never depend on each other, so their tasks can run in parallel.
export function computeWaves(flagged, imports = {}, providers = new Set()) {
  const importersOf = {}
  for (const [f, deps] of Object.entries(imports)) for (const d of deps) (importersOf[d] ||= []).push(f)
  const waves = {}
  const visiting = new Set()
  const flaggedDeps = (file, seen = new Set()) => {
    const out = new Set()
    for (const dep of imports[file] || []) {
      if (seen.has(dep)) continue
      seen.add(dep)
      if (providers.has(dep)) continue
      if (flagged.has(dep)) out.add(dep)
      else for (const d of flaggedDeps(dep, seen)) out.add(d)
    }
    if (providers.has(file)) for (const user of importersOf[file] || []) if (flagged.has(user) && !providers.has(user)) out.add(user)
    return out
  }
  const waveOf = (file) => {
    if (waves[file]) return waves[file]
    if (visiting.has(file)) return 1 // import cycle: break it
    visiting.add(file)
    let w = 1
    for (const dep of flaggedDeps(file)) if (dep !== file) w = Math.max(w, waveOf(dep) + 1)
    visiting.delete(file)
    return (waves[file] = w)
  }
  for (const f of flagged) waveOf(f)
  return waves
}

export function isLegacyValueExport(line) {
  const m = line.match(/^export\s+(?:const|let|var)\s+[\w$]+\s*=\s*(.*)$/)
  if (!m) return false
  return !/^(async\s+)?(function\b|\([^)]*\)\s*=>|[\w$]+\s*=>)/.test(m[1])
}

export function buildPlan(report, { pack = DEFAULT_PACK, scanPath = report.root } = {}) {
  const { to: target, from, playbook } = pack
  const byFile = new Map()
  for (const f of report.findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file).push(f)
  }
  // Providers: a legacy call on an exported value declaration (not an exported function).
  const providers = new Set(report.findings.filter((f) => isLegacyValueExport(f.snippet)).map((f) => f.file))
  const waves = computeWaves(new Set(byFile.keys()), report.imports, providers)

  // Group by (wave, directory), then split into subagent-sized chunks.
  const groups = new Map()
  for (const file of [...byFile.keys()].sort()) {
    const key = `${waves[file]}|${posix.dirname(file)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(file)
  }
  const tasks = []
  for (const [key, files] of groups) {
    const [wave, dir] = key.split('|')
    const chunks = []
    for (let i = 0; i < files.length; i += MAX_FILES_PER_TASK) chunks.push(files.slice(i, i + MAX_FILES_PER_TASK))
    chunks.forEach((chunk, i) => {
      const findings = chunk.flatMap((f) => byFile.get(f))
      const ruleIds = [...new Set(findings.map((f) => f.ruleId))].sort()
      const slug = dir === '.' ? 'root' : dir.replace(/[^\w]+/g, '-')
      tasks.push({
        id: `w${wave}-${slug}${chunks.length > 1 ? `-${i + 1}` : ''}`,
        wave: Number(wave),
        files: chunk.map((f) => posix.join(scanPath, f)),
        findings: findings.length,
        contracts: chunk.filter((f) => providers.has(f)).map((f) => posix.join(scanPath, f)),
        rules: ruleIds.map((id) => ({ id, title: pack.byId[id]?.title || id })),
      })
    })
  }
  tasks.sort((a, b) => a.wave - b.wave || b.findings - a.findings)

  for (const t of tasks) {
    t.prompt = [
      `Migrate these files from ${from} to ${target}: ${t.files.map((f) => `@${f}`).join(' ')}`,
      `Follow @${playbook} (mapping table and rules). Do not edit any other file.`,
      `chainguard found ${t.findings} legacy call sites: ${t.rules.map((r) => `${r.id} ${r.title}`).join(', ')}.`,
      t.contracts.length
        ? `Contract step: ${t.contracts.map((f) => `\`${f}\``).join(', ')} exports legacy objects. Its callers were migrated in earlier waves; remove the legacy exports (or the whole file) now. The signal box refuses the release if anything still imports a removed name.`
        : 'Keep every exported name and call signature stable. Raw amounts become bigint; functions that returned strings still return strings.',
      `Done when \`node chainguard/bin/chainguard.js scan ${scanPath}\` lists none of these files and \`npm test --prefix legacy-dapp\` passes.`,
    ].join('\n')
  }
  return { pack: pack.name, from, target, playbook, totalFindings: report.totals.findings, waves: Math.max(0, ...tasks.map((t) => t.wave)), tasks }
}

export function planToMarkdown(plan) {
  const lines = [
    '# Bob migration task plan',
    '',
    `Generated by chainguard: ${plan.totalFindings} legacy call sites, ${plan.tasks.length} tasks in ${plan.waves} waves.`,
    '',
    'Waves follow the import graph: a file is migrated only after every flagged file it imports.',
    'Tasks inside one wave touch disjoint files and do not depend on each other, so give each one',
    'to its own Bob subagent / parallel task. Between waves run `npm run scan` and `npm test`.',
    '',
  ]
  for (let w = 1; w <= plan.waves; w++) {
    const wave = plan.tasks.filter((t) => t.wave === w)
    if (!wave.length) continue
    lines.push(`## Wave ${w} (${wave.length} parallel task${wave.length > 1 ? 's' : ''})`, '')
    for (const t of wave) lines.push(`### ${t.id} (${t.findings} findings)`, '', '```text', t.prompt, '```', '')
  }
  return lines.join('\n')
}
