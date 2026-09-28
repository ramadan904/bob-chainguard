import { createConfig, http } from 'wagmi'
import { sepolia } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { RPC_URL } from './config.js'

export const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: { [sepolia.id]: http(RPC_URL) },
})
