import { useCallback, useEffect, useState } from 'react'
import { BigNumber } from 'ethers'
import { fetchErc20Balance, fetchErc20Metadata, fetchEthBalance } from '../lib/erc20.js'
import { watchBlocks } from '../lib/events.js'

export function useErc20(address, account) {
  const [meta, setMeta] = useState(null)
  const [balance, setBalance] = useState(null)
  const [ethBalance, setEthBalance] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchErc20Metadata(address).then(setMeta).catch((e) => setError(e.message))
  }, [address])

  const refresh = useCallback(async () => {
    if (!account) return
    try {
      const [b, eth] = await Promise.all([fetchErc20Balance(address, account), fetchEthBalance(account)])
      setBalance(b)
      setEthBalance(eth)
    } catch (e) {
      setError(e.message)
    }
  }, [address, account])

  useEffect(() => {
    refresh()
    return watchBlocks(() => refresh())
  }, [refresh])

  const isEmpty = balance != null && BigNumber.from(balance).isZero()
  return { meta, balance, ethBalance, isEmpty, error, refresh }
}
