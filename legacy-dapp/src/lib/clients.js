import { ethers } from 'ethers'
import Web3 from 'web3'
import { RPC_URL, CHAIN_ID } from '../config.js'

// Read-only ethers provider used by most of the app.
export const readProvider = new ethers.providers.StaticJsonRpcProvider(RPC_URL, CHAIN_ID)

// A second, web3.js-based client left over from the original codebase. The activity
// feed and gas helpers still depend on it.
export const web3 = new Web3(RPC_URL)

export function hasInjectedWallet() {
  return typeof window !== 'undefined' && Boolean(window.ethereum)
}

// Browser wallet provider (MetaMask, Rabby, ...). Created lazily because window.ethereum
// only exists in the browser.
let browserProvider
export function getBrowserProvider() {
  if (!hasInjectedWallet()) throw new Error('No injected wallet found. Install MetaMask or another EIP-1193 wallet.')
  if (!browserProvider) browserProvider = new ethers.providers.Web3Provider(window.ethereum, 'any')
  return browserProvider
}

export function getWalletWeb3() {
  if (!hasInjectedWallet()) throw new Error('No injected wallet found.')
  return new Web3(window.ethereum)
}
