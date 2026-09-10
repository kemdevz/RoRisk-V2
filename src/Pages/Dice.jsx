import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Bets from '../components/Bets'
import FairSeedModal from '../components/FairSeedModal'
import SiteIcon from '../components/Icons'
import ModalAnimation from '../components/ModalAnimation'
import { getFairClientSeed, incrementFairNonce } from '../lib/Fairness'
import { notify } from '../lib/Notifications'
import { playSound } from '../lib/Sounds'

const pageScope = { 'data-v-04c0a362': '' }
const headerScope = { 'data-v-4535443b': '' }
const controlsScope = { 'data-v-490af9b3': '' }
const gameScope = { 'data-v-8fd69488': '' }
const MIN_TICKETS = 100
const MAX_TICKETS = 9300

const formatRoll = (ticket) => (ticket / 100).toFixed(2)
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

function winTickets(mode, low, high) {
  if (mode === 'under') return low
  if (mode === 'over') return 9999 - low
  if (mode === 'inside') return high - low + 1
  return low + (9999 - high)
}

function normalizeTargets(mode, low, high) {
  let nextLow = clamp(Math.floor(low), 0, 9999)
  let nextHigh = clamp(Math.floor(high), 0, 9999)
  if (mode === 'under') nextLow = clamp(nextLow, MIN_TICKETS, MAX_TICKETS), nextHigh = nextLow
  else if (mode === 'over') nextLow = clamp(nextLow, 9999 - MAX_TICKETS, 9999 - MIN_TICKETS), nextHigh = nextLow
  else if (mode === 'inside') {
    if (nextHigh <= nextLow) nextHigh = Math.min(9999, nextLow + 1)
    let tickets = nextHigh - nextLow + 1
    if (tickets < MIN_TICKETS) {
      nextHigh = Math.min(9999, nextLow + MIN_TICKETS - 1)
      tickets = nextHigh - nextLow + 1
      if (tickets < MIN_TICKETS) nextLow = Math.max(0, nextHigh - MIN_TICKETS + 1)
    } else if (tickets > MAX_TICKETS) nextHigh = nextLow + MAX_TICKETS - 1
  } else {
    if (nextHigh <= nextLow) nextHigh = Math.min(9999, nextLow + 1)
    let tickets = nextLow + 9999 - nextHigh
    if (tickets < MIN_TICKETS) {
      const difference = MIN_TICKETS - tickets
      nextHigh = Math.max(nextLow + 1, nextHigh - difference)
      tickets = nextLow + 9999 - nextHigh
      if (tickets < MIN_TICKETS) nextLow = Math.min(nextHigh - 1, nextLow + MIN_TICKETS - tickets)
    } else if (tickets > MAX_TICKETS) {
      const difference = tickets - MAX_TICKETS
      nextHigh = Math.min(9999, nextHigh + Math.ceil(difference / 2))
      nextLow = Math.max(0, nextLow - Math.floor(difference / 2))
      if (nextHigh <= nextLow) nextHigh = nextLow + 1
      tickets = nextLow + 9999 - nextHigh
      if (tickets > MAX_TICKETS) nextLow = Math.max(0, Math.min(nextHigh - 1, MAX_TICKETS - (9999 - nextHigh)))
    }
  }
  return { low: nextLow, high: nextHigh }
}

function RangeIcon({ mode }) {
  const circle = (cx, key) => <circle key={key} cx={cx} cy="6" r={mode === 'under' || mode === 'over' ? '3' : '2.5'} fill="currentColor" />
  return <span className="range-icon" {...controlsScope}><svg viewBox="0 0 24 12" fill="none" aria-hidden="true" {...controlsScope}><path d="M2 6h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />{mode === 'under' ? circle(12, 1) : mode === 'over' ? circle(18, 1) : mode === 'outside' ? [circle(4, 1), circle(20, 2)] : [circle(9, 1), circle(15, 2)]}</svg></span>
}

