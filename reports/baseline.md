# chainguard report

| Metric | Value |
| --- | --- |
| Files scanned | 18 |
| Files with legacy Web3 APIs | 10 |
| Legacy-free files | 44.4% |
| Findings | 72 (58 errors, 14 warnings) |
| ethers-v5 call sites | 57 |
| web3js call sites | 15 |

## By rule

| Rule | Title | Count | Replace with |
| --- | --- | --- | --- |
| ETH004 | BigNumber | 10 | native bigint (123n, BigInt(x)) |
| ETH001 | ethers import | 9 | import { ... } from 'viem' (and 'wagmi' hooks in React) |
| ETH008 | BigNumber instance method | 7 | bigint operators (*, /, -, >=, <=, === 0n, Number(x)) |
| ETH007 | ethers.utils.* | 7 | viem formatUnits, parseUnits, formatEther, parseEther, isAddress, getAddress, keccak256, toHex, stringToBytes, verifyMessage |
| ETH015 | raw provider RPC (send / listAccounts / getNetwork) | 4 | walletClient.requestAddresses / getAddresses / getChainId / switchChain, wagmi useConnect / useChainId / useSwitchChain |
| ETH006 | ethers Contract instance | 4 | getContract({ address, abi, client }) or readContract/writeContract, wagmi useReadContract/useWriteContract |
| ETH009 | contract/provider event listener | 4 | watchContractEvent / watchBlockNumber, wagmi useWatchContractEvent |
| W3J005 | web3.utils.* | 3 | viem utilities (isAddress, getAddress, toHex, keccak256, formatUnits, parseEther) |
| W3J006 | web3.eth RPC call | 3 | publicClient.getBalance / getGasPrice / getBlockNumber / estimateGas, walletClient.sendTransaction / signMessage |
| W3J001 | web3 import | 2 | import { ... } from 'viem' |
| ETH010 | ethers.constants | 2 | viem zeroAddress, zeroHash, maxUint256, 0n, 1n |
| W3J002 | new Web3() | 2 | createPublicClient / createWalletClient |
| W3J003 | web3.eth.Contract | 2 | getContract({ address, abi, client }) |
| ETH012 | callStatic / populateTransaction / estimateGas namespace | 2 | simulateContract / encodeFunctionData / estimateContractGas |
| ETH011 | tx.wait() / waitForTransaction | 2 | publicClient.waitForTransactionReceipt({ hash }) / wagmi useWaitForTransactionReceipt |
| W3J008 | getPastEvents | 2 | getContractEvents / getLogs |
| ETH016 | ethers error shape (err.reason) | 1 | viem BaseError: err.shortMessage (walk err.walk() for ContractFunctionRevertedError) |
| ETH005 | getSigner() | 1 | WalletClient (wagmi useWalletClient / getWalletClient) |
| ETH013 | ENS lookup via provider | 1 | publicClient.getEnsName / getEnsAddress, wagmi useEnsName |
| ETH003 | JsonRpcProvider / StaticJsonRpcProvider | 1 | createPublicClient({ chain, transport: http(url) }) / wagmi usePublicClient |
| ETH002 | Web3Provider (browser wallet) | 1 | wagmi useConnection/useWalletClient, or createWalletClient({ transport: custom(window.ethereum) }) |
| W3J004 | contract.methods.x().call/send | 1 | readContract / writeContract (or contract.read.x / contract.write.x) |
| ETH014 | signMessage via signer | 1 | walletClient.signMessage / signTypedData, wagmi useSignMessage |

## By file

| File | Findings |
| --- | --- |
| `lib/units.js` | 15 |
| `lib/erc20.js` | 12 |
| `lib/events.js` | 10 |
| `hooks/useWallet.js` | 8 |
| `lib/gas.js` | 7 |
| `lib/address.js` | 6 |
| `lib/clients.js` | 6 |
| `lib/signing.js` | 4 |
| `hooks/useErc20.js` | 3 |
| `components/TransferForm.jsx` | 1 |
