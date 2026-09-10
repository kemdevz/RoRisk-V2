import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import SiteIcon from '../components/Icons'
import FairSeedModal from '../components/FairSeedModal'
import ModalAnimation from '../components/ModalAnimation'
import { getFairClientSeed, incrementFairNonce } from '../lib/Fairness'
import { notify } from '../lib/Notifications'
import { playSound } from '../lib/Sounds'

const casesScope = { 'data-v-2696d139': '' }
const pageScope = { 'data-v-4b72bcc0': '' }
const headerScope = { 'data-v-c6b57a4e': '' }
const spinnerScope = { 'data-v-306befb4': '' }
const reelScope = { 'data-v-9f5fffe8': '' }
const controlsScope = { 'data-v-49436a42': '' }
const itemScope = { 'data-v-f0f79356': '' }

function formatAmount(value) {
  return Math.floor(Number(value) || 0).toLocaleString('en-US')
}

function chanceNumber(item) {
  return Number.parseFloat(String(item?.chance || '0').replace('%', '')) || 0
}

function rarityKey(item) {
  if (item?.chroma === true) return 'chroma'
  const rarity = String(item?.rarity || '').toLowerCase().replace(/\s+/g, '')
  if (rarity.includes('chroma')) return 'chroma'
  if (rarity.includes('uncommon')) return 'uncommon'
  if (rarity.includes('legendary')) return 'legendary'
  if (rarity.includes('ancient')) return 'ancient'
  if (rarity.includes('classic')) return 'classic'
  if (rarity.includes('godly')) return 'godly'
  if (rarity.includes('unique')) {
    const color = String(item?.name || '').trim().match(/^(blue|red|gold|green|purple|orange|silver|black|white|yellow|pink|cyan)\s+/i)?.[1]?.toLowerCase()
    return color === 'yellow' || !color ? 'unique-default' : `unique-${color}`
  }
  if (rarity.includes('rare')) return 'rare'
  if (!rarity) {
    const chance = chanceNumber(item)
    if (chance >= 50) return 'common'
    if (chance >= 30) return 'uncommon'
    if (chance >= 20) return 'rare'
    if (chance > 5) return 'legendary'
    return 'godly'
  }
  return 'common'
}

function displayItemName(item) {
  const name = String(item?.display_name || item?.gameName || item?.game_name || item?.name || '').trim()
  if (rarityKey(item) !== 'chroma') return name
  return name
    .replace(/^\s*chroma\s+/i, '')
    .replace(/^\s*\[chroma\]\s*/i, '')
    .replace(/^\s*chroma\s*[-–:]\s*/i, '')
    .trim() || name
}

function pickVisualItem(items) {
  const roll = Math.random() * 100
  let total = 0
  for (const item of items) {
    total += chanceNumber(item)
    if (roll <= total) return item
  }
  return items[items.length - 1]
}