function DiceHeader({ onFairness }) {
  return <div className="dice-header" {...headerScope}><div className="dice-header-left" {...headerScope}><SiteIcon name="dice" {...headerScope} /> Dice</div><div className="dice-header-center" {...headerScope}><img src="/api/casino-images/dice/logo.ee8858f3.png" alt="logo" {...headerScope} /></div><div className="dice-header-right" role="button" tabIndex="0" onClick={onFairness} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onFairness() }} {...headerScope}><SiteIcon name="fairness" {...headerScope} /> Fairness</div></div>
}

function DiceControls({ amount, setAmount, balance, currency, mode, setMode, busy, onPlay, onFairness }) {
  const numericAmount = Number(String(amount).replace(/,/g, '')) || 0
  const formatAmount = (value) => Math.min(500000, Math.max(50, Math.floor(value || 50))).toLocaleString('en-US')
  const applyAction = (action) => {
    const current = numericAmount || 50
    if (action === 'half') setAmount(formatAmount(Math.max(50, Math.floor(current / 2))))
    else if (action === 'double') setAmount(formatAmount(Math.min(500000, current * 2)))
    else setAmount(formatAmount(Math.min(500000, Math.max(50, balance))))
  }
  return <div className="dice-controls" {...controlsScope}>
    <div className="bet-amount-section" {...controlsScope}><div className="dice-title" {...controlsScope}>Bet Amount</div><div className="bet-amount-selector" {...controlsScope}><img className="bet-icon" src={currency === 'rocoins' ? '/rocoin.2d3febd5.svg' : '/Rewards/coin.12f4bce8.svg'} alt="Bet" {...controlsScope} /><input className="bet-amount-display" type="text" inputMode="numeric" placeholder="0" value={amount} onFocus={() => setAmount(String(amount).replace(/,/g, ''))} onBlur={() => setAmount(formatAmount(numericAmount))} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ''))} {...controlsScope} /><div className="bet-actions" {...controlsScope}><button type="button" onClick={() => applyAction('half')} {...controlsScope}>1/2</button><button type="button" onClick={() => applyAction('double')} {...controlsScope}>2x</button><button type="button" onClick={() => applyAction('max')} {...controlsScope}>Max</button></div></div></div>
    <div className="range-type-section" {...controlsScope}><div className="dice-title" {...controlsScope}>Range Type</div><div className="range-type-buttons" {...controlsScope}>{[['under', 'Roll Under'], ['over', 'Roll Over'], ['outside', 'Outside'], ['inside', 'Inside']].map(([value, title]) => <button className={`range-type-btn${mode === value ? ' active' : ''}`} type="button" title={title} aria-label={title} onClick={() => setMode(value)} key={value} {...controlsScope}><RangeIcon mode={value} /></button>)}</div></div>
    <div className="play-button-section" {...controlsScope}><button className="button-action button-play" type="button" disabled={busy || numericAmount < 50 || numericAmount > 500000} onClick={onPlay} {...controlsScope}><span {...controlsScope}>Start Game</span></button></div>
    <div className="fairness-section" {...controlsScope}><button className="button-fairness" type="button" onClick={onFairness} {...controlsScope}><SiteIcon name="fairness" {...controlsScope} /> Fairness</button></div>
  </div>
}

