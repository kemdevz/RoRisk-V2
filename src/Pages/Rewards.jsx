import { useCallback, useEffect, useRef, useState } from 'react'
import XPBreakdownModal from '../components/XPBreakdownModal'
import { notify } from '../lib/Notifications'

const rootScope = { 'data-v-50523a4e': '' }
const profileScope = { 'data-v-b395c708': '' }
const dailyScope = { 'data-v-6df6623e': '' }
const cardScope = { 'data-v-26f0adc3': '' }
const bonusScope = { 'data-v-396c843f': '' }
const asset = (name) => `/RewardsNew/${name}`

const xpThresholds = [
  0, .1, 100, 250, 500, 800, 1200, 1900, 3000, 4500, 6200, 8300,
  10800, 13800, 17300, 21300, 25800, 30900, 36600, 42900, 50000, 58000,
  67000, 77000, 87500, 99000, 111500, 125000, 139500, 156000, 175000,
  197000, 223000, 255000, 293000, 339000, 394000, 460000, 537000, 629000,
  740000, 878000, 1036000, 1214000, 1413000, 1634000, 1879000, 2149000,
  2445000, 2770000, 3127000, 3513000, 3934000, 4389000, 4882000,
  5412000, 5983000, 6596000, 7253000, 7956000, 8700000, 9500000,
  10350000, 11260000, 12220000, 13240000, 14320000, 15460000, 16660000,
  17930000, 19270000, 20670000, 22150000, 23700000, 25340000, 27050000,
  28840000, 30720000, 32680000, 34730000, 37000000, 40000000, 43000000,
  47000000, 51000000, 56000000, 61000000, 67000000, 73000000, 80000000,
  87000000, 96000000, 106000000, 118000000, 133000000, 150000000,
  170000000, 195000000, 225000000, 260000000, 300000000, 350000000,
  410000000, 480000000, 560000000, 650000000, 750000000, 850000000,
  960000000, 1080000000, 1200000000, 1335000000, 1485000000, 1655000000,
  1850000000, 2070000000, 2340000000, 2655000000, 3030000000, 3475000000,
  4200000000, 5000000000, 6000000000, 7200000000, 8500000000, 10000000000,
  11700000000, 13500000000, 15500000000, 18000000000,
]

const ranks = [
  { name: 'Rust', min: 1, icon: asset('rust.0b56e484.svg'), badgeBg: 'rgba(231, 149, 122, 0.2)', bar: '#E29075', accent: '#dd7c5c' },
  { name: 'Bronze', min: 20, icon: asset('bronze.f59206cb.svg'), badgeBg: 'rgba(208, 138, 76, 0.2)', bar: '#D08A4C', accent: '#d08a4c' },
  { name: 'Silver', min: 40, icon: asset('silver.81ba8fbc.svg'), badgeBg: 'rgba(192, 199, 209, 0.2)', bar: '#C0C7D1', accent: '#c0c7d1' },
  { name: 'Gold', min: 60, icon: asset('gold.49b1d38b.svg'), badgeBg: 'rgba(255, 199, 77, 0.2)', bar: '#FFC74D', accent: '#ffc74d' },
  { name: 'Diamond', min: 80, icon: asset('diamond.e915302c.svg'), badgeBg: 'rgba(125, 211, 252, 0.2)', bar: '#7DD3FC', accent: '#7dd3fc' },
  { name: 'Emerald', min: 100, icon: asset('emerald.2fc26a46.svg'), badgeBg: 'rgba(52, 211, 153, 0.2)', bar: '#34D399', accent: '#34d399' },
  { name: 'Ruby', min: 120, icon: asset('ruby.550e6038.svg'), badgeBg: 'rgba(225, 29, 72, 0.2)', bar: '#E11D48', accent: '#e11d48' },
]

const bonusTiers = [
  { ...ranks[0], chest: asset('rust.dfcdfb92.png'), key: asset('rust.134c5f3a.png') },
  { ...ranks[1], chest: asset('bronze.980e97d4.png'), key: asset('bronze.357608b3.png') },
  { ...ranks[2], chest: asset('silver.285777d0.png'), key: asset('silver.e8a99d8a.png') },
  { ...ranks[3], chest: asset('gold.e78dcb04.png'), key: asset('gold.34bcbc8a.png') },
  { ...ranks[4], chest: asset('diamond.77c17e83.png'), key: asset('diamond.e0b428f6.png') },
  { ...ranks[5], chest: asset('emerald.b44417cc.png'), key: asset('emerald.3f96ded5.png') },
  { ...ranks[6], chest: asset('ruby.9eb3e0da.png'), key: asset('ruby.46f86d1d.png') },
]

