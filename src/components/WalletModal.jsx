import { useEffect, useMemo, useState } from 'react'
import SiteIcon from './Icons'
import { notify } from '../lib/Notifications'

const cashierScope = { 'data-v-00c8d34d': '', 'data-v-4a6f1d7d': '' }
const elementScope = { 'data-v-12940656': '' }
const vaultScope = { 'data-v-4a8e12ab': '' }
const redeemScope = { 'data-v-285f0390': '' }
const cryptoModalScope = { 'data-v-910993c8': '' }
const cryptoDepositScope = { 'data-v-bcfd5424': '' }
const cryptoWithdrawScope = { 'data-v-060d18fa': '' }
const robuxModalScope = { 'data-v-f788d450': '' }
const robuxDepositScope = { 'data-v-0559baa4': '' }
const limitedModalScope = { 'data-v-8813ba3e': '' }
const limitedDepositScope = { 'data-v-85a7adf0': '' }

const cryptoDetails = {
  btc: { name: 'Bitcoin', network: 'BTC', address: 'PLACEHOLDER-BTC-ADDRESS-NOT-FOR-PAYMENTS' },
  eth: { name: 'Ethereum', network: 'ETH', address: 'PLACEHOLDER-ETH-ADDRESS-NOT-FOR-PAYMENTS' },
  sol: { name: 'Solana', network: 'SOL', address: 'PLACEHOLDER-SOL-ADDRESS-NOT-FOR-PAYMENTS' },
  ltc: { name: 'Litecoin', network: 'LTC', address: 'PLACEHOLDER-LTC-ADDRESS-NOT-FOR-PAYMENTS' },
  usdt: { name: 'Tether', network: 'ERC-20', address: 'PLACEHOLDER-USDT-ERC20-ADDRESS-NOT-FOR-PAYMENTS' },
  usdc: { name: 'USDC', network: 'ERC-20', address: 'PLACEHOLDER-USDC-ERC20-ADDRESS-NOT-FOR-PAYMENTS' },
  bnb: { name: 'BNB', network: 'BEP-20', address: 'PLACEHOLDER-BNB-BEP20-ADDRESS-NOT-FOR-PAYMENTS' },
  trx: { name: 'Tron', network: 'TRC-20', address: 'PLACEHOLDER-TRX-TRC20-ADDRESS-NOT-FOR-PAYMENTS' },
  xmr: { name: 'Monero', network: 'XMR', address: 'PLACEHOLDER-XMR-ADDRESS-NOT-FOR-PAYMENTS' },
}

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

function CopyIcon(props) {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M15.4567 1.6667H7.87683C6.29075 1.6667 5.00008 2.95737 5.00008 4.54345V5.00004H4.5435C2.95741 5.00004 1.66675 6.2907 1.66675 7.87679V15.4565C1.66675 17.0427 2.95741 18.3334 4.5435 18.3334H12.1232C13.5803 18.3334 14.7751 17.2402 14.9619 15.8334H15.4566C17.0427 15.8334 18.3334 14.5427 18.3334 12.9566V4.54345C18.3334 2.95737 17.0427 1.6667 15.4567 1.6667ZM16.6667 12.9566C16.6667 13.6239 16.1239 14.1667 15.4567 14.1667H15.0001V7.87679C15.0001 6.2907 13.7094 5.00004 12.1233 5.00004H6.66675V4.54345C6.66675 3.8762 7.20958 3.33337 7.87683 3.33337H15.4566C16.1239 3.33337 16.6667 3.8762 16.6667 4.54345V12.9566Z" fill="currentColor" /></svg>
}

function WarningIcon(props) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path d="M12 3 2.6 20h18.8L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M12 9v5M12 17.3v.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
}

function TimerIcon(props) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="2" /><path d="M9 2h6M12 5v2M12 13l3-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
}

