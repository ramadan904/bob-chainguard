import { formatGwei } from 'viem'
import { publicClient } from './viem.js'

// Fee in wei for a gas limit and gas price (raw integers). Returns a decimal string.
export function estimateFeeWei(gasLimit, gasPriceWei) {
  return (BigInt(gasLimit) * BigInt(gasPriceWei)).toString()
}

// Add a safety margin to a gas estimate, in percent (default +20%).
export function withGasBuffer(gasLimit, percent = 20) {
  return (BigInt(gasLimit) * BigInt(100 + percent) / 100n).toString()
}

export function weiToGwei(wei) {
  return Number(formatGwei(BigInt(wei)))
}

export async function fetchGasPrice() {
  return publicClient.getGasPrice()
}

export async function estimateTransferGas(from, to, valueWei) {
  const gas = await publicClient.estimateGas({ account: from, to, value: BigInt(valueWei) })
  return withGasBuffer(gas)
}
