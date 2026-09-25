import Web3 from 'web3'
import { ethers } from 'ethers'

export function isValidAddress(value) {
  return typeof value === 'string' && Web3.utils.isAddress(value)
}

export function toChecksum(value) {
  if (!isValidAddress(value)) throw new Error(`Invalid address: ${value}`)
  return Web3.utils.toChecksumAddress(value)
}

export function isZeroAddress(value) {
  return isValidAddress(value) && toChecksum(value) === ethers.constants.AddressZero
}

export function shortenAddress(value, chars = 4) {
  const a = toChecksum(value)
  return `${a.slice(0, 2 + chars)}…${a.slice(-chars)}`
}

export function sameAddress(a, b) {
  return isValidAddress(a) && isValidAddress(b) && a.toLowerCase() === b.toLowerCase()
}
