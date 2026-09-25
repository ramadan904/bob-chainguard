import { useTransferFeed } from '../hooks/useTransferFeed.js'
import { sameAddress, shortenAddress } from '../lib/address.js'
import { formatAmount } from '../lib/units.js'
import { EXPLORER_URL } from '../config.js'

export function ActivityFeed({ account, contractAddress, meta }) {
  const { items, loading } = useTransferFeed(contractAddress, account)
  if (!account) return null
  return (
    <section className="card">
      <h2>Recent activity</h2>
      {loading && <p className="muted">Loading…</p>}
      {!loading && items.length === 0 && <p className="muted">No transfers in the last 5,000 blocks.</p>}
      <ul className="feed">
        {items.map((t) => {
          const out = sameAddress(t.from, account)
          return (
            <li key={`${t.txHash}-${t.from}-${t.to}`}>
              <span className={out ? 'out' : 'in'}>{out ? '−' : '+'}{meta ? formatAmount(t.value, meta.decimals) : t.value}</span>
              <span className="mono small">{out ? `to ${shortenAddress(t.to)}` : `from ${shortenAddress(t.from)}`}</span>
              <a href={`${EXPLORER_URL}/tx/${t.txHash}`} target="_blank" rel="noreferrer">#{t.blockNumber}</a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
