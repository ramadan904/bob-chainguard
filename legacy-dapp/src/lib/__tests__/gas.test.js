import { describe, it, expect } from 'vitest'
import { estimateFeeWei, withGasBuffer, weiToGwei } from '../gas.js'

describe('gas helpers', () => {
  it('computes fee = gasLimit * gasPrice', () => {
    expect(String(estimateFeeWei('21000', '30000000000'))).toBe('630000000000000')
    expect(String(estimateFeeWei(65000n, 1n))).toBe('65000')
  })
  it('adds a percentage buffer', () => {
    expect(String(withGasBuffer('100000'))).toBe('120000')
    expect(String(withGasBuffer('100000', 50))).toBe('150000')
  })
  it('converts wei to gwei', () => {
    expect(weiToGwei('1500000000')).toBe(1.5)
  })
})
