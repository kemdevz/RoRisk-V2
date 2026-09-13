import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Bets from '../components/Bets'
import FairSeedModal from '../components/FairSeedModal'
import SiteIcon from '../components/Icons'
import ModalAnimation from '../components/ModalAnimation'
import { getFairClientSeed, getFairSeedState, incrementFairNonce } from '../lib/Fairness'
import { notify } from '../lib/Notifications'
import { playSound } from '../lib/Sounds'

const pageScope = { 'data-v-7d12f3a8': '' }
const headerScope = { 'data-v-5f160c75': '' }
const controlsScope = { 'data-v-4a4ff12d': '' }
const gameScope = { 'data-v-68c58efe': '' }
const tileScope = { 'data-v-607606b4': '' }
const loadingScope = { 'data-v-21317e4a': '' }
const image = (name) => `/api/casino-images/mines/${name}`
const currencyImage = (currency) => currency === 'coins' ? '/Rewards/coin.12f4bce8.svg' : '/rocoin.2d3febd5.svg'
const formatAmount = (value) => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US')

function multiplierFor(reveals, mines) {
  if (reveals <= 0) return 0.9
  let multiplier = 0.9
  for (let index = 0; index < reveals; index += 1) multiplier *= (25 - index) / (25 - mines - index)
  return Math.max(0.9, Math.floor(multiplier * 100) / 100)
}

function MinusIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true" {...controlsScope}><path d="M4 9h12v2H4z" {...controlsScope} /></svg>
}

function PlusIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true" {...controlsScope}><path d="M9 4h2v5h5v2h-5v5H9v-5H4V9h5z" {...controlsScope} /></svg>
}

function ButtonLoading() {
  return <div className="button-loading" {...loadingScope}>{Array.from({ length: 3 }, (_, index) => <div className="loading-element" key={index} {...loadingScope}><div className="element-inner" {...loadingScope} /></div>)}</div>
}

function WinIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" {...gameScope}><rect width="48" height="48" rx="24" fill="#6BE098" fillOpacity="0.2" {...gameScope} /><path d="M25.4767 27.614C25.3956 27.524 25.2931 27.4567 25.1872 27.4007C24.9565 27.2787 24.7041 27.2047 24.4536 27.138V29.1059C24.8602 29.0593 25.3271 28.9097 25.5406 28.5249C25.6425 28.3411 25.6628 28.1152 25.6212 27.9106C25.5987 27.7997 25.5522 27.6979 25.4767 27.614Z" fill="#6BE098" {...gameScope} /><path d="M22.5475 24.468C22.4776 24.5715 22.4338 24.689 22.4217 24.814C22.4095 24.9392 22.4163 25.0785 22.4633 25.1964C22.5079 25.3087 22.6015 25.3917 22.6982 25.4585C22.8066 25.5332 22.9258 25.5916 23.0472 25.6411C23.1491 25.6827 23.2637 25.7224 23.3872 25.7608V23.98C23.0752 24.0475 22.7342 24.1917 22.5475 24.468Z" fill="#6BE098" {...gameScope} /><path d="M25.548 28.5103C25.5454 28.5151 25.5425 28.5201 25.5397 28.5254C25.543 28.5193 25.5456 28.5147 25.548 28.5103Z" fill="black" {...gameScope} /><path d="M25.5591 28.492C25.5599 28.4905 25.5598 28.4906 25.5591 28.492Z" fill="black" {...gameScope} /><path d="M25.1368 17.7868C26.7876 16.3809 27.8907 13.2137 27.2119 13.0752C26.3099 12.891 24.3512 13.6984 23.4045 13.8407C22.0617 14.005 20.5993 12.3646 19.7784 13.279C19.1109 14.0224 20.2569 16.7262 22.0498 17.9041C16.7008 20.5693 9.18246 33.9487 22.2986 34.9195C40.4471 36.2628 31.3595 20.384 25.1368 17.7868ZM26.6954 28.3385C26.6396 28.8601 26.3669 29.3318 25.9593 29.652C25.529 29.9901 24.9892 30.1474 24.4529 30.1915V30.7678C24.4529 30.922 24.3864 31.0711 24.2726 31.1732C24.1161 31.3136 23.8861 31.3483 23.6961 31.2595C23.5086 31.172 23.3853 30.977 23.3853 30.7678V30.1379C23.2934 30.1202 23.2021 30.0991 23.1118 30.074C22.6106 29.9344 22.1457 29.6623 21.8061 29.2596C21.6369 29.0589 21.499 28.8312 21.4036 28.5853C21.3787 28.5211 21.3564 28.4557 21.337 28.3895C21.3194 28.3296 21.3012 28.2687 21.2949 28.2063C21.2843 28.1016 21.3048 27.9947 21.353 27.9014C21.4519 27.7095 21.6605 27.5936 21.8734 27.6129C22.083 27.6317 22.2666 27.7792 22.3326 27.9817C22.3529 28.0441 22.3667 28.108 22.3896 28.1697C22.4122 28.231 22.4395 28.2906 22.4716 28.3473C22.535 28.459 22.6145 28.562 22.706 28.6514C22.8946 28.8357 23.1349 28.9554 23.3853 29.0267V26.8855C22.8956 26.7569 22.3901 26.5909 21.9856 26.2721C21.7891 26.1171 21.6223 25.9246 21.5131 25.6966C21.3979 25.4561 21.3501 25.1881 21.3482 24.9219C21.3462 24.6516 21.3968 24.3837 21.5081 24.1375C21.6122 23.9069 21.7622 23.6999 21.9461 23.5283C22.3393 23.1614 22.8615 22.9568 23.3854 22.8816V22.2833C23.3854 22.1292 23.4518 21.98 23.5657 21.8779C23.7223 21.7375 23.9521 21.7029 24.1422 21.7916C24.3297 21.8791 24.4529 22.0741 24.4529 22.2833V22.8783C24.5227 22.8872 24.5923 22.8979 24.6616 22.9106C25.176 23.005 25.6791 23.2204 26.0553 23.5963C26.2335 23.7744 26.3794 23.9866 26.482 24.218C26.5106 24.2826 26.5357 24.3486 26.5574 24.416C26.5776 24.4788 26.5979 24.5434 26.6076 24.609C26.623 24.7136 26.6073 24.8217 26.5631 24.9174C26.4726 25.1135 26.2697 25.2383 26.0562 25.2291C25.8464 25.2198 25.6564 25.0813 25.5813 24.8825C25.5589 24.8234 25.5477 24.7608 25.5249 24.7019C25.5019 24.6422 25.472 24.5853 25.4377 24.5315C25.3709 24.4269 25.2843 24.3372 25.1855 24.2634C24.9716 24.1032 24.7121 24.0197 24.4528 23.9731V26.0221C24.7609 26.097 25.0694 26.1785 25.3646 26.2966C25.8108 26.475 26.2337 26.7485 26.4773 27.1798C26.4395 27.1126 26.4027 27.0471 26.4785 27.182C26.553 27.3146 26.5175 27.2514 26.4801 27.185C26.6739 27.5312 26.7375 27.9452 26.6954 28.3385Z" fill="#6BE098" {...gameScope} /></svg>
}

function MinesHeader({ onFairness }) {
  return <div className="mines-header" {...headerScope}><div className="mines-header-left" {...headerScope}><SiteIcon name="mines" {...headerScope} /> Mines</div><div className="mines-header-center" {...headerScope}><img src={image('logo.ee8858f3.png')} alt="logo" {...headerScope} /></div><div className="mines-header-right" role="button" tabIndex="0" onClick={onFairness} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onFairness() }} {...headerScope}><SiteIcon name="fairness" {...headerScope} /> Fairness</div></div>
}

