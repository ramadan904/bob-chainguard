import { useCallback, useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { getBrowserProvider, hasInjectedWallet } from '../lib/clients.js'
import { CHAIN_ID } from '../config.js'

export function useWallet() {
  const [account, setAccount] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [signer, setSigner] = useState(null)
  const [ensName, setEnsName] = useState(null)
  const [error, setError] = useState(null)

  const sync = useCallback(async () => {
    const provider = getBrowserProvider()
    const accounts = await provider.listAccounts()
    const network = await provider.getNetwork()
    setChainId(network.chainId)
    if (accounts.length === 0) {
      setAccount(null)
      setSigner(null)
      return
    }
    const s = provider.getSigner()
    setSigner(s)
    setAccount(await s.getAddress())
    // ENS only resolves on mainnet; ignore failures elsewhere.
    provider.lookupAddress(accounts[0]).then(setEnsName).catch(() => setEnsName(null))
  }, [])

  const connect = useCallback(async () => {
    setError(null)
    try {
      await getBrowserProvider().send('eth_requestAccounts', [])
      await sync()
    } catch (e) {
      setError(e.message)
    }
  }, [sync])

  const switchChain = useCallback(async () => {
    await getBrowserProvider().send('wallet_switchEthereumChain', [{ chainId: ethers.utils.hexValue(CHAIN_ID) }])
  }, [])

  useEffect(() => {
    if (!hasInjectedWallet()) return
    sync().catch((e) => setError(e.message))
    window.ethereum.on('accountsChanged', sync)
    window.ethereum.on('chainChanged', sync)
    return () => {
      window.ethereum.removeListener('accountsChanged', sync)
      window.ethereum.removeListener('chainChanged', sync)
    }
  }, [sync])

  return { account, chainId, signer, ensName, error, connect, switchChain, wrongChain: chainId != null && chainId !== CHAIN_ID }
}
