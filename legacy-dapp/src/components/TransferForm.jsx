import { useEffect, useState } from 'react'
import { isValidAddress, isZeroAddress } from '../lib/address.js'
import { parseAmount, hasSufficientBalance, formatEth } from '../lib/units.js'
import { sendErc20Transfer } from '../lib/erc20.js'
import { fetchGasPrice, estimateFeeWei, weiToGwei } from '../lib/gas.js'
import { EXPLORER_URL } from '../config.js'

const TRANSFER_GAS_ESTIMATE = 65000

export function TransferForm({ wallet, erc20, contractAddress }) {
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [gasPrice, setGasPrice] = useState(null)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    fetchGasPrice().then(setGasPrice).catch(() => setGasPrice(null))
  }, [])

  let problem = null
  let raw = null
  if (to && !isValidAddress(to)) problem = 'Recipient is not a valid address'
  else if (to && isZeroAddress(to)) problem = 'Refusing to send to the zero address'
  if (amount && erc20.meta) {
    try {
      raw = parseAmount(amount, erc20.meta.decimals)
      if (erc20.balance != null && !hasSufficientBalance(erc20.balance, raw)) problem = 'Amount exceeds balance'
    } catch (e) {
      problem = e.message
    }
  }

  async function submit(e) {
    e.preventDefault()
    setStatus({ kind: 'pending', text: 'Confirm in your wallet…' })
    try {
      const r = await sendErc20Transfer(wallet.signer, contractAddress, to, raw)
      setStatus({ kind: 'ok', text: `Confirmed in block ${r.blockNumber}`, hash: r.hash })
      erc20.refresh()
    } catch (err) {
      setStatus({ kind: 'error', text: err.reason || err.message })
    }
  }

  return (
    <section className="card">
      <h2>Send {erc20.meta?.symbol}</h2>
      <form onSubmit={submit}>
        <input placeholder="0x recipient" value={to} onChange={(e) => setTo(e.target.value.trim())} />
        <input placeholder="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        {gasPrice && (
          <p className="muted">
            Gas {weiToGwei(gasPrice).toFixed(2)} gwei · est. fee {formatEth(estimateFeeWei(TRANSFER_GAS_ESTIMATE, gasPrice), 6)} ETH
          </p>
        )}
        {problem && <p className="error">{problem}</p>}
        <button disabled={!wallet.signer || !raw || !to || problem}>Send</button>
      </form>
      {status && (
        <p className={status.kind}>
          {status.text}{' '}
          {status.hash && <a href={`${EXPLORER_URL}/tx/${status.hash}`} target="_blank" rel="noreferrer">view</a>}
        </p>
      )}
    </section>
  )
}
