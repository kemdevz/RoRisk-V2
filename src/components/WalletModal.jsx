import { useMemo, useState } from 'react'
import SiteIcon from './Icons'
import { notify } from '../lib/Notifications'

const cashierScope = { 'data-v-00c8d34d': '', 'data-v-4a6f1d7d': '' }
const elementScope = { 'data-v-12940656': '' }
const vaultScope = { 'data-v-4a8e12ab': '' }
const redeemScope = { 'data-v-285f0390': '' }

const cryptoMethods = {
  deposit: [
    ['btc', 'Bitcoin', '/Methods/btc.79d4fc52.png'],
    ['eth', 'Ethereum', '/Methods/eth.png'],
    ['sol', 'Solana', '/Methods/solana.png'],
    ['ltc', 'Litecoin', '/Methods/ltc.png'],
    ['usdt', 'Tether', '/Methods/tether.png'],
    ['usdc', 'USDC', '/Methods/usdc.png'],
    ['bnb', 'BNB', '/Methods/bnb.png'],
    ['trx', 'Tron', '/Methods/trx.png'],
    ['xmr', 'Monero', '/Methods/xmr.png'],
  ],
  withdraw: [
    ['sol', 'Solana', '/Methods/solana.png'],
    ['ltc', 'Litecoin', '/Methods/ltc.png'],
    ['usdt', 'Tether', '/Methods/tether.png'],
  ],
}

function MethodCard({ method, label, image, onClick }) {
  return (
    <button className={`cashier-element element-${method}`} type="button" onClick={onClick} {...elementScope}>
      <div className="element-inner" {...elementScope}>
        <div className="inner-image" {...elementScope}><img src={image} alt="" {...elementScope} /></div>
        <div className="text-method" {...elementScope}>{label}</div>
      </div>
      <div className="element-glow" {...elementScope} />
    </button>
  )
}

function Vault({ user }) {
  const balance = Math.max(0, Number(user?.coins) || 0)
  const vaultBalance = Math.max(0, Number(user?.vault_amount ?? user?.vaultAmount) || 0)
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const icon = '/coin.svg'
  const fmt = (value) => Math.floor(value).toLocaleString('en-US')
  const setQuick = (type, ratio) => {
    const max = type === 'deposit' ? balance : vaultBalance
    const value = fmt(Math.floor(max * ratio))
    if (type === 'deposit') setDepositAmount(value)
    else setWithdrawAmount(value)
  }
  const unavailable = () => notify({ type: 'error', message: 'Vault services are currently unavailable.' })

  return (
    <div className="wallet-vault" {...vaultScope}>
      <div className="wallet-vault-header" {...vaultScope}><h2 {...vaultScope}>Vault</h2><div className="wallet-vault-status" {...vaultScope}><span {...vaultScope}>Unlocked</span></div></div>
      <div className="wallet-vault-balances" {...vaultScope}>
        <div className="vault-balance-box" {...vaultScope}><span {...vaultScope}>Wallet Balance</span><strong {...vaultScope}><img src={icon} alt="currency icon" {...vaultScope} /> {fmt(balance)}</strong></div>
        <div className="vault-balance-box" {...vaultScope}><span {...vaultScope}>Vault Balance</span><strong {...vaultScope}><img src={icon} alt="currency icon" {...vaultScope} /> {fmt(vaultBalance)}</strong></div>
      </div>
      <div className="wallet-vault-actions" {...vaultScope}>
        {[
          ['deposit', 'Deposit to Vault', depositAmount, setDepositAmount, balance, 'Deposit'],
          ['withdraw', 'Withdraw from Vault', withdrawAmount, setWithdrawAmount, vaultBalance, 'Withdraw'],
        ].map(([type, title, value, setter, max, action]) => (
          <div className="vault-action" key={type} {...vaultScope}>
            <h3 {...vaultScope}>{title}</h3>
            <div className="vault-input-container" {...vaultScope}>
              <div className="vault-input-wrap" {...vaultScope}>
                <img className="vault-input-icon" src={icon} alt="currency icon" {...vaultScope} />
                <input className="vault-input" type="text" inputMode="numeric" placeholder="0" value={value} onChange={(event) => setter(event.target.value.replace(/[^0-9,]/g, ''))} {...vaultScope} />
                <div className="vault-input-quick-actions" {...vaultScope}>
                  <button className="vault-quick-button" type="button" onClick={() => setQuick(type, 0.5)} {...vaultScope}>1/2</button>
                  <button className="vault-quick-button" type="button" onClick={() => setter(fmt(max))} {...vaultScope}>Max</button>
                </div>
              </div>
              <button className="vault-action-button" type="button" onClick={unavailable} {...vaultScope}>{action}</button>
            </div>
          </div>
        ))}
      </div>
      <div className="divider" {...vaultScope} />
      <div className="vault-lock-title" {...vaultScope}>Lock Vault</div>
      <div className="wallet-vault-lock-buttons" {...vaultScope}>{['1 Day', '3 Days', '7 Days'].map((label) => <button className="vault-lock-button" type="button" key={label} onClick={unavailable} {...vaultScope}>Lock {label}</button>)}</div>
    </div>
  )
}

