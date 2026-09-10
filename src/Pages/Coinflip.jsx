import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SiteIcon from '../components/Icons'
import ModalAnimation from '../components/ModalAnimation'
import { getFairClientSeed, incrementFairNonce } from '../lib/Fairness'
import { copyText, notify } from '../lib/Notifications'
import { playSound } from '../lib/Sounds'

const pageScope = { 'data-v-d9c9c0c4': '' }
const controlsScope = { 'data-v-9b66a54a': '' }
const gamesScope = { 'data-v-6162c2a1': '' }
const cardScope = { 'data-v-3810525d': '' }
const modalScope = { 'data-v-8408fe7c': '' }
const fairScope = { 'data-v-a4722fc8': '' }
const BLUE_COIN = '/api/casino-images/coinflip/blue.9de76194.png'
const ORANGE_COIN = '/api/casino-images/coinflip/orange.945d5bd3.png'
const EMPTY_PLAYER = '/api/casino-images/coinflip/empty.png'
const BOT_PLAYER = '/api/casino-images/coinflip/bot.png'
const CROSS = '/api/casino-images/coinflip/cross.51b7936e.png'
const currencyIcon = (currency) => currency === 'coins' ? '/Rewards/coin.12f4bce8.svg' : '/rocoin.2d3febd5.svg'
const coinIcon = (coin) => coin === 'orange' ? ORANGE_COIN : BLUE_COIN
const formatAmount = (value) => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US')
const userId = (user) => user?.uuid || user?.id || user?._id
const participantUserId = (participant) => userId(participant?.user)
const participantForCoin = (game, coin) => [game.creator, game.opponent].find((participant) => participant?.coin === coin)
const levelTheme = (level) => level >= 80 ? 'purple' : level >= 60 ? 'red' : level >= 40 ? 'orange' : level >= 20 ? 'green' : 'blue'

function LevelBadge({ level }) {
  return <div className={`box-level level-${levelTheme(Number(level) || 0)}`} data-v-ff759fba=""><div className="level-inner" data-v-ff759fba="">{Number(level) || 0}</div></div>
}

function RankBadge({ rank }) {
  const normalized = String(rank || 'user').toLowerCase()
  const hash = normalized === 'admin' ? 'f6df244d' : normalized === 'mod' ? '998a884b' : '0a259ddf'
  return <div className={`box-rank rank-${normalized}`} data-v-fc8af502=""><div className="rank-inner" data-v-fc8af502=""><img src={`/${normalized}.${hash}.svg`} alt={normalized} data-v-fc8af502="" /></div></div>
}

function ChevronDown() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...controlsScope}><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...controlsScope} /></svg>
}

function EyeIcon() {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...cardScope}><path d="M9.99992 7.5C9.33688 7.5 8.70099 7.76339 8.23215 8.23223C7.76331 8.70107 7.49992 9.33696 7.49992 10C7.49992 10.663 7.76331 11.2989 8.23215 11.7678C8.70099 12.2366 9.33688 12.5 9.99992 12.5C10.663 12.5 11.2988 12.2366 11.7677 11.7678C12.2365 11.2989 12.4999 10.663 12.4999 10C12.4999 9.33696 12.2365 8.70107 11.7677 8.23223C11.2988 7.76339 10.663 7.5 9.99992 7.5ZM9.99992 14.1667C8.89485 14.1667 7.83504 13.7277 7.05364 12.9463C6.27224 12.1649 5.83325 11.1051 5.83325 10C5.83325 8.89493 6.27224 7.83512 7.05364 7.05372C7.83504 6.27232 8.89485 5.83333 9.99992 5.83333C11.105 5.83333 12.1648 6.27232 12.9462 7.05372C13.7276 7.83512 14.1666 8.89493 14.1666 10C14.1666 11.1051 13.7276 12.1649 12.9462 12.9463C12.1648 13.7277 11.105 14.1667 9.99992 14.1667ZM9.99992 3.75C5.83325 3.75 2.27492 6.34167.833252 10C2.27492 13.6583 5.83325 16.25 9.99992 16.25C14.1666 16.25 17.7249 13.6583 19.1666 10C17.7249 6.34167 14.1666 3.75 9.99992 3.75Z" fill="currentColor" {...cardScope} /></svg>
}

function FairnessIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...modalScope}><path fillRule="evenodd" clipRule="evenodd" d="M9.99994 3.50671C9.43987 3.50671 8.504 3.72181 7.62331 3.96126C6.83668 4.17792 6.05534 4.41338 5.27997 4.66743C5.05667 4.74117 4.8587 4.87641 4.7088 5.05761C4.5589 5.23881 4.46316 5.45861 4.43257 5.69178C3.9488 9.32571 5.07137 12.0189 6.43338 13.8005C7.01117 14.5625 7.69982 15.2336 8.4764 15.7916C8.74464 15.9851 9.02927 16.1549 9.32705 16.2989C9.55513 16.406 9.79864 16.4937 9.99994 16.4937C10.2012 16.4937 10.4456 16.406 10.6728 16.2989C10.9706 16.1549 11.2552 15.9851 11.5235 15.7916C12.3001 15.2336 12.9887 14.5625 13.5665 13.8005C14.9285 12.0189 16.0511 9.32571 15.5673 5.69178C15.5367 5.45861 15.441 5.23881 15.2911 5.05761C15.1412 4.87641 14.9432 4.74117 14.7199 4.66743C14.1858 4.49291 13.2775 4.20477 12.3766 3.96126C11.4959 3.72181 10.56 3.50671 9.99994 3.50671ZM8.94476 11.4692C9.04366 11.5942 9.198 11.6667 9.36096 11.6667L9.38494 11.666C9.4696 11.6624 9.55206 11.6392 9.62518 11.5984C9.6983 11.5575 9.75986 11.5003 9.80452 11.4317L12.4209 7.42774C12.5738 7.19415 12.4985 6.88698 12.2538 6.74196C12.1362 6.67221 11.9944 6.64977 11.8595 6.67957C11.7246 6.70937 11.6076 6.78897 11.5342 6.90091L9.31976 10.2912L8.43901 9.18255C8.39774 9.13025 8.34603 9.08625 8.28686 9.05308C8.22769 9.01991 8.16222 8.99821 8.09422 8.98925C8.02623 8.98029 7.95704 8.98423 7.89065 9.00085C7.82426 9.01748 7.76197 9.04645 7.70736 9.08611C7.65262 9.12545 7.60656 9.17472 7.57184 9.23107C7.53711 9.28742 7.5144 9.34976 7.505 9.41451C7.4956 9.47925 7.4997 9.54513 7.51707 9.60836C7.53444 9.67158 7.56474 9.73092 7.60622 9.78296L8.94476 11.4692Z" fill="currentColor" {...modalScope} /></svg>
}

function CopyIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...fairScope}><path d="M15.4567 1.6667H7.87683C6.29075 1.6667 5.00008 2.95737 5.00008 4.54345V5.00004H4.5435C2.95741 5.00004 1.66675 6.2907 1.66675 7.87679V15.4565C1.66675 17.0427 2.95741 18.3334 4.5435 18.3334H12.1232C13.5803 18.3334 14.7751 17.2402 14.9619 15.8334H15.4566C17.0427 15.8334 18.3334 14.5427 18.3334 12.9566V4.54345C18.3334 2.95737 17.0427 1.6667 15.4567 1.6667ZM16.6667 12.9566C16.6667 13.6239 16.1239 14.1667 15.4567 14.1667H15.0001V7.87679C15.0001 6.2907 13.7094 5.00004 12.1233 5.00004H6.66675V4.54345C6.66675 3.8762 7.20958 3.33337 7.87683 3.33337H15.4566C16.1239 3.33337 16.6667 3.8762 16.6667 4.54345V12.9566Z" fill="currentColor" {...fairScope} /></svg>
}

