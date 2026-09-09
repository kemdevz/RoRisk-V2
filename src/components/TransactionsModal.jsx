import { useMemo, useState } from 'react'

const scope = { 'data-v-24da0259': '' }
const PER_PAGE = 8
const typeLabels = { robuxdeposit: 'Robux Deposit', limiteddepositinstant: 'Limiteds Deposit', limiteddepositunlock: 'Limiteds Unlock', limitedmarketpurchase: 'Limiteds Withdraw', limitedmarketrefund: 'Limiteds Refund', leaderboardpayout: 'Race Payout', adminadjust: 'Admin', faucetclaim: 'Faucet', limited: 'Limited', tip: 'Tip', rainjoin: 'Rain Join', raintip: 'Rain Tip', rakebackclaiminstant: 'Instant Rakeback', rakebackclaimdaily: 'Daily Rakeback', rakebackclaimweekly: 'Weekly Rakeback', rakebackclaimmonthly: 'Monthly Rakeback', raincreate: 'Rain Created', rainpayout: 'Rain Payout', affiliate: 'Affiliate', promocodeclaim: 'Promo Code', rakebackclaim: 'Rakeback', affiliatecodeclaim: 'Affiliate', affiliateearningclaim: 'Affiliate Earnings', balance: 'Balance' }

