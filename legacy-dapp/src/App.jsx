import { useWallet } from './hooks/useWallet.js'
import { useErc20 } from './hooks/useErc20.js'
import { WalletPanel } from './components/WalletPanel.jsx'
import { TransferForm } from './components/TransferForm.jsx'
import { SignMessage } from './components/SignMessage.jsx'
import { ActivityFeed } from './components/ActivityFeed.jsx'
import { ERC20_ADDRESS } from './config.js'

export default function App() {
  const wallet = useWallet()
  const erc20 = useErc20(ERC20_ADDRESS, wallet.account)
  return (
    <main>
      <header>
        <h1>ChainGuard Wallet</h1>
        <p className="muted">ERC-20 wallet on Sepolia · stack: ethers v5 + web3.js 1.x</p>
      </header>
      <div className="grid">
        <WalletPanel wallet={wallet} erc20={erc20} />
        <TransferForm wallet={wallet} erc20={erc20} contractAddress={ERC20_ADDRESS} />
        <SignMessage wallet={wallet} />
        <ActivityFeed account={wallet.account} contractAddress={ERC20_ADDRESS} meta={erc20.meta} />
      </div>
    </main>
  )
}
