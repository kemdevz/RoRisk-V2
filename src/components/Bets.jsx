import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import SiteIcon from './Icons'

const scope = { 'data-v-3dfc5cda': '' }
const amount = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value) || 0)
const levelTheme = (level) => level >= 100 ? 'red' : level >= 75 ? 'orange' : level >= 50 ? 'purple' : level >= 25 ? 'green' : 'blue'

function betTime(value) {
  const date = new Date(value)
  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const meridiem = hours >= 12 ? 'PM' : 'AM'
  hours %= 12
  hours ||= 12
  return `${hours}:${minutes} ${meridiem}`
}

function Bets({ games }) {
  const [tab, setTab] = useState('all')
  const [remoteGames, setRemoteGames] = useState([])
  const rowNodes = useRef(new Map())
  const previousIds = useRef(null)
  const previousPositions = useRef(new Map())
  const skipAnimation = useRef(false)
  const animationFrames = useRef(new Set())
  const animationTimers = useRef(new Set())
  const sourceGames = games ?? remoteGames
  const visible = sourceGames.filter((game) => tab === 'big-wins' ? Number(game.bet_amount) >= 100000 : tab === 'lucky-wins' ? Number(game.multiplier) >= 5 && game.won : true)
  const visibleIds = visible.map((game) => game.uuid)
  const visibleSignature = visibleIds.join('|')

  useLayoutEffect(() => {
    const currentIds = visibleSignature ? visibleSignature.split('|') : []
    const currentPositions = new Map(currentIds.map((id) => [id, rowNodes.current.get(id)?.offsetTop ?? 0]))
    if (previousIds.current === null || skipAnimation.current) {
      previousIds.current = currentIds
      previousPositions.current = currentPositions
      skipAnimation.current = false
      return
    }
    if (currentIds.length === previousIds.current.length && currentIds.every((id, index) => id === previousIds.current[index])) return

    const previousSet = new Set(previousIds.current)
    const entering = currentIds.filter((id) => !previousSet.has(id)).map((id) => rowNodes.current.get(id)).filter(Boolean)
    const moving = currentIds.filter((id) => previousSet.has(id)).map((id) => {
      const node = rowNodes.current.get(id)
      return { node, delta: (previousPositions.current.get(id) ?? node?.offsetTop ?? 0) - (node?.offsetTop ?? 0) }
    }).filter(({ node, delta }) => node && delta)

    entering.forEach((node) => node.classList.add('new-bet', 'bet-animation-enter-active', 'bet-animation-enter-from'))
    moving.forEach(({ node, delta }) => {
      node.style.transition = 'none'
      node.style.transform = `translateY(${delta}px)`
    })
    entering.forEach((node) => void node.offsetHeight)
    moving.forEach(({ node }) => void node.offsetHeight)

    const frame = window.requestAnimationFrame(() => {
      entering.forEach((node) => {
        node.classList.remove('bet-animation-enter-from')
        node.classList.add('bet-animation-enter-to')
      })
      moving.forEach(({ node }) => {
        node.classList.add('bet-animation-move')
        node.style.transition = ''
        node.style.transform = ''
      })
      const finish = window.setTimeout(() => {
        entering.forEach((node) => node.classList.remove('bet-animation-enter-active', 'bet-animation-enter-to'))
        moving.forEach(({ node }) => node.classList.remove('bet-animation-move'))
        animationTimers.current.delete(finish)
      }, 350)
      const highlight = window.setTimeout(() => {
        entering.forEach((node) => node.classList.remove('new-bet'))
        animationTimers.current.delete(highlight)
      }, 1500)
      animationTimers.current.add(finish)
      animationTimers.current.add(highlight)
      animationFrames.current.delete(frame)
    })
    animationFrames.current.add(frame)
    previousIds.current = currentIds
    previousPositions.current = currentPositions
  }, [visibleSignature])

  useEffect(() => () => {
    animationFrames.current.forEach(window.cancelAnimationFrame)
    animationTimers.current.forEach(window.clearTimeout)
  }, [])

  useEffect(() => {
    if (games !== undefined) return undefined
    let active = true
    const refresh = async () => {
      try {
        const response = await fetch('/api/bets?limit=30')
        const payload = await response.json()
        if (active && response.ok) setRemoteGames(payload.games || [])
      } catch { /* Keep the most recent feed during a temporary connection failure. */ }
    }
    const receiveBet = (event) => {
      const game = event.detail?.game
      if (!game?.uuid) return
      setRemoteGames((current) => [game, ...current.filter((item) => item.uuid !== game.uuid)].slice(0, 30))
    }
    refresh()
    const timer = window.setInterval(refresh, 5000)
    window.addEventListener('rorisk:dice-bet', receiveBet)
    window.addEventListener('rorisk:coinflip-update', refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('rorisk:dice-bet', receiveBet)
      window.removeEventListener('rorisk:coinflip-update', refresh)
    }
  }, [games])

  const changeTab = (nextTab) => {
    skipAnimation.current = true
    setTab(nextTab)
  }
  return <div className="bets" {...scope}>
    <div className="bets-header" {...scope}><h2 className="title" {...scope}><SiteIcon name="bets" {...scope} /> Live Bets</h2><div className="bets-buttons" {...scope}>{[['all', 'All Bets'], ['big-wins', 'High Rollers'], ['lucky-wins', 'Lucky Wins']].map(([key, label]) => <button type="button" key={key} className={`button${tab === key ? ' button-active' : ''}`} onClick={() => changeTab(key)} {...scope}>{label}</button>)}</div></div>
    <div className="bets-list" {...scope}><div className="list-head" {...scope}><div className="head-game" {...scope}>Gamemode</div><div className="head-user" {...scope}>Player</div><div className="head-time" {...scope}>Time</div><div className="head-amount" {...scope}>Bet</div><div className="head-multiplier" {...scope}>Multiplier</div><div className="head-payout" {...scope}>Payout</div></div>
      <div className="list-content" {...scope}>{visible.length === 0 ? <div className="content-empty" {...scope} /> : <div className="content-list-wrap" {...scope}><div className="content-list" {...scope}>{visible.map((game) => {
        const icon = game.currency === 'rocoins' ? '/rocoin.2d3febd5.svg' : '/Rewards/coin.12f4bce8.svg'
        const level = Number(game.level) || 0
        const method = game.method || 'dice'
        const methodLabel = method === 'cases' ? 'Cases' : method === 'coinflip' ? 'Coinflip' : 'Dice'
        return <div className="bets-row" key={game.uuid} ref={(node) => { if (node) rowNodes.current.set(game.uuid, node); else rowNodes.current.delete(game.uuid) }} {...scope}><div className={`bets-element ${game.won ? 'bet-positive' : 'bet-negative'}`} {...scope}><div className="element-game" {...scope}><SiteIcon name={method} {...scope} /><span {...scope}>{methodLabel}</span></div><div className="element-user" {...scope}><div className="user-avatar" {...scope}><img className="avatar-image" src={game.avatar_headshot || '/default-avatar.png'} alt="" {...scope} /></div><div className={`box-level level-${levelTheme(level)}`} data-v-ff759fba=""><div className="level-inner" data-v-ff759fba="">{level}</div></div><span className="user-username" {...scope}>{game.username || 'Guest'}</span></div><div className="element-time" {...scope}>{betTime(game.updatedAt || game.updated_at || game.createdAt || game.created_at)}</div><div className="element-amount" {...scope}><img src={icon} alt="" {...scope} /><span {...scope}>{amount(game.bet_amount)}</span></div><div className="element-multiplier" {...scope}>{Number(game.multiplier || 0).toFixed(2)}x</div><div className="element-payout" {...scope}><img src={icon} alt="" {...scope} /><span className={game.won ? 'payout-positive' : ''} {...scope}>{amount(game.payout_amount)}</span></div></div></div>
      })}</div></div>}</div>
    </div>
  </div>
}

export default Bets