const riskCases = [
  { key: 'low', label: 'low', image: asset('low.d17f3bbd.png') },
  { key: 'medium', label: 'medium', image: asset('medium.68a45fde.png') },
  { key: 'high', label: 'high', image: asset('high.7c5a52ab.png') },
]

function levelFromUser(user) {
  const xp = Number(user?.xp)
  if (!Number.isFinite(xp)) return Math.max(0, Number(user?.level) || 0)
  const normalized = xp / 1000
  if (normalized < xpThresholds[1]) return 0
  let level = 1
  for (let index = 1; index < xpThresholds.length; index += 1) {
    if (xpThresholds[index] > normalized) break
    level = index
  }
  return level
}

function xpAtLevel(level) {
  const index = Math.max(0, Math.min(129, Math.floor(Number(level) || 0)))
  return Math.round(1000 * xpThresholds[index])
}

function LevelBadge({ level }) {
  const theme = level >= 100 ? 'red' : level >= 75 ? 'orange' : level >= 50 ? 'purple' : level >= 25 ? 'green' : 'blue'
  return <div className={`box-level level-${theme}`} data-v-ff759fba=""><div className="level-inner" data-v-ff759fba="">{level}</div></div>
}

function SectionTitle({ icon, title, heading = 'h2', children, scope }) {
  const Heading = heading
  return (
    <div className="rewards-section-title" {...scope}>
      <img className="rewards-section-icon" src={icon} alt="" {...scope} />
      <Heading {...scope}>{title}</Heading>
      {children}
    </div>
  )
}

function Chevron({ direction, scope }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...scope}><path d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} {...scope} /></svg>
}

function InfoIcon({ scope }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...scope}><path fill="#8aa0b3" d="M13 9h-2V7h2m0 10h-2v-6h2m-1-9A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2Z" {...scope} /></svg>
}

function RewardsProfile({ user }) {
  const level = levelFromUser(user)
  const rank = ranks.reduce((current, entry) => level >= entry.min ? entry : current, ranks[0])
  const staffAccent = user?.rank === 'admin' ? '#F7DE50' : user?.rank === 'partner' ? '#FF7785' : user?.rank === 'mod' ? '#78FF78' : null
  const xp = Math.max(0, Number(user?.xp) || 0)
  const xpStart = xpAtLevel(level)
  const xpNeeded = Math.max(1, xpAtLevel(level + 1) - xpStart)
  const xpProgress = Math.max(0, xp - xpStart)
  const progress = Math.min(100, Math.max(4, xpProgress / xpNeeded * 100))
  const joinedValue = user?.joined_at || user?.joinedAt || user?.created_at || user?.createdAt
  const joined = joinedValue ? new Date(joinedValue) : null
  const joinedLabel = joined && !Number.isNaN(joined.getTime())
    ? `Joined ${joined.toLocaleString('en-US', { month: 'long' })} ${joined.getDate()}, ${joined.getFullYear()}`
    : 'Join to start earning rewards'

  return (
    <section className="rewards-profile" {...profileScope}>
      <SectionTitle icon={asset('gift.2b91124b.svg')} title="Rewards" heading="h1" scope={profileScope} />
      <div className="rewards-profile-card" {...profileScope}>
        <div className="rewards-profile-top" {...profileScope}>
          <div className="rewards-profile-user" {...profileScope}>
            <div className="rewards-profile-avatar" style={{ '--rank-accent': staffAccent || rank.accent }} {...profileScope}>
              <div className="rewards-profile-avatar-inner" {...profileScope}>
                <img src={user?.avatar_headshot || user?.avatar || '/default-avatar.png'} alt="" {...profileScope} />
              </div>
            </div>
            <div className="rewards-profile-meta" {...profileScope}>
              <div className="rewards-profile-name" {...profileScope}>{user?.username || 'Guest'}</div>
              <div className="rewards-profile-joined" {...profileScope}>{joinedLabel}</div>
            </div>
          </div>
          <div className="rewards-profile-level" {...profileScope}>
            <span className="rewards-profile-level-label" {...profileScope}>Level</span>
            <LevelBadge level={level} />
            <span className="rewards-profile-level-rule" aria-hidden="true" {...profileScope} />
            <div className="rewards-profile-rank" style={{ background: rank.badgeBg }} {...profileScope}>
              <img src={rank.icon} alt={rank.name} {...profileScope} />
              <span {...profileScope}>{rank.name}</span>
            </div>
          </div>
        </div>
        <div className="rewards-profile-divider" aria-hidden="true" {...profileScope} />
        <div className="rewards-profile-progress" {...profileScope}>
          <div className="rewards-profile-progress-row" {...profileScope}>
            <p {...profileScope}><span className="muted" {...profileScope}>Progress:</span><span className="strong" {...profileScope}>{rank.name}</span></p>
            <p className="rewards-profile-xp" {...profileScope}><span {...profileScope}>{Math.floor(xpProgress / 1000).toLocaleString('en-US')}</span><span className="muted" {...profileScope}> / {Math.floor(xpNeeded / 1000).toLocaleString('en-US')}</span></p>
          </div>
          <div className="rewards-profile-bar" {...profileScope}><div className="rewards-profile-bar-fill" style={{ width: `${progress}%`, '--bar': rank.bar }} {...profileScope} /></div>
        </div>
      </div>
    </section>
  )
}

