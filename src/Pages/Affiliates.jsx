import { useState } from 'react'
import { copyText, notify } from '../lib/Notifications'

const pageScope = { 'data-v-121a7eb4': '' }
const statsScope = { 'data-v-7c01c2de': '' }
const detailsScope = { 'data-v-c333a2d2': '' }
const listScope = { 'data-v-ebfe9e2e': '' }

function CoinValue({ children }) {
  return <div className="value-content coin-value" {...statsScope}><img src="/coin.svg" alt="icon" {...statsScope} /><span {...statsScope}>{children}</span></div>
}

function Affiliates() {
  const [code, setCode] = useState('')
  const referral = `${window.location.host}/r/${code}`
  const save = () => notify({ type: code.trim() ? 'error' : 'error', message: code.trim() ? 'Affiliate services are currently unavailable.' : 'Please enter an affiliate code.' })
  const copy = async () => {
    try { await copyText(referral); notify({ type: 'success', message: 'Link copied to clipboard.' }) }
    catch { notify({ type: 'error', message: 'Failed to copy.' }) }
  }
  return <div className="affiliates" {...pageScope}><div className="main-content" {...pageScope}>
    <div className="affiliates-stats" {...statsScope}><div className="stats-title" {...statsScope}>Overview</div><div className="stats-grid" {...statsScope}>
      <div className="stats-card" {...statsScope}><div className="card-body" {...statsScope}><div className="card-title with" {...statsScope}>Users</div><div className="card-value" {...statsScope}><div className="value-content" {...statsScope}>0</div></div></div></div>
      <div className="stats-card deposit-card" {...statsScope}><div className="card-body" {...statsScope}><div className="card-body-text" {...statsScope}><div className="card-title with" {...statsScope}>Total Deposited</div><div className="card-value" {...statsScope}><CoinValue>0</CoinValue></div></div></div></div>
      <div className="stats-card" {...statsScope}><div className="card-body" {...statsScope}><div className="card-title with" {...statsScope}>Total Earnings</div><div className="card-value" {...statsScope}><CoinValue>0</CoinValue></div></div></div>
      <div className="stats-card claim-card" {...statsScope}><div className="card-body" {...statsScope}><div className="card-body-text" {...statsScope}><div className="card-title claim-card" {...statsScope}>Available Earnings</div><div className="card-value" {...statsScope}><CoinValue>0</CoinValue></div></div><button className="claim-button" type="button" onClick={() => notify({ type: 'error', message: 'You have no earnings available to claim.' })} {...statsScope}>Claim</button></div></div>
    </div></div>
    <div {...detailsScope}><div className="content-section" {...detailsScope}><div className="referral-details" {...detailsScope}><div className="referral-link-section" {...detailsScope}><div className="referral-link-section-title" {...detailsScope}><label {...detailsScope}>Affiliate Code</label></div><div className="code-setter" {...detailsScope}><input type="text" placeholder="Enter your referral code" value={code} onChange={(event) => setCode(event.target.value)} {...detailsScope} /><button className="save-button" type="button" onClick={save} {...detailsScope}>Save</button></div></div><div className="referral-input-group" {...detailsScope}><div className="referral-link-display" {...detailsScope}>{referral}</div><button className="copy-button" type="button" title="Copy link" onClick={copy} {...detailsScope}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...detailsScope}><path d="M7 6V4.5A2.5 2.5 0 0 1 9.5 2h6A2.5 2.5 0 0 1 18 4.5v6a2.5 2.5 0 0 1-2.5 2.5H14M4.5 7h6A2.5 2.5 0 0 1 13 9.5v6a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 2 15.5v-6A2.5 2.5 0 0 1 4.5 7Z" stroke="currentColor" strokeWidth="1.6" /></svg></button></div></div></div></div>
    <div className="affiliates-referred" {...listScope}><div className="referred-title" {...listScope}>Affiliate List</div><div className="referred-list" {...listScope}><div className="header-row" {...listScope}><div className="header-player" {...listScope}>User</div><div className="header-wagered" {...listScope}>Wagered</div><div className="header-deposits" {...listScope}>Deposited</div><div className="header-earned" {...listScope}>Earned</div></div><div className="empty-list" {...listScope}><p {...listScope}>No users found.</p></div></div></div>
  </div></div>
}

export default Affiliates
