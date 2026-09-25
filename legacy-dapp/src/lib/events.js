import { ethers } from 'ethers'
import { readProvider, web3 } from './clients.js'
import { ERC20_ABI } from './abi.js'

function normalize(from, to, value, txHash, blockNumber) {
  return { from, to, value: String(value), txHash, blockNumber: Number(blockNumber) }
}

// Most recent Transfer events touching `account`, newest first.
export async function fetchRecentTransfers(address, account, lookbackBlocks = 5000) {
  const contract = new web3.eth.Contract(ERC20_ABI, address)
  const latest = await web3.eth.getBlockNumber()
  const fromBlock = Math.max(0, latest - lookbackBlocks)
  const [sent, received] = await Promise.all([
    contract.getPastEvents('Transfer', { filter: { from: account }, fromBlock, toBlock: 'latest' }),
    contract.getPastEvents('Transfer', { filter: { to: account }, fromBlock, toBlock: 'latest' }),
  ])
  return [...sent, ...received]
    .map((e) => normalize(e.returnValues.from, e.returnValues.to, e.returnValues.value, e.transactionHash, e.blockNumber))
    .sort((a, b) => b.blockNumber - a.blockNumber)
}

// Live Transfer feed. Returns an unsubscribe function.
export function watchTransfers(address, account, onTransfer) {
  const contract = new ethers.Contract(address, ERC20_ABI, readProvider)
  const handler = (from, to, value, event) => {
    if (account && from.toLowerCase() !== account.toLowerCase() && to.toLowerCase() !== account.toLowerCase()) return
    onTransfer(normalize(from, to, value, event.transactionHash, event.blockNumber))
  }
  contract.on('Transfer', handler)
  return () => contract.off('Transfer', handler)
}

export function watchBlocks(onBlock) {
  readProvider.on('block', onBlock)
  return () => readProvider.off('block', onBlock)
}