function seededRandom(seedValue) {
  let seed = 0
  for (const character of String(seedValue)) seed = Math.abs(((seed << 5) - seed + character.charCodeAt(0)) | 0)
  return () => {
    seed = (1664525 * seed + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

function createReel(items, winner = null, seedValue = Date.now(), baitSeedValue = seedValue) {
  const random = seededRandom(seedValue)
  const weightedItems = items.flatMap((item) => Array.from({ length: Math.max(1, Math.floor(chanceNumber(item))) }, () => item))
  const reel = Array.from({ length: 80 }, () => weightedItems[Math.floor(random() * weightedItems.length)])
  if (winner) {
    reel[60] = winner
    const bait = items.filter((item) => chanceNumber(item) >= 20 && item !== winner)
    if (bait.length) {
      const baitRandom = seededRandom(baitSeedValue)
      reel[59] = bait[Math.floor(baitRandom() * bait.length)]
      reel[61] = bait[Math.floor(baitRandom() * bait.length)]
    }
  }
  return reel
}

function waitForReelImages(container, timeout = 2000) {
  const images = [...(container?.querySelectorAll('.reel-element img') || [])]
  if (!images.length || images.every((image) => image.complete && image.naturalHeight > 0)) return Promise.resolve()
  return new Promise((resolve) => {
    let finished = false
    let loaded = images.filter((image) => image.complete && image.naturalHeight > 0).length
    const finish = () => {
      if (finished) return
      finished = true
      resolve()
    }
    const onLoad = () => {
      loaded += 1
      if (loaded >= images.length) finish()
    }
    images.filter((image) => !image.complete || image.naturalHeight === 0).forEach((image) => {
      image.addEventListener('load', onLoad, { once: true })
      image.addEventListener('error', finish, { once: true })
    })
    window.setTimeout(finish, timeout)
  })
}

function reelGeometry(spinner, multi) {
  const wheel = spinner?.querySelector('.inner-wheel')
  const reel = wheel?.querySelector('.cases-reel')
  const elements = reel?.querySelectorAll('.reel-element')
  if (!spinner || !wheel || !reel || !elements || elements.length < 2) return null

  const spinnerBounds = spinner.getBoundingClientRect()
  const firstBounds = elements[0].getBoundingClientRect()
  if (multi) {
    const itemSpacing = firstBounds.height
    if (itemSpacing < 50) return null
    const initialOffset = -(20 * itemSpacing + itemSpacing / 2 - spinnerBounds.height / 2)
    const targetOffset = -(60 * itemSpacing + itemSpacing / 2 - spinnerBounds.height / 2)
    return { itemSpacing, initialOffset, targetOffset, finalOffset: targetOffset - 0.1 * itemSpacing }
  }

  const secondBounds = elements[1].getBoundingClientRect()
  const firstCenter = firstBounds.left + firstBounds.width / 2
  const secondCenter = secondBounds.left + secondBounds.width / 2
  const itemSpacing = secondCenter - firstCenter
  if (itemSpacing < 50) return null
  const matrix = new DOMMatrixReadOnly(window.getComputedStyle(reel).transform)
  const untransformedFirstCenter = firstCenter - matrix.m41
  const initialOffset = spinnerBounds.left + spinnerBounds.width / 2 - untransformedFirstCenter - 20 * itemSpacing
  const targetOffset = spinnerBounds.left + spinnerBounds.width / 2 - untransformedFirstCenter - 60 * itemSpacing
  return { itemSpacing, initialOffset, targetOffset, finalOffset: targetOffset }
}

const patternPaths = [
  ['M.6 43.26h5.76v5.76H.6zM.6 31.02h5.76v5.76H.6zM.6 18.78h5.76v5.76H.6z', '.02'],
  ['M.6 6.54h5.76v5.76H.6z', '.01'],
  ['M6.72 55.5h5.76v5.76H6.72z', '.02'],
  ['M6.72 43.26h5.76v5.76H6.72zM6.72 31.02h5.76v5.76H6.72zM6.72 18.78h5.76v5.76H6.72z', '.08'],
  ['M6.72 6.54h5.76v5.76H6.72z', '.05'],
  ['M12.84 55.5h5.76v5.76h-5.76z', '.02'],
  ['M12.84 43.26h5.76v5.76h-5.76z', '.05'],
  ['M12.84 31.02h5.76v5.76h-5.76zM12.84 18.78h5.76v5.76h-5.76z', '.15'],
  ['M12.84 6.54h5.76v5.76h-5.76z', '.08'],
  ['M18.96 55.5h5.76v5.76h-5.76z', '.02'],
  ['M18.96 43.26h5.76v5.76h-5.76z', '.15'],
  ['M18.96 31.02h5.76v5.76h-5.76z', '.02'],
  ['M18.96 18.78h5.76v5.76h-5.76z', '.05'],
  ['M18.96 6.54h5.76v5.76h-5.76z', '.08'],
  ['M25.08 55.5h5.76v5.76h-5.76z', '.02'],
  ['M25.08 43.26h5.76v5.76h-5.76z', '.15'],
  ['M25.08 31.02h5.76v5.76h-5.76zM25.08 18.78h5.76v5.76h-5.76z', '.02'],
  ['M25.08 6.54h5.76v5.76h-5.76z', '.08'],
  ['M31.2 55.5h5.76v5.76H31.2z', '.02'],
  ['M31.2 43.26h5.76v5.76H31.2z', '.15'],
  ['M31.2 31.02h5.76v5.76H31.2zM31.2 18.78h5.76v5.76H31.2z', '.02'],
  ['M31.2 6.54h5.76v5.76H31.2z', '.08'],
  ['M37.32 55.5h5.76v5.76h-5.76z', '.02'],
  ['M37.32 43.26h5.76v5.76h-5.76z', '.15'],
  ['M37.32 31.02h5.76v5.76h-5.76z', '.02'],
  ['M37.32 18.78h5.76v5.76h-5.76z', '.05'],
  ['M37.32 6.54h5.76v5.76h-5.76z', '.08'],
  ['M43.44 55.5h5.76v5.76h-5.76z', '.02'],
  ['M43.44 43.26h5.76v5.76h-5.76z', '.05'],
  ['M43.44 31.02h5.76v5.76h-5.76zM43.44 18.78h5.76v5.76h-5.76z', '.15'],
  ['M43.44 6.54h5.76v5.76h-5.76z', '.08'],
  ['M49.56 55.5h5.76v5.76h-5.76z', '.02'],
  ['M49.56 43.26h5.76v5.76h-5.76zM49.56 31.02h5.76v5.76h-5.76zM49.56 18.78h5.76v5.76h-5.76z', '.08'],
  ['M49.56 6.54h5.76v5.76h-5.76z', '.05'],
  ['M55.68 43.26h5.76v5.76h-5.76zM55.68 31.02h5.76v5.76h-5.76zM55.68 18.78h5.76v5.76h-5.76zM55.68 6.54h5.76v5.76h-5.76zM.6 49.38h5.76v5.76H.6zM.6 37.14h5.76v5.76H.6zM.6 24.9h5.76v5.76H.6zM.6 12.66h5.76v5.76H.6z', '.02'],
  ['M6.72 49.38h5.76v5.76H6.72z', '.05'],
  ['M6.72 37.14h5.76v5.76H6.72zM6.72 24.9h5.76v5.76H6.72zM6.72 12.66h5.76v5.76H6.72z', '.08'],
  ['M6.72.42h5.76v5.76H6.72z', '.02'],
  ['M12.84 49.38h5.76v5.76h-5.76z', '.08'],
  ['M12.84 37.14h5.76v5.76h-5.76zM12.84 24.9h5.76v5.76h-5.76z', '.15'],
  ['M12.84 12.66h5.76v5.76h-5.76z', '.05'],
  ['M12.84.42h5.76v5.76h-5.76z', '.02'],
  ['M18.96 49.38h5.76v5.76h-5.76z', '.08'],
  ['M18.96 37.14h5.76v5.76h-5.76z', '.05'],
  ['M18.96 24.9h5.76v5.76h-5.76z', '.02'],
  ['M18.96 12.66h5.76v5.76h-5.76z', '.15'],
  ['M18.96.42h5.76v5.76h-5.76z', '.02'],
  ['M25.08 49.38h5.76v5.76h-5.76z', '.08'],
  ['M25.08 37.14h5.76v5.76h-5.76zM25.08 24.9h5.76v5.76h-5.76z', '.02'],
  ['M25.08 12.66h5.76v5.76h-5.76z', '.15'],
  ['M25.08.42h5.76v5.76h-5.76z', '.02'],
  ['M31.2 49.38h5.76v5.76H31.2z', '.08'],
  ['M31.2 37.14h5.76v5.76H31.2zM31.2 24.9h5.76v5.76H31.2z', '.02'],
  ['M31.2 12.66h5.76v5.76H31.2z', '.15'],
  ['M31.2.42h5.76v5.76H31.2z', '.02'],
  ['M37.32 49.38h5.76v5.76h-5.76z', '.08'],
  ['M37.32 37.14h5.76v5.76h-5.76z', '.05'],
  ['M37.32 24.9h5.76v5.76h-5.76z', '.02'],
  ['M37.32 12.66h5.76v5.76h-5.76z', '.15'],
  ['M37.32.42h5.76v5.76h-5.76z', '.02'],
  ['M43.44 49.38h5.76v5.76h-5.76z', '.08'],
  ['M43.44 37.14h5.76v5.76h-5.76zM43.44 24.9h5.76v5.76h-5.76z', '.15'],
  ['M43.44 12.66h5.76v5.76h-5.76z', '.05'],
  ['M43.44.42h5.76v5.76h-5.76z', '.02'],
  ['M49.56 49.38h5.76v5.76h-5.76z', '.05'],
  ['M49.56 37.14h5.76v5.76h-5.76zM49.56 24.9h5.76v5.76h-5.76zM49.56 12.66h5.76v5.76h-5.76z', '.08'],
  ['M49.56.42h5.76v5.76h-5.76zM55.68 49.38h5.76v5.76h-5.76zM55.68 37.14h5.76v5.76h-5.76zM55.68 24.9h5.76v5.76h-5.76zM55.68 12.66h5.76v5.76h-5.76z', '.02'],
]

function Pattern({ scope, className = 'pattern-bg position-absolute', chroma = false }) {
  const gradientId = `case-pattern-${useId().replace(/:/g, '')}`
  const fill = chroma ? `url(#${gradientId})` : 'currentColor'
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 62 62" aria-hidden="true" {...scope}>
    {chroma && <defs><linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="62" y2="0"><stop offset="0%" stopColor="#f06575" stopOpacity=".78" /><stop offset="14%" stopColor="#f0a855" stopOpacity=".74" /><stop offset="28%" stopColor="#e8d060" stopOpacity=".72" /><stop offset="42%" stopColor="#5ad090" stopOpacity=".74" /><stop offset="57%" stopColor="#6ca0ec" stopOpacity=".76" /><stop offset="71%" stopColor="#b090e8" stopOpacity=".74" /><stop offset="85%" stopColor="#ec90c0" stopOpacity=".72" /><stop offset="100%" stopColor="#f06575" stopOpacity=".78" /></linearGradient></defs>}
    {patternPaths.map(([path, opacity], index) => <path key={index} d={path} fill={fill} opacity={opacity} {...scope} />)}
  </svg>
}

function Arrow({ direction }) {
  return <div className={`cases-spinner-arrow cases-spinner-arrow-${direction}`} {...spinnerScope}><svg fill="currentColor" viewBox="0 0 512 512" aria-hidden="true" {...spinnerScope}><path d="m98 190.06 139.78 163.12a24 24 0 0 0 36.44 0L414 190.06c13.34-15.57 2.28-39.62-18.22-39.62h-279.6c-20.5 0-31.56 24.05-18.18 39.62z" {...spinnerScope} /></svg></div>
}

function Reel({ items, style, winnerVisible }) {
  return <div className="cases-reel" style={style} {...reelScope}>{items.map((item, index) => {
    const rarity = rarityKey(item)
    const winner = index === 60 && winnerVisible
    return <div className={`reel-element element-rarity-${rarity}${index === (winnerVisible ? 60 : 20) ? ' element-active' : ''}${winner ? ' element-winner' : ''}`} key={`${index}-${item?.index || item?.name}`} {...reelScope}>
      <div className="element-vector-container" {...reelScope}><Pattern scope={reelScope} className="pattern-bg from-colored-text position-absolute" /></div>
      {item && <div className="element-image" {...reelScope}><img src={item.image} alt="" {...reelScope} /><div className="element-glow" {...reelScope} /></div>}
      {winner && <div className="element-info" {...reelScope}><span {...reelScope}>{displayItemName(item)}</span><div className="info-amount" {...reelScope}><img src="/rocoin.2d3febd5.svg" alt="icon" {...reelScope} /><div className="amount-value" {...reelScope}>{formatAmount(item.price)}</div></div></div>}
    </div>
  })}</div>
}

function Spinner({ count, reels, styles, winnerVisible, spinnerRef }) {
  return <div ref={spinnerRef} className={`cases-spinner spinner-${count}`} {...pageScope} {...spinnerScope}>
    {count === 1 ? <><div className="shadow-left" {...spinnerScope} /><div className="shadow-right" {...spinnerScope} /></> : <><div className="shadow-top" {...spinnerScope} /><div className="shadow-bottom" {...spinnerScope} /></>}
    {reels.map((reel, index) => <div className="inner-wheel" key={index} {...spinnerScope}>
      <canvas className="confetti-canvas" {...spinnerScope} />
      <Reel items={reel} style={styles[index]} winnerVisible={winnerVisible} />
      {index < count - 1 && <div className="spinner-separator" {...spinnerScope} />}
    </div>)}
    {count === 1 ? <><Arrow direction="top" /><Arrow direction="bottom" /></> : <><Arrow direction="left" /><Arrow direction="right" /></>}
  </div>
}

function FastIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" {...controlsScope}><path d="M16.7971 8.71966L10.6931 8.74433C10.542 8.74493 10.444 8.57326 10.5127 8.42847L13.8866 1.31761C13.9881 1.1038 13.7397 0.897073 13.573 1.05657L3.06811 11.1056C2.9301 11.2376 3.01573 11.4833 3.20036 11.485L8.77294 11.5363C8.9182 11.5376 9.01459 11.6989 8.95548 11.8418L6.12076 18.6931C6.03288 18.9055 6.27472 19.0972 6.43754 18.9451L16.9304 9.10043C17.0712 8.96834 16.9839 8.71892 16.7971 8.71966Z" {...controlsScope} /></svg>
}

const confettiColors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3', '#FF1493', '#00CED1', '#FFD700', '#FF69B4', '#00FF7F']

function launchConfetti(canvas) {
  if (!canvas) return
  canvas.classList.add('temp-confetti-canvas')
  const bounds = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.floor(bounds.width * ratio))
  canvas.height = Math.max(1, Math.floor(bounds.height * ratio))
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  const particles = Array.from({ length: 100 }, (_, index) => ({
    x: bounds.width / 2,
    y: bounds.height / 2,
    vx: (Math.random() - 0.5) * 9,
    vy: -3 - Math.random() * 8,
    gravity: 0.12 + Math.random() * 0.08,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.3,
    size: 4 + Math.random() * 5,
    color: confettiColors[index % confettiColors.length],
  }))
  const started = performance.now()
  const draw = (now) => {
    const progress = (now - started) / 3000
    context.clearRect(0, 0, bounds.width, bounds.height)
    for (const particle of particles) {
      particle.x += particle.vx
      particle.y += particle.vy
      particle.vy += particle.gravity
      particle.rotation += particle.spin
      context.save()
      context.globalAlpha = Math.max(0, 1 - Math.max(0, progress - 0.4) / 0.6)
      context.translate(particle.x, particle.y)
      context.rotate(particle.rotation)
      context.fillStyle = particle.color
      context.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2)
      context.restore()
    }
    if (progress < 1) window.requestAnimationFrame(draw)
    else {
      context.clearRect(0, 0, bounds.width, bounds.height)
      canvas.classList.remove('temp-confetti-canvas')
    }
  }
  window.requestAnimationFrame(draw)
}

