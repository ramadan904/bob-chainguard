import { shortenAddress } from '../lib/address.js'
import { formatAmount, formatEth } from '../lib/units.js'
import { CHAIN_NAME } from '../config.js'

export function WalletPanel({ wallet, erc20 }) {
  if (!wallet.account) {
    return (
      <section className="card">
        <h2>Wallet</h2>
        <button onClick={wallet.connect}>Connect wallet</button>
        {wallet.error && <p className="error">{wallet.error}</p>}
      </section>
    )
  }
  return (
    <section className="card">
      <h2>Wallet</h2>
      <p className="mono">{wallet.ensName || shortenAddress(wallet.account)}</p>
      {wallet.wrongChain && (
        <p className="warn">
          Wrong network. <button onClick={wallet.switchChain}>Switch to {CHAIN_NAME}</button>
        </p>
      )}
      <dl>
        <dt>ETH</dt>
        <dd>{erc20.ethBalance == null ? '…' : formatEth(erc20.ethBalance)}</dd>
        <dt>{erc20.meta?.symbol || 'ERC-20'}</dt>
        <dd>{erc20.balance == null || !erc20.meta ? '…' : formatAmount(erc20.balance, erc20.meta.decimals)}</dd>
      </dl>
      {erc20.isEmpty && <p className="muted">No {erc20.meta?.symbol} yet. Grab some from a faucet.</p>}
    </section>
  )
}
