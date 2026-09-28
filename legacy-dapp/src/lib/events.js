import { publicClient } from './viem.js'
import { ERC20_ABI } from './abi.js'

function normalize(from, to, value, txHash, blockNumber) {
  return { from, to, value: String(value), txHash, blockNumber: Number(blockNumber) }
}

// Most recent Transfer events touching `account`, newest first.
export async function fetchRecentTransfers(address, account, lookbackBlocks = 5000) {
  const latest = await publicClient.getBlockNumber()
  const lookback = BigInt(lookbackBlocks)
  const fromBlock = latest > lookback ? latest - lookback : 0n
  const [sent, received] = await Promise.all([
    publicClient.getContractEvents({ address, abi: ERC20_ABI, eventName: 'Transfer', args: { from: account }, fromBlock, toBlock: 'latest' }),
    publicClient.getContractEvents({ address, abi: ERC20_ABI, eventName: 'Transfer', args: { to: account }, fromBlock, toBlock: 'latest' }),
  ])
  return [...sent, ...received]
    .map((e) => normalize(e.args.from, e.args.to, e.args.value, e.transactionHash, e.blockNumber))
    .sort((a, b) => b.blockNumber - a.blockNumber)
}

// Live Transfer feed. Returns an unsubscribe function.
export function watchTransfers(address, account, onTransfer) {
  const unwatch = publicClient.watchContractEvent({
    address,
    abi: ERC20_ABI,
    eventName: 'Transfer',
    onLogs: (logs) => {
      logs.forEach((log) => {
        const { from, to, value } = log.args
        if (account && from.toLowerCase() !== account.toLowerCase() && to.toLowerCase() !== account.toLowerCase()) return
        onTransfer(normalize(from, to, value, log.transactionHash, log.blockNumber))
      })
    },
  })
  return unwatch
}

export function watchBlocks(onBlock) {
  const unwatch = publicClient.watchBlockNumber({ onBlockNumber: onBlock })
  return unwatch
}
