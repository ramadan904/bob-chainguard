import { ethers, BigNumber } from 'ethers'

// Format a raw on-chain integer amount for display, trimming to `maxFractionDigits`.
export function formatAmount(raw, decimals = 18, maxFractionDigits = 4) {
  const value = ethers.utils.formatUnits(BigNumber.from(raw), decimals)
  const [whole, fraction = ''] = value.split('.')
  const trimmed = fraction.slice(0, maxFractionDigits).replace(/0+$/, '')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return trimmed ? `${grouped}.${trimmed}` : grouped
}

// Parse user input ("1.5") into a raw integer amount. Returns a decimal string.
export function parseAmount(input, decimals = 18) {
  const cleaned = String(input).trim().replace(/,/g, '')
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') throw new Error(`Invalid amount: ${input}`)
  return ethers.utils.parseUnits(cleaned, decimals).toString()
}

export function formatEth(weiRaw, maxFractionDigits = 4) {
  return formatAmount(weiRaw, 18, maxFractionDigits)
}

export function parseEth(input) {
  return ethers.utils.parseEther(String(input)).toString()
}

export function isZeroAmount(raw) {
  return BigNumber.from(raw).isZero()
}

// True when `balance` covers `amount` (both raw integers).
export function hasSufficientBalance(balance, amount) {
  return BigNumber.from(balance).gte(BigNumber.from(amount))
}

// Share of `part` in `total` in basis points (1% = 100).
export function shareBps(part, total) {
  const t = BigNumber.from(total)
  if (t.isZero()) return 0
  return BigNumber.from(part).mul(10000).div(t).toNumber()
}

// Largest amount that can be sent after reserving `reserve` for fees; never negative.
export function maxSendable(balance, reserve) {
  const b = BigNumber.from(balance)
  const r = BigNumber.from(reserve)
  return b.lte(r) ? '0' : b.sub(r).toString()
}
