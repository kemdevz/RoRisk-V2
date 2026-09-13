import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ModalAnimation from '../components/ModalAnimation'
import SiteIcon from '../components/Icons'
import { copyText, notify } from '../lib/Notifications'
import { playSound, stopSound } from '../lib/Sounds'

const pageScope = { 'data-v-2d292171': '' }
const gameScope = { 'data-v-b1a1cf04': '' }
const cardScope = { 'data-v-212fa4b9': '' }
const historyScope = { 'data-v-3abbbffd': '' }
const timerScope = { 'data-v-53641f25': '' }
const controlsScope = { 'data-v-97054fc0': '' }
const betsScope = { 'data-v-0474fe40': '' }
const fairScope = { 'data-v-a4722fc8': '' }
const loadingScope = { 'data-v-21317e4a': '' }
const currencyIcon = (currency) => currency === 'coins' ? '/Rewards/coin.12f4bce8.svg' : '/rocoin.2d3febd5.svg'
const userId = (user) => String(user?.user_uuid || user?.uuid || user?.id || user?._id || '')
const formatAmount = (value) => (Math.floor(Math.max(0, Number(value) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const emptyRoulettePage = { game: null, bets: [], history: [], serverTimeOffset: 0 }
let cachedRoulettePage = emptyRoulettePage
const rouletteEosBlocks = new Map()
const roulettePhaseOrder = { BETTING_OPEN: 0, BETTING_LOCKED: 1, ROLLING: 2, SETTLING: 3, COMPLETE: 4 }
const rouletteCountdownDisplayMaximum = 14_600
function tierFor(multiplierBps) {
  const value = Number(multiplierBps) || 0
  if (value < 150) return 'blue'
  if (value < 250) return 'green'
  if (value < 500) return 'purple'
  if (value < 2000) return 'red'
  return 'yellow'
}

function SelectorIcon({ className }) {
  const suffix = useId().replaceAll(':', '')
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50" fill="none" aria-hidden="true" {...gameScope}>
    <g clipPath={`url(#selector-clip-${suffix})`}><path d="M25.0003 49.9998L46.651 12.5H3.34961L25.0003 49.9998Z" fill={`url(#selector-a-${suffix})`} /><path fillRule="evenodd" clipRule="evenodd" d="M25.0005 49.9992L46.6516 12.5H25.0005V49.9992Z" fill={`url(#selector-b-${suffix})`} /><path d="M25 49.9998L38.5317 12.5H11.4683L25 49.9998Z" fill={`url(#selector-c-${suffix})`} /><path d="M25.0003 0L46.651 12.5H3.34961L25.0003 0Z" fill={`url(#selector-d-${suffix})`} /><path fillRule="evenodd" clipRule="evenodd" d="M25.0005 0.000244141L46.6516 12.4999H25.0005V0.000244141Z" fill={`url(#selector-e-${suffix})`} /><path d="M25 0L38.5317 12.5H11.4683L25 0Z" fill={`url(#selector-f-${suffix})`} /><path d="M25.0003 0L46.651 12.5H3.34961L25.0003 0Z" fill="white" fillOpacity=".12" /><path fillRule="evenodd" clipRule="evenodd" d="M46.6498 12.4995L25 0L3.3501 12.4995L25 49.9993L46.6498 12.4995Z" fill="white" style={{ mixBlendMode: 'overlay' }} /></g>
    <defs><linearGradient id={`selector-a-${suffix}`} x1="25" y1="50" x2="5" y2="13" gradientUnits="userSpaceOnUse"><stop stopColor="#51BBE2" /><stop offset="1" stopColor="#93DBFF" /></linearGradient><linearGradient id={`selector-b-${suffix}`} x1="36" y1="13" x2="36" y2="50" gradientUnits="userSpaceOnUse"><stop stopColor="#027380" /><stop offset="1" stopColor="#011E3A" /></linearGradient><linearGradient id={`selector-c-${suffix}`} x1="17" y1="25" x2="40" y2="15" gradientUnits="userSpaceOnUse"><stop stopColor="#013D62" /><stop offset="1" stopColor="#0C5583" /></linearGradient><linearGradient id={`selector-d-${suffix}`} x1="25" y1="0" x2="22" y2="15" gradientUnits="userSpaceOnUse"><stop stopColor="#51A6E2" /><stop offset="1" stopColor="#93EBFF" /></linearGradient><linearGradient id={`selector-e-${suffix}`} x1="36" y1="12" x2="36" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#024380" /><stop offset="1" stopColor="#011A3A" /></linearGradient><linearGradient id={`selector-f-${suffix}`} x1="17" y1="8" x2="27" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#014562" /><stop offset="1" stopColor="#036E81" /></linearGradient><clipPath id={`selector-clip-${suffix}`}><rect width="50" height="50" fill="white" /></clipPath></defs>
  </svg>
}

function RouletteCard({ card, winner, highlight, bets, currency }) {
  const myBets = bets.filter((bet) => (bet.currency || 'coins') === currency)
  const target = myBets.length ? Math.min(...myBets.map((bet) => Number(bet.target_multiplier_bps) || Number.POSITIVE_INFINITY)) : 0
  const losing = target > 0 && Number(card.multiplierBps) < target
  const payout = myBets.reduce((total, bet) => Number(card.multiplierBps) >= Number(bet.target_multiplier_bps) ? total + Math.floor(Number(bet.amount) * Number(bet.target_multiplier_bps) / 100) : total, 0)
  return <div className={`xr-card element-${tierFor(card.multiplierBps)}${winner && highlight ? ' is-winner' : ''}${losing ? ' is-skull' : ''}`} {...cardScope}>
    <div className="xr-card-multiplier" {...cardScope}>{(Number(card.multiplierBps) / 100).toFixed(2)}x</div>
    <div className="xr-card-image" {...cardScope}><img className={losing ? 'skull-image' : undefined} src={losing ? '/api/casino-images/x-roulette/skull.5e8dd863.png' : card.image} alt={losing ? 'Losing tile' : card.name} {...cardScope} /></div>
    {!losing && <div className="xr-card-name" {...cardScope}>{card.name}</div>}
    {!losing && myBets.length > 0 && <div className="xr-card-value" {...cardScope}><img src={currencyIcon(currency)} alt="" {...cardScope} /><span {...cardScope}>{formatAmount(payout)}</span></div>}
  </div>
}

function AwaitingEos({ game, visible }) {
  const stableBlockNumber = game?.fair?.eosBlockNumber
  return <div className={`slide-awaiting-eos${visible ? ' is-visible' : ''}`} aria-hidden={!visible} {...gameScope}><div className="slide-awaiting-eos-text" {...gameScope}><span {...gameScope}>Awaiting EOS Block {stableBlockNumber ? `(#${stableBlockNumber})` : ''}</span></div></div>
}

function RouletteGame({ game, bets, currency, returningToStart }) {
  const innerRef = useRef(null)
  const previous = useRef(null)
  const spinningSound = useRef(null)
  const [width, setWidth] = useState(0)
  const [landingOffset, setLandingOffset] = useState(0)
  const [curve, setCurve] = useState('cubic-bezier(0.15, 0.5, 0.15, 1)')
  const [spinningBack, setSpinningBack] = useState(false)
  const [centering, setCentering] = useState(false)
  const [centered, setCentered] = useState(false)
  const [highlight, setHighlight] = useState(false)
  const [overlayHidden, setOverlayHidden] = useState(false)
  const [rollingDuration, setRollingDuration] = useState(5000)
  const mobile = typeof window !== 'undefined' && window.innerWidth <= 850
  const cardWidth = mobile ? 110 : 140
  const gap = mobile ? 10 : 12
  const total = cardWidth + gap
  const cards = game?.reel || []
  const winningIndex = Number.isInteger(game?.result?.winningIndex) ? game.result.winningIndex : cards.findIndex((card) => card.isWinner)
  const gameId = game?.uuid || null
  const gameState = game?.state || null
  const rollingEndsAt = game?.rollingEndsAt || null

  useLayoutEffect(() => {
    const update = () => setWidth(innerRef.current?.offsetWidth || 0)
    update()
    const observer = typeof ResizeObserver !== 'undefined' && innerRef.current ? new ResizeObserver(update) : null
    observer?.observe(innerRef.current)
    window.addEventListener('resize', update)
    return () => { observer?.disconnect(); window.removeEventListener('resize', update) }
  }, [])

  useEffect(() => () => {
    stopSound('slideStarted')
    spinningSound.current = null
  }, [])

  useEffect(() => {
    if (!gameId || !gameState) return undefined
    const old = previous.current
    const timers = []
    if (old && old.state !== 'BETTING_OPEN' && gameState === 'BETTING_OPEN') {
      setSpinningBack(true); setCentered(false); setHighlight(false); setLandingOffset(0)
      timers.push(window.setTimeout(() => setSpinningBack(false), 2000))
    }
    if (gameState === 'ROLLING' && (!old || old.state !== 'ROLLING' || old.uuid !== gameId)) {
      const curves = ['cubic-bezier(0.25, 0.4, 0.3, 1)', 'cubic-bezier(0.2, 0.6, 0.2, 1)', 'cubic-bezier(0.1, 0.5, 0.3, 1)', 'cubic-bezier(0.5, 0.2, 0.1, 1)', 'cubic-bezier(0.1, 0.2, 0.3, 1)', 'cubic-bezier(0, 0, 0.25, 1)', 'cubic-bezier(0.1, 0, 0.3, 1)', 'cubic-bezier(0, 0.1, 0.2, 1)', 'cubic-bezier(0.5, 0.25, 0.1, 1)', 'cubic-bezier(0.1, 0.25, 0.3, 1)', 'cubic-bezier(0, 0.25, 0.3, 1)']
      setLandingOffset((Math.random() - .5) * 100)
      setCurve(curves[Math.floor(Math.random() * curves.length)])
      setRollingDuration(Math.max(300, new Date(rollingEndsAt).getTime() - Date.now()))
      setOverlayHidden(true); setCentering(false); setCentered(false); setHighlight(false)
      spinningSound.current = playSound('slideStarted')
    }
    if (['SETTLING', 'COMPLETE'].includes(gameState) && old?.state === 'ROLLING') {
      if (spinningSound.current) {
        stopSound('slideStarted')
        spinningSound.current = null
      }
      timers.push(window.setTimeout(() => { setCentering(true); timers.push(window.setTimeout(() => { setCentering(false); setCentered(true) }, 1000)) }, 500))
      timers.push(window.setTimeout(() => setHighlight(true), 1000))
      timers.push(window.setTimeout(() => setOverlayHidden(false), 2000))
    }
    if (gameState === 'BETTING_OPEN' && spinningSound.current) {
      stopSound('slideStarted')
      spinningSound.current = null
    }
    previous.current = { uuid: gameId, state: gameState }
    return () => timers.forEach(window.clearTimeout)
  }, [gameId, gameState, rollingEndsAt])

  const center = width / 2
  const startIndex = Math.min(8, Math.max(0, cards.length - 1))
  const startX = center - (startIndex * total + cardWidth / 2)
  const winnerX = center - (Math.max(0, winningIndex) * total + cardWidth / 2)
  let transform = startX
  let transition = 'none'
  if (game?.state === 'ROLLING') { transform = winnerX - landingOffset; transition = `transform ${rollingDuration}ms ${curve}` }
  else if (['SETTLING', 'COMPLETE'].includes(game?.state)) { transform = winnerX - (centering || centered ? 0 : landingOffset); transition = centering ? 'transform 1000ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none' }
  else if (spinningBack || returningToStart) transition = 'transform 2000ms cubic-bezier(0.4, 0, 0.2, 1)'

  return <div className="xr-game" {...gameScope}><div className="game-spinner" {...gameScope}><div className="spinner-selector" {...gameScope}><SelectorIcon /><SelectorIcon className="selector-bottom" /></div><div className="spinner-inner" ref={innerRef} {...gameScope}><div className="shadow-left" {...gameScope} />{cards.length > 0 && <div className="inner-reel" style={{ transform: `translateX(${transform}px)`, transition }} {...gameScope}>{cards.map((card, index) => <RouletteCard key={`${game?.uuid}-${index}`} card={card} winner={index === winningIndex} highlight={highlight} bets={bets} currency={currency} />)}</div>}<div className="shadow-right" {...gameScope} /><div className={`slide-overlay${overlayHidden ? ' fade-out' : ''}`} {...gameScope} /><AwaitingEos game={game} visible={game?.state === 'BETTING_LOCKED'} /></div></div></div>
}

function RouletteHistory({ history, onFairness }) {
  return <div className="slide-history" {...historyScope}><div className="history-title" {...historyScope}>Previous Rounds</div><div className="history-list" {...historyScope}>{history.slice(0, 12).map((round) => <button type="button" key={round.uuid} className={`history-element element-${tierFor(round.result?.multiplierBps)}`} title={`${round.result?.name || ''} - ${(Number(round.result?.multiplierBps) / 100).toFixed(2)}x`} onClick={() => onFairness(round)} {...historyScope}>{(Number(round.result?.multiplierBps) / 100).toFixed(2)}x</button>)}</div></div>
}

function RouletteTimer({ game, serverTimeOffset = 0 }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [])
  const state = game?.state || 'LOADING'
  const start = state === 'BETTING_OPEN' ? new Date(game.bettingOpensAt).getTime() : state === 'ROLLING' ? new Date(game.rollingStartedAt).getTime() : 0
  const end = state === 'BETTING_OPEN' ? new Date(game.bettingClosesAt).getTime() : state === 'ROLLING' ? new Date(game.rollingEndsAt).getTime() : 0
  const currentServerTime = now + serverTimeOffset
  const bettingDeadlineReached = state === 'BETTING_OPEN' && Number.isFinite(end) && currentServerTime >= end
  const displayState = bettingDeadlineReached ? 'BETTING_LOCKED' : state
  const remaining = end ? Math.max(0, end - currentServerTime) : 0
  const displayedRemaining = displayState === 'BETTING_OPEN' ? Math.min(remaining, rouletteCountdownDisplayMaximum) : remaining
  const progress = displayState === 'BETTING_LOCKED' ? 100 : start && end ? Math.min(100, Math.max(0, remaining / (end - start) * 100)) : 100
  const text = displayState === 'BETTING_OPEN' ? `Starting in ${(displayedRemaining / 1000).toFixed(2)}s` : displayState === 'BETTING_LOCKED' ? 'Awaiting EOS Block...' : displayState === 'ROLLING' ? 'Sliding...' : ['SETTLING', 'COMPLETE'].includes(displayState) ? 'Game Complete' : 'Loading...'
  return <div className="slide-timer-container" {...timerScope}><div className="slide-text text-fade-enter-active" key={displayState} {...timerScope}>{text}</div><div className="slide-timer" {...timerScope}><div className="timer-progress" style={{ width: `${progress}%` }} {...timerScope} /></div></div>
}

function MultiplierIcon() {
  return <svg className="multiplier-prefix" width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...controlsScope}><path d="M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...controlsScope} /><path d="M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...controlsScope} /></svg>
}