function DailyCaseCard({ risk, peek, action = 'wager', timer = '00:00:00', onOpen }) {
  return (
    <article className={`daily-case-card daily-case-card--${risk.key}${peek ? ' is-peek' : ' is-clickable'}`} onClick={peek ? undefined : onOpen} {...cardScope}>
      {!peek && <div className="daily-case-card-head" {...cardScope}>
        <p className="daily-case-card-title" {...cardScope}>Daily Case</p>
        <div className="daily-case-card-risk" {...cardScope}><span className="daily-case-card-risk-label" {...cardScope}>Risk Level</span><span className="daily-case-card-risk-value" {...cardScope}>{risk.label}</span></div>
      </div>}
      <div className="daily-case-card-art" {...cardScope}><img src={risk.image} alt="" {...cardScope} /></div>
      {!peek && (action === 'open'
        ? <button className="daily-case-card-btn daily-case-card-btn-open" type="button" onClick={(event) => { event.stopPropagation(); onOpen() }} {...cardScope}><img src={asset('open-case.f85c68d7.svg')} alt="" {...cardScope} />Open Case</button>
        : <div className="daily-case-card-btn daily-case-card-btn-wager" {...cardScope}>{action === 'timer' ? `Unbox in: ${timer}` : 'Wager more!'}</div>)}
    </article>
  )
}

