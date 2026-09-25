import { useEffect, useState } from 'react'
import { fetchRecentTransfers, watchTransfers } from '../lib/events.js'

export function useTransferFeed(address, account, limit = 10) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!account) return
    let cancelled = false
    setLoading(true)
    fetchRecentTransfers(address, account)
      .then((list) => !cancelled && setItems(list.slice(0, limit)))
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false))
    const stop = watchTransfers(address, account, (t) => setItems((prev) => [t, ...prev].slice(0, limit)))
    return () => {
      cancelled = true
      stop()
    }
  }, [address, account, limit])

  return { items, loading }
}
