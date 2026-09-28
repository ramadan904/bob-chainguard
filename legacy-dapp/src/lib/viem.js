import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { sepolia } from 'viem/chains'
import { RPC_URL } from '../config.js'

export const chain = sepolia

export const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })

export function getWalletClient(account) {
  return createWalletClient({ account, chain: sepolia, transport: custom(window.ethereum) })
}

export function hasInjectedWallet() {
  return typeof window !== 'undefined' && Boolean(window.ethereum)
}