function SuccessIcon(props) {
  return <svg viewBox="0 0 22 22" fill="none" aria-hidden="true" {...props}><rect width="22" height="22" rx="6" fill="currentColor" /><path d="m6.5 11.2 3 3 6-6" stroke="#1c3144" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function ExternalIcon(props) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path d="M14 3h7v7M10 14 21 3M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function PlaceholderQr() {
  const cells = []
  for (let y = 0; y < 21; y += 1) {
    for (let x = 0; x < 21; x += 1) {
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)
      const finderPixel = finder && ((x % 7 === 0 || x % 7 === 6 || y % 7 === 0 || y % 7 === 6) || (x % 7 >= 2 && x % 7 <= 4 && y % 7 >= 2 && y % 7 <= 4))
      const dataPixel = !finder && ((x * 3 + y * 5 + x * y) % 7 < 3)
      if (finderPixel || dataPixel) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)
    }
  }
  return <svg className="placeholder-qr" viewBox="0 0 21 21" role="img" aria-label="Placeholder QR code"><rect width="21" height="21" fill="#fff" /><g fill="#101820">{cells}</g></svg>
}

function formatInteger(value) {
  const parsed = Math.max(0, Math.floor(Number(String(value).replace(/,/g, '')) || 0))
  return parsed.toLocaleString('en-US')
}

function CryptoDeposit({ method, user }) {
  const currency = method[0]
  const detail = cryptoDetails[currency]
  const [coins, setCoins] = useState('1,000')
  const [crypto, setCrypto] = useState('0.00000000')
  const [usd, setUsd] = useState('1.00')
  const [bonus, setBonus] = useState('')
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(detail.address)
      notify({ type: 'success', message: 'Copied to your clipboard.' })
    } catch {
      notify({ type: 'error', message: 'Failed to copy.' })
    }
  }
  const fromCoins = (value) => {
    const cleaned = value.replace(/[^\d]/g, '')
    setCoins(cleaned)
    setUsd(((Number(cleaned) || 0) / 1000).toFixed(2))
    setCrypto('0.00000000')
  }
  const fromUsd = (value) => {
    const cleaned = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
    setUsd(cleaned)
    setCoins(String(Math.round((Number(cleaned) || 0) * 1000)))
    setCrypto('0.00000000')
  }
  return <div className="modal-crypto" {...cryptoModalScope}>
    <div className="crypto-content" {...cryptoModalScope}>
      <div className="crypto-header" {...cryptoModalScope}><div className="header-text" {...cryptoModalScope}>Deposit Crypto</div></div>
      <div className="cashier-crypto-deposit" {...cryptoDepositScope}>
        <div className="deposit-header" {...cryptoDepositScope}><div className="header-icon" {...cryptoDepositScope}><img src={method[2]} alt="crypto icon" {...cryptoDepositScope} /></div><div className="header-text" {...cryptoDepositScope}><div className="header-title" {...cryptoDepositScope}>Deposit {detail.name}</div><div className="header-price" {...cryptoDepositScope}>$0.00</div></div></div>
        <div className="deposit-card" {...cryptoDepositScope}>
          <div className="card-qrcode" {...cryptoDepositScope}><div className="qrcode-content" {...cryptoDepositScope}><PlaceholderQr /></div></div>
          <div className="card-info" {...cryptoDepositScope}><div className="info-instructions" {...cryptoDepositScope}>Send the amount of {detail.name} of your choice to the following address to receive the equivalent in Coins. Only send through the {detail.network} network to this address.</div><div className="info-address" {...cryptoDepositScope}><div className="address-label" {...cryptoDepositScope}>Your personal {detail.name} deposit address:</div><div className="address-input" {...cryptoDepositScope}><div className="input-content" {...cryptoDepositScope}><input type="text" readOnly value={detail.address} aria-label={`${detail.name} placeholder deposit address`} {...cryptoDepositScope} /><button className="button-copy" type="button" title="Copy to clipboard" onClick={copyAddress} {...cryptoDepositScope}><CopyIcon {...cryptoDepositScope} /></button></div></div></div></div>
        </div>
        {user && <div className="deposit-bonus" {...cryptoDepositScope}><div className="bonus-title-row" {...cryptoDepositScope}><span className="bonus-title" {...cryptoDepositScope}>Deposit Bonus Code</span></div><div className="bonus-row" {...cryptoDepositScope}><div className="bonus-input-wrap" {...cryptoDepositScope}><input type="text" placeholder="Enter code" maxLength="32" value={bonus} onChange={(event) => setBonus(event.target.value)} {...cryptoDepositScope} /></div><button className="bonus-apply-button" type="button" disabled={!bonus.trim()} onClick={() => notify({ type: 'error', message: 'Your entered deposit bonus code is invalid.' })} {...cryptoDepositScope}>Apply</button></div></div>}
        <div className="deposit-exchange" {...cryptoDepositScope}><div className="exchange-title" {...cryptoDepositScope}>Exchange</div><div className="exchange-content" {...cryptoDepositScope}><div className="exchange-element" {...cryptoDepositScope}><div className="element-content" {...cryptoDepositScope}><img src="/coin.svg" alt="icon" {...cryptoDepositScope} /><input type="text" inputMode="numeric" placeholder="0" value={coins} onChange={(event) => fromCoins(event.target.value)} onBlur={() => setCoins(formatInteger(coins))} {...cryptoDepositScope} /></div></div><span className="equals" {...cryptoDepositScope}>=</span><div className="exchange-element" {...cryptoDepositScope}><div className="element-content" {...cryptoDepositScope}><img src={method[2]} alt="" {...cryptoDepositScope} /><input type="text" placeholder="0" value={crypto} readOnly {...cryptoDepositScope} /></div></div><span className="equals" {...cryptoDepositScope}>=</span><div className="exchange-element" {...cryptoDepositScope}><div className="element-content element-usd" {...cryptoDepositScope}><div className="usd-icon" {...cryptoDepositScope}><img src="/usd.4027001f.svg" alt="USD icon" {...cryptoDepositScope} /></div><input type="text" inputMode="decimal" placeholder="0.00" value={usd} onChange={(event) => fromUsd(event.target.value)} onBlur={() => setUsd((Number(usd) || 0).toFixed(2))} {...cryptoDepositScope} /></div></div></div></div>
      </div>
    </div>
  </div>
}

