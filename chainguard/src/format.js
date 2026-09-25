import { RULES_BY_ID } from './rules.js'

export function toText(report, delta) {
  const lines = [
    `chainguard: ${report.root}`,
    `  files scanned    ${report.filesScanned}`,
    `  files affected   ${report.filesAffected}`,
    `  legacy-free      ${report.legacyFreePercent}%`,
    `  findings         ${report.totals.findings} (${report.totals.errors} errors, ${report.totals.warnings} warnings)`,
    '',
  ]
  for (const f of report.findings) {
    lines.push(`${f.file}:${f.line}  ${f.severity.padEnd(7)} ${f.ruleId}  ${RULES_BY_ID[f.ruleId].title}`)
    lines.push(`    ${f.snippet}`)
  }
  if (delta) lines.push('', ...deltaLines(delta))
  return lines.join('\n')
}

function deltaLines(d) {
  return [
    'vs baseline:',
    `  findings         ${d.findingsBefore} -> ${d.findingsAfter} (${d.findingsRemovedPercent > 0 ? '-' : ''}${d.findingsRemovedPercent}%)`,
    `  files affected   ${d.filesAffectedBefore} -> ${d.filesAffectedAfter}`,
    `  legacy-free      ${d.legacyFreeBefore}% -> ${d.legacyFreeAfter}%`,
    ...(d.newRules.length ? [`  NEW legacy patterns introduced: ${d.newRules.join(', ')}`] : []),
  ]
}

export function toMarkdown(report, delta) {
  const lines = [
    '# chainguard report',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| Files scanned | ${report.filesScanned} |`,
    `| Files with legacy Web3 APIs | ${report.filesAffected} |`,
    `| Legacy-free files | ${report.legacyFreePercent}% |`,
    `| Findings | ${report.totals.findings} (${report.totals.errors} errors, ${report.totals.warnings} warnings) |`,
    ...Object.entries(report.byLib).map(([lib, n]) => `| ${lib} call sites | ${n} |`),
    '',
  ]
  if (delta) {
    lines.push('## Before vs after', '', '| Metric | Before | After |', '| --- | --- | --- |',
      `| Findings | ${delta.findingsBefore} | ${delta.findingsAfter} (${delta.findingsRemovedPercent > 0 ? '-' : ''}${delta.findingsRemovedPercent}%) |`,
      `| Files affected | ${delta.filesAffectedBefore} | ${delta.filesAffectedAfter} |`,
      `| Legacy-free files | ${delta.legacyFreeBefore}% | ${delta.legacyFreeAfter}% |`, '')
  }
  if (report.findings.length) {
    lines.push('## By rule', '', '| Rule | Title | Count | Replace with |', '| --- | --- | --- | --- |')
    for (const [id, n] of Object.entries(report.byRule).sort((a, b) => b[1] - a[1])) {
      const r = RULES_BY_ID[id]
      lines.push(`| ${id} | ${r.title} | ${n} | ${r.replacement} |`)
    }
    lines.push('', '## By file', '', '| File | Findings |', '| --- | --- |')
    for (const [file, n] of Object.entries(report.byFile).sort((a, b) => b[1] - a[1])) lines.push(`| \`${file}\` | ${n} |`)
    lines.push('')
  }
  return lines.join('\n')
}