function typeLabel(value = '') {
  const text = String(value)
  const key = text.toLowerCase().replace(/[_ -]/g, '')
  return typeLabels[key] || (text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown')
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

const formatAmount = (value) => Math.floor(Math.abs(Number(value) || 0) / 1000).toLocaleString('en-US')
const iconFor = (currency) => String(currency).toLowerCase() === 'rocoins' ? '/rocoin.2d3febd5.svg' : '/coin.svg'

function Pagination({ page, pages, onChange, className = 'transactions-pagination' }) {
  return <div className={className} {...scope}><button className="pagination-button" type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page" {...scope}><svg viewBox="0 0 20 20" fill="none" {...scope}><path d="M12.5 15 7.5 10l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button><div className="pagination-info" {...scope}>Page: <span {...scope}>{page} / {pages}</span></div><button className="pagination-button" type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page" {...scope}><svg viewBox="0 0 20 20" fill="none" {...scope}><path d="m7.5 5 5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button></div>
}

function TransactionRow({ item, userId }) {
  const [expanded, setExpanded] = useState(false)
  const type = String(item.type || item.transaction_type || '')
  const state = String(item.state || item.status || 'completed').toLowerCase()
  const currency = item.walletCurrency || item.wallet_currency || item.currency
  const sender = item.sender_uuid || item.sender?.uuid || item.sender
  const negative = /withdraw|purchase/i.test(type) || (/^tip$/i.test(type) && String(sender) === String(userId)) || /raintip/i.test(type)
  const expandable = Boolean(item.txid || item.address || item.method || item.bonus)
  const status = state === 'pending_manual_approval' ? 'Pending' : state.charAt(0).toUpperCase() + state.slice(1)
  return <div className="transaction-entry" {...scope}><div className={`transaction-item${expandable ? ' item-clickable' : ''}`} role={expandable ? 'button' : undefined} tabIndex={expandable ? 0 : undefined} onClick={() => expandable && setExpanded((value) => !value)} onKeyDown={(event) => { if (expandable && (event.key === 'Enter' || event.key === ' ')) setExpanded((value) => !value) }} {...scope}><div className="transaction-date" {...scope}>{formatDate(item.created_at || item.date || item.timestamp)}</div><div className="transaction-type" {...scope}>{typeLabel(type)}</div><div className="transaction-details" {...scope}><span className="type" {...scope}>{item.details || item.description || typeLabel(type)}</span>{item.method && <span className="method" {...scope}>{typeLabel(item.method)}</span>}</div><div className={`transaction-status status-${state === 'pending_manual_approval' ? 'pending' : state}`} {...scope}>{status}</div><div className={`transaction-amount ${negative ? 'amount-negative' : 'amount-positive'}${state === 'processing' ? ' amount-processing' : ''}`} {...scope}><img src={iconFor(currency)} alt="" {...scope} /><span {...scope}>{state === 'processing' ? '' : negative ? '-' : '+'}{formatAmount(item.amount ?? item.coin_amount)}</span></div></div>{expanded && <div className="transaction-details-box" onClick={() => setExpanded(false)} {...scope}>{item.txid && <div className="detail-item" {...scope}><span className="detail-label" {...scope}>TXID</span><span className="detail-value txid" title={item.txid} {...scope}>{item.txid}</span></div>}{item.address && <div className="detail-item" {...scope}><span className="detail-label" {...scope}>Address</span><span className="detail-value address" title={item.address} {...scope}>{item.address}</span></div>}{item.method && <div className="detail-item" {...scope}><span className="detail-label" {...scope}>Method</span><span className="detail-value" {...scope}>{typeLabel(item.method)}</span></div>}<div className="detail-item" {...scope}><span className="detail-label" {...scope}>Amount</span><span className="detail-value amount" {...scope}><img src={iconFor(currency)} alt="" {...scope} />{formatAmount(item.amount ?? item.coin_amount)}</span></div>{item.bonus && <div className="detail-item" {...scope}><span className="detail-label" {...scope}>Bonus</span><span className="detail-value" {...scope}>{item.bonus}</span></div>}</div>}</div>
}

function GameRow({ game }) {
  const bet = typeof game.bet === 'object' ? Object.values(game.bet).reduce((sum, value) => sum + (Number(value) || 0), 0) : Number(game.bet || game.bet_amount) || 0
  const result = (Number(game.payout || game.payout_amount) || 0) - bet
  const type = String(game.method || game.game || game.type || '')
  const name = type.toLowerCase() === 'slots' && game.game_name ? `Slots (${game.game_name})` : typeLabel(type === 'xroulette' ? 'X-Roulette' : type)
  return <div className="game-item" {...scope}><div className="game-date" {...scope}>{formatDate(game.created_at || game.date || game.timestamp)}</div><div className="game-details" {...scope}><span className="type" {...scope}>{name}</span></div><div className={`game-amount ${result > 0 ? 'amount-positive' : result < 0 ? 'amount-negative' : 'amount-neutral'}`} {...scope}><span {...scope}>{result > 0 ? '+' : result < 0 ? '-' : ''}{formatAmount(result)}</span></div><div className="game-bet-info" {...scope}><div className="bet-amount-container" {...scope}><img src={iconFor(game.walletCurrency || game.wallet_currency || game.currency)} alt="" {...scope} /><span className="bet-amount" {...scope}>{formatAmount(bet)}</span></div>{type.toLowerCase() !== 'slots' && <button className="button-verify" type="button" {...scope}>Verify</button>}</div></div>
}

function TransactionsModal({ user }) {
  const [tab, setTab] = useState('transactions')
  const [transactionPage, setTransactionPage] = useState(1)
  const [gamePage, setGamePage] = useState(1)
  const transactions = useMemo(() => Array.isArray(user?.transactions) ? user.transactions : [], [user])
  const games = useMemo(() => Array.isArray(user?.games) ? user.games : Array.isArray(user?.bets) ? user.bets : [], [user])
  const items = tab === 'transactions' ? transactions : games
  const page = tab === 'transactions' ? transactionPage : gamePage
  const setPage = tab === 'transactions' ? setTransactionPage : setGamePage
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE))
  const visible = items.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return <div className="modal-user-transactions" {...scope}><div className="modal-content" {...scope}><div className="modal-header" {...scope}><div className="tab-buttons" {...scope}><button className={`tab-button${tab === 'transactions' ? ' active' : ''}`} type="button" onClick={() => setTab('transactions')} {...scope}>Transactions</button><button className={`tab-button${tab === 'games' ? ' active' : ''}`} type="button" onClick={() => setTab('games')} {...scope}>Games</button></div></div>{tab === 'transactions' ? <div className="transactions-container" {...scope}><div className="header-row" {...scope}><div className="header-date" {...scope}>Date</div><div className="header-type" {...scope}>Type</div><div className="header-details" {...scope}>Details</div><div className="header-status" {...scope}>Status</div><div className="header-amount" {...scope}>Amount</div></div><div className="separator" {...scope} /><div className="transactions-content" {...scope}>{visible.length ? <div className="list" {...scope}>{visible.map((item, index) => <TransactionRow key={item.uuid || item.id || index} item={item} userId={user?.uuid || user?.id} />)}</div> : <div className="content-empty" {...scope}>No transactions found.</div>}</div><Pagination page={page} pages={pages} onChange={setPage} /></div> : <div className="profile-games" {...scope}><div className="games-head" {...scope}><div className="head-date" {...scope}>Date</div><div className="head-details" {...scope}>Details</div><div className="head-pl" {...scope}>P/L</div><div className="head-bet" {...scope}>Bet</div></div><div className="separator" {...scope} /><div className="games-content" {...scope}>{visible.length ? <div className="content-list" {...scope}>{visible.map((game, index) => <GameRow key={game.uuid || game.id || index} game={game} />)}</div> : <div className="content-empty" {...scope}>No games found.</div>}</div><Pagination page={page} pages={pages} onChange={setPage} className="games-pagination transactions-pagination" /></div>}</div></div>
}

export default TransactionsModal