function CryptoWithdraw({ method }) {
  const currency = method[0]
  const detail = cryptoDetails[currency]
  const [address, setAddress] = useState('')
  const [coins, setCoins] = useState('0')
  const [usd, setUsd] = useState('0.00')
  const fromCoins = (value) => {
    const cleaned = value.replace(/[^\d]/g, '')
    setCoins(cleaned)
    setUsd(((Number(cleaned) || 0) / 1000).toFixed(2))
  }
  const fromUsd = (value) => {
    const cleaned = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').replace(/^(\d*\.\d{0,2}).*$/, '$1')
    setUsd(cleaned)
    setCoins(String(Math.round((Number(cleaned) || 0) * 1000)))
  }
  const submit = () => {
    if (!address.trim()) return notify({ type: 'error', message: `You need to enter a valid ${currency.toUpperCase()} withdraw address.` })
    if ((Number(String(coins).replace(/,/g, '')) || 0) < 10000) return notify({ type: 'error', message: 'Minimum withdrawal amount is $10.00 USD.' })
    notify({ type: 'error', message: 'Crypto withdrawals will be enabled when the cashier backend is connected.' })
  }
  return <div className="modal-crypto" {...cryptoModalScope}>
    <div className="crypto-content" {...cryptoModalScope}>
      <div className="crypto-header" {...cryptoModalScope}><div className="header-text" {...cryptoModalScope}>Withdraw Crypto</div></div>
      <div className="cashier-crypto-withdraw" {...cryptoWithdrawScope}>
        <div className="withdraw-header" {...cryptoWithdrawScope}><div className="header-icon" {...cryptoWithdrawScope}><img src={method[2]} alt="crypto icon" {...cryptoWithdrawScope} /></div><div className="header-text" {...cryptoWithdrawScope}><div className="header-title" {...cryptoWithdrawScope}>Withdraw {detail.name}</div><div className="header-price" {...cryptoWithdrawScope}>$0.00</div></div></div>
        <div className="withdraw-content" {...cryptoWithdrawScope}><div className="withdraw-address" {...cryptoWithdrawScope}><div className="address-inner" {...cryptoWithdrawScope}><div className="inner-title" {...cryptoWithdrawScope}>Withdraw Address</div><p {...cryptoWithdrawScope}>This action may be irreversible. Please ensure the provided information is correct.</p></div><input type="text" placeholder="Enter your wallet address..." value={address} onChange={(event) => setAddress(event.target.value)} {...cryptoWithdrawScope} /></div><div className="withdraw-amount" {...cryptoWithdrawScope}><p {...cryptoWithdrawScope}>Enter the amount of Coins you would like to withdraw. The network fees will be deducted from your withdraw amount.</p><p {...cryptoWithdrawScope}>Minimum withdrawal amount: <span {...cryptoWithdrawScope}>$10.00 USD</span>.</p><div className="amount-inputs" {...cryptoWithdrawScope}><div className="inputs-element" {...cryptoWithdrawScope}><div className="element-content" {...cryptoWithdrawScope}><img src="/coin.svg" alt="icon" {...cryptoWithdrawScope} /><input type="text" inputMode="numeric" value={coins} onChange={(event) => fromCoins(event.target.value)} onBlur={() => setCoins(formatInteger(coins))} {...cryptoWithdrawScope} /></div></div><span {...cryptoWithdrawScope}>=</span><div className="inputs-element" {...cryptoWithdrawScope}><div className="element-content" {...cryptoWithdrawScope}><div className="usd-icon" {...cryptoWithdrawScope}><img src="/usd.4027001f.svg" alt="USD icon" {...cryptoWithdrawScope} /></div><input className="input-usd" type="text" inputMode="decimal" value={usd} onChange={(event) => fromUsd(event.target.value)} onBlur={() => setUsd((Number(usd) || 0).toFixed(2))} {...cryptoWithdrawScope} /></div></div></div><button className="button-withdraw" type="button" onClick={submit} {...cryptoWithdrawScope}><div className="button-inner" {...cryptoWithdrawScope}><div className="inner-content" {...cryptoWithdrawScope}>Confirm Withdraw</div></div></button></div></div>
      </div>
    </div>
  </div>
}

