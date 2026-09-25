import { ethers } from 'ethers'
export const provider = new ethers.providers.JsonRpcProvider('https://rpc.example')
// new ethers.Contract(x) in a comment must not count
/* BigNumber.from(1) inside a block comment
   web3.utils.toWei also ignored */
export const link = 'https://docs.ethers.org' // url with // should not break