function ItemCard({ item, items }) {
  const [showRange, setShowRange] = useState(false)
  const rarity = rarityKey(item)
  const chance = chanceNumber(item)
  const ticketRange = useMemo(() => {
    const sorted = [...items].sort((left, right) => chanceNumber(left) - chanceNumber(right))
    const position = sorted.indexOf(item)
    if (position < 0) return null
    const first = Math.round(sorted.slice(0, position).reduce((sum, entry) => sum + chanceNumber(entry) * 1000, 0)) + 1
    const last = first + Math.round(chance * 1000) - 1
    return `${first} - ${last}`
  }, [item, items, chance])
  return <div className={`cases-item-element element-rarity-${rarity}`} onMouseEnter={() => setShowRange(true)} onMouseLeave={() => setShowRange(false)} {...itemScope}>
    <div className="inner-percent" {...itemScope}><div className="percent-text" {...itemScope}><span {...itemScope}>{showRange && ticketRange ? ticketRange : `${chance}%`}</span></div></div>
    <div className="inner-vector-container" {...itemScope}><Pattern scope={itemScope} chroma={rarity === 'chroma'} className={`pattern-bg position-absolute${rarity === 'chroma' ? ' pattern-chroma' : ''}`} /></div>
    <div className="inner-image" {...itemScope}><img src={item.image} alt="" {...itemScope} /><div className={`inner-glow glow-rarity-${rarity}`} {...itemScope} /></div>
    <div className="inner-info" {...itemScope}><div className="inner-name" {...itemScope}>{displayItemName(item)}</div><div className="inner-price" {...itemScope}><img src="/rocoin.2d3febd5.svg" alt="icon" {...itemScope} /><div className="price-value" {...itemScope}><span {...itemScope}>{formatAmount(item.price)}</span></div></div></div>
  </div>
}

