import { maxUint256 } from 'viem'
import { publicClient } from './viem.js'
import { ERC20_ABI } from './abi.js'

export async function fetchErc20Metadata(address) {
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    publicClient.readContract({ address, abi: ERC20_ABI, functionName: 'name' }),
    publicClient.readContract({ address, abi: ERC20_ABI, functionName: 'symbol' }),
    publicClient.readContract({ address, abi: ERC20_ABI, functionName: 'decimals' }),
    publicClient.readContract({ address, abi: ERC20_ABI, functionName: 'totalSupply' }),
  ])
  return { address, name, symbol, decimals, totalSupply: totalSupply.toString() }
}

export async function fetchErc20Balance(address, owner) {
  const balance = await publicClient.readContract({ address, abi: ERC20_ABI, functionName: 'balanceOf', args: [owner] })
  return balance.toString()
}

export async function fetchAllowance(address, owner, spender) {
  const allowance = await publicClient.readContract({ address, abi: ERC20_ABI, functionName: 'allowance', args: [owner, spender] })
  return allowance.toString()
}

export async function fetchEthBalance(owner) {
  const wei = await publicClient.getBalance({ address: owner })
  return wei.toString()
}

// Simulates the transfer first so the user sees a revert reason before signing.
export async function sendErc20Transfer(signer, address, to, amountRaw) {
  const account = signer.account
  try {
    const { request } = await publicClient.simulateContract({
      account,
      address,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, BigInt(amountRaw)],
    })
    const hash = await signer.writeContract(request)
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
    if (receipt.status === 'reverted') throw new Error('Transaction reverted')
    return { hash, blockNumber: Number(receipt.blockNumber), status: receipt.status }
  } catch (err) {
    throw new Error(err.shortMessage || err.message)
  }
}

export async function approveSpender(signer, address, spender, amountRaw = maxUint256) {
  const account = signer.account
  const { request } = await publicClient.simulateContract({
    account,
    address,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spender, BigInt(amountRaw)],
  })
  const hash = await signer.writeContract(request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status === 'reverted') throw new Error('Transaction reverted')
  return hash
}
