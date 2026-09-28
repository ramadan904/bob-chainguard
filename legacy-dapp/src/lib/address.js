import { isAddress, getAddress, zeroAddress } from 'viem'

export function isValidAddress(value) {
  return typeof value === 'string' && isAddress(value, { strict: false })
}

export function toChecksum(value) {
  if (!isValidAddress(value)) throw new Error(`Invalid address: ${value}`)
  return getAddress(value)
}

export function isZeroAddress(value) {
  return isValidAddress(value) && toChecksum(value) === zeroAddress
}

export function shortenAddress(value, chars = 4) {
  const a = toChecksum(value)
  return `${a.slice(0, 2 + chars)}…${a.slice(-chars)}`
}

export function sameAddress(a, b) {
  return isValidAddress(a) && isValidAddress(b) && a.toLowerCase() === b.toLowerCase()
}
