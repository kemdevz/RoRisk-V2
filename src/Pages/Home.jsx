import { useEffect, useRef, useState } from 'react'
import SiteIcon from '../components/Icons'
import { casinoImageUrl, loadCasinoCatalog } from '../lib/CasinoCatalog'

const banners = [
  { src: '/Banners/rewards.52a9b29c.png', alt: 'Claim your free rewards', width: 1080, height: 420 },
  { src: '/Banners/release.ec6f2af6.png', alt: 'RoRisk is now live', width: 1080, height: 420 },
  { src: '/Banners/pragmatic.6bd4d323.png', alt: 'Try Pragmatic Play titles', width: 1860, height: 724 },
]

const originals = [
  ['X-Roulette', '/Games/xr.webm', 'slide', 'wide', '/x-roulette', true],
  ['Blackjack', '/Games/blackjack.webm', 'blackjack', '', '/blackjack'],
  ['Upgrader', '/Games/upgrader.webm', 'upgrader', '', '/upgrader'],
  ['Mines', '/Games/mines.webm', 'mines', '', '/mines'],
  ['Dice', '/Games/dice.webm', 'dice', '', '/dice', true],
  ['Case Battles', '/Games/casebattles.webm', 'battles', '', '/battles'],
  ['Cases', '/Games/cases.webm', 'cases', '', '/cases'],
]

const methods = [
  ['btc', '/Methods/btc.79d4fc52.png'],
  ['eth', '/Methods/eth.png'],
  ['ltc', '/Methods/ltc.png'],
  ['sol', '/Methods/solana.png'],
  ['usdt', '/Methods/tether.png'],
  ['usdc', '/Methods/usdc.png'],
  ['robux', '/Methods/robux.2244c5eb.png'],
  ['limiteds', '/Methods/valk.3e69ac3a.png'],
]

function levelTheme(level) {
  if (level >= 100) return 'red'
  if (level >= 75) return 'orange'
  if (level >= 50) return 'purple'
  if (level >= 25) return 'green'
  return 'blue'
}