function CoinflipFairGame({ game }) {
  const copy = async (value) => { await copyText(String(value)); notify({ type: 'success', message: 'Copied to your clipboard.' }) }
  const values = [
    ['Game ID', game.gameId || game._id],
    ['Server Seed (Hashed)', game.fair?.serverSeedHash || ''],
    ...(game.fair?.serverSeed ? [['Server Seed', game.fair.serverSeed]] : []),
    ...(game.fair?.clientSeed ? [['EOS Block ID', game.fair.clientSeed]] : []),
    ...(game.fair?.ticket != null ? [['Ticket', Number(game.fair.ticket).toLocaleString('en-US')]] : []),
  ]
  return <div className="modal-fair-game" {...fairScope}><div className="game-group" {...fairScope}><div className="game-header" {...fairScope}><span {...fairScope}>Game Fairness</span></div>{values.map(([label, value]) => <div className="game-element" key={label} {...fairScope}><div className="element-title" {...fairScope}>{label}</div><div className="element-content" {...fairScope}><span {...fairScope}>{value}</span><button className="button-copy" type="button" title="Copy to clipboard" onClick={() => copy(value)} {...fairScope}><CopyIcon /></button></div></div>)}{game.fair?.serverSeed && <div className="verify-button-container" {...fairScope}><button className="button-verify" type="button" onClick={() => notify({ type: 'success', message: 'This game is provably fair.' })} {...fairScope}>Verify Game</button></div>}</div></div>
}

function PlayerAvatar({ participant, coin, completed, winningCoin, scope = cardScope }) {
  const winner = completed && participant && winningCoin === coin
  const loser = completed && participant && winningCoin !== coin
  const source = participant?.bot ? BOT_PLAYER : participant?.user?.avatar || participant?.user?.avatar_headshot || EMPTY_PLAYER
  return <div className={scope === modalScope ? 'coinflip-player-element-avatar-container' : 'coinflip-games-element-left-players-player-avatar'} {...scope}>
    {loser && scope === cardScope && <img className="crossed-icon" src={CROSS} alt="Cross" {...scope} />}
    <div className={scope === modalScope ? 'coinflip-player-element-avatar' : undefined} {...scope}><img className={scope === cardScope ? 'avatar-image' : undefined} src={source} alt={participant?.user?.username || (participant?.bot ? 'Bot Avatar' : 'No Player')} {...scope} /></div>
    <div className={scope === modalScope ? 'coinflip-player-element-coin' : 'coinflip-games-element-left-players-player-avatar-coins'} {...scope}><img className={scope === cardScope ? `coinflip-games-element-left-players-player-avatar-coin ${coin}` : undefined} src={coinIcon(coin)} alt={coin === 'blue' ? 'Blue' : 'Orange'} {...scope} /></div>
    {scope === modalScope && completed && participant && <div className="coinflip-game-element-winner-text" {...scope}><span className={winner ? 'won' : 'lost'} {...scope}>{winner ? 'Won' : 'Lost'}</span></div>}
  </div>
}