function RobuxDeposit({ user }) {
  const [amount, setAmount] = useState('100')
  const [step, setStep] = useState('amount')
  const [secondsLeft, setSecondsLeft] = useState(600)
  const numberAmount = Math.max(0, Math.floor(Number(amount.replace(/,/g, '')) || 0))
  const hasVerifiedRoblox = Boolean(user?.roblox_id || user?.robloxId)
  const username = user?.username || 'this Roblox account'
  useEffect(() => {
    if (step !== 'purchase' && step !== 'placeCheck') return undefined
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [step])
  const startDeposit = () => {
    if (!hasVerifiedRoblox || numberAmount < 7) return
    setStep('checking')
    window.setTimeout(() => setStep('purchase'), 500)
  }
  const countdown = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`
  const unavailable = () => notify({ type: 'error', message: 'Robux deposits will be enabled when the cashier backend is connected.' })
  return <div className="modal-robux" {...robuxModalScope}><div className="robux-content" {...robuxModalScope}>
    <div className="robux-header" {...robuxModalScope}><div className="header-text-wrap" {...robuxModalScope}><div className="header-text" {...robuxModalScope}>Deposit Robux</div></div></div>
    <div className="wallet-robux-deposit" {...robuxDepositScope}>
      {step === 'amount' && <div className="deposit-step wallet-flow-step" {...robuxDepositScope}><div className="deposit-section" {...robuxDepositScope}><div className="section-title" {...robuxDepositScope}>Amount of Robux</div><div className="tip-input" {...robuxDepositScope}><img className="tip-icon" src="/Methods/rbx.62091f8a.png" alt="" {...robuxDepositScope} /><input className="tip-amount-display" type="text" inputMode="numeric" autoComplete="off" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d,]/g, ''))} onBlur={() => setAmount(formatInteger(amount))} {...robuxDepositScope} /><div className="tip-actions-buttons" {...robuxDepositScope}><button type="button" onClick={() => setAmount(formatInteger(Math.floor(numberAmount / 2)))} {...robuxDepositScope}>1/2</button><button type="button" onClick={() => setAmount(formatInteger(numberAmount * 2))} {...robuxDepositScope}>2x</button><button type="button" onClick={() => setAmount('10,000')} {...robuxDepositScope}>Max</button></div></div></div><div className="amount-inputs" {...robuxDepositScope}><div className="inputs-element" {...robuxDepositScope}><div className="element-content" {...robuxDepositScope}><img src="/rocoin.2d3febd5.svg" alt="" {...robuxDepositScope} /><input type="text" readOnly tabIndex="-1" value={formatInteger(numberAmount * 2)} {...robuxDepositScope} /></div></div><span className="equals" {...robuxDepositScope}>=</span><div className="inputs-element" {...robuxDepositScope}><div className="element-content" {...robuxDepositScope}><img src="/Methods/rbx.62091f8a.png" alt="" {...robuxDepositScope} /><input type="text" readOnly tabIndex="-1" value={formatInteger(numberAmount)} {...robuxDepositScope} /></div></div></div>{!hasVerifiedRoblox && <div className="deposit-meta" {...robuxDepositScope}><p className="error-message" {...robuxDepositScope}>Link and verify your Roblox account before depositing Robux.</p></div>}<button className="button-withdraw" type="button" disabled={!hasVerifiedRoblox || numberAmount < 7} onClick={startDeposit} {...robuxDepositScope}><div className="button-inner" {...robuxDepositScope}><div className="inner-content" {...robuxDepositScope}>Continue</div></div></button></div>}
      {step === 'checking' && <div className="deposit-step status-step wallet-flow-step" {...robuxDepositScope}><div className="status-icon checking" {...robuxDepositScope}><div className="status-spinner" {...robuxDepositScope} /></div><div className="status-title" {...robuxDepositScope}>Checking your purchase</div><p className="status-copy" {...robuxDepositScope}>Checking your purchase, please wait...</p></div>}
      {(step === 'purchase' || step === 'placeCheck') && <div className={`deposit-step session-panel wallet-flow-step${step === 'placeCheck' ? ' place-check' : ''}`} {...robuxDepositScope}>{step === 'purchase' ? <><div className="session-copy-block" {...robuxDepositScope}><div className="section-title" {...robuxDepositScope}>Purchase this gamepass to continue</div><p className="session-copy muted" {...robuxDepositScope}>Coins are credited automatically after the purchase is detected.</p></div><div className="expiry-notice" {...robuxDepositScope}><TimerIcon className="expiry-icon" {...robuxDepositScope} /><span {...robuxDepositScope}>Expires in: <strong {...robuxDepositScope}>{countdown}</strong></span></div><div className="warning-stack" {...robuxDepositScope}><div className="warning-box" {...robuxDepositScope}><WarningIcon className="warning-icon" {...robuxDepositScope} /><span {...robuxDepositScope}>If you have purchased the gamepass, <strong {...robuxDepositScope}>do not delete it</strong> until your coins are credited.</span></div><div className="warning-box" {...robuxDepositScope}><WarningIcon className="warning-icon" {...robuxDepositScope} /><span {...robuxDepositScope}>Only buy this gamepass with <strong {...robuxDepositScope}>{username}</strong>.</span></div></div><div className="pass-details" {...robuxDepositScope}><div className="pass-row" {...robuxDepositScope}><span className="pass-label" {...robuxDepositScope}>Gamepass</span><span className="pass-value" {...robuxDepositScope}>Deposit Gamepass</span></div><div className="pass-row" {...robuxDepositScope}><span className="pass-label" {...robuxDepositScope}>Price</span><span className="pass-value receive" {...robuxDepositScope}><img src="/Methods/rbx.62091f8a.png" alt="" {...robuxDepositScope} /> {formatInteger(numberAmount)}</span></div><div className="pass-row" {...robuxDepositScope}><span className="pass-label" {...robuxDepositScope}>You'll receive</span><span className="pass-value receive" {...robuxDepositScope}><img src="/rocoin.2d3febd5.svg" alt="" {...robuxDepositScope} /> {formatInteger(numberAmount * 2)}</span></div></div><button className="button-withdraw session-link" type="button" onClick={unavailable} {...robuxDepositScope}><div className="button-inner" {...robuxDepositScope}><div className="inner-content" {...robuxDepositScope}><span {...robuxDepositScope}>Open Gamepass Page</span><ExternalIcon className="external-icon" {...robuxDepositScope} /></div></div></button><button className="button-outline" type="button" onClick={() => setStep('placeCheck')} {...robuxDepositScope}><div className="button-inner" {...robuxDepositScope}><div className="inner-content" {...robuxDepositScope}>I'm getting '404 | Page Not found'</div></div></button><div className="session-actions" {...robuxDepositScope}><button className="button-secondary" type="button" onClick={() => setStep('amount')} {...robuxDepositScope}><div className="button-inner" {...robuxDepositScope}><div className="inner-content" {...robuxDepositScope}>Cancel</div></div></button><button className="button-withdraw" type="button" onClick={unavailable} {...robuxDepositScope}><div className="button-inner" {...robuxDepositScope}><div className="inner-content" {...robuxDepositScope}>I've bought it</div></div></button></div></> : <><div className="session-copy-block" {...robuxDepositScope}><div className="section-title" {...robuxDepositScope}>Check the place page</div><p className="session-copy muted" {...robuxDepositScope}>Newly created gamepasses can briefly 404. Open the place URL and confirm you can play and see the gamepass under the Store tab.</p></div><div className="expiry-notice compact" {...robuxDepositScope}><TimerIcon className="expiry-icon" {...robuxDepositScope} /><span {...robuxDepositScope}>Expires in: <strong {...robuxDepositScope}>{countdown}</strong></span></div><div className="steps-card" {...robuxDepositScope}><div className="step-row" {...robuxDepositScope}><div className="step-num" {...robuxDepositScope}>1</div><div className="step-body" {...robuxDepositScope}><div className="step-title" {...robuxDepositScope}>Open the place URL</div><p className="step-text" {...robuxDepositScope}>Use the Roblox place page for this deposit, not the 404 gamepass page.</p><p className="step-text warn" {...robuxDepositScope}>Place URL unavailable — the cashier backend has not been connected.</p></div></div><div className="step-row" {...robuxDepositScope}><div className="step-num" {...robuxDepositScope}>2</div><div className="step-body" {...robuxDepositScope}><div className="step-title" {...robuxDepositScope}>Open the Store tab</div><p className="step-text" {...robuxDepositScope}>Find the deposit gamepass, then return here after purchasing it.</p></div></div></div><div className="session-actions place-actions" {...robuxDepositScope}><button className="button-secondary" type="button" onClick={() => setStep('purchase')} {...robuxDepositScope}><div className="button-inner" {...robuxDepositScope}><div className="inner-content" {...robuxDepositScope}>Back</div></div></button><button className="button-withdraw" type="button" onClick={unavailable} {...robuxDepositScope}><div className="button-inner" {...robuxDepositScope}><div className="inner-content" {...robuxDepositScope}>I've bought it</div></div></button></div></>}</div>}
    </div>
  </div></div>
}

function LimitedsDeposit({ user }) {
  const [username, setUsername] = useState('')
  const [step, setStep] = useState('scan')
  const verify = () => {
    if (!username.trim()) return notify({ type: 'error', message: 'Please enter a Roblox username.' })
    setStep('checking')
    window.setTimeout(() => setStep('confirm'), 500)
  }
  const avatar = username.trim().toLowerCase() === String(user?.username || '').toLowerCase() ? (user?.avatar_headshot || user?.avatar || '/default-avatar.png') : '/default-avatar.png'
  const button = (label, props = {}) => <button className="button-withdraw" type="button" {...props} {...limitedDepositScope}><div className="button-inner" {...limitedDepositScope}><div className="inner-content" {...limitedDepositScope}>{label}</div></div></button>
  const usernameEntry = <><p className="session-copy muted tip-copy" {...limitedDepositScope}>Tip: For the best experience, we recommend using a secondary or alt Roblox account dedicated to trading.</p><div className="deposit-section" {...limitedDepositScope}><div className="section-title" {...limitedDepositScope}>Roblox username</div><div className="verify-row" {...limitedDepositScope}><div className="tip-input" {...limitedDepositScope}><input className="username-input" type="text" autoComplete="off" maxLength="20" placeholder="Enter username" value={username} onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} onKeyDown={(event) => { if (event.key === 'Enter') verify() }} {...limitedDepositScope} /></div><button className="button-withdraw verify-btn" type="button" disabled={!username.trim()} onClick={verify} {...limitedDepositScope}><div className="button-inner" {...limitedDepositScope}><div className="inner-content" {...limitedDepositScope}>Verify</div></div></button></div></div></>
  return <div className="modal-limiteds" {...limitedModalScope}><div className="limiteds-content" {...limitedModalScope}>
    <div className="limiteds-header" {...limitedModalScope}><div className="header-text-wrap" {...limitedModalScope}><div className="header-text" {...limitedModalScope}>Deposit Limiteds</div></div></div>
    <div className="wallet-limited-deposit" {...limitedDepositScope}>
      {step === 'scan' && <div className="deposit-step wallet-flow-step" {...limitedDepositScope}>{usernameEntry}</div>}
      {step === 'checking' && <div className="deposit-step status-step wallet-flow-step" {...limitedDepositScope}><div className="status-icon checking" {...limitedDepositScope}><div className="status-spinner" {...limitedDepositScope} /></div><div className="status-title" {...limitedDepositScope}>Verifying account</div><p className="status-copy" {...limitedDepositScope}>Looking up this Roblox user, please wait...</p></div>}
      {step === 'confirm' && <div className="deposit-step wallet-flow-step" {...limitedDepositScope}>{usernameEntry}<div className="confirm-card" {...limitedDepositScope}><div className="confirm-label" {...limitedDepositScope}>Is this you?</div><div className="confirm-user" {...limitedDepositScope}><img className="confirm-avatar" src={avatar} alt={username} {...limitedDepositScope} /><div className="confirm-user-text" {...limitedDepositScope}><div className="confirm-display" {...limitedDepositScope}>{username}</div><div className="confirm-handle" {...limitedDepositScope}>@{username}</div></div></div></div><div className="requirements-card" {...limitedDepositScope}><div className="confirm-label" {...limitedDepositScope}>Requirements</div><div className="requirement-row ok" {...limitedDepositScope}><SuccessIcon className="requirement-icon" {...limitedDepositScope} /><span {...limitedDepositScope}>Inventory public</span></div><div className="requirement-row ok" {...limitedDepositScope}><SuccessIcon className="requirement-icon" {...limitedDepositScope} /><span {...limitedDepositScope}>Trades enabled</span></div></div>{button('Continue', { onClick: () => setStep('pick') })}</div>}
      {step === 'pick' && <div className="deposit-step wallet-flow-step" {...limitedDepositScope}><div className="deposit-section" {...limitedDepositScope}><div className="section-title" {...limitedDepositScope}>Select limiteds to deposit</div><p className="session-copy muted" {...limitedDepositScope}>Choose up to 4 eligible items. Quotes expire after 30 minutes.</p></div><div className="pass-details quote-summary" {...limitedDepositScope}><div className="pass-row" {...limitedDepositScope}><span className="pass-label" {...limitedDepositScope}>Offer</span><span className="pass-value receive dual-amount" {...limitedDepositScope}><span className="amount-part" {...limitedDepositScope}><img src="/rocoin.2d3febd5.svg" alt="" {...limitedDepositScope} /> 0</span><span className="amount-part usd" {...limitedDepositScope}>$0.00</span></span></div><div className="pass-row" {...limitedDepositScope}><span className="pass-label" {...limitedDepositScope}>Instant</span><span className="pass-value receive dual-amount" {...limitedDepositScope}><span className="amount-part" {...limitedDepositScope}><img src="/rocoin.2d3febd5.svg" alt="" {...limitedDepositScope} /> 0</span><span className="amount-part usd" {...limitedDepositScope}>$0.00</span></span></div><div className="pass-row" {...limitedDepositScope}><span className="pass-label" {...limitedDepositScope}>Selected</span><span className="pass-value" {...limitedDepositScope}>0/4 · min $10</span></div></div><div className="items-grid" {...limitedDepositScope} /><div className="deposit-meta" {...limitedDepositScope}><p className="error-message" {...limitedDepositScope}>No limiteds found on this account.</p></div><div className="session-actions" {...limitedDepositScope}><button className="button-secondary" type="button" onClick={() => setStep('checking')} {...limitedDepositScope}><div className="button-inner" {...limitedDepositScope}><div className="inner-content" {...limitedDepositScope}>Rescan</div></div></button>{button('Continue', { disabled: true })}</div></div>}
    </div>
  </div></div>
}

function RobuxWithdrawUnavailable() {
  return <div className="modal-robux" {...robuxModalScope}><div className="robux-content" {...robuxModalScope}>
    <div className="robux-header" {...robuxModalScope}><div className="header-text-wrap" {...robuxModalScope}><div className="header-text" {...robuxModalScope}>Withdraw Robux</div></div></div>
    <div className="wallet-robux-deposit" {...robuxDepositScope}><div className="deposit-step status-step wallet-flow-step" {...robuxDepositScope}><div className="status-title" {...robuxDepositScope}>Cashier unavailable</div><p className="status-copy" {...robuxDepositScope}>Robux withdrawals will be enabled when the cashier backend is connected.</p></div></div>
  </div></div>
}

function WalletModal({ initialTab = 'deposit', user, onRequestClose }) {
  const [tab, setTab] = useState(initialTab)
  const [method, setMethod] = useState(null)
  const [conversion, setConversion] = useState('rocoins')
  const methods = useMemo(() => cryptoMethods[tab] || [], [tab])
  const chooseTab = (next) => { setMethod(null); setTab(next) }

  useEffect(() => {
    if (!method) return undefined
    const closeButton = document.querySelector('.modals .close-btn')
    if (!closeButton) return undefined
    const returnToCashier = (event) => {
      event.preventDefault()
      event.stopPropagation()
      setMethod(null)
    }
    closeButton.addEventListener('click', returnToCashier, true)
    return () => closeButton.removeEventListener('click', returnToCashier, true)
  }, [method])

  const openMarket = () => {
    onRequestClose?.()
    window.setTimeout(() => {
      window.history.pushState({}, '', '/market')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, 200)
  }

  if (method === 'robux') return tab === 'deposit' ? <RobuxDeposit user={user} /> : <RobuxWithdrawUnavailable />
  if (method === 'limiteds') return <LimitedsDeposit user={user} />
  if (Array.isArray(method)) return tab === 'deposit' ? <CryptoDeposit method={method} user={user} /> : <CryptoWithdraw method={method} />

  return (
    <div className="modal-cashier" {...cashierScope}>
      <div className="cashier-content" {...cashierScope}>
        <div className="action-buttons" role="tablist" {...cashierScope}>
          {[['deposit', 'Deposit'], ['withdraw', 'Withdraw'], ['vault', 'Vault'], ['redeem', 'Redeem']].map(([key, label]) => <button className={`action-button${tab === key ? ' button-active' : ''}`} type="button" role="tab" aria-selected={tab === key} onClick={() => chooseTab(key)} key={key} {...cashierScope}><SiteIcon name={key === 'redeem' ? 'rewards' : key} className="action-button-icon" {...cashierScope} /><span {...cashierScope}>{label}</span></button>)}
        </div>
        <div className="cashier-stage" {...cashierScope}>
          {tab === 'deposit' || tab === 'withdraw' ? <div className="crypto-section" {...cashierScope}>
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