function HomeBanner() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragDelta, setDragDelta] = useState(0)
  const [dragWidth, setDragWidth] = useState(420)
  const [stageWidth, setStageWidth] = useState(0)
  const timerRef = useRef(null)
  const bannerRef = useRef(null)
  const dragStartRef = useRef(0)
  const didDragRef = useRef(false)

  const clearAutoAdvance = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
  }

  const startAutoAdvance = () => {
    clearAutoAdvance()
    timerRef.current = window.setInterval(
      () => setCurrentIndex((index) => (index + 1) % banners.length),
      8000,
    )
  }

  const goTo = (index) => {
    if (index !== currentIndex) {
      setHoveredIndex(null)
      setCurrentIndex(index)
      startAutoAdvance()
    }
  }

  useEffect(() => {
    timerRef.current = window.setInterval(
      () => setCurrentIndex((index) => (index + 1) % banners.length),
      8000,
    )
    return () => clearAutoAdvance()
  }, [])

  useEffect(() => {
    const measureStage = () => setStageWidth(bannerRef.current?.clientWidth || 0)
    measureStage()
    window.addEventListener('resize', measureStage)
    return () => window.removeEventListener('resize', measureStage)
  }, [])

  const getSlot = (index) => {
    let slot = index - currentIndex
    if (slot > 1) slot -= banners.length
    if (slot < -1) slot += banners.length
    return slot
  }

  const poses = stageWidth > 0 && stageWidth < 640
    ? {
        '-1': { x: -70, scale: 0.76, rotate: -2, opacity: 0.4, z: 1 },
        0: { x: -50, scale: 1, rotate: 0, opacity: 1, z: 3 },
        1: { x: -30, scale: 0.76, rotate: 2, opacity: 0.4, z: 1 },
      }
    : {
        '-1': { x: -78, scale: 0.82, rotate: -2, opacity: 0.45, z: 1 },
        0: { x: -50, scale: 1, rotate: 0, opacity: 1, z: 3 },
        1: { x: -22, scale: 0.82, rotate: 2, opacity: 0.45, z: 1 },
      }

  const finishDrag = () => {
    if (!isDragging) return
    const delta = dragDelta
    setIsDragging(false)
    setDragDelta(0)
    if (Math.abs(delta) >= 50) {
      const direction = delta < 0 ? 1 : -1
      setCurrentIndex((index) => (index + direction + banners.length) % banners.length)
      startAutoAdvance()
    } else startAutoAdvance()
    if (didDragRef.current) window.setTimeout(() => { didDragRef.current = false }, 40)
  }

  return (
    <section className="banner-section" data-v-656b4aa4="" data-v-30c4bf74="">
      <div className="banner-mask-x" onMouseEnter={clearAutoAdvance} onMouseLeave={() => { setHoveredIndex(null); if (!isDragging) startAutoAdvance() }} data-v-656b4aa4="">
        <div
          ref={bannerRef}
          className={`banner-mask-y${isDragging ? ' is-dragging' : ''}`}
          onPointerMove={(event) => {
            if (!isDragging) return
            const delta = event.clientX - dragStartRef.current
            setDragDelta(delta)
            if (Math.abs(delta) > 6) didDragRef.current = true
          }}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          data-v-656b4aa4=""
        >
          <div className="banner-stage" data-v-656b4aa4="">
            {banners.map((banner, index) => {
              const slot = getSlot(index)
              const dragProgress = isDragging ? Math.max(-1, Math.min(1, dragDelta / (0.55 * dragWidth))) : 0
              const pose = slot === 0 && dragProgress !== 0
                ? { x: -50 + 38 * dragProgress, scale: 1, rotate: 2 * dragProgress, opacity: 1, z: 4 }
                : (poses[slot] || { x: slot < 0 ? -160 : 60, scale: 0.7, rotate: 4 * (slot < 0 ? -1 : 1), opacity: 0, z: 0 })
              const hovered = !isDragging && hoveredIndex === index
              const scale = hovered ? pose.scale * (slot === 0 ? 1.04 : 1.06) : pose.scale
              const opacity = hovered && slot !== 0 ? Math.min(1, pose.opacity + 0.45) : pose.opacity
              return (
                <div
                  className={`banner-slide${isDragging && index === currentIndex ? ' no-transition' : ''}`}
                  data-v-656b4aa4=""
                  key={banner.src}
                  tabIndex="0"
                  onClick={() => {
                    if (didDragRef.current) didDragRef.current = false
                    else if (index !== currentIndex) goTo(index)
                  }}
                  onPointerDown={(event) => {
                    if (index !== currentIndex || (event.button !== undefined && event.button !== 0)) return
                    setIsDragging(true)
                    didDragRef.current = false
                    dragStartRef.current = event.clientX
                    setDragWidth(bannerRef.current?.clientWidth || 420)
                    setDragDelta(0)
                    clearAutoAdvance()
                    event.currentTarget.setPointerCapture?.(event.pointerId)
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    transform: `translateX(${pose.x}%) translateY(-50%) scale(${scale}) rotateZ(${pose.rotate}deg)`,
                    opacity,
                    zIndex: pose.z,
                    filter: 'drop-shadow(rgba(0, 0, 0, 0.3) 0 0 0.3rem)',
                    pointerEvents: pose.opacity < 0.05 ? 'none' : 'auto',
                  }}
                >
                  <div className="banner-slide-inner" data-v-656b4aa4="">
                    <img src={banner.src} alt={banner.alt} width={banner.width} height={banner.height} draggable="false" data-v-656b4aa4="" />
                  </div>
                </div>
              )
            })}
            <button className="banner-hit banner-hit-left" type="button" aria-label="Show previous banner" onClick={() => goTo((currentIndex - 1 + banners.length) % banners.length)} onPointerDown={(event) => event.stopPropagation()} onMouseEnter={() => setHoveredIndex((currentIndex - 1 + banners.length) % banners.length)} onMouseLeave={() => setHoveredIndex(null)} data-v-656b4aa4="" />
            <button className="banner-hit banner-hit-right" type="button" aria-label="Show next banner" onClick={() => goTo((currentIndex + 1) % banners.length)} onPointerDown={(event) => event.stopPropagation()} onMouseEnter={() => setHoveredIndex((currentIndex + 1) % banners.length)} onMouseLeave={() => setHoveredIndex(null)} data-v-656b4aa4="" />
          </div>
        </div>
      </div>
      <div className="banner-dots" data-v-656b4aa4="">
        {banners.map((banner, index) => (
          <button
            key={banner.src}
            className={`banner-dot${index === currentIndex ? ' active' : ''}`}
            data-v-656b4aa4=""
            type="button"
            aria-label={`Go to slide ${index + 1}`}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </section>
  )
}

function HomeWelcome({ user, onRewards }) {
  const username = user?.username || 'Guest'
  const avatar = user?.avatar_headshot || user?.avatar || '/default-avatar.png'
  const xp = Number(user?.xp)
  const storedLevel = Math.min(100, Math.max(0, Number(user?.level) || 0))
  const level = Number.isFinite(xp) && xp > 0 ? Math.min(100, Math.floor(Math.cbrt(xp / 1000 / 50))) : storedLevel
  const levelStart = 1000 * (level ** 3) * 50
  const levelEnd = 1000 * ((level + 1) ** 3) * 50
  const levelProgress = level >= 100 ? 100 : Number.isFinite(xp) && xp > 0 ? Math.min(100, Math.max(0, ((xp - levelStart) / (levelEnd - levelStart)) * 100)) : 0
  return (
    <div className="home-welcome" data-v-21735a18="" data-v-30c4bf74="">
      <div className="welcome-panel" data-v-21735a18="">
        <div className="welcome-content" data-v-21735a18="">
          <div className="welcome-top" data-v-21735a18="">
            <div className="welcome-avatar" data-v-21735a18="">
              <div className="welcome-avatar-inner" data-v-21735a18="">
                <div className="avatar-image user-avatar" data-v-6adb23f8="" data-v-21735a18=""><img src={avatar} alt="avatar" data-v-6adb23f8="" /></div>
              </div>
            </div>
            <div className="welcome-heading" data-v-21735a18="">
              <div className="welcome-label" data-v-21735a18="">Welcome Back</div>
              <div className="welcome-username" data-v-21735a18="">{username}</div>
            </div>
          </div>
          <div className="level-progress-section" data-v-21735a18="">
            <div className={`box-level level-${levelTheme(level)}`} data-v-ff759fba="" data-v-21735a18=""><div className="level-inner" data-v-ff759fba="">{level}</div></div>
            <div className="progress-container" data-v-21735a18="">
              <div className="progress-arrow" style={{ left: `${levelProgress}%` }} data-v-21735a18=""><SiteIcon name="chevron-down" data-v-21735a18="" /></div>
              <div className="progress-bar" data-v-21735a18=""><div className="progress-fill" style={{ width: `${levelProgress}%` }} data-v-21735a18="" /></div>
            </div>
            <div className={`box-level level-${levelTheme(Math.min(100, level + 1))}`} data-v-ff759fba="" data-v-21735a18=""><div className="level-inner" data-v-ff759fba="">{Math.min(100, level + 1)}</div></div>
          </div>
          <button className="rewards-btn" type="button" onClick={onRewards} data-v-21735a18="">View Daily Rewards</button>
        </div>
        <div className="welcome-visual" aria-hidden="true" data-v-21735a18="">
          <img className="welcome-item" src="/federation.png" alt="" data-v-21735a18="" />
          <video className="welcome-character" src="/Home.webm" autoPlay muted loop playsInline preload="auto" data-v-21735a18="" />
        </div>
      </div>
    </div>
  )
}

function GameCard({ name, video, icon, wide, route, isNew = false }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const sessionRef = useRef({ frames: [], captureId: null, rewindRaf: null, token: 0 })

  const stopCapture = () => {
    const media = videoRef.current
    const session = sessionRef.current
    if (session.captureId !== null) {
      if (media && typeof media.cancelVideoFrameCallback === 'function') media.cancelVideoFrameCallback(session.captureId)
      else cancelAnimationFrame(session.captureId)
      session.captureId = null
    }
  }

  const stopRewind = () => {
    const session = sessionRef.current
    if (session.rewindRaf !== null) cancelAnimationFrame(session.rewindRaf)
    session.rewindRaf = null
  }

  const mediaSize = () => {
    const media = videoRef.current
    const bounds = media?.parentElement?.getBoundingClientRect()
    return bounds && bounds.width > 1 && bounds.height > 1
      ? { width: Math.max(1, Math.round(bounds.width)), height: Math.max(1, Math.round(bounds.height)) }
      : { width: Math.max(1, media?.clientWidth || 320), height: Math.max(1, media?.clientHeight || 200) }
  }

  const drawCover = (context, source, width, height, sourceWidth, sourceHeight) => {
    if (!context || !source || !width || !height || !sourceWidth || !sourceHeight) return
    const scale = Math.max(width / sourceWidth, height / sourceHeight)
    const cropWidth = width / scale
    const cropHeight = height / scale
    context.drawImage(source, (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, width, height)
  }

  const captureFrame = () => {
    const media = videoRef.current
    const session = sessionRef.current
    if (!media?.videoWidth || !media.videoHeight || session.frames.length >= 60) return
    const size = mediaSize()
    const scale = Math.min(1, 720 / size.width)
    const frame = document.createElement('canvas')
    frame.width = Math.max(1, Math.round(size.width * scale))
    frame.height = Math.max(1, Math.round(size.height * scale))
    drawCover(frame.getContext('2d'), media, frame.width, frame.height, media.videoWidth, media.videoHeight)
    session.frames.push(frame)
  }

  const startCapture = (token) => {
    const media = videoRef.current
    const session = sessionRef.current
    const capture = () => {
      if (!media || session.token !== token || media.paused || media.ended || session.frames.length >= 60) {
        session.captureId = null
        return
      }
      captureFrame()
      session.captureId = typeof media.requestVideoFrameCallback === 'function'
        ? media.requestVideoFrameCallback(capture)
        : requestAnimationFrame(capture)
    }
    session.captureId = typeof media?.requestVideoFrameCallback === 'function'
      ? media.requestVideoFrameCallback(capture)
      : requestAnimationFrame(capture)
  }

  const playCardVideo = () => {
    const media = videoRef.current
    const canvas = canvasRef.current
    if (!media) return
    const session = sessionRef.current
    session.token += 1
    const token = session.token
    stopCapture()
    stopRewind()
    session.frames = []
    media.pause()
    media.playbackRate = 1
    media.currentTime = 0
    media.classList.remove('is-hidden')
    canvas?.classList.remove('is-active')
    captureFrame()
    const playback = media.play()
    if (playback && typeof playback.then === 'function') playback.then(() => {
      if (session.token === token) startCapture(token)
    }).catch(() => {})
    else startCapture(token)
  }

  const rewindCardVideo = () => {
    const media = videoRef.current
    const canvas = canvasRef.current
    if (!media) return
    const session = sessionRef.current
    session.token += 1
    const token = session.token
    stopCapture()
    stopRewind()
    const frames = session.frames.slice()
    if (!frames.length || !canvas) {
      media.pause()
      media.currentTime = 0
      media.classList.remove('is-hidden')
      canvas?.classList.remove('is-active')
      session.frames = []
      return
    }

    const size = mediaSize()
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size.width * pixelRatio)
    canvas.height = Math.round(size.height * pixelRatio)
    const context = canvas.getContext('2d')
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.imageSmoothingEnabled = true
    const paintFrame = (frame) => {
      context.clearRect(0, 0, size.width, size.height)
      context.drawImage(frame, 0, 0, frame.width, frame.height, 0, 0, size.width, size.height)
    }
    paintFrame(frames.at(-1))
    media.pause()
    canvas.classList.add('is-active')

    requestAnimationFrame(() => {
      if (session.token !== token) return
      media.classList.add('is-hidden')
      let frameIndex = frames.length - 2
      let previousTime = performance.now()
      let elapsed = 0
      const frameDuration = 1000 / 48
      const rewind = (time) => {
        if (session.token !== token) return
        elapsed += time - previousTime
        previousTime = time
        while (elapsed >= frameDuration && frameIndex >= 0) {
          elapsed -= frameDuration
          paintFrame(frames[frameIndex])
          frameIndex -= 1
        }
        if (frameIndex >= 0) session.rewindRaf = requestAnimationFrame(rewind)
        else {
          media.currentTime = 0
          session.rewindRaf = null
          session.frames = []
        }
      }
      session.rewindRaf = requestAnimationFrame(rewind)
    })
  }

  useEffect(() => () => {
    sessionRef.current.token += 1
    stopCapture()
    stopRewind()
    sessionRef.current.frames = []
  }, [])

  return (
    <a
      href={route}
      className={`game-card${wide ? ` ${wide}` : ''}`}
      data-v-1cd04c6a=""
      onMouseEnter={playCardVideo}
      onMouseLeave={rewindCardVideo}
    >
      <div className="game-card-media" data-v-1cd04c6a="">
        <video ref={videoRef} className="game-media" src={video} muted playsInline preload="auto" data-v-1cd04c6a="" />
        <canvas ref={canvasRef} className="game-media-canvas" aria-hidden="true" data-v-1cd04c6a="" />
      </div>
      <div className="game-card-label" data-v-1cd04c6a="">
        <SiteIcon name={icon} className="game-card-icon" data-v-1cd04c6a="" /><span className="game-card-name" data-v-1cd04c6a="">{name}</span>{isNew && <span className="game-card-new" data-v-1cd04c6a="">NEW</span>}
      </div>
    </a>
  )
}

function ThumbnailStrip({ title, images, routeBase }) {
  const stripRef = useRef(null)
  const scroll = (direction) => stripRef.current?.scrollBy({ left: 170 * direction, behavior: 'smooth' })
  return (
    <div className="slots-popular-block" data-v-1cd04c6a="">
      <div className="title-container" data-v-1cd04c6a="">
        <h2 className="title" data-v-1cd04c6a=""><SiteIcon name={title === 'Popular Slots' ? 'slots' : 'fire'} data-v-1cd04c6a="" /> {title}</h2>
        <div className="scroll-buttons" data-v-1cd04c6a="">
          <button className="scroll-btn scroll-btn-left" type="button" aria-label={`Scroll ${title} left`} onClick={() => scroll(-1)} data-v-1cd04c6a=""><SiteIcon name="chevron-left" data-v-1cd04c6a="" /></button>
          <button className="scroll-btn scroll-btn-right" type="button" aria-label={`Scroll ${title} right`} onClick={() => scroll(1)} data-v-1cd04c6a=""><SiteIcon name="chevron-right" data-v-1cd04c6a="" /></button>
        </div>
      </div>
      <div className="slots-strip-wrapper" data-v-1cd04c6a="">
        <div ref={stripRef} className="slots-strip" data-v-1cd04c6a="">
          {images.map((game, index) => (
            <div className="slots-strip-item" data-v-1cd04c6a="" key={game.code}>
              <a
                className="slot-card slot-card--home"
                href={`${routeBase}/${encodeURIComponent(game.code)}`}
                data-v-53767690=""
                data-v-1cd04c6a=""
                style={{ animationDelay: `${Math.min(30 * index, 400)}ms` }}
              >
                <div className="card-thumbnail" data-v-53767690="">
                  <img
                    className="slot-image"
                    data-v-53767690=""
                    src={casinoImageUrl(game)}
                    alt={game.name}
                    loading="lazy"
                  />
                </div>
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function HomeGames() {
  const [catalog, setCatalog] = useState({ slots: [], live: [] })

  useEffect(() => {
    let active = true
    loadCasinoCatalog().then((games) => {
      if (active) setCatalog(games)
    })
    return () => { active = false }
  }, [])

  return (
    <section className="games-section" data-v-1cd04c6a="" data-v-30c4bf74="">
      <div className="originals-block" data-v-1cd04c6a="">
        <div className="title-container" data-v-1cd04c6a=""><div className="title-text" data-v-1cd04c6a=""><h2 className="title" data-v-1cd04c6a=""><SiteIcon name="fire" data-v-1cd04c6a="" /> RoRisk Originals</h2></div></div>
        <div className="originals-grid" data-v-1cd04c6a="">
          {originals.map(([name, video, icon, wide, route, isNew]) => <GameCard key={name} name={name} video={video} icon={icon} wide={wide} route={route} isNew={isNew} />)}
        </div>
      </div>
      <ThumbnailStrip title="Popular Slots" images={catalog.slots.slice(0, 12)} routeBase="/slots" />
      <ThumbnailStrip title="Live Casino" images={catalog.live.slice(0, 11)} routeBase="/live-casino" />
    </section>
  )
}

function HomeInfoBanner() {
  const cards = [
    ['blue', 'community', 'Community', 'Join our Discord server to participate in giveaways!', 'https://discord.gg/rorisk'],
    ['green', 'rewards', 'Rewards', 'Earn exclusive rewards every time you play!', '/rewards'],
    ['yellow', 'promotions', 'Promotions', 'Follow us on Twitter to redeem exclusive promotions!', 'https://x.com/roriskcom'],
  ]
  return (
    <div className="home-info-banner-container" data-v-8631d556="" data-v-30c4bf74="">
      <div className="home-info-banner" data-v-8631d556="">
        {cards.map(([color, icon, title, description, href]) => (
          <a className="banner-item" data-v-8631d556="" key={title} href={href}>
            <div className={`info-banner-item ${color}`} data-v-8631d556="">
              <div className={`info-banner-item-icon ${color}`} data-v-8631d556=""><SiteIcon name={icon} className={`icon-${icon} ${color}`} data-v-8631d556="" /></div>
              <div className="info-banner-item-title" data-v-8631d556=""><h2 data-v-8631d556="">{title}</h2></div>
              <div className="info-banner-item-description" data-v-8631d556=""><p data-v-8631d556="">{description}</p></div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

function HomeMethods() {
  const row = methods.concat(methods, methods)
  const sliderRef = useRef(null)
  const leftTrackRef = useRef(null)
  const rightTrackRef = useRef(null)

  useEffect(() => {
    let frame = null
    let totalWidth = 0
    let translateLeft = 0
    let translateRight = 0

    const setTrackPositions = () => {
      if (leftTrackRef.current) leftTrackRef.current.style.transform = `translateX(${translateLeft}px)`
      if (rightTrackRef.current) rightTrackRef.current.style.transform = `translateX(${translateRight}px)`
    }

    const calculateWidth = () => {
      const item = sliderRef.current?.querySelector('.method-item')
      if (!item) return
      const style = window.getComputedStyle(item)
      const itemWidth = item.offsetWidth + parseFloat(style.marginLeft || 0) + parseFloat(style.marginRight || 0)
      totalWidth = itemWidth * methods.length
      translateLeft = 0
      translateRight = -totalWidth
      setTrackPositions()
    }

    const animate = () => {
      if (totalWidth > 0) {
        translateLeft -= 0.25
        if (Math.abs(translateLeft) >= totalWidth) translateLeft = 0
        translateRight += 0.25
        if (translateRight >= 0) translateRight = -totalWidth
        setTrackPositions()
      }
      frame = requestAnimationFrame(animate)
    }

    calculateWidth()
    window.addEventListener('resize', calculateWidth)
    frame = requestAnimationFrame(animate)
    return () => {
      window.removeEventListener('resize', calculateWidth)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="payment-methods-container" data-v-779fab0e="" data-v-30c4bf74="">
      <h3 className="methods-subtitle" data-v-779fab0e="">Select your preferred payment method</h3>
      <div className="methods-stack" data-v-779fab0e="">
        {[row, [...row].reverse()].map((methodRow, rowIndex) => (
          <div className="methods-slider" data-v-779fab0e="" key={rowIndex} ref={rowIndex === 0 ? sliderRef : undefined}>
            <div className="methods-track" data-v-779fab0e="" ref={rowIndex === 0 ? leftTrackRef : rightTrackRef}>
              {methodRow.map(([name, image], index) => (
                <div className={`method-item ${name}`} data-v-779fab0e="" key={`${rowIndex}-${name}-${index}`}>
                  <div className="method-inner" data-v-779fab0e=""><img src={image} alt={name} data-v-779fab0e="" /></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Bets() {
  const [tab, setTab] = useState('all')
  return (
    <div className="bets" data-v-3dfc5cda="" data-v-30c4bf74="">
      <div className="bets-header" data-v-3dfc5cda="">
        <h2 className="title" data-v-3dfc5cda=""><SiteIcon name="bets" data-v-3dfc5cda="" /> Live Bets</h2>
        <div className="bets-buttons" data-v-3dfc5cda="">
          {[['all', 'All Bets'], ['big-wins', 'High Rollers'], ['lucky-wins', 'Lucky Wins']].map(([key, label]) => (
            <button key={key} className={`button${tab === key ? ' button-active' : ''}`} onClick={() => setTab(key)} data-v-3dfc5cda="">{label}</button>
          ))}
        </div>
      </div>
      <div className="bets-list" data-v-3dfc5cda="">
        <div className="list-head" data-v-3dfc5cda="">
          <div className="head-game" data-v-3dfc5cda="">Gamemode</div><div className="head-user" data-v-3dfc5cda="">Player</div><div className="head-time" data-v-3dfc5cda="">Time</div><div className="head-amount" data-v-3dfc5cda="">Bet</div><div className="head-multiplier" data-v-3dfc5cda="">Multiplier</div><div className="head-payout" data-v-3dfc5cda="">Payout</div>
        </div>
        <div className="list-content" data-v-3dfc5cda=""><div className="content-empty" data-v-3dfc5cda="">No active bets.</div></div>
      </div>
    </div>
  )
}

function Home({ user }) {
  const openRewards = () => {
    window.history.pushState({}, '', '/rewards')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  useEffect(() => {
    document.title = 'RoRisk.com - #1 Roblox Arcade Platform'
  }, [])

  return (
    <div className="home" data-v-30c4bf74="">
      <div className="home-top" data-v-30c4bf74=""><HomeWelcome user={user} onRewards={openRewards} /><HomeBanner /></div>
      <HomeGames />
      <HomeInfoBanner />
      <HomeMethods />
      <Bets />
    </div>
  )
}

export default Home
