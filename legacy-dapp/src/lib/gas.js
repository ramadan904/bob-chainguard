import { BigNumber } from 'ethers'
import { web3 } from './clients.js'

// Fee in wei for a gas limit and gas price (raw integers). Returns a decimal string.
export function estimateFeeWei(gasLimit, gasPriceWei) {
  return BigNumber.from(gasLimit).mul(BigNumber.from(gasPriceWei)).toString()
}

// Add a safety margin to a gas estimate, in percent (default +20%).
export function withGasBuffer(gasLimit, percent = 20) {
  return BigNumber.from(gasLimit).mul(100 + percent).div(100).toString()
}

export function weiToGwei(wei) {
  return Number(web3.utils.fromWei(String(wei), 'gwei'))
}

export async function fetchGasPrice() {
  return web3.eth.getGasPrice()
}

export async function estimateTransferGas(from, to, valueWei) {
  const gas = await web3.eth.estimateGas({ from, to, value: valueWei })
  return withGasBuffer(gas)
}