function CoinflipControls({ user, currency, busy, onCreate, sort, onSort }) {
  const [amount, setAmount] = useState('50')
  const [selectedCoin, setSelectedCoin] = useState(null)
  const [open, setOpen] = useState(false)
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth)
  const root = useRef(null)
  const numeric = Math.floor(Number(amount.replace(/,/g, '')) || 0)
  const balance = Math.floor(Number(user?.[currency]) || 0)
  const valid = numeric >= 50 && numeric <= 500000 && numeric <= balance && selectedCoin
  useEffect(() => {
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])
  useEffect(() => {
    const resize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const commit = (value) => setAmount(Math.min(500000, Math.max(50, Math.floor(value || 50))).toLocaleString('en-US'))
  const create = () => {
    if (!user) return notify({ type: 'error', message: 'Please sign in to perform this action.' })
    if (!selectedCoin) return notify({ type: 'error', message: 'Please select blue or orange.' })
    if (!valid) return notify({ type: 'error', message: 'Your entered bet amount is invalid.' })
    onCreate(numeric, selectedCoin)
  }
  const displaySort = sort === 'LOWEST PRICE' ? 'Low to High' : sort === 'RECENT' ? 'Recent' : 'High to Low'
  return <div className="coinflip-header" {...controlsScope}>
    <div className="coinflip-header-left-title" {...controlsScope}><SiteIcon name="coinflip" {...controlsScope} /> Coinflip</div>
    <div className="coinflip-header-wrapper" {...controlsScope}>
      <div className="coinflip-header-right" {...controlsScope}>
        <div className="coinflip-header-right-amount-container-wrapper" {...controlsScope}>
          <div className="coinflip-header-right-amount-container" {...controlsScope}><img className="coinflip-header-right-amount-coin" src={currencyIcon(currency)} alt="coin" {...controlsScope} /><input type="text" inputMode="numeric" placeholder="0" value={amount} onFocus={() => setAmount(amount.replace(/,/g, ''))} onBlur={() => commit(numeric)} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ''))} {...controlsScope} /><div className="coinflip-header-right-amount-preset-container" {...controlsScope}><div className="coinflip-header-right-amount-preset" onClick={() => commit((numeric || 50) / 2)} {...controlsScope}>1/2</div><div className="coinflip-header-right-amount-preset" onClick={() => commit((numeric || 50) * 2)} {...controlsScope}>2x</div><div className="coinflip-header-right-amount-preset" onClick={() => commit(Math.min(balance, 500000))} {...controlsScope}>Max</div></div></div>
          <div className={`coinflip-header-right-create${!valid || busy ? ' disabled' : ''}`} onClick={create} {...controlsScope}>{windowWidth > 600 ? <span {...controlsScope}>Create Game</span> : windowWidth < 600 ? <span {...controlsScope}>Create</span> : null}</div>
        </div>
        <div className="seperator" {...controlsScope} />
        <div className="coinflip-header-right-coins" {...controlsScope}><div className={`coin-option${selectedCoin === 'blue' ? ' active' : ''}`} onClick={() => setSelectedCoin('blue')} {...controlsScope}><img src={BLUE_COIN} alt="coin" {...controlsScope} /></div><div className={`coin-option${selectedCoin === 'orange' ? ' active' : ''}`} onClick={() => setSelectedCoin('orange')} {...controlsScope}><img src={ORANGE_COIN} alt="coin" {...controlsScope} /></div></div>
      </div>
      <div className="coinflip-header-left" {...controlsScope}><div ref={root} className={`price-filter${open ? ' dropdown-open' : ''}`} onClick={() => setOpen((value) => !value)} {...controlsScope}>{displaySort} <ChevronDown /><div className="sort-dropdown-menu" {...controlsScope}>{[['RECENT', 'Recent'], ['HIGHEST PRICE', 'Highest Price'], ['LOWEST PRICE', 'Lowest Price']].map(([value, label]) => <div className="sort-dropdown-item" key={value} onClick={(event) => { event.stopPropagation(); onSort(value); setOpen(false) }} {...controlsScope}>{label}</div>)}</div></div></div>
    </div>
  </div>
}