function MinesControls({ amount, setAmount, mines, setMines, currency, balance, game, loadingAction, revealBusy, onStart, onCashout, onAutoSelect, onFairness }) {
  const active = game?.state === 'created' || game?.state === 'running'
  const reveals = game?.revealed_tiles?.length || 0
  const multiplier = active ? multiplierFor(reveals, game.mines_count) : 0
  const totalProfit = active ? Math.max(0, Math.floor(game.bet_amount * multiplier - game.bet_amount)) : 0
  const numericAmount = Number(String(amount).replace(/,/g, '')) || 0
  const validBet = numericAmount >= 50 && numericAmount <= 500000 && numericAmount <= balance
  const normalizeAmount = (value) => Math.min(500000, Math.max(50, Math.floor(Number(value) || 50)))
  const applyAmount = (action) => {
    const value = numericAmount || 50
    if (action === 'half') setAmount(formatAmount(normalizeAmount(Math.floor(value / 2))))
    else if (action === 'double') setAmount(formatAmount(normalizeAmount(value * 2)))
    else setAmount(formatAmount(normalizeAmount(Math.min(500000, balance))))
  }
  return <div className="mines-controls" {...controlsScope}>
    <div className="bet-amount-section" {...controlsScope}><div className="mines-title" {...controlsScope}>Bet Amount</div><div className="bet-amount-selector" {...controlsScope}><img className="bet-icon" src={currencyImage(currency)} alt="Bet" {...controlsScope} /><input className="bet-amount-display" type="text" inputMode="numeric" placeholder="0" value={amount} disabled={active} onFocus={() => setAmount(String(amount).replace(/,/g, ''))} onBlur={() => setAmount(formatAmount(normalizeAmount(numericAmount)))} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ''))} {...controlsScope} /><div className="bet-actions" {...controlsScope}><button type="button" disabled={active} onClick={() => applyAmount('half')} {...controlsScope}>1/2</button><button type="button" disabled={active} onClick={() => applyAmount('double')} {...controlsScope}>2x</button><button type="button" disabled={active} onClick={() => applyAmount('max')} {...controlsScope}>Max</button></div></div></div>
    <div className="mines-count-section" {...controlsScope}><div className="mines-split-header" {...controlsScope}><div className="mines-title" {...controlsScope}>Mines</div><div className="mines-title mines-title-right" {...controlsScope}>Gems</div></div><div className="mines-split-row" {...controlsScope}><div className="mines-quantity-selector" {...controlsScope}><img className="mines-icon" src={image('mine-icon.2434c5b8.png')} alt="Mines" {...controlsScope} /><div className="mines-quantity" {...controlsScope}><span className="flip-number" key={`mines-${mines}`} {...controlsScope}>{mines}</span></div><div className="quantity-controls" {...controlsScope}><button className="quantity-btn minus-btn" type="button" disabled={active || mines <= 1} onClick={() => setMines((value) => Math.max(1, value - 1))} {...controlsScope}><MinusIcon /></button><button className="quantity-btn plus-btn" type="button" disabled={active || mines >= 24} onClick={() => setMines((value) => Math.min(24, value + 1))} {...controlsScope}><PlusIcon /></button></div></div><div className="gems-box" {...controlsScope}><img className="gems-icon" src={image('diamond.2c57ac69.png')} alt="Gems" {...controlsScope} /><div className="gems-value" {...controlsScope}><span className="flip-number" key={`gems-${25 - mines}`} {...controlsScope}>{25 - mines}</span></div></div></div></div>
    <div className="total-profit-section" {...controlsScope}><div className="mines-title" {...controlsScope}>Total profit ({multiplier.toFixed(2)}x)</div><div className="total-profit-selector" {...controlsScope}><img className="bet-icon" src={currencyImage(currency)} alt="Token" {...controlsScope} /><input className="bet-amount-display" type="text" disabled value={formatAmount(totalProfit)} {...controlsScope} /></div></div>
    {active && <div className="multiplier-section" {...controlsScope}><div className="multiplier-title" {...controlsScope}>Multiplier</div><div className="multiplier-value" {...controlsScope}>{multiplier.toFixed(2)}x</div></div>}
    <div className="play-button-section" {...controlsScope}>{active ? <><button className="button-action button-cashout" type="button" disabled={Boolean(loadingAction) || revealBusy} onClick={onCashout} {...controlsScope}>{loadingAction === 'cashout' ? <ButtonLoading /> : <div className="cashout-content" {...controlsScope}><div className="cashout-amount" {...controlsScope}>Cashout</div></div>}</button><button className="button-action button-auto" type="button" onClick={onAutoSelect} {...controlsScope}>Auto-Select</button></> : <button className="button-action button-play" type="button" disabled={Boolean(loadingAction) || !validBet} onClick={onStart} {...controlsScope}><span {...controlsScope}>Start Game</span></button>}</div>
    <div className="fairness-section" {...controlsScope}><button className="button-fairness" type="button" onClick={onFairness} {...controlsScope}><SiteIcon name="fairness" {...controlsScope} /> Fairness</button></div>
  </div>
}

