# Migration playbook: ethers v5 + web3.js 1.x to viem 2 + wagmi 3

Bob: this is the playbook for every migration task in this repo. Read all of it before editing.
Each rule id (ETH001, W3J004, ...) matches a chainguard finding (`npm run scan`).

## Target stack

| Package | Version | Where |
| --- | --- | --- |
| `viem` | `^2` | everything in `legacy-dapp/src/lib/` (framework-agnostic, unit-tested) |
| `wagmi` | `^3` | React hooks in `legacy-dapp/src/hooks/` only |
| `@tanstack/react-query` | `^5` | required by wagmi |
| `ethers`, `web3` | removed | uninstall in the final step, once chainguard reports 0 findings |

## Expand → migrate → contract

Parallel blocks can't all edit the shared client module at once, so the migration follows the
classic safe-refactor order:

1. **Expand** (one commit, before the signal box opens): add the new pieces next to the old ones.
   - `src/lib/viem.js`: `publicClient`, `getWalletClient(account)`, `chain` (see "Clients" below)
   - `src/wagmi.js` and the `WagmiProvider` + `QueryClientProvider` wrap in `src/main.jsx`
   - Nothing uses them yet, so nothing breaks.
2. **Migrate** (signal box waves): every block switches its own files to the new pieces. **Never
   import from `lib/clients.js` in migrated code**; import `publicClient` / `getWalletClient` from
   `lib/viem.js` instead.
3. **Contract** (the last wave): `lib/clients.js` exports the legacy objects themselves
   (`readProvider`, `web3`, ...). Once no file imports them, its block deletes them (or deletes
   the whole file). The signal box refuses to release a removed export that anything still imports.

## Hard rules

1. **Do not change exported names or call signatures** that other files still import (the signal
   box checks this). Components and tests import them.
   The `wallet` object returned by `useWallet()` keeps its shape
   `{ account, chainId, signer, ensName, error, connect, switchChain, wrongChain }`.
   `signer` now holds a viem `WalletClient` (or `undefined`).
2. **Do not edit `src/lib/__tests__/`.** Those tests are the behavior contract. If a test fails,
   fix the implementation, not the test.
3. Raw on-chain amounts are `bigint` internally. Functions that returned decimal strings
   (`parseAmount`, `estimateFeeWei`, `maxSendable`, `fetchErc20Balance`, ...) still return strings (`x.toString()`).
4. Only edit the files named in your task. Anything else you think needs changing: say so, don't edit it.
5. No private keys, mnemonics or API keys anywhere. Wallet signing goes through the injected wallet (`custom(window.ethereum)`).
6. When your task is done, run `npm run scan` and `npm test`. Report the before/after finding count for your files.

## Known traps (the tests catch these)

| Trap | ethers / web3.js behavior | viem behavior | What to do |
| --- | --- | --- | --- |
| Too many decimals | `parseUnits('0.0000001', 6)` throws | returns `0n` silently | Check the fraction length against `decimals` yourself and throw |
| Signature recovery | `utils.verifyMessage(msg, sig)` is sync, returns the address | `recoverMessageAddress({ message, signature })` is **async** | `recoverSigner` becomes `async`; callers already `await` it |
| `formatUnits` input | accepts string / BigNumber | requires `bigint` | `formatUnits(BigInt(raw), decimals)` |
| Block numbers | numbers | `bigint` | `Number(log.blockNumber)` when building UI objects; use `bigint` math for block ranges |
| Gas price | web3 returns a string | `bigint` | callers already pass it through `String()` / bigint-safe helpers |
| Receipt status | `1` / `0` | `'success'` / `'reverted'` | return viem's value, and treat `'reverted'` as failure |
| Revert reason | `err.reason` | `err.shortMessage` on `BaseError` | `err.shortMessage \|\| err.message` |
| Event callback | `(from, to, value, event)` per event | `onLogs(logs)` batch, `log.args.{from,to,value}` | loop over `logs` |
| Address checks | `Web3.utils.isAddress` | `isAddress(x)` (mixed case is checksum-validated) | `isAddress(x, { strict: false })` if you need the old leniency |

## Mapping table

### Clients (ETH002, ETH003, ETH005, W3J002, W3J009)

```js
// before
export const readProvider = new ethers.providers.StaticJsonRpcProvider(RPC_URL, CHAIN_ID)
export const web3 = new Web3(RPC_URL)
const browserProvider = new ethers.providers.Web3Provider(window.ethereum, 'any')
const signer = browserProvider.getSigner()

// after: lib/viem.js (created in the expand step)
import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { sepolia } from 'viem/chains'
import { RPC_URL } from '../config.js'
export const chain = sepolia
export const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })
export function getWalletClient(account) {
  return createWalletClient({ account, chain: sepolia, transport: custom(window.ethereum) })
}
```

There is one read client now. Everything that used `readProvider` or `web3` imports `publicClient`
from `lib/viem.js`. `hasInjectedWallet()` moves to `lib/viem.js` too, if a migrated file needs it.

### Units and math (ETH004, ETH007, ETH008, ETH010, W3J005)