function CaseOpen({ caseId, user, onSignIn }) {
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(1)
  const [fast, setFast] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [running, setRunning] = useState(false)
  const [winnerVisible, setWinnerVisible] = useState(false)
  const [showFairness, setShowFairness] = useState(false)
  const [reels, setReels] = useState([])
  const [styles, setStyles] = useState([])
  const spinnerRef = useRef(null)
  const timers = useRef([])

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/cases/${encodeURIComponent(caseId)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Unable to load this case.')
        setCaseData(payload.case)
        document.title = `${payload.case.name} - RoRisk.com`
      })
      .catch((error) => { if (error.name !== 'AbortError') notify({ type: 'error', message: error.message }) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [caseId])

  const positionReels = useCallback((targetIndex = 20, transition = 'none', jitters = []) => {
    const spinner = spinnerRef.current
    if (!spinner) return
    const multi = spinner.classList.contains('spinner-2') || spinner.classList.contains('spinner-3') || spinner.classList.contains('spinner-4')
    const geometry = reelGeometry(spinner, multi)
    if (!geometry) return
    const offset = targetIndex === 60 ? geometry.targetOffset : geometry.initialOffset
    const nextStyles = [...spinner.querySelectorAll('.inner-wheel')].map((_, index) => {
      const reelTransition = Array.isArray(transition) ? transition[index] : transition
      const reelOffset = offset - (jitters[index] || 0)
      return { transform: `translateX(${multi ? 0 : reelOffset}px) translateY(${multi ? reelOffset : 0}px)`, transition: reelTransition }
    })
    setStyles(nextStyles)
  }, [])

  const settleReel = useCallback((index, transition) => {
    const spinner = spinnerRef.current
    if (!spinner) return
    const multi = count > 1
    const geometry = reelGeometry(spinner, multi)
    if (!geometry) return
    const nextStyle = {
      transform: `translateX(${multi ? 0 : geometry.finalOffset}px) translateY(${multi ? geometry.finalOffset : 0}px)`,
      transition,
    }
    setStyles((current) => current.map((style, styleIndex) => styleIndex === index ? nextStyle : style))
  }, [count])

  useLayoutEffect(() => {
    if (!caseData?.items?.length) return
    const frame = window.requestAnimationFrame(() => {
      setWinnerVisible(false)
      setReels(Array.from({ length: count }, (_, index) => createReel(caseData.items, null, `${Date.now()}-${index}`)))
      window.requestAnimationFrame(() => positionReels())
    })
    return () => window.cancelAnimationFrame(frame)
  }, [caseData, count, positionReels])

  useEffect(() => {
    const resize = () => { if (!running) positionReels(winnerVisible ? 60 : 20) }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [positionReels, running, winnerVisible])

  useEffect(() => {
    if (!running) return undefined
    let animationFrame
    let previous = Array(count).fill(20)
    const track = () => {
      const spinner = spinnerRef.current
      if (!spinner) return
      const next = [...spinner.querySelectorAll('.inner-wheel')].map((wheel) => {
        const bounds = wheel.getBoundingClientRect()
        const multi = count > 1
        const center = multi ? bounds.top + bounds.height / 2 : bounds.left + bounds.width / 2
        const elements = wheel.querySelectorAll('.reel-element')
        if (elements.length < 2) return 20
        const firstBounds = elements[0].getBoundingClientRect()
        const secondBounds = elements[1].getBoundingClientRect()
        const firstCenter = multi ? firstBounds.top + firstBounds.height / 2 : firstBounds.left + firstBounds.width / 2
        const secondCenter = multi ? secondBounds.top + secondBounds.height / 2 : secondBounds.left + secondBounds.width / 2
        const spacing = Math.abs(secondCenter - firstCenter) || 1
        return Math.max(0, Math.min(elements.length - 1, Math.round((center - firstCenter) / spacing)))
      })
      if (next.some((position, index) => position !== previous[index])) {
        next.forEach((position, index) => {
          const wheel = spinner.querySelectorAll('.inner-wheel')[index]
          wheel?.querySelector('.element-active')?.classList.remove('element-active')
          wheel?.querySelectorAll('.reel-element')[position]?.classList.add('element-active')
        })
        previous = next
        playSound('tick', { volume: 0.8 })
      }
      animationFrame = window.requestAnimationFrame(track)
    }
    animationFrame = window.requestAnimationFrame(track)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [count, running])

  const spin = useCallback(async (opening, nextUser) => {
    const outcomes = Array.isArray(opening?.outcomes) ? opening.outcomes : []
    if (outcomes.length !== count) throw new Error('The case result was incomplete.')
    clearTimers()
    setRunning(true)
    setWinnerVisible(false)
    const openingId = opening.uuid || opening._id || Date.now()
    const reelSeed = `${openingId}${outcomes[0]?.outcome ?? ''}`
    setReels(outcomes.map((outcome, index) => createReel(
      caseData.items,
      outcome.item,
      `${reelSeed}${index + 1}`,
      `${openingId}${index}bait${outcome.outcome || 0}`,
    )))

    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)))
    positionReels(20)
    await waitForReelImages(spinnerRef.current?.querySelector('.inner-wheel'))
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)))
    await new Promise((resolve) => window.setTimeout(resolve, 100))

    const updatedAt = opening.updatedAt || opening.updated_at || opening.completed_at || opening.created_at
    const normalDuration = updatedAt
      ? Math.max(0, new Date(updatedAt).getTime() + 5000 - Date.now()) / 1010
      : 5
    const durations = outcomes.map((outcome, index) => {
      const baseDuration = fast ? 1.3 : normalDuration
      if (count === 1) return baseDuration
      const durationRandom = seededRandom(`${openingId}${index}dur${outcome.outcome || 0}`)
      return Math.max(0, baseDuration + durationRandom() * 0.5 - 0.25)
    })
    const geometry = reelGeometry(spinnerRef.current, count > 1)
    if (!geometry) throw new Error('The case reel could not be measured.')
    const itemSpacing = geometry.itemSpacing
    const jitters = outcomes.map((outcome, index) => {
      const animationRandom = seededRandom(`${openingId}${index}anim${outcome.outcome || 0}`)
      return Math.floor(animationRandom() * 7 + 1) * itemSpacing / 8
    })
    positionReels(60, durations.map((duration) => `transform ${duration}s cubic-bezier(0.1, 0.6, 0.3, 1)`), jitters)
    durations.forEach((duration, index) => {
      timers.current.push(window.setTimeout(() => {
        settleReel(index, 'transform 0.25s cubic-bezier(0.1, 0.6, 0.3, 1)')
        timers.current.push(window.setTimeout(() => {
          const outcome = outcomes[index]
          const rarity = rarityKey(outcome.item)
          const highTier = ['godly', 'chroma', 'ancient', 'classic'].includes(rarity)
          const sound = highTier && Number(outcome.item?.price) > caseData.rocoinAmount ? 'unboxBig' : rarity === 'legendary' ? 'unboxRare' : 'unbox'
          playSound(sound)
          if (chanceNumber(outcome.item) < 15 && Number(outcome.item?.price) >= caseData.rocoinAmount) {
            launchConfetti(spinnerRef.current?.querySelectorAll('.confetti-canvas')[index])
          }
        }, 300))
      }, duration * 1000 + 200))
    })
    const longestDuration = Math.max(...durations)
    timers.current.push(window.setTimeout(() => {
      setWinnerVisible(true)
      setRunning(false)
      if (nextUser) window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: nextUser } }))
    }, longestDuration * 1000 + 500))
  }, [caseData, clearTimers, count, fast, settleReel, positionReels])

  const openCase = async (demo) => {
    if (running || requesting || !caseData) return
    if (!demo && !user) {
      notify({ type: 'error', message: 'Please sign in to perform this action.' })
      onSignIn?.()
      return
    }
    try {
      if (demo) {
        await spin({ demo: true, updatedAt: new Date().toISOString(), outcomes: Array.from({ length: count }, () => ({ outcome: Math.floor(Math.random() * 100000) + 1, item: pickVisualItem(caseData.items) })) })
        return
      }
      setRequesting(true)
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, demo, clientSeed: getFairClientSeed(user) }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to open this case.')
      incrementFairNonce(user, count)
      await spin(payload.opening, payload.user)
    } catch (error) {
      notify({ type: 'error', message: error.message || 'Unable to open this case.' })
    } finally {
      setRequesting(false)
    }
  }

  const total = (caseData?.rocoinAmount || 0) * count
  const items = useMemo(() => [...(caseData?.items || [])].sort((left, right) => chanceNumber(left) - chanceNumber(right)), [caseData])
  const isOtherCase = caseData?.categories?.includes('rewards') || caseData?.categories?.includes('daily')
  const isDailyCase = caseData?.categories?.includes('daily')

  return <div className="cases" {...casesScope}>
    <div className="cases-content" {...casesScope}>
      {loading ? <div className="case-page-state" {...pageScope}>Loading case...</div> : !caseData ? <div className="case-page-state" {...pageScope}>This case could not be found.</div> : <div className="cases-box-container" {...pageScope}>
        <div className="cases-header-box" {...pageScope} {...headerScope}>
          <a className="link-back" href={isOtherCase ? '/rewards' : '/cases'} {...headerScope}><SiteIcon name="back" {...headerScope} /> Go Back</a>
          <div className="box-mid" {...headerScope}><img className={isDailyCase ? 'case-header-daily-image' : undefined} src={caseData.imageUrl} alt="" {...headerScope} /><div className="item-info" {...headerScope}><span className="item-name" {...headerScope}>{caseData.name}</span><span className="item-price" {...headerScope}><img src="/rocoin.2d3febd5.svg" alt="coin" {...headerScope} /> {formatAmount(caseData.rocoinAmount)}</span></div></div>
          <button className="button-fair" type="button" onClick={() => { if (!user) notify({ type: 'error', message: 'Please sign in to perform this action.' }); else setShowFairness(true) }} {...headerScope}><SiteIcon name="fairness" {...headerScope} /> Fairness</button>
        </div>
        <div className="cases-box" {...pageScope}>
          <Spinner count={count} reels={reels} styles={styles} winnerVisible={winnerVisible} spinnerRef={spinnerRef} />
          <div className={`cases-controls${running || requesting ? ' controls-disabled' : ''}`} {...pageScope} {...controlsScope}><div className="controls-bet" {...controlsScope}>
            <div className="controls-count" {...controlsScope}>{[1, 2, 3, 4].map((value) => <button className={count === value ? 'button-active' : ''} type="button" disabled={running || requesting} onClick={() => setCount(value)} key={value} {...controlsScope}>{value}x</button>)}</div>
            <button className="button-bet" type="button" disabled={running || requesting} onClick={() => openCase(false)} {...controlsScope}>Open {count} Case <div className="inner-amount" {...controlsScope}><img src="/rocoin.2d3febd5.svg" alt="icon" {...controlsScope} /><div className="amount-value" {...controlsScope}><span {...controlsScope}>{formatAmount(total)}</span></div></div></button>
            <button className="button-demo" type="button" disabled={running || requesting} onClick={() => openCase(true)} {...controlsScope}>Demo Spin</button>
            <div className="controls-fast-spin" {...controlsScope}><button className={`button-fast-spin${fast ? ' button-active' : ''}`} type="button" disabled={running || requesting} aria-label="Fast mode" onClick={() => setFast((value) => !value)} {...controlsScope}><FastIcon /></button></div>
          </div></div>
          <div className="box-items" {...pageScope}><div className="items-header" {...pageScope}>Case Items</div><div className="items-content" {...pageScope}>{items.map((item) => <ItemCard item={item} items={items} key={item.index || item.name} />)}</div></div>
        </div>
      </div>}
    </div>
    {showFairness && <ModalAnimation label="Seed Fairness" onClose={() => setShowFairness(false)}><FairSeedModal user={user} /></ModalAnimation>}
  </div>
}

export default CaseOpen