function MinesTile({ index, game, queued, processing, onReveal }) {
  const completed = game?.state === 'completed'
  const explicitlyRevealed = game?.revealed_tiles?.includes(index) || false
  const isMine = completed && game?.deck?.[index] === 'mine'
  const revealed = explicitlyRevealed || isMine
  const safe = explicitlyRevealed && !isMine
  const lost = completed && game.won === false
  const revealOrder = Math.max(1, (game?.revealed_tiles || []).indexOf(index) + 1)
  const tilePayout = safe ? Math.floor(game.bet_amount * multiplierFor(revealOrder, game.mines_count)) : 0
  const active = game?.state === 'created' || game?.state === 'running'
  return <div className={`mines-tile${revealed ? ' revealed' : ''}${isMine ? ' bombed' : ''}${lost && safe ? ' opacity-dim' : ''}`} {...tileScope}><div className={`tile-container${revealed ? ' flipped' : ''}`} {...tileScope}><div className="tile-front" {...tileScope}><button className={`button-reveal${queued ? ' queued' : ''}${processing ? ' processing' : ''}`} type="button" disabled={!active} aria-label={`Reveal tile ${index + 1}`} onClick={() => { if (active && !revealed) onReveal(index) }} {...tileScope}><img className="mines-logo-vector" src={image('shadow.476c8406.png')} alt="shadow" {...tileScope} /></button></div><div className="tile-back" {...tileScope}>{isMine ? <div className="tile-mine" {...tileScope}><img src={image('mine.3905474b.png')} alt="mine" {...tileScope} /></div> : safe ? <div className="tile-coin" {...tileScope}><img src={image('diamond.2c57ac69.png')} alt="diamond" {...tileScope} /><div className="tile-coin-value" {...tileScope}>+ {formatAmount(tilePayout)}</div></div> : null}</div></div></div>
}

function MinesGame({ game, queuedTiles, processingTile, onReveal, onPlayAgain, popupPhase }) {
  const containerRef = useRef(null)
  const [tilesReady, setTilesReady] = useState(false)
  useEffect(() => {
    let frame
    let timeout
    let observer
    const showWhenSized = () => {
      const container = containerRef.current
      if (!container || container.offsetWidth <= 0 || container.offsetHeight <= 0) return false
      setTilesReady(true)
      return true
    }
    frame = window.requestAnimationFrame(() => {
      if (showWhenSized()) return
      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        observer = new ResizeObserver(() => { if (showWhenSized()) observer?.disconnect() })
        observer.observe(containerRef.current)
      }
      timeout = window.setTimeout(() => setTilesReady(true), 300)
    })
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timeout); observer?.disconnect() }
  }, [])
  return <div className="mines-game" ref={containerRef} {...gameScope}>{tilesReady && <div className="game-inner" {...gameScope}>{Array.from({ length: 25 }, (_, index) => <MinesTile key={index} index={index} game={game} queued={queuedTiles.includes(index)} processing={processingTile === index} onReveal={onReveal} />)}</div>}{game?.state === 'completed' && game.won && <div className={`mines-win-popup popup-fade-enter-active${popupPhase === 'from' ? ' popup-fade-enter' : ''}`} {...gameScope}><div className="popup-content" {...gameScope}><WinIcon /><h2 className="win-message" {...gameScope}>You've won!</h2><div className="reward-display" {...gameScope}><img src={currencyImage(game.currency)} alt="Currency" {...gameScope} /><div className="reward-amount" {...gameScope}>+{formatAmount(game.payout_amount)}</div></div><button className="play-again-button" type="button" onClick={onPlayAgain} {...gameScope}>Play Again</button></div></div>}<div className="mines-game-image-container" {...gameScope}><img className="mines-game-image" src={image('mines.54f0b228.png')} alt="bg" {...gameScope} /></div></div>
}