| ethers v5 / web3.js | viem / native |
| --- | --- |
| `BigNumber.from(x)` | `BigInt(x)` |
| `a.add(b)` `a.sub(b)` `a.mul(b)` `a.div(b)` | `a + b` `a - b` `a * b` `a / b` |
| `a.gte(b)` `a.lte(b)` `a.eq(b)` | `a >= b` `a <= b` `a === b` |
| `a.isZero()` | `a === 0n` |
| `a.toNumber()` | `Number(a)` |
| `utils.formatUnits` / `formatEther` | `formatUnits` / `formatEther` (bigint in) |
| `utils.parseUnits` / `parseEther` | `parseUnits` / `parseEther` (bigint out) |
| `web3.utils.fromWei(x, 'gwei')` | `formatGwei(BigInt(x))` |
| `utils.keccak256(utils.toUtf8Bytes(s))` | `keccak256(stringToBytes(s))` or `keccak256(toHex(s))` |
| `utils.hexValue(n)` | `numberToHex(n)` |
| `Web3.utils.isAddress` / `toChecksumAddress` | `isAddress` / `getAddress` |
| `constants.AddressZero` / `MaxUint256` | `zeroAddress` / `maxUint256` |

### Contracts (ETH006, ETH011, ETH012, W3J003, W3J004)

```js
// before
const c = new ethers.Contract(address, ERC20_ABI, signer)
await c.callStatic.transfer(to, amount)
const tx = await c.transfer(to, amount)
const receipt = await tx.wait(1)
const allowance = await new web3.eth.Contract(ERC20_ABI, address).methods.allowance(o, s).call()

// after
const { request } = await publicClient.simulateContract({ account, address, abi: ERC20_ABI, functionName: 'transfer', args: [to, BigInt(amount)] })
const hash = await walletClient.writeContract(request)
const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
const allowance = await publicClient.readContract({ address, abi: ERC20_ABI, functionName: 'allowance', args: [o, s] })
```

`simulateContract` replaces both `callStatic` and the manual gas estimate. `ERC20_ABI` is already
in JSON ABI format; add `as const` only if the file becomes TypeScript.

### Events (ETH009, W3J007, W3J008)

```js
// history
const logs = await publicClient.getContractEvents({ address, abi: ERC20_ABI, eventName: 'Transfer', args: { from: account }, fromBlock, toBlock: 'latest' })
// live
const unwatch = publicClient.watchContractEvent({ address, abi: ERC20_ABI, eventName: 'Transfer', onLogs: (logs) => logs.forEach(handle) })
const unwatchBlocks = publicClient.watchBlockNumber({ onBlockNumber })
```

`fromBlock` must be a `bigint`: `latest > lookback ? latest - lookback : 0n`.

### RPC calls (W3J006, ETH013, ETH015)

| before | after |
| --- | --- |
| `web3.eth.getGasPrice()` | `publicClient.getGasPrice()` |
| `web3.eth.getBlockNumber()` | `publicClient.getBlockNumber()` |
| `web3.eth.estimateGas({...})` | `publicClient.estimateGas({ account, to, value })` |
| `provider.getBalance(a)` | `publicClient.getBalance({ address: a })` |
| `provider.lookupAddress(a)` | `publicClient.getEnsName({ address: a })` |
| `provider.send('eth_requestAccounts')` | `walletClient.requestAddresses()` |
| `provider.listAccounts()` | `walletClient.getAddresses()` |
| `provider.getNetwork()` | `walletClient.getChainId()` |
| `provider.send('wallet_switchEthereumChain', ...)` | `walletClient.switchChain({ id })` |

### Signing (ETH014)

```js
const signature = await walletClient.signMessage({ account, message })
const address = await recoverMessageAddress({ message, signature })
```

### React hooks (wave with `src/hooks/`)

Hooks use wagmi and keep their return shapes:

| legacy logic in `useWallet` | wagmi 3 |
| --- | --- |
| accounts, connect | `useConnection()` (wagmi 3 name for v2 `useAccount`), `useConnect()` + `injected()` from `wagmi/connectors` |
| chain id, switch | `useChainId()`, `useSwitchChain()` |
| signer | `useWalletClient()` -> expose as `signer` |
| ENS | `useEnsName({ address })` |
| `accountsChanged` / `chainChanged` listeners | not needed; wagmi tracks them |

App setup is part of the expand step (done before the waves), so hooks can use wagmi right away:
- `src/wagmi.js`: `createConfig({ chains: [sepolia], connectors: [injected()], transports: { [sepolia.id]: http(RPC_URL) } })`
- `src/main.jsx`: wrap `<App />` in `<WagmiProvider config={config}><QueryClientProvider client={queryClient}>`.

## Definition of done (whole migration)

1. `npm run scan`: 0 findings. `npm run guard` exits 0.
2. `npm test`: all chainguard and dApp tests pass, with no test files modified.
3. `npm run build` succeeds.
4. `ethers` and `web3` are removed from `legacy-dapp/package.json`.
5. `npm run report` writes `reports/after.md` with the before/after table.
