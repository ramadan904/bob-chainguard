// Behavior contract for the units helpers. These tests must keep passing, unchanged,
// after the ethers v5 -> viem migration. Results are compared via String() so either
// decimal strings or bigints are accepted as outputs.
import { describe, it, expect } from 'vitest'
import { formatAmount, parseAmount, formatEth, parseEth, isZeroAmount, hasSufficientBalance, shareBps, maxSendable } from '../units.js'

describe('formatAmount', () => {
  it('formats with thousands separators and trims fraction', () => {
    expect(formatAmount('1234567890000000000000', 18)).toBe('1,234.5678')
    expect(formatAmount('1500000', 6)).toBe('1.5')
    expect(formatAmount('0', 18)).toBe('0')
  })
  it('respects maxFractionDigits', () => {
    expect(formatAmount('1234567890000000000', 18, 2)).toBe('1.23')
    expect(formatAmount('1000000000000000000', 18, 0)).toBe('1')
  })
  it('accepts bigint input', () => {
    expect(formatAmount(2500000000000000000n, 18)).toBe('2.5')
  })
})

describe('parseAmount', () => {
  it('parses decimal user input into raw units', () => {
    expect(String(parseAmount('1.5', 18))).toBe('1500000000000000000')
    expect(String(parseAmount('1,000', 6))).toBe('1000000000')
    expect(String(parseAmount(' 0.000001 ', 6))).toBe('1')
  })
  it('rejects garbage', () => {
    expect(() => parseAmount('abc', 18)).toThrow()
    expect(() => parseAmount('', 18)).toThrow()
    expect(() => parseAmount('-1', 18)).toThrow()
  })
  it('rejects more decimals than the asset supports', () => {
    expect(() => parseAmount('0.0000001', 6)).toThrow()
  })
})

describe('eth helpers', () => {
  it('round-trips ether amounts', () => {
    expect(String(parseEth('0.25'))).toBe('250000000000000000')
    expect(formatEth('250000000000000000')).toBe('0.25')
  })
})

describe('amount math', () => {
  it('detects zero', () => {
    expect(isZeroAmount('0')).toBe(true)
    expect(isZeroAmount('1')).toBe(false)
  })
  it('checks sufficient balance', () => {
    expect(hasSufficientBalance('100', '100')).toBe(true)
    expect(hasSufficientBalance('99', '100')).toBe(false)
  })
  it('computes basis-point share', () => {
    expect(shareBps('25', '100')).toBe(2500)
    expect(shareBps('1', '3')).toBe(3333)
    expect(shareBps('5', '0')).toBe(0)
  })
  it('never returns a negative sendable amount', () => {
    expect(String(maxSendable('1000', '300'))).toBe('700')
    expect(String(maxSendable('100', '300'))).toBe('0')
  })
})
