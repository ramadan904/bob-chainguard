import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the viem module so publicClient.waitForTransactionReceipt is controllable.
vi.mock('../viem.js', () => ({
  publicClient: {
    simulateContract: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
  },
}))

import { publicClient } from '../viem.js'
import { sendErc20Transfer } from '../erc20.js'

describe('sendErc20Transfer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the receipt status is reverted', async () => {
    const mockHash = '0xdeadbeef'
    publicClient.simulateContract.mockResolvedValue({ request: {} })
    const mockSigner = {
      account: { address: '0x1234' },
      writeContract: vi.fn().mockResolvedValue(mockHash),
    }
    publicClient.waitForTransactionReceipt.mockResolvedValue({ status: 'reverted', blockNumber: 1n })

    await expect(
      sendErc20Transfer(mockSigner, '0xtoken', '0xrecipient', '1000000')
    ).rejects.toThrow('Transaction reverted')
  })

  it('resolves when the receipt status is success', async () => {
    const mockHash = '0xdeadbeef'
    publicClient.simulateContract.mockResolvedValue({ request: {} })
    const mockSigner = {
      account: { address: '0x1234' },
      writeContract: vi.fn().mockResolvedValue(mockHash),
    }
    publicClient.waitForTransactionReceipt.mockResolvedValue({ status: 'success', blockNumber: 42n })

    const result = await sendErc20Transfer(mockSigner, '0xtoken', '0xrecipient', '1000000')
    expect(result).toEqual({ hash: mockHash, blockNumber: 42, status: 'success' })
  })
})
