import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderStatement, countWords } from '../src/statements.js'

test('statements: fills values, drops optional lines, reports gaps', () => {
  const r = renderStatement('<!-- note -->\n# T\n- Calls: {{a}} → {{b}}\n- Bobcoins: {{bobcoins}}\n- Shots: {{shots}}\n', { a: 72, b: 0 })
  assert.equal(r.text, '# T\n- Calls: 72 → 0\n- Shots: {{shots}}\n')
  assert.deepEqual(r.missing, ['shots'])
  assert.equal(countWords('| Legacy call sites | 72 → 0 |'), 5)
})

test('statements: both real templates stay under 500 words when filled', () => {
  const values = new Proxy({}, { get: (_, k) => (k === 'bobcoins' ? null : '12') })
  for (const name of ['PROBLEM_SOLUTION.md', 'IBM_BOB_USAGE.md']) {
    const text = readFileSync(fileURLToPath(new URL(`../../docs/submission/${name}`, import.meta.url)), 'utf8')
    const r = renderStatement(text, values)
    assert.deepEqual(r.missing, [], name)
    assert.ok(r.words <= 500, `${name}: ${r.words} words`)
  }
})
