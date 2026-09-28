import { useCallback, useState } from 'react'
import { useAccount, useConnect, useChainId, useSwitchChain, useWalletClient, useEnsName } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { CHAIN_ID } from '../config.js'

export function useWallet() {
  const [error, setError] = useState(null)

  const { address: account } = useAccount()
  const chainId = useChainId()
  const { data: signer } = useWalletClient()
  const { data: ensName } = useEnsName({ address: account })
  const { mutateAsync: connectAsync } = useConnect()
  const { mutateAsync: switchChainAsync } = useSwitchChain()

  const connect = useCallback(async () => {
    setError(null)
    try {
      await connectAsync({ connector: injected() })
    } catch (e) {
      setError(e.message)
    }
  }, [connectAsync])

  const switchChain = useCallback(async () => {
    setError(null)
    try {
      await switchChainAsync({ chainId: CHAIN_ID })
    } catch (e) {
      setError(e.message)
    }
  }, [switchChainAsync])

  return {
    account: account ?? null,
    chainId,
    signer: signer ?? null,
    ensName: ensName ?? null,
    error,
    connect,
    switchChain,
    wrongChain: chainId != null && chainId !== CHAIN_ID,
  }
}
