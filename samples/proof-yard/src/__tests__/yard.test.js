import { test } from 'node:test'
import assert from 'node:assert/strict'
import { departure } from '../index.js'

const crew = [{ name: 'Ada', shift: 'early' }, { name: 'Brunel', shift: 'late' }]

test('fares: base plus a rate per whole kilometre, never negative', () => {
  assert.equal(departure({ km: 10, blocksClear: 3, crew, hour: 8 }).fare, 650)
  assert.equal(departure({ km: -4, blocksClear: 3, crew, hour: 8 }).fare, 250)
})

test('signals: aspect by clear blocks ahead', () => {
  assert.deepEqual([0, 1, 2, 3, 9].map((n) => departure({ km: 1, blocksClear: n, crew, hour: 8 }).signal), ['red', 'yellow', 'double yellow', 'green', 'green'])
})

test('crew: the shift that covers the hour', () => {
  assert.deepEqual(departure({ km: 1, blocksClear: 3, crew, hour: 8 }).drivers, ['Ada'])
  assert.deepEqual(departure({ km: 1, blocksClear: 3, crew, hour: 20 }).drivers, ['Brunel'])
})