function Redeem() {
  const [promoCode, setPromoCode] = useState('')
  const [affiliateCode, setAffiliateCode] = useState('')
  const apply = (value, kind) => notify({ type: 'error', message: value.trim() ? `${kind} services are currently unavailable.` : `Your entered ${kind.toLowerCase()} code is invalid.` })
  return <div className="wallet-redeem" {...redeemScope}><div className="redeem-content" {...redeemScope}>
    <div className="code-section" {...redeemScope}><h2 {...redeemScope}>Promo Code</h2><div className="referral-input-container" {...redeemScope}><input className="referral-input" type="text" placeholder="Enter a promo code..." value={promoCode} onChange={(event) => setPromoCode(event.target.value)} {...redeemScope} /><button className="referral-apply-button" type="button" onClick={() => apply(promoCode, 'Promo Code')} {...redeemScope}>Apply</button></div></div>
    <div className="divider" {...redeemScope} />
    <div className="code-section" {...redeemScope}><h2 {...redeemScope}>Affiliate Code</h2><div className="referral-input-container" {...redeemScope}><input className="referral-input" type="text" placeholder="Enter a affiliate code..." value={affiliateCode} onChange={(event) => setAffiliateCode(event.target.value)} {...redeemScope} /><button className="referral-apply-button" type="button" onClick={() => apply(affiliateCode, 'Affiliate Code')} {...redeemScope}>Apply</button></div></div>
  </div></div>
}

function RobuxFlow({ type, onBack }) {
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState('amount')
  const continueFlow = () => {
    if (!Number(amount.replace(/,/g, ''))) return notify({ type: 'error', message: 'Your entered amount is invalid.' })
    setStep('checking')
    window.setTimeout(() => setStep('unavailable'), 650)
  }
  return <div className="cashier-special" {...cashierScope}><button className="cashier-back" type="button" onClick={onBack} {...cashierScope}><SiteIcon name="back" {...cashierScope} /> Back</button><div className="crypto-header" {...cashierScope}><div className="header-text" {...cashierScope}>{type === 'deposit' ? 'Deposit Robux' : 'Withdraw Robux'}</div></div>{step === 'amount' ? <div className="cashier-special-step" {...cashierScope}><div className="cashier-special-title" {...cashierScope}>Amount of Robux</div><div className="cashier-special-input" {...cashierScope}><img src="/Methods/robux.2244c5eb.png" alt="" {...cashierScope} /><input type="text" inputMode="numeric" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9,]/g, ''))} {...cashierScope} /><div className="cashier-special-actions" {...cashierScope}><button type="button" onClick={() => setAmount(String(Math.max(0, Math.floor((Number(amount.replace(/,/g, '')) || 0) / 2))))} {...cashierScope}>1/2</button><button type="button" onClick={() => setAmount(String((Number(amount.replace(/,/g, '')) || 0) * 2))} {...cashierScope}>2x</button><button type="button" onClick={() => setAmount('0')} {...cashierScope}>Max</button></div></div><div className="cashier-special-exchange" {...cashierScope}><span {...cashierScope}><img src="/rocoin.2d3febd5.svg" alt="" {...cashierScope} />{Number(amount.replace(/,/g, '')) ? (Number(amount.replace(/,/g, '')) * 2).toLocaleString('en-US') : '0'}</span><b {...cashierScope}>=</b><span {...cashierScope}><img src="/Methods/robux.2244c5eb.png" alt="" {...cashierScope} />{amount || '0'}</span></div><button className="cashier-special-continue" type="button" onClick={continueFlow} {...cashierScope}>Continue</button></div> : <div className="cashier-status-step" {...cashierScope}>{step === 'checking' && <div className="content-loading-spinner" {...cashierScope} />}<h2 {...cashierScope}>{step === 'checking' ? 'Checking your purchase' : 'Cashier unavailable'}</h2><p {...cashierScope}>{step === 'checking' ? 'Checking your purchase, please wait...' : 'Robux transactions will be enabled when the cashier backend is connected.'}</p>{step === 'unavailable' && <button className="cashier-special-continue" type="button" onClick={() => setStep('amount')} {...cashierScope}>Try Again</button>}</div>}</div>
}