function Mines({ user }) {
  const [amount, setAmount] = useState('50')
  const [mines, setMines] = useState(1)
  const [currency, setCurrency] = useState(() => window.localStorage.getItem('currency') === 'coins' ? 'coins' : 'rocoins')
  const [game, setGame] = useState(null)
  const [loadingAction, setLoadingAction] = useState(null)
  const [queuedTiles, setQueuedTiles] = useState([])
  const [processingTile, setProcessingTile] = useState(null)
  const [showFairness, setShowFairness] = useState(false)
  const [popupPhase, setPopupPhase] = useState('active')
  const gameRef = useRef(game)
  const queueRef = useRef([])
  const processingRef = useRef(false)
  const actionLoadingRef = useRef(null)
  const mountedRef = useRef(true)
  const balance = Number(user?.[currency]) || 0
  useEffect(() => { gameRef.current = game }, [game])
  useEffect(() => () => { mountedRef.current = false }, [])
  useEffect(() => { document.title = 'Mines - RoRisk.com' }, [])
  useEffect(() => {
    const updateCurrency = (event) => setCurrency(event.detail?.currency === 'coins' ? 'coins' : 'rocoins')
    window.addEventListener('rorisk:currency-change', updateCurrency)
    return () => window.removeEventListener('rorisk:currency-change', updateCurrency)
  }, [])
  useEffect(() => {
    if (!user) return undefined
    fetch('/api/mines/current').then(async (response) => {
      const payload = await response.json()
      if (response.ok && mountedRef.current) {
        setGame(payload.game || null)
        if (payload.game) { setMines(payload.game.mines_count); setAmount(formatAmount(payload.game.bet_amount)); setCurrency(payload.game.currency) }
      }
    }).catch(() => {})
  }, [user])

  const showWinPopup = useCallback(() => {
    setPopupPhase('from')
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => { if (mountedRef.current) setPopupPhase('active') }))
  }, [])
  const applyResult = useCallback((payload) => {
    setGame(payload.game)
    gameRef.current = payload.game
    if (payload.user) window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: payload.user } }))
    if (payload.game?.state === 'completed') {
      queueRef.current = []
      setQueuedTiles([])
      if (payload.game.won) { playSound('cash'); showWinPopup() }
      window.dispatchEvent(new CustomEvent('rorisk:mines-bet', { detail: { game: payload.game } }))
    }
  }, [showWinPopup])
  const request = useCallback(async (path, body = {}) => {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to update this game.')
    return payload
  }, [])
  const startGame = useCallback(async () => {
    if (!user) { notify({ type: 'error', message: 'Please sign in to perform this action.' }); return }
    const wager = Math.trunc(Number(String(amount).replace(/,/g, '')))
    if (!Number.isSafeInteger(wager) || wager < 50 || wager > 500000) { notify({ type: 'error', message: 'Your entered bet amount is invalid.' }); return }
    if (!Number.isInteger(mines) || mines < 1 || mines > 24) { notify({ type: 'error', message: 'Your entered mines count is invalid.' }); return }
    setLoadingAction('start')
    actionLoadingRef.current = 'start'
    queueRef.current = []
    setQueuedTiles([])
    try {
      const fairState = getFairSeedState(user)
      const payload = await request('/api/mines/start', { amount: wager, currency, minesCount: mines, clientSeed: getFairClientSeed(user), nonce: fairState.seed.nonce })
      incrementFairNonce(user, 1)
      setGame(payload.game)
      gameRef.current = payload.game
      if (payload.user) window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: payload.user } }))
    } catch (error) { notify({ type: 'error', message: error.message || 'Unable to start this game.' }) } finally { setLoadingAction(null); actionLoadingRef.current = null }
  }, [amount, currency, mines, request, user])

  const drainQueue = useCallback(async () => {
    if (processingRef.current || actionLoadingRef.current) return
    processingRef.current = true
    while (queueRef.current.length && mountedRef.current) {
      const tile = queueRef.current[0]
      const activeGame = gameRef.current
      if (!activeGame || !['created', 'running'].includes(activeGame.state)) break
      setProcessingTile(tile)
      const startedAt = performance.now()
      try {
        const payload = await request(`/api/mines/${activeGame.uuid}/reveal`, { tile })
        const remaining = 140 - (performance.now() - startedAt)
        if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining))
        queueRef.current.shift()
        applyResult(payload)
        if (payload.mine) playSound('explosion')
        else playSound('gem')
        if (payload.game.state === 'completed') queueRef.current = []
      } catch (error) {
        queueRef.current.shift()
        notify({ type: 'error', message: error.message || 'Unable to reveal this tile.' })
      }
      setQueuedTiles([...queueRef.current])
      setProcessingTile(null)
      if (queueRef.current.length) await new Promise((resolve) => window.setTimeout(resolve, 50))
    }
    processingRef.current = false
  }, [applyResult, request])
  const queueTile = useCallback((tile) => {
    const activeGame = gameRef.current
    if (!activeGame || !['created', 'running'].includes(activeGame.state)) { notify({ type: 'error', message: 'You have no running mines game at the moment.' }); return }
    if (activeGame.revealed_tiles.includes(tile) || queueRef.current.includes(tile) || processingTile === tile) return
    queueRef.current.push(tile)
    setQueuedTiles([...queueRef.current])
    window.setTimeout(drainQueue, 50)
  }, [drainQueue, processingTile])
  const autoSelect = () => {
    const activeGame = gameRef.current
    if (!activeGame) return
    const excluded = new Set([...(activeGame.revealed_tiles || []), ...queueRef.current, ...(processingTile == null ? [] : [processingTile])])
    const available = Array.from({ length: 25 }, (_, index) => index).filter((index) => !excluded.has(index))
    if (available.length) queueTile(available[Math.floor(Math.random() * available.length)])
  }
  const cashout = async () => {
    const activeGame = gameRef.current
    if (!activeGame) return
    setLoadingAction('cashout')
    actionLoadingRef.current = 'cashout'
    queueRef.current = []
    setQueuedTiles([])
    const startedAt = performance.now()
    try {
      const payload = await request(`/api/mines/${activeGame.uuid}/cashout`)
      const remaining = 300 - (performance.now() - startedAt)
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining))
      applyResult(payload)
    } catch (error) { notify({ type: 'error', message: error.message || 'Unable to cash out this game.' }) } finally { setLoadingAction(null); actionLoadingRef.current = null }
  }
  const openFairness = () => user ? setShowFairness(true) : notify({ type: 'error', message: 'Please sign in to perform this action.' })
  const activeUserGame = user ? game : null
  const tilesGame = useMemo(() => activeUserGame || { state: 'idle', revealed_tiles: [], deck: null, mines_count: mines, bet_amount: Number(String(amount).replace(/,/g, '')) || 50, currency }, [activeUserGame, amount, currency, mines])

  return <div className="mines" {...pageScope}><div className="mines-content" {...pageScope}><MinesHeader onFairness={openFairness} /><div className="mines-container" {...pageScope}><MinesControls amount={amount} setAmount={setAmount} mines={mines} setMines={setMines} currency={currency} balance={balance} game={activeUserGame} loadingAction={loadingAction} revealBusy={processingTile != null} onStart={startGame} onCashout={cashout} onAutoSelect={autoSelect} onFairness={openFairness} /><MinesGame game={tilesGame} queuedTiles={queuedTiles} processingTile={processingTile} onReveal={queueTile} onPlayAgain={startGame} popupPhase={popupPhase} /></div></div><Bets />{showFairness && <ModalAnimation label="Seed Fairness" onClose={() => setShowFairness(false)}><FairSeedModal user={user} /></ModalAnimation>}</div>
}

export default Mines