function DiceGame({ mode, setMode, low, high, setTargets, result, openingMotion }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(null)
  const [popup, setPopup] = useState(null)
  const popupTimer = useRef(null)
  const lastTick = useRef(0)
  const rangeMode = mode === 'inside' || mode === 'outside'
  const tickets = winTickets(mode, low, high)
  const multiplier = Math.floor((0.95 * 10000 / tickets) * 10000) / 10000
  const chance = Math.round((tickets / 10000) * 10000) / 100

  useEffect(() => () => window.clearTimeout(popupTimer.current), [])

  const setTicket = useCallback((kind, ticket) => {
    let nextLow = kind === 'low' ? ticket : low
    let nextHigh = kind === 'high' ? ticket : high
    if (rangeMode) {
      if (kind === 'low') nextLow = clamp(nextLow, 0, nextHigh - 99)
      else nextHigh = clamp(nextHigh, nextLow + 99, 9999)
    }
    setTargets(normalizeTargets(mode, nextLow, nextHigh))
    const now = performance.now()
    if (now - lastTick.current > 45) { playSound('tick', { volume: 0.35 }); lastTick.current = now }
  }, [high, low, mode, rangeMode, setTargets])

  const ticketFromPointer = useCallback((event) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return clamp(Math.round(((event.clientX - rect.left) / rect.width) * 9999), 0, 9999)
  }, [])

  const startDrag = (event, requested) => {
    event.preventDefault()
    const ticket = ticketFromPointer(event)
    const kind = requested || (!rangeMode || Math.abs(ticket - low) <= Math.abs(ticket - high) ? 'low' : 'high')
    window.clearTimeout(popupTimer.current)
    setDragging(kind)
    setPopup({ kind, leaving: false })
    setTicket(kind, ticket)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const moveDrag = (event) => dragging && setTicket(dragging, ticketFromPointer(event))
  const endDrag = () => {
    setDragging(null)
    setPopup((current) => current ? { ...current, leaving: true } : null)
    window.clearTimeout(popupTimer.current)
    popupTimer.current = window.setTimeout(() => setPopup(null), 120)
  }
  const handleKey = (event, kind) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(event.key)) return
    event.preventDefault()
    const step = event.shiftKey ? 100 : 1
    setTicket(kind, (kind === 'low' ? low : high) + (['ArrowRight', 'ArrowUp'].includes(event.key) ? step : -step))
  }
  const applyTickets = (count) => {
    const nextTickets = clamp(Math.round(count), MIN_TICKETS, MAX_TICKETS)
    if (mode === 'under') setTargets({ low: nextTickets, high: nextTickets })
    else if (mode === 'over') setTargets({ low: 9999 - nextTickets, high: 9999 - nextTickets })
    else if (mode === 'inside') {
      const center = Math.floor((low + high) / 2)
      const half = Math.floor((nextTickets - 1) / 2)
      let nextLow = Math.max(0, center - half)
      let nextHigh = nextLow + nextTickets - 1
      if (nextHigh > 9999) { nextHigh = 9999; nextLow = nextHigh - nextTickets + 1 }
      setTargets(normalizeTargets(mode, nextLow, nextHigh))
    } else {
      const gap = 10000 - nextTickets
      const center = Math.floor((low + high) / 2)
      const half = Math.floor(gap / 2)
      let nextLow = Math.max(0, center - half)
      let nextHigh = nextLow + gap - 1
      if (nextHigh > 9999) { nextHigh = 9999; nextLow = Math.max(0, nextHigh - gap + 1) }
      if (nextHigh <= nextLow) nextHigh = Math.min(9999, nextLow + 1)
      setTargets(normalizeTargets(mode, nextLow, nextHigh))
    }
  }
  const commitInput = (event, kind) => {
    const value = Number.parseFloat(event.currentTarget.value)
    if (!Number.isFinite(value) || value <= 0) return
    if (kind === 'multiplier') applyTickets(0.95 * 10000 / value)
    else if (kind === 'chance') applyTickets(value / 100 * 10000)
    else setTargets(normalizeTargets(mode, Math.round(value * 100), high))
  }
  const segments = useMemo(() => mode === 'under'
    ? [{ kind: 'win', left: 0, width: low / 100 }, { kind: 'lose', left: low / 100, width: 100 - low / 100 }]
    : mode === 'over'
      ? [{ kind: 'lose', left: 0, width: low / 100 }, { kind: 'win', left: low / 100, width: 100 - low / 100 }]
      : mode === 'inside'
        ? [{ kind: 'lose', left: 0, width: low / 100 }, { kind: 'win', left: low / 100, width: (high - low) / 100 }, { kind: 'lose', left: high / 100, width: 100 - high / 100 }]
        : [{ kind: 'win', left: 0, width: low / 100 }, { kind: 'lose', left: low / 100, width: (high - low) / 100 }, { kind: 'win', left: high / 100, width: 100 - high / 100 }], [high, low, mode])
  const displayRoll = result?.roll ?? (rangeMode ? Math.round((low + high) / 2) : low)
  const resultClass = result ? (result.won ? ' win' : ' lose') : ''

  const diceMotionClass = result ? `moving ${result.moveDirection || ''}` : openingMotion ? 'moving moving-right' : ''
  return <div className="dice-game" {...gameScope}><div className="game-background" {...gameScope}><img src="/main.c55d6769.png" alt="bg" {...gameScope} /></div><div className="slider-section" {...gameScope}><div className="slider-track" onPointerDown={(event) => startDrag(event)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} {...gameScope}><div className="slider-line" ref={trackRef} {...gameScope}><div className={`dice-result${resultClass}`} style={{ left: result ? `${clamp(displayRoll / 100, 6, 94)}%` : '50%' }} {...gameScope}><img key={`${result?.uuid || 'initial'}-${displayRoll}-${openingMotion}`} className={diceMotionClass.trim()} src="/api/casino-images/dice/dice.png" alt="Dice" draggable="false" {...gameScope} /><span {...gameScope}>{formatRoll(displayRoll)}</span></div><div className="track-base" {...gameScope} />{segments.map((segment, index) => <div className={`track-fill ${segment.kind}`} style={{ left: `${segment.left}%`, width: `${segment.width}%` }} key={index} {...gameScope} />)}{result && <div className="result-highlight" style={{ left: `${result.roll / 100}%` }} {...gameScope} />}{popup && <div className={`handle-value ${popup.leaving ? 'selector-pop-leave-active selector-pop-leave-to' : 'selector-pop-enter-active'}`} style={{ left: `${(popup.kind === 'low' ? low : high) / 100}%` }} {...gameScope}>{formatRoll(popup.kind === 'low' ? low : high)}</div>}<div className="slider-handle" style={{ left: `${low / 100}%` }} role="slider" tabIndex="0" aria-label="Low target" aria-valuemin="0" aria-valuemax="99.99" aria-valuenow={low / 100} onPointerDown={(event) => { event.stopPropagation(); startDrag(event, 'low') }} onKeyDown={(event) => handleKey(event, 'low')} {...gameScope} />{rangeMode && <div className="slider-handle" style={{ left: `${high / 100}%` }} role="slider" tabIndex="0" aria-label="High target" aria-valuemin="0" aria-valuemax="99.99" aria-valuenow={high / 100} onPointerDown={(event) => { event.stopPropagation(); startDrag(event, 'high') }} onKeyDown={(event) => handleKey(event, 'high')} {...gameScope} />}</div></div><div className="slider-scale" {...gameScope}><span {...gameScope}>0</span><span {...gameScope}>25</span><span {...gameScope}>50</span><span {...gameScope}>75</span><span {...gameScope}>100</span></div></div>
    <div className={`control-panel${rangeMode ? '' : ' three-columns'}`} {...gameScope}><div className="input-group" {...gameScope}><label className="input-label" {...gameScope}>Payout</label><div className="input-wrapper" {...gameScope}><input className="input-field" type="text" key={`multiplier-${multiplier}`} defaultValue={multiplier.toFixed(3)} onBlur={(event) => commitInput(event, 'multiplier')} {...gameScope} /><span className="input-suffix" {...gameScope}>X</span></div></div><div className="input-group" {...gameScope}><label className="input-label" {...gameScope}>Win Chance</label><div className="input-wrapper" {...gameScope}><input className="input-field" type="text" key={`chance-${chance}`} defaultValue={chance.toFixed(2)} onBlur={(event) => commitInput(event, 'chance')} {...gameScope} /><span className="input-suffix" {...gameScope}>%</span></div></div>{!rangeMode && <div className="input-group" {...gameScope}><label className="input-label" {...gameScope}>{mode === 'under' ? 'Roll Under' : 'Roll Over'}</label><div className="input-wrapper" {...gameScope}><input className="input-field" type="text" key={`target-${low}`} defaultValue={formatRoll(low)} onBlur={(event) => commitInput(event, 'target')} {...gameScope} /><button className="roll-toggle" type="button" title={mode === 'under' ? 'Switch to Roll Over' : 'Switch to Roll Under'} onClick={() => setMode(mode === 'under' ? 'over' : 'under')} {...gameScope}><svg viewBox="0 0 24 24" aria-hidden="true" {...gameScope}><path d="M5 8h12m0 0-3-3m3 3-3 3M19 16H7m0 0 3-3m-3 3 3 3" /></svg></button></div></div>}</div>
  </div>
}

