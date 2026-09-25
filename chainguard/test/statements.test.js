import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderStatement, countWords, promptFrom } from '../src/statements.js'

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

test('runbook prompts: every step the Bob helpers print exists', () => {
  const runbook = readFileSync(fileURLToPath(new URL('../../docs/BOB_RUNBOOK.md', import.meta.url)), 'utf8')
  assert.match(promptFrom(runbook, '0.'), /expand step/)
  assert.match(promptFrom(runbook, '1.'), /walk\s+legacy-dapp\/src/)
  assert.match(promptFrom(runbook, '2. The dispatcher'), /You are the dispatcher/)
  assert.equal(promptFrom(runbook, 'no such heading'), null)
  assert.equal(promptFrom(runbook.replace(/\r?\n/g, '\r\n'), '2. The dispatcher'), promptFrom(runbook.replace(/\r\n/g, '\n'), '2. The dispatcher'), 'CRLF checkouts (Windows) read the same')
})

test('screenshot captions come from file names', async () => {
  const { shotCaption } = await import('../src/statements.js')
  assert.deepEqual(shotCaption('ramadan-dispatcher.png').member, 'ramadan')
  assert.match(shotCaption('ramadan-dispatcher.png').caption, /Dispatcher/)
  assert.equal(shotCaption('ada-w1-lib-2.png').caption, 'Bob subagent working block w1-lib-2')
  assert.equal(shotCaption('notes.png').member, null)
})
