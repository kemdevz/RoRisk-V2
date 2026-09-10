import { useState } from 'react'
import SiteIcon from './Icons'

const scope = { 'data-v-3dfc5cda': '' }
const amount = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value) || 0)

function timeAgo(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

function Bets({ games = [] }) {
  const [tab, setTab] = useState('all')
  const visible = games.filter((game) => tab === 'big-wins' ? Number(game.bet_amount) >= 100000 : tab === 'lucky-wins' ? Number(game.multiplier) >= 5 && game.won : true)
  return <div className="bets" {...scope}>
    <div className="bets-header" {...scope}><h2 className="title" {...scope}><SiteIcon name="bets" {...scope} /> Live Bets</h2><div className="bets-buttons" {...scope}>{[['all', 'All Bets'], ['big-wins', 'High Rollers'], ['lucky-wins', 'Lucky Wins']].map(([key, label]) => <button type="button" key={key} className={`button${tab === key ? ' button-active' : ''}`} onClick={() => setTab(key)} {...scope}>{label}</button>)}</div></div>
    <div className="bets-list" {...scope}><div className="list-head" {...scope}><div className="head-game" {...scope}>Gamemode</div><div className="head-user" {...scope}>Player</div><div className="head-time" {...scope}>Time</div><div className="head-amount" {...scope}>Bet</div><div className="head-multiplier" {...scope}>Multiplier</div><div className="head-payout" {...scope}>Payout</div></div>
      <div className="list-content" {...scope}>{visible.length === 0 ? <div className="content-empty" {...scope}>No active bets.</div> : <div className="content-list-wrap" {...scope}><div className="content-list" {...scope}>{visible.map((game) => {
        const icon = game.currency === 'rocoins' ? '/rocoin.2d3febd5.svg' : '/Rewards/coin.12f4bce8.svg'
        return <div className="bets-row" key={game.uuid} {...scope}><div className={`bets-element ${game.won ? 'bet-positive' : 'bet-negative'}`} {...scope}><div className="element-game" {...scope}><SiteIcon name="dice" {...scope} /><span {...scope}>Dice</span></div><div className="element-user" {...scope}><div className="user-avatar" {...scope}><img className="avatar-image" src={game.avatar_headshot || '/default-avatar.png'} alt="" {...scope} /></div><span className="user-username" {...scope}>{game.username || 'Guest'}</span></div><div className="element-time" {...scope}>{timeAgo(game.created_at)}</div><div className="element-amount" {...scope}><img src={icon} alt="" {...scope} /><span {...scope}>{amount(game.bet_amount)}</span></div><div className="element-multiplier" {...scope}>{Number(game.multiplier || 0).toFixed(2)}x</div><div className="element-payout" {...scope}><img src={icon} alt="" {...scope} /><span className={game.won ? 'payout-positive' : ''} {...scope}>{amount(game.payout_amount)}</span></div></div></div>
      })}</div></div>}</div>
    </div>
  </div>
}

export default Bets
