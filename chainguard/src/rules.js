// Legacy Web3 API detection rules.
//
// Each rule matches one line of source. `replacement` is the viem/wagmi target that
// the migration playbook (docs/MIGRATION_PLAYBOOK.md) tells Bob to use.
// severity: "error" = must be migrated, "warning" = likely legacy, review manually.

export const RULES = [
  // ---------------------------------------------------------------- ethers v5
  {
    id: 'ETH001',
    lib: 'ethers-v5',
    severity: 'error',
    title: 'ethers import',
    pattern: /(from\s+['"]ethers(\/lib\/\w+)?['"]|require\(\s*['"]ethers['"]\s*\))/,
    replacement: "import { ... } from 'viem' (and 'wagmi' hooks in React)",
  },
  {
    id: 'ETH002',
    lib: 'ethers-v5',
    severity: 'error',
    title: 'Web3Provider (browser wallet)',
    pattern: /\bproviders\.Web3Provider\b|\bnew\s+Web3Provider\(/,
    replacement: 'wagmi useConnection/useWalletClient, or createWalletClient({ transport: custom(window.ethereum) })',
  },
  {
    id: 'ETH003',
    lib: 'ethers-v5',
    severity: 'error',
    title: 'JsonRpcProvider / StaticJsonRpcProvider',
    pattern: /\bproviders\.(Static)?JsonRpcProvider\b|\bnew\s+(Static)?JsonRpcProvider\(/,
    replacement: 'createPublicClient({ chain, transport: http(url) }) / wagmi usePublicClient',
  },
  {
    id: 'ETH004',
    lib: 'ethers-v5',
    severity: 'error',
    title: 'BigNumber',
    pattern: /\bBigNumber\.from\(|\bethers\.BigNumber\b|\bBigNumber\.isBigNumber\(/,
    replacement: 'native bigint (123n, BigInt(x))',
  },
  {
    id: 'ETH005',
    lib: 'ethers-v5',
    severity: 'error',
    title: 'getSigner()',
    pattern: /\.getSigner\(/,
    replacement: 'WalletClient (wagmi useWalletClient / getWalletClient)',
  },
  {
    id: 'ETH006',
    lib: 'ethers-v5',
    severity: 'error',
    title: 'ethers Contract instance',
    pattern: /new\s+(ethers\.)?Contract\(/,
    replacement: 'getContract({ address, abi, client }) or readContract/writeContract, wagmi useReadContract/useWriteContract',
  },
  {
    id: 'ETH007',
    lib: 'ethers-v5',
    severity: 'error',
    title: 'ethers.utils.*',
    pattern: /\bethers\.utils\.\w+|\butils\.(formatUnits|parseUnits|formatEther|parseEther|isAddress|getAddress|keccak256|toUtf8Bytes|hexlify|arrayify|solidityKeccak256|verifyMessage|id)\(/,
    replacement: 'viem formatUnits, parseUnits, formatEther, parseEther, isAddress, getAddress, keccak256, toHex, stringToBytes, verifyMessage',
  },
  {
    id: 'ETH008',
    lib: 'ethers-v5',
    severity: 'warning',
    title: 'BigNumber instance method',
    pattern: /\.(isZero|toNumber)\(\)|\.(mul|div|sub|gte|lte)\(\s*[\w.]+\s*\)/,
    replacement: 'bigint operators (*, /, -, >=, <=, === 0n, Number(x))',
  },
  {
    id: 'ETH009',
    lib: 'ethers-v5',
    severity: 'error',
    title: 'contract/provider event listener',
    pattern: /\.(on|once|off|removeAllListeners)\(\s*['"]([A-Z]\w*|block)['"]/,
    replacement: 'watchContractEvent / watchBlockNumber, wagmi useWatchContractEvent',
  },
  {
    id: 'ETH010',
    lib: 'ethers-v5',
    severity: 'error',
    title: 'ethers.constants',
    pattern: /\bconstants\.(AddressZero|HashZero|MaxUint256|Zero|One|WeiPerEther)\b/,
    replacement: 'viem zeroAddress, zeroHash, maxUint256, 0n, 1n',
  },
  {
    id: 'ETH011',
    lib: 'ethers-v5',
    severity: 'warning',
    title: 'tx.wait() / waitForTransaction',
    pattern: /\.wait\(\s*\d*\s*\)|\.waitForTransaction\(/,
    replacement: 'publicClient.waitForTransactionReceipt({ hash }) / wagmi useWaitForTransactionReceipt',
  },
  {
    id: 'ETH012',
    lib: 'ethers-v5',
    severity: 'error',
    title: 'callStatic / populateTransaction / estimateGas namespace',
    pattern: /\.(callStatic|populateTransaction)\.\w+|\.estimateGas\.\w+\(/,
    replacement: 'simulateContract / encodeFunctionData / estimateContractGas',
  },
  {
    id: 'ETH013',
    lib: 'ethers-v5',
    severity: 'error',
    title: 'ENS lookup via provider',
    pattern: /\.(lookupAddress|resolveName)\(/,
    replacement: 'publicClient.getEnsName / getEnsAddress, wagmi useEnsName',
  },
  {
    id: 'ETH014',
    lib: 'ethers-v5',
    severity: 'error',
    title: 'signMessage via signer',
    // ethers passes the message itself; viem's walletClient.signMessage takes an options object.
    pattern: /\bsigner\.signMessage\(\s*(?!\{)|\._signTypedData\(/,
    replacement: 'walletClient.signMessage / signTypedData, wagmi useSignMessage',
  },
  {
    id: 'ETH015',
    lib: 'ethers-v5',
    severity: 'warning',
    title: 'raw provider RPC (send / listAccounts / getNetwork)',
    pattern: /\.(listAccounts|getNetwork)\(\)|\.send\(\s*['"](eth|wallet)_\w+['"]/,
    replacement: 'walletClient.requestAddresses / getAddresses / getChainId / switchChain, wagmi useConnect / useChainId / useSwitchChain',
  },
  {
    id: 'ETH016',
    lib: 'ethers-v5',
    severity: 'warning',
    title: 'ethers error shape (err.reason)',
    pattern: /\b(err|error|e)\.reason\b/,
    replacement: 'viem BaseError: err.shortMessage (walk err.walk() for ContractFunctionRevertedError)',
  },

  // ---------------------------------------------------------------- web3.js
  {
    id: 'W3J001',
    lib: 'web3js',
    severity: 'error',
    title: 'web3 import',
    pattern: /from\s+['"]web3(-[\w-]+)?['"]|require\(\s*['"]web3(-[\w-]+)?['"]\s*\)/,
    replacement: "import { ... } from 'viem'",
  },
  {
    id: 'W3J002',
    lib: 'web3js',
    severity: 'error',
    title: 'new Web3()',
    pattern: /new\s+Web3\(/,
    replacement: 'createPublicClient / createWalletClient',
  },
  {
    id: 'W3J003',
    lib: 'web3js',
    severity: 'error',
    title: 'web3.eth.Contract',
    pattern: /\.eth\.Contract\(/,
    replacement: 'getContract({ address, abi, client })',
  },
  {
    id: 'W3J004',
    lib: 'web3js',
    severity: 'error',
    title: 'contract.methods.x().call/send',
    pattern: /\.methods\.\w+\(/,
    replacement: 'readContract / writeContract (or contract.read.x / contract.write.x)',
  },
  {
    id: 'W3J005',
    lib: 'web3js',
    severity: 'error',
    title: 'web3.utils.*',
    pattern: /\b[Ww]eb3\.utils\.\w+/,
    replacement: 'viem utilities (isAddress, getAddress, toHex, keccak256, formatUnits, parseEther)',
  },
  {
    id: 'W3J006',
    lib: 'web3js',
    severity: 'error',
    title: 'web3.eth RPC call',
    pattern: /\.eth\.(get\w+|sendTransaction|estimateGas|sign|call|personal\.\w+)\(/,
    replacement: 'publicClient.getBalance / getGasPrice / getBlockNumber / estimateGas, walletClient.sendTransaction / signMessage',
  },
  {
    id: 'W3J007',
    lib: 'web3js',
    severity: 'error',
    title: 'contract.events subscription',
    pattern: /\.events\.\w+\(/,
    replacement: 'watchContractEvent, wagmi useWatchContractEvent',
  },
  {
    id: 'W3J008',
    lib: 'web3js',
    severity: 'error',
    title: 'getPastEvents',
    pattern: /\.getPastEvents\(/,
    replacement: 'getContractEvents / getLogs',
  },
  {
    id: 'W3J009',
    lib: 'web3js',
    severity: 'warning',
    title: 'currentProvider / givenProvider',
    pattern: /\.(currentProvider|givenProvider)\b/,
    replacement: 'viem transports: custom(window.ethereum), http(url)',
  },
]

export const RULES_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r]))

// A rule pack describes one migration: what it moves from and to, the playbook Bob follows, and
// the detection rules. The Web3 pack above is the default; any other migration is a JSON file:
//   { "name", "from", "to", "playbook", "rules": [{ "id", "lib", "severity", "title",
//     "pattern" (regex source), "flags"?, "replacement" }] }
// Known traps (docs/MIGRATION_PLAYBOOK.md), keyed by the rule that brings a block into contact with
// them. The planner puts the relevant ones straight into each block's prompt.
export const TRAPS = {
  ETH007: [
    "viem's parseUnits silently rounds extra decimals where ethers and web3 threw: check the fraction length against decimals and throw yourself.",
    'formatUnits needs a bigint: formatUnits(BigInt(raw), decimals).',
  ],
  W3J005: [
    "viem's parseUnits silently rounds extra decimals where ethers and web3 threw: check the fraction length against decimals and throw yourself.",
    'isAddress is checksum-strict for mixed case: isAddress(x, { strict: false }) keeps the old leniency.',
  ],
  ETH014: ['recoverMessageAddress is async: recoverSigner becomes async (callers already await it).'],
  ETH006: ["Receipt status is 'success' / 'reverted', not 1 / 0; a revert reason is err.shortMessage || err.message."],
  ETH009: ['watchContractEvent delivers a batch: onLogs(logs), read log.args.{from,to,value}; blockNumber is a bigint (Number() for UI objects).'],
  W3J007: ['watchContractEvent delivers a batch: onLogs(logs), read log.args.{from,to,value}; blockNumber is a bigint (Number() for UI objects).'],
  W3J008: ['getContractEvents returns bigint blockNumber: use bigint math for ranges, Number() for UI objects.'],
  W3J006: ['Gas price and balances come back as bigint, not strings.'],
}

export const DEFAULT_PACK = withIndex({
  name: 'web3-to-viem',
  from: 'ethers v5 / web3.js',
  to: 'viem + wagmi',
  playbook: 'docs/MIGRATION_PLAYBOOK.md',
  rules: RULES,
  traps: TRAPS,
})

function withIndex(pack) {
  return { ...pack, byId: Object.fromEntries(pack.rules.map((r) => [r.id, r])) }
}

export function compilePack(json, source = 'rule pack') {
  for (const k of ['name', 'from', 'to', 'playbook']) if (typeof json[k] !== 'string' || !json[k]) throw new Error(`${source}: "${k}" is required`)
  if (!Array.isArray(json.rules) || !json.rules.length) throw new Error(`${source}: "rules" must be a non-empty array`)
  const seen = new Set()
  const rules = json.rules.map((r, i) => {
    for (const k of ['id', 'title', 'pattern', 'replacement']) if (typeof r[k] !== 'string' || !r[k]) throw new Error(`${source}: rules[${i}].${k} is required`)
    if (seen.has(r.id)) throw new Error(`${source}: duplicate rule id ${r.id}`)
    seen.add(r.id)
    let pattern
    try {
      pattern = new RegExp(r.pattern, (r.flags || '').replace(/g/g, ''))
    } catch (err) {
      throw new Error(`${source}: rules[${i}] (${r.id}) has an invalid pattern: ${err.message}`)
    }
    return { id: r.id, lib: r.lib || json.name, severity: r.severity === 'warning' ? 'warning' : 'error', title: r.title, pattern, replacement: r.replacement }
  })
  const traps = Object.fromEntries(Object.entries(json.traps || {}).map(([id, t]) => [id, [].concat(t).map(String)]))
  return withIndex({ name: json.name, from: json.from, to: json.to, playbook: json.playbook, rules, traps })
}