function CoinflipCard({ game, user, busy, onOpen, onBot, entering = false, style }) {
  const blue = participantForCoin(game, 'blue')
  const orange = participantForCoin(game, 'orange')
  const completed = game.state === 'completed'
  const isCreator = participantUserId(game.creator) === userId(user)
  const canBot = game.state === 'created' && !game.opponent && isCreator
  const player = (participant, coin) => <div className={`coinflip-games-element-left-players-player${completed && participant && game.winningCoin !== coin ? ' losing-player' : ''}`} {...cardScope}><div className={`coinflip-games-element-left-players-player-avatar${completed && participant && game.winningCoin === coin ? ' player-winner' : ''}`} {...cardScope}>{completed && participant && game.winningCoin !== coin && <img className="crossed-icon" src={CROSS} alt="Cross" {...cardScope} />}<img className="avatar-image" src={participant?.bot ? BOT_PLAYER : participant?.user?.avatar || participant?.user?.avatar_headshot || EMPTY_PLAYER} alt={participant?.user?.username || (participant?.bot ? 'Bot Avatar' : 'No Player')} {...cardScope} /><div className="coinflip-games-element-left-players-player-avatar-coins" {...cardScope}><img className={`coinflip-games-element-left-players-player-avatar-coin ${coin}`} src={coinIcon(coin)} alt={coin === 'blue' ? 'Blue' : 'Orange'} {...cardScope} /></div></div><div className="coinflip-games-element-left-players-player-name" {...cardScope}><span {...cardScope}>{participant?.bot ? 'Risk Bot' : participant?.user?.username || 'Waiting...'}</span></div></div>
  return <div className={`coinflip-games-element game-item-enter-active${entering ? ' game-item-enter-from' : ' game-item-enter-to'}${game.opponent ? ' element-full' : ''}${completed ? ` element-completed ${game.winningCoin}-winner` : ''}`} style={style} onClick={() => onOpen(game)} {...gamesScope} {...cardScope}>
    <div className="coinflip-games-element-left" {...cardScope}><div className="coinflip-games-element-left-players" {...cardScope}>{player(blue, 'blue')}<SiteIcon name="battles" className="sword-icon" {...cardScope} />{player(orange, 'orange')}</div></div>
    {completed && <div className="coinflip-games-element-center-winner" {...cardScope}><div className="coinflip-games-element-center-winner-coin" {...cardScope}><img src={coinIcon(game.winningCoin)} alt={game.winningCoin} {...cardScope} /></div></div>}
    <div className="coinflip-games-element-right" {...cardScope}><div className="coinflip-games-element-center-price" {...cardScope}><img src={currencyIcon(game.currency)} alt="Coins" {...cardScope} /><span {...cardScope}>{formatAmount(game.amount)}</span></div><div className="seperator" {...cardScope} /><div className="coinflip-games-element-right-buttons" {...cardScope}>{canBot ? <button className="button join-game" disabled={busy} onClick={(event) => { event.stopPropagation(); onBot(game) }} {...cardScope}>Call Bot</button> : !game.opponent && game.state === 'created' ? <button className="button join-game" onClick={(event) => { event.stopPropagation(); onOpen(game) }} {...cardScope}>Join Game</button> : null}<button className="button view-game" onClick={(event) => { event.stopPropagation(); onOpen(game) }} {...cardScope}><EyeIcon /></button></div></div>
  </div>
}

function AnimatedCoinflipCard(props) {
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    let secondFrame
    const firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => setEntering(false)) })
    return () => { cancelAnimationFrame(firstFrame); if (secondFrame) cancelAnimationFrame(secondFrame) }
  }, [])
  return <CoinflipCard {...props} entering={entering} />
}

function CoinAnimation({ coin }) {
  const canvas = useRef(null)
  const glow = useRef(null)
  const isMobile = window.matchMedia('(max-width: 700px)').matches || /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent || '')
  useEffect(() => {
    let alive = true
    let frameRequest
    const images = Array.from({ length: 12 }, (_, row) => {
      const image = new Image()
      image.decoding = 'async'
      image.src = `/api/casino-images/coinflip/${coin}-row-${row}.png`
      return image
    })
    Promise.all(images.map((image) => image.decode?.().catch(() => new Promise((resolve) => { image.onload = resolve })) || Promise.resolve())).then(() => {
      if (!alive || !canvas.current) return
      const size = isMobile ? 375 : 500
      const contexts = [canvas.current, glow.current].filter(Boolean).map((element) => {
        const ratio = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2)
        element.width = size * ratio
        element.height = size * ratio
        element.style.width = `${size}px`
        element.style.height = `${size}px`
        const context = element.getContext('2d', { alpha: true, desynchronized: true })
        context.scale(ratio, ratio)
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = isMobile ? 'low' : 'high'
        return context
      })
      const started = performance.now()
      const draw = (now) => {
        if (!alive) return
        const frame = Math.min(149, Math.floor((now - started) / 16.5))
        const row = Math.floor(frame / 13)
        const column = frame % 13
        contexts.forEach((context) => { context.clearRect(0, 0, size, size); context.drawImage(images[row], column * 500, 0, 500, 500, 0, 0, size, size) })
        if (frame < 149) frameRequest = requestAnimationFrame(draw)
      }
      playSound('flip')
      frameRequest = requestAnimationFrame(draw)
    })
    return () => { alive = false; if (frameRequest) cancelAnimationFrame(frameRequest) }
  }, [coin, isMobile])
  return <><canvas ref={canvas} className="coinflip-game-element-canvas" {...modalScope} />{!isMobile && <canvas ref={glow} className="coinflip-game-element-canvas-glow" {...modalScope} />}</>
}