function Dice({ user }) {
  const [entryPhase, setEntryPhase] = useState('from')
  const [openingMotion, setOpeningMotion] = useState(false)
  const [amount, setAmount] = useState('50')
  const [mode, setModeState] = useState('under')
  const [targets, setTargets] = useState({ low: 5000, high: 5000 })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [games, setGames] = useState([])
  const [showFairness, setShowFairness] = useState(false)
  const [currency, setCurrency] = useState(() => window.localStorage.getItem('currency') === 'coins' ? 'coins' : 'rocoins')
  const balance = Number(user?.[currency]) || 0

  useEffect(() => {
    document.title = 'Dice - RoRisk.com'
    let secondFrame
    let finishTimer
    let motionTimer
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setEntryPhase('active')
        setOpeningMotion(true)
        finishTimer = window.setTimeout(() => setEntryPhase('idle'), 200)
        motionTimer = window.setTimeout(() => setOpeningMotion(false), 700)
      })
    })
    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) window.cancelAnimationFrame(secondFrame)
      if (finishTimer) window.clearTimeout(finishTimer)
      if (motionTimer) window.clearTimeout(motionTimer)
    }
  }, [])
  useEffect(() => {
    const updateCurrency = (event) => setCurrency(event.detail?.currency === 'coins' ? 'coins' : 'rocoins')
    window.addEventListener('rorisk:currency-change', updateCurrency)
    return () => window.removeEventListener('rorisk:currency-change', updateCurrency)
  }, [])
  useEffect(() => {
    fetch('/api/dice/games')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload) => {
        const loadedGames = payload.games || []
        setGames(loadedGames)
      })
      .catch(() => {})
  }, [])
  const setMode = (nextMode) => {
    setTargets((current) => mode === 'under' || mode === 'over'
      ? nextMode === 'under' || nextMode === 'over' ? normalizeTargets(nextMode, current.low, current.low) : normalizeTargets(nextMode, 2500, 7500)
      : normalizeTargets(nextMode, current.low, nextMode === 'under' || nextMode === 'over' ? current.low : current.high))
    setModeState(nextMode)
  }
  const openFairness = () => user ? setShowFairness(true) : notify({ type: 'error', message: 'Please sign in to perform this action.' })
  const play = async () => {
    if (!user) { notify({ type: 'error', message: 'Please sign in to perform this action.' }); return }
    const wager = Number(String(amount).replace(/,/g, ''))
    if (!Number.isFinite(wager) || wager < 50) { notify({ type: 'error', message: 'Minimum bet is 50 Coins.' }); return }
    setBusy(true)
    try {
      const response = await fetch('/api/dice/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Math.round(wager), currency, mode, targetLow: targets.low, targetHigh: targets.high, clientSeed: getFairClientSeed(user) }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to start this game.')
      incrementFairNonce(user, 1)
      setResult((current) => ({ ...payload.game, moveDirection: payload.game.roll < (current?.roll ?? 5000) ? 'moving-left' : 'moving-right' }))
      setGames((current) => [payload.game, ...current].slice(0, 30))
      window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: payload.user } }))
      playSound('roll')
      if (payload.game.won) playSound('success')
    } catch (error) { notify({ type: 'error', message: error.message || 'Unable to start this game.' }) } finally { setBusy(false) }
  }

  const entryClass = entryPhase === 'from' ? ' page-enter-active page-enter-from' : entryPhase === 'active' ? ' page-enter-active' : ''
  return <div className={`dice${entryClass}`} {...pageScope}><div className="dice-content" {...pageScope}><DiceHeader onFairness={openFairness} /><div className="dice-container" {...pageScope}><DiceControls amount={amount} setAmount={setAmount} balance={balance} currency={currency} mode={mode} setMode={setMode} busy={busy} onPlay={play} onFairness={openFairness} /><DiceGame mode={mode} setMode={setMode} low={targets.low} high={targets.high} setTargets={setTargets} result={result} openingMotion={openingMotion} /></div></div><Bets games={games} />{showFairness && <ModalAnimation label="Seed Fairness" onClose={() => setShowFairness(false)}><FairSeedModal user={user} /></ModalAnimation>}</div>
}

export default Dice
