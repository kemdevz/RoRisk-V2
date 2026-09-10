import { useEffect, useRef, useState } from 'react'
import SiteIcon from './Icons'

const userCardScope = { 'data-v-eb7454a8': '' }

function userLevelData(user) {
  const xp = Number(user?.xp)
  if (Number.isFinite(xp) && xp > 0) {
    const level = Math.min(100, Math.floor(Math.cbrt(xp / 1000 / 50)))
    if (level >= 100) return { level, progress: 100 }
    const start = 1000 * (level ** 3) * 50
    const end = 1000 * ((level + 1) ** 3) * 50
    return { level, progress: Math.min(100, Math.max(0, ((xp - start) / (end - start)) * 100)) }
  }
  return { level: Math.min(100, Math.max(0, Number(user?.level) || 0)), progress: 0 }
}

function SidebarUserCard({ user }) {
  const [claimMenuOpen, setClaimMenuOpen] = useState(false)
  const userCardRef = useRef(null)
  const { level, progress } = userLevelData(user)

  useEffect(() => {
    const close = (event) => {
      if (!userCardRef.current?.contains(event.target)) setClaimMenuOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const goToRewards = () => {
    setClaimMenuOpen(false)
    if (window.location.pathname === '/rewards') return
    window.history.pushState({}, '', '/rewards')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <section ref={userCardRef} className="sidebar-user-card" {...userCardScope}>
      <div className="sidebar-user-name" {...userCardScope}>{user?.username || ''}</div>
      <div className="sidebar-user-xp" title={`Level ${level}`} {...userCardScope}><div className="sidebar-user-xp-fill" style={{ width: `${progress}%` }} {...userCardScope} /></div>
      <div className="sidebar-user-actions" {...userCardScope}>
        <div className={`sidebar-claim${claimMenuOpen ? ' sidebar-claim-open' : ''}`} {...userCardScope}>
          <button className={`sidebar-user-btn sidebar-user-btn-claim${claimMenuOpen ? ' sidebar-user-btn-active' : ''}`} type="button" aria-expanded={claimMenuOpen} onClick={() => setClaimMenuOpen((value) => !value)} {...userCardScope}>
            <span {...userCardScope}>CLAIM</span><SiteIcon name="chevron-down" className={`sidebar-claim-caret${claimMenuOpen ? ' sidebar-claim-caret-open' : ''}`} {...userCardScope} />
          </button>
        </div>
        <button className="sidebar-user-btn sidebar-user-btn-rewards" type="button" onClick={goToRewards} {...userCardScope}>REWARDS</button>
        <div className={`sidebar-claim-menu${claimMenuOpen ? ' sidebar-claim-menu-visible' : ''}`} aria-hidden={!claimMenuOpen} {...userCardScope}>
          <div className="sidebar-claim-empty" {...userCardScope}>No daily cases available</div>
        </div>
      </div>
    </section>
  )
}

const games = [
  ['battles', 'Battles', '/battles'],
  ['blackjack', 'Blackjack', '/blackjack'],
  ['upgrader', 'Upgrader', '/upgrader'],
  ['slide', 'X-Roulette', '/x-roulette'],
  ['mines', 'Mines', '/mines'],
  ['coinflip', 'Coinflip', '/coinflip'],
  ['dice', 'Dice', '/dice'],
  ['cases', 'Cases', '/cases'],
  ['slots', 'Slots', '/slots'],
  ['fire', 'Live Casino', '/live-casino'],
]

const more = [
  ['rewards', 'Rewards', '/rewards'],
  ['market', 'Market', '/market'],
  ['affiliates', 'Affiliates', '/affiliates'],
  ['support', 'Support', '#support'],
]

const profile = [
  ['wallet', 'Wallet', '/wallet'],
  ['vault', 'Vault', '/vault'],
  ['settings', 'Settings', '/settings'],
]

function SidebarSection({ title, items, showLabels, pathname, onAction }) {
  const [open, setOpen] = useState(true)
  const isActive = (href) => pathname === href || (['/cases', '/slots', '/live-casino'].includes(href) && pathname.startsWith(`${href}/`))
  return (
    <section className="sidebar-content" data-v-4fc2a52c="">
      {showLabels && (
        <button className="sidebar-header" type="button" aria-expanded={open} onClick={() => setOpen(!open)} data-v-4fc2a52c="">
          <span data-v-4fc2a52c="">{title}</span><SiteIcon name="chevron-down" className={open ? '' : 'section-collapsed'} data-v-4fc2a52c="" />
        </button>
      )}
      {(open || !showLabels) && (
        <div className="sidebar-items" data-v-4fc2a52c="">
          {items.map(([icon, label, href]) => (
            onAction?.[href] ? (
              <button className={`sidebar-item${pathname === href ? ' sidebar-item-selected' : ''}`} type="button" key={label} onClick={onAction[href]} data-v-4fc2a52c="">
                <span className="sidebar-item-icon" data-v-4fc2a52c=""><SiteIcon name={icon} data-v-4fc2a52c="" /></span>
                {showLabels && <span className="sidebar-item-text" data-v-4fc2a52c="">{label}</span>}
              </button>
            ) :
            icon === 'support' ? (
            <button className="sidebar-item" type="button" key={label} data-v-4fc2a52c="">
              <span className="sidebar-item-icon" data-v-4fc2a52c=""><SiteIcon name={icon} data-v-4fc2a52c="" /></span>
              {showLabels && <span className="sidebar-item-text" data-v-4fc2a52c="">{label}</span>}
            </button>
            ) : (
              <a className={`sidebar-item${icon === 'rewards' ? ' rewards' : ''}${href === '/race' ? ' race' : ''}${isActive(href) ? ' router-link-active' : ''}`} href={href} aria-current={isActive(href) ? 'page' : undefined} key={label} data-v-4fc2a52c="">
                <span className="sidebar-item-icon" data-v-4fc2a52c=""><SiteIcon name={icon} data-v-4fc2a52c="" /></span>
                {showLabels && <span className="sidebar-item-text" data-v-4fc2a52c="">{label}</span>}
              </a>
            )
          ))}
        </div>
      )}
    </section>
  )
}

function Sidebar({ pathname, user, onOpenWallet, onOpenSettings }) {
  const [width, setWidth] = useState(window.innerWidth)
  const [collapsed, setCollapsed] = useState(window.innerWidth < 1200)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1200)

  useEffect(() => {
    const onResize = () => {
      setWidth(window.innerWidth)
      if (window.innerWidth < 1200) setSidebarOpen(false)
      else setSidebarOpen(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const desktop = width >= 1200
  const desktopIconRail = desktop && collapsed
  const showLabels = desktop ? !collapsed : sidebarOpen
  const toggleSidebar = () => desktop ? setCollapsed((value) => !value) : setSidebarOpen((value) => !value)

  return (
    <aside id="sidebar" className={`${desktopIconRail ? 'sidebar-collapsed ' : ''}${sidebarOpen ? 'sidebar-open' : ''}`.trim()} data-v-4fc2a52c="">
      <button className="sidebar-toggle" aria-label={desktop ? (collapsed ? 'Expand sidebar' : 'Collapse sidebar') : (sidebarOpen ? 'Close menu' : 'Open menu')} onClick={toggleSidebar} data-v-4fc2a52c=""><span data-v-4fc2a52c="" /><span data-v-4fc2a52c="" /><span data-v-4fc2a52c="" /></button>
      <div className="sidebar-inner-content" data-v-4fc2a52c="">
        {user && showLabels && <SidebarUserCard user={user} />}
        <SidebarSection title="Games" items={games} showLabels={showLabels} pathname={pathname} />
        {showLabels && (
          <a className="sidebar-race-banner" href="/race" data-v-9e395626="">
            <img className="sidebar-race-art" src="/race2.57df575d.png" alt="RoRisk weekly race" data-v-9e395626="" />
            <div className="sidebar-race-copy" data-v-9e395626="">
              <div className="sidebar-race-row" data-v-9e395626=""><img className="sidebar-race-icon" src="/Sidebar/sidebar-race-coin.bc4b0944.svg" alt="" width="14" height="14" data-v-9e395626="" /><span className="sidebar-race-title" data-v-9e395626="">500k race</span></div>
              <div className="sidebar-race-row" data-v-9e395626=""><img className="sidebar-race-icon" src="/Sidebar/sidebar-race-timer.79af31ab.svg" alt="" width="14" height="14" data-v-9e395626="" /><div className="race-timer is-inline" data-v-233720ce="" data-v-9e395626=""><div className="timer-inline" data-v-233720ce="">{'154:04:22'.split('').map((value, index) => value === ':' ? <span className="inline-colon" key={index} data-v-233720ce="">:</span> : <span className="inline-digit" key={index} data-v-233720ce=""><span className="flip-number" data-v-233720ce="">{value}</span></span>)}</div></div></div>
            </div>
          </a>
        )}
        {user && <SidebarSection title="Profile" items={profile} showLabels={showLabels} pathname={pathname} onAction={{
          '/wallet': () => onOpenWallet?.('deposit'),
          '/vault': () => onOpenWallet?.('vault'),
          '/settings': () => onOpenSettings?.(),
        }} />}
        <SidebarSection title="More" items={more} showLabels={showLabels} pathname={pathname} />
      </div>
    </aside>
  )
}

export default Sidebar
