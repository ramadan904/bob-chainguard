import { provider } from '../lib/client'
import Web3 from 'web3'
const web3 = new Web3(provider)
export const read = (c, a) => c.methods.balanceOf(a).call()
