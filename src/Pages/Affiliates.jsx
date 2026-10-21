import { useCallback, useEffect, useState } from 'react'
import { copyText, notify } from '../lib/Notifications'

const pageScope = { 'data-v-121a7eb4': '' }
const statsScope = { 'data-v-7c01c2de': '' }
const detailsScope = { 'data-v-c333a2d2': '' }
const listScope = { 'data-v-ebfe9e2e': '' }

function formatValue(value) { return Math.floor(Number(value) || 0).toLocaleString('en-US') }

function CoinValue({ children }) {
  return <div className="value-content coin-value" {...statsScope}><img src="/assets/currency/coin.svg" alt="icon" {...statsScope} /><span {...statsScope}>{children}</span></div>
}

function Affiliates({ user, onSignIn }) {
  const [state, setState] = useState({ data: null, referred: [], pagination: null })
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const host = window.location.host

  const load = useCallback(async (page = 1) => {
    if (!user) { setLoading(false); return }
    try {
      setLoading(true)
      const response = await fetch(`/api/affiliates?page=${page}&limit=50`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load affiliate data.')
      setState(payload)
      setCode((current) => current || payload.data?.code || '')
    } catch (error) { notify({ type: 'error', message: error.message }) }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { document.title = 'Affiliates - RoRisk.com'; Promise.resolve().then(() => load(1)) }, [load])

  const save = async () => {
    if (!user) return onSignIn?.()
    const nextCode = code.trim()
    if (!/^[A-Za-z0-9_]{3,12}$/.test(nextCode)) { notify({ type: 'error', message: 'Your entered affiliate code is invalid.' }); return }
    try {
      setSending(true)
      const response = await fetch('/api/affiliates/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: nextCode }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to set your affiliate code.')
      notify({ type: 'success', message: "You've successfully set your affiliate code." })
      await load(state.pagination?.currentPage || 1)
    } catch (error) { notify({ type: 'error', message: error.message }) }
    finally { setSending(false) }
  }

  const claim = async () => {
    if (!user) return onSignIn?.()
    try {
      setSending(true)
      const response = await fetch('/api/affiliates/claim', { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'You have no earnings available to claim.')
      if (payload.user) window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: payload.user } }))
      notify({ type: 'success', message: "You've successfully claimed your affiliate earnings." })
      await load(state.pagination?.currentPage || 1)
    } catch (error) { notify({ type: 'error', message: error.message }) }
    finally { setSending(false) }
  }

  const referral = `${host}/r/${state.data?.code || code}`
  const copy = async () => {
    try { await copyText(referral); notify({ type: 'success', message: 'Link copied to clipboard.' }) }
    catch { notify({ type: 'error', message: 'Failed to copy.' }) }
  }

  const pagination = state.pagination
  const visiblePages = []
  if (pagination) {
    let start = Math.max(1, pagination.currentPage - 2)
    let end = Math.min(pagination.totalPages, pagination.currentPage + 2)
    if (end - start < 4) { if (start === 1) end = Math.min(pagination.totalPages, start + 4); else start = Math.max(1, end - 4) }
    for (let page = start; page <= end; page += 1) visiblePages.push(page)
  }

  return <div className="affiliates" {...pageScope}><div className="main-content" {...pageScope}>
    <div className="affiliates-stats" {...statsScope}><div className="stats-title" {...statsScope}>Overview</div><div className="stats-grid" {...statsScope}>
      <div className="stats-card" {...statsScope}><div className="card-body" {...statsScope}><div className="card-title with" {...statsScope}>Users</div><div className="card-value" {...statsScope}>{loading ? <div className="value-loading" {...statsScope} /> : <div className="value-content" {...statsScope}>{pagination?.totalUsers || 0}</div>}</div></div></div>
      <div className="stats-card deposit-card" {...statsScope}><div className="card-body" {...statsScope}><div className="card-body-text" {...statsScope}><div className="card-title with" {...statsScope}>Total Deposited</div><div className="card-value" {...statsScope}>{loading ? <div className="value-loading" {...statsScope} /> : <CoinValue>{formatValue(state.data?.deposit)}</CoinValue>}</div></div></div></div>
      <div className="stats-card" {...statsScope}><div className="card-body" {...statsScope}><div className="card-title with" {...statsScope}>Total Earnings</div><div className="card-value" {...statsScope}>{loading ? <div className="value-loading" {...statsScope} /> : <CoinValue>{formatValue(state.data?.earned)}</CoinValue>}</div></div></div>
      <div className="stats-card claim-card" {...statsScope}><div className="card-body" {...statsScope}><div className="card-body-text" {...statsScope}><div className="card-title claim-card" {...statsScope}>Available Earnings</div><div className="card-value" {...statsScope}>{loading ? <div className="value-loading" {...statsScope} /> : <CoinValue>{formatValue(state.data?.available)}</CoinValue>}</div></div><button className="claim-button" type="button" disabled={sending} onClick={claim} {...statsScope}>Claim</button></div></div>
    </div></div>
    <div {...detailsScope}><div className="content-section" {...detailsScope}><div className="referral-details" {...detailsScope}><div className="referral-link-section" {...detailsScope}><div className="referral-link-section-title" {...detailsScope}><label {...detailsScope}>Affiliate Code</label></div><div className="code-setter" {...detailsScope}><input type="text" placeholder="Enter your referral code" maxLength="12" value={code} onChange={(event) => setCode(event.target.value)} {...detailsScope} /><button className="save-button" type="button" disabled={sending} onClick={save} {...detailsScope}>Save</button></div></div><div className="referral-input-group" {...detailsScope}><div className="referral-link-display" {...detailsScope}>{referral}</div><button className="copy-button" type="button" title="Copy link" onClick={copy} {...detailsScope}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...detailsScope}><path d="M7 6V4.5A2.5 2.5 0 0 1 9.5 2h6A2.5 2.5 0 0 1 18 4.5v6a2.5 2.5 0 0 1-2.5 2.5H14M4.5 7h6A2.5 2.5 0 0 1 13 9.5v6a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 2 15.5v-6A2.5 2.5 0 0 1 4.5 7Z" stroke="currentColor" strokeWidth="1.6" /></svg></button></div></div></div></div>
    <div className="affiliates-referred" {...listScope}><div className="referred-title" {...listScope}>Affiliate List</div><div className="referred-list" {...listScope}><div className="header-row" {...listScope}><div className="header-player" {...listScope}>User</div><div className="header-wagered" {...listScope}>Wagered</div><div className="header-deposits" {...listScope}>Deposited</div><div className="header-earned" {...listScope}>Earned</div></div>
      {loading ? <div className="loading" {...listScope}><div className="loading-content" {...listScope} /></div> : state.referred?.length ? <div className="list" {...listScope}>{state.referred.map((entry) => <div className="user-item" key={entry.user?.uuid || entry.referredAt} {...listScope}><div className="user-player-info" {...listScope}><div className="user-avatar" {...listScope}><img src={entry.user?.avatar_headshot || '/assets/users/default-avatar.png'} alt="" {...listScope} /></div><div className="user-info" {...listScope}><div className="username" {...listScope}>{entry.user?.username || 'Unknown User'}</div></div></div><div className="user-wagered" {...listScope}><img src="/assets/currency/coin.svg" alt="coin" {...listScope} /><span {...listScope}>{formatValue(entry.wagered)}</span><span className="wagered-divider" {...listScope}>/</span><img src="/assets/currency/rocoin.2d3febd5.svg" alt="rocoin" {...listScope} /><span {...listScope}>{formatValue(entry.wageredRocoins)}</span></div><div className="user-deposits" {...listScope}><img src="/assets/currency/coin.svg" alt="coin" {...listScope} /><span {...listScope}>{formatValue(entry.deposited)}</span></div><div className="user-earned" {...listScope}><img src="/assets/currency/coin.svg" alt="coin" {...listScope} /><span {...listScope}>{formatValue(entry.earned)}</span></div></div>)}</div> : <div className="empty-list" {...listScope}><p {...listScope}>No users found.</p></div>}
      {pagination && <div className="pagination" {...listScope}><div className="pagination-controls" {...listScope}><button className="pagination-btn prev-btn" disabled={!pagination.hasPrevPage || loading} onClick={() => load(pagination.currentPage - 1)} {...listScope}>Previous</button><div className="page-numbers" {...listScope}>{visiblePages.map((page) => <button className={`page-btn${page === pagination.currentPage ? ' active' : ''}`} disabled={loading} onClick={() => load(page)} key={page} {...listScope}>{page}</button>)}</div><button className="pagination-btn next-btn" disabled={!pagination.hasNextPage || loading} onClick={() => load(pagination.currentPage + 1)} {...listScope}>Next</button></div></div>}
    </div></div>
  </div></div>
}

export default Affiliates
