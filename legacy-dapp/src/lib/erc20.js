import { ethers } from 'ethers'
import { readProvider, web3 } from './clients.js'
import { ERC20_ABI } from './abi.js'

export function getReadContract(address) {
  return new ethers.Contract(address, ERC20_ABI, readProvider)
}

export async function fetchErc20Metadata(address) {
  const c = getReadContract(address)
  const [name, symbol, decimals, totalSupply] = await Promise.all([c.name(), c.symbol(), c.decimals(), c.totalSupply()])
  return { address, name, symbol, decimals, totalSupply: totalSupply.toString() }
}

export async function fetchErc20Balance(address, owner) {
  const balance = await getReadContract(address).balanceOf(owner)
  return balance.toString()
}

// Allowance is still read through the old web3.js contract wrapper.
export async function fetchAllowance(address, owner, spender) {
  const legacy = new web3.eth.Contract(ERC20_ABI, address)
  return legacy.methods.allowance(owner, spender).call()
}

export async function fetchEthBalance(owner) {
  const wei = await readProvider.getBalance(owner)
  return wei.toString()
}

// Simulates the transfer first so the user sees a revert reason before signing.
export async function sendErc20Transfer(signer, address, to, amountRaw) {
  const c = new ethers.Contract(address, ERC20_ABI, signer)
  await c.callStatic.transfer(to, amountRaw)
  const gas = await c.estimateGas.transfer(to, amountRaw)
  const tx = await c.transfer(to, amountRaw, { gasLimit: gas.mul(120).div(100) })
  const receipt = await tx.wait(1)
  return { hash: tx.hash, blockNumber: receipt.blockNumber, status: receipt.status }
}

export async function approveSpender(signer, address, spender, amountRaw = ethers.constants.MaxUint256) {
  const c = new ethers.Contract(address, ERC20_ABI, signer)
  const tx = await c.approve(spender, amountRaw)
  await tx.wait()
  return tx.hash
}
