import { RPC_URL } from '../config.js'
import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { sepolia } from 'viem/chains'

export const chain = sepolia

// Read-only viem public client used by most of the app.
export const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })

export function hasInjectedWallet() {
  return typeof window !== 'undefined' && Boolean(window.ethereum)
}

// Browser wallet client (MetaMask, Rabby, ...). Created lazily because window.ethereum
// only exists in the browser.
export function getBrowserProvider() {
  if (!hasInjectedWallet()) throw new Error('No injected wallet found. Install MetaMask or another EIP-1193 wallet.')
  return createWalletClient({ chain: sepolia, transport: custom(window.ethereum) })
}

export function getWalletClient(account) {
  if (!hasInjectedWallet()) throw new Error('No injected wallet found.')
  return createWalletClient({ account, chain: sepolia, transport: custom(window.ethereum) })
}