function CountdownNumber({ value }) {
  const element = useRef(null)
  useEffect(() => {
    element.current?.animate([
      { transform: 'translateY(-8px) scale(1.35)', opacity: .55 },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ], { duration: 280, easing: 'cubic-bezier(.25,.46,.45,.94)' })
  }, [value])
  return <span ref={element} {...modalScope}>{value}</span>
}

function CoinflipGameModal({ game, user, busy, onAction, onFairness }) {
  const [now, setNow] = useState(0)
  const lastCountdown = useRef(null)
  useEffect(() => {
    if (!game.startedAt) return undefined
    let frame
    const tick = () => { setNow(Date.now()); frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [game.startedAt])
  const elapsed = game.startedAt ? now - new Date(game.startedAt).getTime() : 0
  const phase = game.state === 'created' ? 'created' : elapsed < 3000 ? 'countdown' : elapsed < 5500 ? 'rolling' : 'completed'
  const countdown = Math.min(3, Math.max(1, Math.ceil((3000 - elapsed) / 1000)))
  useEffect(() => {
    if (phase !== 'countdown' || lastCountdown.current === countdown) return
    if (lastCountdown.current != null) playSound('countdown')
    lastCountdown.current = countdown
  }, [countdown, phase])
  useEffect(() => {
    if (phase !== 'completed' || !user || !game.winningCoin) return
    const winningParticipant = participantForCoin(game, game.winningCoin)
    if (participantUserId(winningParticipant) !== userId(user)) return
    const storageKey = 'coinflipCashSoundPlayed'
    const played = (() => { try { return JSON.parse(window.localStorage.getItem(storageKey) || '[]') } catch { return [] } })()
    if (played.includes(game._id)) return
    playSound('cash')
    window.localStorage.setItem(storageKey, JSON.stringify([...played, game._id]))
  }, [game, phase, user])
  const blue = participantForCoin(game, 'blue')
  const orange = participantForCoin(game, 'orange')
  const isCreator = participantUserId(game.creator) === userId(user)
  const actionText = isCreator ? 'CALL BOT' : `Join ${blue ? 'Orange' : 'Blue'}`
  const timestampSource = phase === 'completed' ? game.updatedAt : game.createdAt
  const timestamp = `${phase === 'completed' ? 'Ended at' : 'Created at'} ${new Date(timestampSource || 0).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })} ${new Date(timestampSource || 0).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
  const player = (participant, coin, first) => <div className={`coinflip-player-element${phase === 'completed' && participant && game.winningCoin !== coin ? ' losing-player' : ''}`} {...modalScope}><PlayerAvatar participant={participant} coin={coin} completed={phase === 'completed'} winningCoin={game.winningCoin} scope={modalScope} /><div className="coinflip-player-element-info" {...modalScope}>{participant?.user?.rank && participant.user.rank !== 'user' ? <RankBadge rank={participant.user.rank} /> : participant?.user?.level != null ? <LevelBadge level={participant.user.level} /> : null}<span {...modalScope}>{participant?.bot ? 'Risk Bot' : participant?.user?.username || 'Waiting...'}</span></div><div className="coinflip-player-element-bet" {...modalScope}><img src={currencyIcon(game.currency)} alt="coin" {...modalScope} /><span {...modalScope}>{formatAmount(game.amount)}</span></div>{phase === 'created' && user && ((isCreator && first) || (!isCreator && !first)) && <div className={isCreator ? 'coinflip-player-element-call-bot' : 'coinflip-player-element-join-game'} disabled={busy ? '' : undefined} onClick={() => onAction(game, isCreator ? 'bot' : 'join')} {...modalScope}>{actionText}</div>}</div>
  const share = async () => { await copyText(`${window.location.origin}/coinflip?game=${game.gameId || game._id}`); notify({ type: 'success', message: 'Copied to your clipboard.' }) }
  return <div className={`modal-coinflip-game${phase === 'completed' ? ` win-glow-${game.winningCoin}` : ''}`} {...modalScope}>
    <div className="modal-coinflip-game-header" {...modalScope}><div className="modal-coinflip-game-header-title" {...modalScope}><span {...modalScope}>Coinflip Game</span><span className="game-id" {...modalScope}>#{game.gameId || game._id}</span></div></div>
    <div className="modal-coinflip-game-content" {...modalScope}><div className="game-content" {...modalScope}><div className="coinflip-coinflip-game" {...modalScope}><div className="coinflip-coinflip-game-content" {...modalScope}>{player(blue, 'blue', true)}<div className="coinflip-game-element" {...modalScope}>{(phase === 'rolling' || phase === 'completed') && <CoinAnimation key={`${game._id}-${game.winningCoin}`} coin={game.winningCoin || 'blue'} />}<div className="coinflip-game-element-text-container" {...modalScope}>{phase === 'countdown' && <div key={countdown} className="coinflip-game-element-countdown" {...modalScope}><div className="coinflip-game-element-countdown-text" {...modalScope}><CountdownNumber value={countdown} /></div></div>}{phase === 'created' && <div className="coinflip-game-element-waiting" {...modalScope}><div className="coinflip-game-element-waiting-text" {...modalScope}>Waiting for a player...</div></div>}</div></div>{player(orange, 'orange', false)}</div></div></div></div>
    <div className="modal-coinflip-game-footer" {...modalScope}><div className="modal-coinflip-game-footer-left" {...modalScope}><span className="game-timestamp" {...modalScope}>{timestamp}</span></div><div className="modal-coinflip-game-footer-right" {...modalScope}><button type="button" title="Provably Fair" onClick={() => onFairness(game)} {...modalScope}><FairnessIcon /></button><button type="button" onClick={share} {...modalScope}>Share</button></div></div>
  </div>
}

function Coinflip({ user }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sort, setSort] = useState('RECENT')
  const [selected, setSelected] = useState(null)
  const [fairness, setFairness] = useState(null)
  const [count, setCount] = useState(0)
  const countRef = useRef(0)
  const [currency, setCurrency] = useState(() => window.localStorage.getItem('currency') === 'coins' ? 'coins' : 'rocoins')
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/coinflip/games')
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setGames(payload.games || [])
      setSelected((current) => current ? (payload.games || []).find((game) => game._id === current._id) || current : current)
    } catch { setGames((current) => current) } finally { setLoading(false) }
  }, [])
  useEffect(() => {
    document.title = 'Coinflip - RoRisk.com'
    const initialTimer = window.setTimeout(refresh, 0)
    const timer = window.setInterval(refresh, 5000)
    const transitionTimers = []
    const realtimeUpdate = (event) => {
      const game = event.detail?.game
      if (!game?._id) return
      setGames((current) => [game, ...current.filter((item) => item._id !== game._id)])
      setSelected((current) => current?._id === game._id ? game : current)
      transitionTimers.push(window.setTimeout(refresh, 3100), window.setTimeout(refresh, 5600))
    }
    window.addEventListener('rorisk:coinflip-update', realtimeUpdate)
    const queryGame = new URLSearchParams(window.location.search).get('game')
    if (queryGame) fetch(`/api/coinflip/games/${encodeURIComponent(queryGame)}`).then((response) => response.ok ? response.json() : null).then((payload) => payload?.game && setSelected(payload.game)).catch(() => {})
    const idle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1000))
    const idleId = idle(() => ['blue', 'orange'].forEach((coin) => Array.from({ length: 12 }, (_, row) => { const image = new Image(); image.decoding = 'async'; image.src = `/api/casino-images/coinflip/${coin}-row-${row}.png`; return image })))
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer); transitionTimers.forEach(window.clearTimeout); window.removeEventListener('rorisk:coinflip-update', realtimeUpdate); if (window.cancelIdleCallback) window.cancelIdleCallback(idleId); else window.clearTimeout(idleId) }
  }, [refresh])
  useEffect(() => {
    const update = (event) => setCurrency(event.detail?.currency === 'coins' ? 'coins' : 'rocoins')
    window.addEventListener('rorisk:currency-change', update)
    return () => window.removeEventListener('rorisk:currency-change', update)
  }, [])
  const activeCount = games.filter((game) => game.state !== 'completed').length
  useEffect(() => {
    const from = countRef.current
    const to = activeCount
    if (from === to) return undefined
    const started = performance.now()
    let frame
    const animate = (now) => { const progress = Math.min(1, (now - started) / 350); const next = Math.round(from + (to - from) * (1 - (1 - progress) ** 3)); countRef.current = next; setCount(next); if (progress < 1) frame = requestAnimationFrame(animate) }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [activeCount])
  const sorted = useMemo(() => {
    const compare = (a, b) => sort === 'LOWEST PRICE' ? a.amount - b.amount : sort === 'HIGHEST PRICE' ? b.amount - a.amount : new Date(b.createdAt) - new Date(a.createdAt)
    return [
      ...games.filter((game) => game.state !== 'completed').sort(compare),
      ...games.filter((game) => game.state === 'completed').sort(compare),
    ]
  }, [games, sort])
  const request = async (path, body) => {
    setBusy(true)
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to update this game.')
      if (payload.user) window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: payload.user } }))
      if (payload.game) {
        setSelected((current) => current?._id === payload.game._id ? payload.game : current)
        setGames((current) => [payload.game, ...current.filter((game) => game._id !== payload.game._id)])
      }
      incrementFairNonce(user, 1)
      return payload
    } catch (error) { notify({ type: 'error', message: error.message || 'Unable to update this game.' }); return null } finally { setBusy(false) }
  }
  const create = async (amount, coin) => request('/api/coinflip/games', { amount, coin, currency, clientSeed: getFairClientSeed(user) })
  const action = async (game, type) => { const payload = await request(`/api/coinflip/games/${game._id}/${type}`, { clientSeed: getFairClientSeed(user) }); if (payload) playSound('join') }
  const open = (game) => setSelected(game)
  const close = () => setSelected(null)
  const openFairness = (game) => { setSelected(null); setFairness(game) }
  return <div className="coinflip" {...pageScope}><CoinflipControls user={user} currency={currency} busy={busy} onCreate={create} sort={sort} onSort={setSort} /><div className="coinflip-games" {...gamesScope}><div className="games-container" {...gamesScope}><div className="games-header" {...gamesScope}><div className="header-title" {...gamesScope}>Active Games: <span {...gamesScope}>{count}</span></div></div><div className="games-content" {...gamesScope}>{loading ? <div className="content-loading" {...gamesScope}>{Array.from({ length: 25 }, (_, index) => <div className="loading-placeholder" key={index} {...gamesScope} />)}</div> : sorted.length ? <div className="content-list" {...gamesScope}><div className="games-list" {...gamesScope}>{sorted.map((game, index) => <AnimatedCoinflipCard style={{ '--animation-delay': `${index * .05}s` }} key={game._id} game={game} user={user} busy={busy} onOpen={open} onBot={(selectedGame) => action(selectedGame, 'bot')} />)}</div></div> : <div className="content-empty" {...gamesScope} />}</div></div></div>
    {selected && !fairness && <ModalAnimation label="Coinflip Game" onClose={close}><CoinflipGameModal game={selected} user={user} busy={busy} onAction={action} onFairness={openFairness} /></ModalAnimation>}
    {fairness && <ModalAnimation label="Game Fairness" onClose={() => setFairness(null)}><CoinflipFairGame game={fairness} /></ModalAnimation>}
  </div>
}

export default Coinflip