function LimitedsFlow({ onBack }) {
  const [username, setUsername] = useState('')
  const [checking, setChecking] = useState(false)
  const verify = () => {
    if (!username.trim()) return notify({ type: 'error', message: 'Please enter a Roblox username.' })
    setChecking(true)
    window.setTimeout(() => { setChecking(false); notify({ type: 'error', message: 'Limiteds services are currently unavailable.' }) }, 650)
  }
  return <div className="cashier-special" {...cashierScope}><button className="cashier-back" type="button" onClick={onBack} {...cashierScope}><SiteIcon name="back" {...cashierScope} /> Back</button><div className="crypto-header" {...cashierScope}><div className="header-text" {...cashierScope}>Deposit Limiteds</div></div>{checking ? <div className="cashier-status-step" {...cashierScope}><div className="content-loading-spinner" {...cashierScope} /><h2 {...cashierScope}>Verifying account</h2><p {...cashierScope}>Looking up this Roblox user, please wait...</p></div> : <div className="cashier-special-step" {...cashierScope}><p className="cashier-special-tip" {...cashierScope}>Tip: For the best experience, we recommend using a secondary or alt Roblox account dedicated to trading.</p><div className="cashier-special-title" {...cashierScope}>Roblox username</div><div className="cashier-special-verify" {...cashierScope}><div className="cashier-special-input" {...cashierScope}><input type="text" autoComplete="off" maxLength="20" placeholder="Enter username" value={username} onChange={(event) => setUsername(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') verify() }} {...cashierScope} /></div><button className="cashier-special-continue" type="button" onClick={verify} {...cashierScope}>Verify</button></div></div>}</div>
}

function WalletModal({ initialTab = 'deposit', user, onRequestClose }) {
  const [tab, setTab] = useState(initialTab)
  const [method, setMethod] = useState(null)
  const [conversion, setConversion] = useState('rocoins')
  const methods = useMemo(() => cryptoMethods[tab] || [], [tab])
  const chooseTab = (next) => { setMethod(null); setTab(next) }

  const openMarket = () => {
    onRequestClose?.()
    window.setTimeout(() => {
      window.history.pushState({}, '', '/market')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, 200)
  }

  return (
    <div className="modal-cashier" {...cashierScope}>
      <div className="cashier-content" {...cashierScope}>
        <div className="action-buttons" role="tablist" {...cashierScope}>
          {[['deposit', 'Deposit'], ['withdraw', 'Withdraw'], ['vault', 'Vault'], ['redeem', 'Redeem']].map(([key, label]) => <button className={`action-button${tab === key ? ' button-active' : ''}`} type="button" role="tab" aria-selected={tab === key} onClick={() => chooseTab(key)} key={key} {...cashierScope}><SiteIcon name={key === 'redeem' ? 'rewards' : key} className="action-button-icon" {...cashierScope} /><span {...cashierScope}>{label}</span></button>)}
        </div>
        <div className="cashier-stage" {...cashierScope}>
          {method === 'robux' ? <RobuxFlow type={tab} onBack={() => setMethod(null)} /> : method === 'limiteds' ? <LimitedsFlow onBack={() => setMethod(null)} /> : method ? <div className="cashier-method-detail" {...cashierScope}>
            <button className="cashier-back" type="button" onClick={() => setMethod(null)} {...cashierScope}><SiteIcon name="back" {...cashierScope} /> Back</button>
            <div className="crypto-header" {...cashierScope}><div className="header-text" {...cashierScope}>{tab === 'deposit' ? 'Deposit Crypto' : 'Withdraw Crypto'}</div></div>
            <div className="cashier-method-placeholder" {...cashierScope}><img src={method[2]} alt="" {...cashierScope} /><h2 {...cashierScope}>{tab === 'deposit' ? `Deposit ${method[1]}` : `Withdraw ${method[1]}`}</h2><p {...cashierScope}>This payment method will become available when the cashier backend is connected.</p></div>
          </div> : tab === 'deposit' || tab === 'withdraw' ? <div className="crypto-section" {...cashierScope}>
            <section className="cashier-block" {...cashierScope}><h2 className="cashier-block-title" {...cashierScope}>In-Game · <img className="cashier-block-currency-icon" src="/rocoin.2d3febd5.svg" alt="RoCoins" {...cashierScope} /></h2><div className="in-game-banners" {...cashierScope}><button className="game-banner game-banner--robux" type="button" onClick={() => setMethod('robux')} {...cashierScope}><span className="game-banner-title" {...cashierScope}>Robux</span><img className="game-banner-art" src="/Methods/robux.2244c5eb.png" alt="" {...cashierScope} /></button><button className="game-banner game-banner--limiteds" type="button" onClick={() => tab === 'deposit' ? setMethod('limiteds') : openMarket()} {...cashierScope}><span className="game-banner-title" {...cashierScope}>Limiteds</span><img className="game-banner-art game-banner-art--valk" src="/Methods/valk.3e69ac3a.png" alt="" {...cashierScope} /></button></div></section>
            <section className="cashier-block" {...cashierScope}><div className="cashier-block-heading" {...cashierScope}><h2 className="cashier-block-title" {...cashierScope}>Crypto · <img className="cashier-block-currency-icon" src="/coin.svg" alt="Coins" {...cashierScope} /></h2></div><div className="crypto-grid" {...cashierScope}>{methods.map((item) => <MethodCard key={item[0]} method={item[0]} label={item[1]} image={item[2]} onClick={() => setMethod(item)} />)}</div></section>
            {tab === 'deposit' && <section className="cashier-block cashier-block--conversion" {...cashierScope}><div className="conversion-heading" {...cashierScope}><h2 className="cashier-block-title" {...cashierScope}>Currency Conversion</h2><button className="conversion-switch" type="button" onClick={() => setConversion((value) => value === 'rocoins' ? 'coins' : 'rocoins')} {...cashierScope}>Switch to {conversion === 'rocoins' ? 'Coins' : 'RoCoins'}</button></div><div className="conversion-exchange" {...cashierScope}><div className="exchange-element" {...cashierScope}><div className="element-content" {...cashierScope}><img src={conversion === 'rocoins' ? '/rocoin.2d3febd5.svg' : '/coin.svg'} alt="" {...cashierScope} /><input value="1,000" readOnly aria-label={conversion === 'rocoins' ? 'RoCoins' : 'Coins'} {...cashierScope} /></div></div><span className="equals" {...cashierScope}>=</span><div className="exchange-element" {...cashierScope}><div className={`element-content${conversion === 'rocoins' ? ' element-robux' : ''}`} {...cashierScope}><img src={conversion === 'rocoins' ? '/Methods/rbx.62091f8a.png' : '/coin.svg'} alt="" {...cashierScope} /><input value={conversion === 'rocoins' ? '500' : '1.00'} readOnly aria-label={conversion === 'rocoins' ? 'Robux' : 'USD'} {...cashierScope} /></div></div></div></section>}
          </div> : tab === 'vault' ? <div className="vault-section" {...cashierScope}><Vault user={user} /></div> : <div className="redeem-section" {...cashierScope}><Redeem /></div>}
        </div>
      </div>
    </div>
  )
}

export default WalletModal