function RouletteControls({ user, currency, game, maintenance, busy, onBet, onFairness }) {
  const [amount, setAmount] = useState('0')
  const [target, setTarget] = useState('2')
  const [width, setWidth] = useState(() => window.innerWidth)
  const balance = Math.max(0, Number(user?.[currency]) || 0)
  const numeric = Math.max(0, Math.floor(Number(String(amount).replace(/,/g, '')) || 0))
  const maximum = Math.min(500000, balance)
  useEffect(() => { const resize = () => setWidth(window.innerWidth); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize) }, [])
  const commitAmount = (value) => setAmount(Math.max(0, Math.min(maximum, Math.floor(Number(value) || 0))).toLocaleString('en-US'))
  const preset = (kind) => { if (kind === 'clear') commitAmount(0); else if (kind === 'half') commitAmount(numeric / 2); else if (kind === 'double') commitAmount(numeric * 2); else if (kind === 'max') commitAmount(maximum); else commitAmount(numeric + kind) }
  const commitTarget = () => { const value = Math.max(1.01, Math.round((Number(target) || 1.01) * 100) / 100); setTarget(String(value)); return value }
  const updateTarget = (value) => { const clean = value.replace(/[^0-9.]/g, ''); const [whole, ...rest] = clean.split('.'); setTarget(rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole) }
  const canBet = game?.state === 'BETTING_OPEN' && !maintenance?.active && !busy
  const desktopButtons = <div className="presets presets-inline" {...controlsScope}><button type="button" onClick={() => preset('clear')} {...controlsScope}>Clear</button>{width > 700 && <><button type="button" onClick={() => preset(10)} {...controlsScope}>+10</button><button type="button" onClick={() => preset(100)} {...controlsScope}>+100</button><button type="button" onClick={() => preset(1000)} {...controlsScope}>+1,000</button><button type="button" onClick={() => preset(10000)} {...controlsScope}>+10,000</button></>}<button type="button" onClick={() => preset('half')} {...controlsScope}>1/2</button><button type="button" onClick={() => preset('double')} {...controlsScope}>2x</button><button type="button" onClick={() => preset('max')} {...controlsScope}>Max</button></div>
  const mobileButtons = <div className="presets presets-mobile" {...controlsScope}><button type="button" onClick={() => preset('clear')} {...controlsScope}>Clear</button><button type="button" onClick={() => preset(1000)} {...controlsScope}>+1,000</button><button type="button" onClick={() => preset(10000)} {...controlsScope}>+10,000</button><button type="button" onClick={() => preset('half')} {...controlsScope}>1/2</button><button className="preset-wide" type="button" onClick={() => preset('double')} {...controlsScope}>2x</button><button className="preset-wide" type="button" onClick={() => preset('max')} {...controlsScope}>Max</button></div>
  return <div className="xr-controls" {...controlsScope}><div className="amount-row" {...controlsScope}><div className="control-field amount-field" {...controlsScope}><img src={currencyIcon(currency)} alt="coin" {...controlsScope} /><input type="text" inputMode="numeric" placeholder="0" value={amount} onFocus={() => setAmount(String(amount).replace(/,/g, ''))} onBlur={() => commitAmount(numeric)} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ''))} {...controlsScope} />{width > 400 && desktopButtons}</div><button className="fair-button" type="button" aria-label="Provably Fair" onClick={onFairness} {...controlsScope}><SiteIcon name="fairness" {...controlsScope} /></button></div>{width <= 400 && mobileButtons}<div className="control-row multiplier-row" {...controlsScope}><div className="control-field target-field" {...controlsScope}><MultiplierIcon /><input type="text" inputMode="decimal" value={target} onChange={(event) => updateTarget(event.target.value)} onBlur={commitTarget} {...controlsScope} /></div><button className={`play-button${canBet ? '' : ' disabled'}`} type="button" disabled={!canBet} onClick={() => { const multiplier = commitTarget(); if (!user) notify({ type: 'error', message: 'Please sign in to perform this action.' }); else if (numeric <= 0) notify({ type: 'error', message: 'Please enter a bet amount first.' }); else onBet(numeric, multiplier) }} {...controlsScope}>{busy ? <ButtonLoading /> : <span {...controlsScope}>Place Bet</span>}</button></div></div>
}

