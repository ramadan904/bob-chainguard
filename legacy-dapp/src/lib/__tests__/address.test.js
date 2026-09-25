import { describe, it, expect } from 'vitest'
import { isValidAddress, toChecksum, isZeroAddress, shortenAddress, sameAddress } from '../address.js'

const LOWER = '0xbd776639745374a6b90169d1f2bcc486fdf86002'
const CHECKSUM = '0xbD776639745374a6b90169D1f2BCC486FDf86002'

describe('address helpers', () => {
  it('validates addresses', () => {
    expect(isValidAddress(LOWER)).toBe(true)
    expect(isValidAddress(CHECKSUM)).toBe(true)
    expect(isValidAddress('0x123')).toBe(false)
    expect(isValidAddress(undefined)).toBe(false)
  })
  it('checksums', () => {
    expect(toChecksum(LOWER)).toBe(CHECKSUM)
    expect(() => toChecksum('nope')).toThrow()
  })
  it('detects the zero address', () => {
    expect(isZeroAddress('0x0000000000000000000000000000000000000000')).toBe(true)
    expect(isZeroAddress(CHECKSUM)).toBe(false)
  })
  it('shortens for display', () => {
    expect(shortenAddress(LOWER)).toBe('0xbD77…6002')
  })
  it('compares case-insensitively', () => {
    expect(sameAddress(LOWER, CHECKSUM)).toBe(true)
    expect(sameAddress(LOWER, '0x0000000000000000000000000000000000000000')).toBe(false)
  })
})
