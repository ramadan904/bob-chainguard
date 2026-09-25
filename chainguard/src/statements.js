// Fills the submission statements from computed values: every {{name}} is replaced, the
// authoring comment is dropped, and the words are counted the way a form counts them.
// Lines whose only unknown values are optional (e.g. {{bobcoins}}) are dropped rather than
// left with a hole; any other missing value is reported so nothing blank gets submitted.

// Optional: Bobcoins (typed by you in bob_sessions/bobcoins.txt) and the MCP row, which is only
// claimed when there is a screenshot of Bob using the MCP tools.
export const OPTIONAL = new Set(['bobcoins', 'shots_mcp'])

export function renderStatement(template, values) {
  const missing = new Set()
  const lines = template.replace(/<!--[\s\S]*?-->\n?/g, '').split('\n').filter((line) => {
    const names = [...line.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])
    const absent = names.filter((n) => values[n] == null || values[n] === '')
    if (absent.length && absent.every((n) => OPTIONAL.has(n))) return false
    for (const n of absent) missing.add(n)
    return true
  })
  const text = lines.join('\n').replace(/\{\{(\w+)\}\}/g, (all, n) => (values[n] == null || values[n] === '' ? all : String(values[n])))
  return { text, words: countWords(text), missing: [...missing] }
}

export function countWords(markdown) {
  return markdown.replace(/[#|*`>-]+/g, ' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

// The first ```text block under the runbook heading that starts with `heading` (e.g. '2. The
// dispatcher'), so scripts print the exact prompts the runbook documents.
export function promptFrom(runbook, heading) {
  const lines = runbook.split('\n')
  const start = lines.findIndex((l) => /^#{1,3} /.test(l) && l.replace(/^#+\s*/, '').startsWith(heading))
  if (start < 0) return null
  const rest = lines.slice(start + 1).join('\n')
  const next = rest.search(/^#{1,3} /m)
  const section = next < 0 ? rest : rest.slice(0, next)
  return section.match(/```text\n([\s\S]*?)```/)?.[1].trim() || null
}
