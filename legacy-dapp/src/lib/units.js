import { formatUnits, parseUnits, parseEther } from 'viem'

// Format a raw on-chain integer amount for display, trimming to `maxFractionDigits`.
export function formatAmount(raw, decimals = 18, maxFractionDigits = 4) {
  const value = formatUnits(BigInt(raw), decimals)
  const [whole, fraction = ''] = value.split('.')
  const trimmed = fraction.slice(0, maxFractionDigits).replace(/0+$/, '')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return trimmed ? `${grouped}.${trimmed}` : grouped
}

// Parse user input ("1.5") into a raw integer amount. Returns a decimal string.
export function parseAmount(input, decimals = 18) {
  const cleaned = String(input).trim().replace(/,/g, '')
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') throw new Error(`Invalid amount: ${input}`)
  const dotIndex = cleaned.indexOf('.')
  if (dotIndex !== -1 && cleaned.length - dotIndex - 1 > decimals) {
    throw new Error(`Too many decimals for ${decimals} decimal asset: ${input}`)
  }
  return parseUnits(cleaned, decimals).toString()
}

export function formatEth(weiRaw, maxFractionDigits = 4) {
  return formatAmount(weiRaw, 18, maxFractionDigits)
}

export function parseEth(input) {
  return parseEther(String(input)).toString()
}

export function isZeroAmount(raw) {
  return BigInt(raw) === 0n
}

// True when `balance` covers `amount` (both raw integers).
export function hasSufficientBalance(balance, amount) {
  return BigInt(balance) >= BigInt(amount)
}

// Share of `part` in `total` in basis points (1% = 100).
export function shareBps(part, total) {
  const t = BigInt(total)
  if (t === 0n) return 0
  return Number((BigInt(part) * 10000n) / t)
}

// Largest amount that can be sent after reserving `reserve` for fees; never negative.
export function maxSendable(balance, reserve) {
  const b = BigInt(balance)
  const r = BigInt(reserve)
  return b <= r ? '0' : (b - r).toString()
}
