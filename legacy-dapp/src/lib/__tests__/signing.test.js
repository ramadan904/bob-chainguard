import { describe, it, expect } from 'vitest'
import { messageDigest, recoverSigner, buildLoginMessage } from '../signing.js'

// Test vector produced once with a throwaway random wallet; only its public address is kept.
const VECTOR = {
  address: '0xbD776639745374a6b90169D1f2BCC486FDf86002',
  message: 'ChainGuard test vector',
  signature:
    '0x8500aafa215b98d8bfb940d8b15187c74ab57122540beb0611ad2440d9cf6e952e8834b84efcf45d78da61d77275e129a67dd4621ff2b234874b23851fd714651b',
}

describe('signing helpers', () => {
  it('hashes messages with keccak256', () => {
    expect(messageDigest('hello')).toBe('0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8')
  })
  it('recovers the signer of a personal_sign message', async () => {
    const recovered = await recoverSigner(VECTOR.message, VECTOR.signature)
    expect(recovered.toLowerCase()).toBe(VECTOR.address.toLowerCase())
  })
  it('builds a deterministic login message', () => {
    expect(buildLoginMessage('0xabc', 'n1', '2026-09-25T00:00:00.000Z')).toBe(
      'ChainGuard Wallet wants you to sign in with 0xabc\n\nNonce: n1\nIssued At: 2026-09-25T00:00:00.000Z',
    )
  })
})