function RewardsDaily({ user, onSignIn }) {
  const [active, setActive] = useState(0)
  const [drag, setDrag] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [carouselWidth, setCarouselWidth] = useState(420)
  const carouselRef = useRef(null)
  const didDragRef = useRef(false)
  const step = useCallback((amount) => {
    setHovered(null)
    setActive((value) => (value + amount + riskCases.length) % riskCases.length)
  }, [])
  useEffect(() => {
    const node = carouselRef.current
    if (!node) return undefined
    const update = () => setCarouselWidth(node.clientWidth || 420)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const pose = (index) => {
    let slot = index - active
    if (slot > 1) slot -= 3
    if (slot < -1) slot += 3
    const base = slot === 0
      ? { x: -50, scale: 1, rotate: 0, opacity: 1, z: 3 }
      : slot < 0
        ? { x: -82, scale: .82, rotate: -2, opacity: .45, z: 1 }
        : { x: -18, scale: .82, rotate: 2, opacity: .45, z: 1 }
    const delta = drag ? Math.max(-1, Math.min(1, drag.delta / Math.max(1, carouselWidth * .55))) : 0
    const x = slot === 0 ? base.x + 38 * delta : base.x
    const sideHover = !drag && hovered === index && slot !== 0
    const scale = sideHover ? base.scale * 1.06 : base.scale
    const opacity = sideHover ? Math.min(1, base.opacity + .45) : base.opacity
    return { transform: `translateX(${x}%) translateY(-50%) scale(${scale}) rotate(${base.rotate}deg)`, opacity, zIndex: base.z }
  }
  const open = () => user ? notify({ type: 'error', message: 'Daily cases are not available yet.' }) : onSignIn?.()
  const pointerDown = (event, index) => {
    if (index !== active || event.button !== 0 || event.target.closest('button')) return
    didDragRef.current = false
    setDrag({ start: event.clientX, delta: 0 })
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const pointerMove = (event) => drag && setDrag((current) => {
    const delta = event.clientX - current.start
    if (Math.abs(delta) > 6) didDragRef.current = true
    return { ...current, delta }
  })
  const pointerUp = () => {
    if (!drag) return
    if (Math.abs(drag.delta) >= 50) step(drag.delta < 0 ? 1 : -1)
    setDrag(null)
  }
  const slideClick = (index) => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    setHovered(null)
    if (index === active) open()
    else setActive(index)
  }

  return (
    <section className="rewards-daily" {...dailyScope}>
      <SectionTitle icon={asset('daily.9a8eeb97.svg')} title="Daily Cases" scope={dailyScope}>
        <span className="rewards-info-wrap" {...dailyScope}><span className="rewards-info-btn" aria-label="Daily cases info" tabIndex="0" {...dailyScope}><InfoIcon scope={dailyScope} /></span><span className="rewards-info-tip" role="tooltip" {...dailyScope}>Claim values increase when you wager and decrease when you stop wagering.</span></span>
      </SectionTitle>
      <div className="rewards-daily-banner" {...dailyScope}>
        <div className="rewards-daily-character" aria-hidden="true" {...dailyScope}><img className="rewards-daily-character-img" src={asset('character.af6a58b2.png')} alt="" {...dailyScope} /></div>
        <div className="rewards-daily-copy" {...dailyScope}>
          <h3 {...dailyScope}><span className="claim" {...dailyScope}>Claim</span><span {...dailyScope}> Your</span><span className="daily" {...dailyScope}> Daily Case</span></h3>
          <p {...dailyScope}>Pick a <strong className="risk-low" {...dailyScope}>Low</strong>, <strong className="risk-med" {...dailyScope}>Medium</strong> or <strong className="risk-high" {...dailyScope}>High-risk</strong> bonus case once each day. You can either open it or cash it out. Higher-risk cases have higher possible values.</p>
          <div className="rewards-daily-rule" aria-hidden="true" {...dailyScope} />
          <div className="rewards-daily-more" {...dailyScope}><p {...dailyScope}>More Cases?</p><a className="rewards-primary-btn" href="/welcome" {...dailyScope}>Claim Your 4 Free Cases</a></div>
        </div>
        <div ref={carouselRef} className={`rewards-daily-carousel${drag ? ' is-dragging' : ''}`} {...dailyScope}>
          <div className="rewards-daily-stage" {...dailyScope}>
            {riskCases.map((risk, index) => <div className={`rewards-daily-slide${drag && index === active ? ' no-transition' : ''}`} style={pose(index)} onClick={() => slideClick(index)} onPointerDown={(event) => pointerDown(event, index)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} key={risk.key} {...dailyScope}><DailyCaseCard risk={risk} peek={index !== active} onOpen={open} /></div>)}
          </div>
          <button className="rewards-daily-nav rewards-daily-nav-prev" type="button" aria-label="Previous case" onClick={() => step(-1)} {...dailyScope}><Chevron direction="left" scope={dailyScope} /></button>
          <button className="rewards-daily-nav rewards-daily-nav-next" type="button" aria-label="Next case" onClick={() => step(1)} {...dailyScope}><Chevron direction="right" scope={dailyScope} /></button>
        </div>
      </div>
    </section>
  )
}

function RewardsBonus({ user, onSignIn, onXPBreakdown }) {
  const rowRef = useRef(null)
  const dragRef = useRef(null)
  const didDragRef = useRef(false)
  const [now, setNow] = useState(() => Date.now())
  const level = levelFromUser(user)
  const keys = user?.bonus_keys || user?.bonusKeys || {}
  const lastOpened = user?.bonus_keys_last_opened || user?.bonusKeysLastOpened || {}
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const open = (tier) => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    if (!user) return onSignIn?.()
    notify({ type: 'error', message: Number(keys[tier.name.toLowerCase()] || 0) > 0 ? 'This bonus case is not available yet.' : 'This bonus case is locked.' })
  }
  const scroll = (direction) => {
    const row = rowRef.current
    const card = row?.querySelector('.rewards-bonus-card')
    if (row) row.scrollBy({ left: direction * ((card?.offsetWidth || 200) + 14), behavior: 'smooth' })
  }
  const pointerDown = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return
    didDragRef.current = false
    dragRef.current = { x: event.clientX, left: rowRef.current?.scrollLeft || 0 }
    rowRef.current?.classList.add('is-dragging')
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const pointerMove = (event) => {
    if (dragRef.current && rowRef.current) {
      const delta = event.clientX - dragRef.current.x
      if (Math.abs(delta) > 6) didDragRef.current = true
      rowRef.current.scrollLeft = dragRef.current.left - delta
    }
  }
  const pointerUp = () => {
    dragRef.current = null
    rowRef.current?.classList.remove('is-dragging')
    if (didDragRef.current) window.setTimeout(() => { didDragRef.current = false }, 40)
  }

  return (
    <section className="rewards-bonus" {...bonusScope}>
      <SectionTitle icon={asset('bonus.68efa6a8.svg')} title="Bonus Cases" scope={bonusScope}>
        <button className="rewards-info-btn" type="button" aria-label="XP breakdown" onClick={onXPBreakdown} {...bonusScope}><InfoIcon scope={bonusScope} /></button>
        <div className="rewards-bonus-nav" {...bonusScope}><button className="rewards-bonus-nav-btn" type="button" aria-label="Previous cases" onClick={() => scroll(-1)} {...bonusScope}><Chevron direction="left" scope={bonusScope} /></button><button className="rewards-bonus-nav-btn" type="button" aria-label="Next cases" onClick={() => scroll(1)} {...bonusScope}><Chevron direction="right" scope={bonusScope} /></button></div>
      </SectionTitle>
      <div ref={rowRef} className="rewards-bonus-grid" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} {...bonusScope}>
        {bonusTiers.map((tier) => {
          const key = tier.name.toLowerCase()
          const unlocked = tier.min <= 1 || level >= tier.min
          const count = Math.max(0, Math.floor(Number(keys[key]) || 0))
          const cooldown = ({ rust: 3600000, bronze: 7200000, silver: 10800000 }[key] || 21600000)
          const openedAt = lastOpened[key] ? new Date(lastOpened[key]).getTime() : 0
          const remaining = openedAt && Number.isFinite(openedAt) ? Math.max(0, openedAt + cooldown - now) : 0
          const canOpen = unlocked && count > 0 && remaining <= 0
          const waiting = unlocked && count > 0 && remaining > 0
          const hours = Math.floor(remaining / 3600000)
          const minutes = Math.floor((remaining % 3600000) / 60000)
          const seconds = Math.floor((remaining % 60000) / 1000)
          const timer = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
          return <article className={`rewards-bonus-card ${unlocked ? 'is-unlocked' : 'is-locked'}`} style={{ '--edge': tier.accent, '--wash': `${tier.accent}35` }} onClick={() => open(tier)} key={tier.name} {...bonusScope}>
            <div className="rewards-bonus-head" {...bonusScope}><div className="rewards-bonus-name" {...bonusScope}><img src={tier.icon} alt={tier.name} {...bonusScope} /><span {...bonusScope}>{tier.name}</span></div>{unlocked ? <div className="rewards-bonus-meta rewards-bonus-keys" {...bonusScope}><img src={tier.key} alt="" {...bonusScope} /><span {...bonusScope}>{count} {count === 1 ? 'Key' : 'Keys'}</span></div> : <div className="rewards-bonus-meta" {...bonusScope}>Level {tier.min}+</div>}</div>
            <img className="rewards-bonus-chest" src={tier.chest} alt={tier.name} {...bonusScope} />
            {canOpen ? <button className="rewards-bonus-btn rewards-bonus-btn-open" type="button" onClick={(event) => { event.stopPropagation(); open(tier) }} {...bonusScope}>Open Case</button> : waiting ? <div className="rewards-bonus-btn rewards-bonus-btn-wait" {...bonusScope}>Unbox in: <span {...bonusScope}>{timer}</span></div> : <div className="rewards-bonus-btn rewards-bonus-btn-locked" {...bonusScope}><img src={asset('locked.8cc650fb.svg')} alt="" {...bonusScope} />Case locked</div>}
          </article>
        })}
      </div>
    </section>
  )
}

function Rewards({ user, onSignIn }) {
  const [showXPBreakdown, setShowXPBreakdown] = useState(false)

  useEffect(() => {
    document.title = 'Rewards - RoRisk.com'
    window.localStorage.setItem('currency', 'coins')
    window.dispatchEvent(new CustomEvent('rorisk:currency-change', { detail: { currency: 'coins' } }))
  }, [])
  return <>
    <div className="rewards" {...rootScope}><RewardsProfile user={user} /><RewardsDaily user={user} onSignIn={onSignIn} /><RewardsBonus user={user} onSignIn={onSignIn} onXPBreakdown={() => setShowXPBreakdown(true)} /></div>
    {showXPBreakdown && <XPBreakdownModal onClose={() => setShowXPBreakdown(false)} />}
  </>
}

export default Rewards