function ButtonLoading() {
  return <div className="button-loading" {...loadingScope}>{Array.from({ length: 3 }, (_, index) => <div className="loading-element" key={index} {...loadingScope}><div className="element-inner" {...loadingScope} /></div>)}</div>
}

function LevelBadge({ level }) {
  const value = Number(level) || 0
  const theme = value >= 100 ? 'purple' : value >= 76 ? 'red' : value >= 51 ? 'orange' : value >= 26 ? 'green' : 'blue'
  return <div className={`box-level level-${theme}`} data-v-ff759fba=""><div className="level-inner" data-v-ff759fba="">{value}</div></div>
}

function RankBadge({ rank }) {
  const normalized = String(rank || '').toLowerCase()
  const hash = normalized === 'admin' ? 'f6df244d' : normalized === 'mod' ? '998a884b' : '0a259ddf'
  return <div className={`box-rank rank-${normalized}`} data-v-fc8af502=""><div className="rank-inner" data-v-fc8af502=""><img src={`/${normalized}.${hash}.svg`} alt={normalized} data-v-fc8af502="" /></div></div>
}

function AnimatedAmount({ value }) {
  const [display, setDisplay] = useState(0)
  const current = useRef(0)
  useEffect(() => {
    const from = current.current
    const to = Number(value) || 0
    const startedAt = performance.now()
    let frame
    const animate = (now) => {
      const progress = Math.min(1, (now - startedAt) / 450)
      const next = from + (to - from) * (1 - Math.pow(1 - progress, 3))
      current.current = next
      setDisplay(next)
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return formatAmount(display)
}

function ActiveBetCard({ bet }) {
  const [entered, setEntered] = useState(false)
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const rank = bet.rank && bet.rank !== 'user' ? bet.rank : null
  return <div className={`bet-card card-pop-enter-active${entered ? '' : ' card-pop-enter'}`} {...betsScope}><div className="element-user" {...betsScope}><div className="user-avatar" {...betsScope}><img className="avatar-image" src={bet.roblox_avatar_headshot || '/default-avatar.png'} alt="" {...betsScope} /></div><div className="user-details" {...betsScope}><div className="user-name" {...betsScope}>{rank ? <RankBadge rank={rank} /> : Number(bet.level) > 0 ? <LevelBadge level={bet.level} /> : null}<span {...betsScope}>{bet.username || 'Player'}</span></div><strong {...betsScope}>{(Number(bet.target_multiplier_bps) / 100).toFixed(2)}x</strong></div></div><div className="element-info" {...betsScope}><img src={currencyIcon(bet.currency)} alt="" {...betsScope} /><span {...betsScope}><AnimatedAmount value={bet.amount} /></span></div></div>
}

function ActiveBets({ bets }) {
  const totals = useMemo(() => ({ coins: bets.filter((bet) => bet.currency === 'coins').reduce((sum, bet) => sum + Number(bet.amount || 0), 0), rocoins: bets.filter((bet) => bet.currency === 'rocoins').reduce((sum, bet) => sum + Number(bet.amount || 0), 0) }), [bets])
  return <div className="active-bets" {...betsScope}><div className="bets-header" {...betsScope}><span {...betsScope}>Active Bets</span><div className="header-totals" {...betsScope}>{['rocoins', 'coins'].map((currency) => totals[currency] > 0 && <div className="total-amount" key={currency} {...betsScope}><img src={currencyIcon(currency)} alt={currency} {...betsScope} /><span {...betsScope}><AnimatedAmount value={totals[currency]} /></span></div>)}</div></div><div className="bets-list" {...betsScope}>{bets.map((bet) => <ActiveBetCard key={bet.uuid} bet={bet} />)}</div></div>
}

function CopyIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...fairScope}><path d="M15.4567 1.6667H7.87683C6.29075 1.6667 5.00008 2.95737 5.00008 4.54345V5.00004H4.5435C2.95741 5.00004 1.66675 6.2907 1.66675 7.87679V15.4565C1.66675 17.0427 2.95741 18.3334 4.5435 18.3334H12.1232C13.5803 18.3334 14.7751 17.2402 14.9619 15.8334H15.4566C17.0427 15.8334 18.3334 14.5427 18.3334 12.9566V4.54345C18.3334 2.95737 17.0427 1.6667 15.4567 1.6667ZM16.6667 12.9566C16.6667 13.6239 16.1239 14.1667 15.4567 14.1667H15.0001V7.87679C15.0001 6.2907 13.7094 5.00004 12.1233 5.00004H6.66675V4.54345C6.66675 3.8762 7.20958 3.33337 7.87683 3.33337H15.4566C16.1239 3.33337 16.6667 3.8762 16.6667 4.54345V12.9566Z" fill="currentColor" {...fairScope} /></svg>
}

function FairGame({ game }) {
  const fair = game.fair || {}
  const gameId = game.gameId || game._id || game.uuid || ''
  const serverSeedHash = fair.seed?.hash || fair.seedServerHash || fair.serverSeedHash || fair.hash || ''
  const serverSeed = fair.seed?.seedServer || fair.seedServer || fair.serverSeed || ''
  const eosBlockId = fair.clientSeed || fair.eosBlockId || fair.seed?.eosBlockId || fair.seedPublic || ''
  const eosBlockNumber = fair.eosBlockNumber || fair.seed?.eosBlockNumber || fair.blockId || ''
  const ticket = fair.ticket
  const resultAssetId = game.result?.assetId || game.result?.itemId || ''
  const values = [
    { label: 'Game ID', display: gameId, copyValue: gameId },
    { label: 'Server Seed (Hashed)', display: serverSeedHash, copyValue: serverSeedHash },
    ...(serverSeed ? [{ label: 'Server Seed', display: serverSeed, copyValue: serverSeed }] : []),
    ...(eosBlockId ? [{ label: 'EOS Block ID', display: eosBlockId, copyValue: eosBlockId }] : []),
    ...(eosBlockNumber ? [{ label: 'EOS Block Number', display: eosBlockNumber, copyValue: eosBlockNumber }] : []),
    ...(ticket != null ? [{ label: 'Ticket', display: Number(ticket).toLocaleString('en-US'), copyValue: ticket }] : []),
    ...(game.result?.multiplierBps ? [{ label: 'Winning Item', display: `${game.result.name || 'Limited'} (${(Number(game.result.multiplierBps) / 100).toFixed(2)}x)`, copyValue: resultAssetId }] : []),
  ]
  const copy = async (value) => {
    try {
      await copyText(String(value))
      notify({ type: 'success', message: 'Copied to your clipboard.' })
    } catch {
      notify({ type: 'error', message: 'Failed to copy.' })
    }
  }
  return <div className="modal-fair-game" {...fairScope}><div className="game-group" {...fairScope}><div className="game-header" {...fairScope}><span {...fairScope}>Game Fairness</span></div>{values.map(({ label, display, copyValue }) => <div className="game-element" key={label} {...fairScope}><div className="element-title" {...fairScope}>{label}</div><div className="element-content" {...fairScope}><span {...fairScope}>{display}</span><button className="button-copy" type="button" title="Copy to clipboard" onClick={() => copy(copyValue)} {...fairScope}><CopyIcon /></button></div></div>)}</div></div>
}

function XRoulette({ user }) {
  const [state, setState] = useState(() => ({ ...cachedRoulettePage, bets: [] }))
  const [currency, setCurrency] = useState(() => window.localStorage.getItem('currency') === 'coins' ? 'coins' : 'rocoins')
  const [busy, setBusy] = useState(false)
  const [fairness, setFairness] = useState(null)
  const busyRef = useRef(false)
  const mutationRef = useRef(false)
  const requestRef = useRef(null)
  const requestAbortRef = useRef(null)
  const revisionRef = useRef(0)
  const publish = useCallback((update) => {
    const incomingGame = update.game
    const incomingBlockNumber = incomingGame?.fair?.eosBlockNumber
    if (incomingGame?.uuid && incomingBlockNumber) rouletteEosBlocks.set(incomingGame.uuid, incomingBlockNumber)
    const rememberedBlockNumber = incomingGame?.uuid ? rouletteEosBlocks.get(incomingGame.uuid) : null
    const normalizedUpdate = incomingGame?.state === 'BETTING_LOCKED' && rememberedBlockNumber && !incomingBlockNumber
      ? { ...update, game: { ...incomingGame, fair: { ...incomingGame.fair, eosBlockNumber: rememberedBlockNumber } } }
      : update
    setState((current) => {
      let stableUpdate = normalizedUpdate
      const sameRound = stableUpdate.game?.uuid && stableUpdate.game.uuid === current.game?.uuid
      const incomingPhase = roulettePhaseOrder[stableUpdate.game?.state]
      const currentPhase = roulettePhaseOrder[current.game?.state]
      if (sameRound && Number.isFinite(incomingPhase) && Number.isFinite(currentPhase) && incomingPhase < currentPhase) {
        stableUpdate = { ...stableUpdate, game: current.game }
      }
      const stableGame = stableUpdate.game
      const changedRound = Boolean(stableGame?.uuid && current.game?.uuid && stableGame.uuid !== current.game.uuid)
      if (changedRound && !Object.prototype.hasOwnProperty.call(stableUpdate, 'bets')) {
        stableUpdate = { ...stableUpdate, bets: [] }
      }
      const returningToStart = stableUpdate.game
        ? stableUpdate.game.state === 'BETTING_OPEN' && current.game && current.game.state !== 'BETTING_OPEN'
        : current.returningToStart
      const next = { ...current, ...stableUpdate, returningToStart }
      cachedRoulettePage = next
      if (Object.prototype.hasOwnProperty.call(stableUpdate, 'user') && stableUpdate.user) {
        window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: stableUpdate.user } }))
      }
      return next
    })
  }, [])
  const refresh = useCallback(async () => {
    if (mutationRef.current) return
    if (requestRef.current) return requestRef.current
    const revision = revisionRef.current
    const controller = new AbortController()
    requestAbortRef.current = controller
    const request = fetch('/api/x-roulette/state', { headers: { Accept: 'application/json' }, signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || mutationRef.current || revision !== revisionRef.current) return
        const serverTime = new Date(payload.serverTime).getTime()
        const measuredOffset = Number.isFinite(serverTime) ? serverTime - Date.now() : 0
        const previousOffset = cachedRoulettePage.serverTimeOffset
        const stableOffset = cachedRoulettePage.game && Math.abs(measuredOffset - previousOffset) <= 250 ? previousOffset : measuredOffset
        publish({ ...payload, serverTimeOffset: stableOffset })
      })
      .catch(() => {})
      .finally(() => {
        if (requestRef.current === request) requestRef.current = null
        if (requestAbortRef.current === controller) requestAbortRef.current = null
      })
    requestRef.current = request
    return request
  }, [publish])
  useEffect(() => { document.title = 'X-Roulette - RoRisk.com' }, [])
  useEffect(() => {
    const realtimeState = (event) => {
      revisionRef.current += 1
      publish(event.detail || {})
    }
    const realtimeBet = (event) => {
      const { game, bet: placedBet } = event.detail || {}
      if (!game) return
      revisionRef.current += 1
      const sameRound = game.uuid === cachedRoulettePage.game?.uuid
      const currentBets = sameRound ? cachedRoulettePage.bets : []
      publish({ game, ...(placedBet ? { bets: [placedBet, ...currentBets.filter((bet) => bet.uuid !== placedBet.uuid)] } : { bets: currentBets }) })
    }
    window.addEventListener('rorisk:roulette-state', realtimeState)
    window.addEventListener('rorisk:roulette-bet', realtimeBet)
    refresh()
    const timer = window.setInterval(refresh, 500)
    return () => {
      window.clearInterval(timer)
      requestAbortRef.current?.abort()
      window.removeEventListener('rorisk:roulette-state', realtimeState)
      window.removeEventListener('rorisk:roulette-bet', realtimeBet)
    }
  }, [publish, refresh])
  useEffect(() => { const update = (event) => setCurrency(event.detail?.currency === 'coins' ? 'coins' : 'rocoins'); window.addEventListener('rorisk:currency-change', update); return () => window.removeEventListener('rorisk:currency-change', update) }, [])
  const bet = async (amount, targetMultiplier) => {
    if (busyRef.current) return
    requestAbortRef.current?.abort()
    requestAbortRef.current = null
    requestRef.current = null
    busyRef.current = true
    mutationRef.current = true
    revisionRef.current += 1
    setBusy(true)
    try {
      const response = await fetch('/api/x-roulette/bet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, targetMultiplier, currency }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to place this bet.')
      publish({ game: payload.game, bets: payload.bets })
      if (payload.user) window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: payload.user } }))
    } catch (error) { notify({ type: 'error', message: error.message || 'Unable to place this bet.' }) } finally { mutationRef.current = false; busyRef.current = false; setBusy(false); refresh() }
  }
  const myBets = state.bets.filter((bet) => userId(bet) === userId(user))
  return <div className="x-roulette" {...pageScope}>{state.maintenance?.active && <div className="state-banner error" {...pageScope}>{state.maintenance.reason || 'X-Roulette is currently unavailable.'}</div>}<RouletteHistory history={state.history} onFairness={setFairness} /><RouletteGame game={state.game} bets={myBets} currency={currency} returningToStart={state.returningToStart} /><RouletteTimer game={state.game} serverTimeOffset={state.serverTimeOffset} /><RouletteControls user={user} currency={currency} game={state.game} maintenance={state.maintenance} busy={busy} onBet={bet} onFairness={() => state.game && setFairness(state.game)} />{state.bets.length > 0 && <ActiveBets bets={state.bets} />}{fairness && <ModalAnimation label="Game Fairness" onClose={() => setFairness(null)}><FairGame game={fairness} /></ModalAnimation>}</div>
}

export default XRoulette
