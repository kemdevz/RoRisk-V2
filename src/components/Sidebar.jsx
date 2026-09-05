import { useEffect, useState } from 'react'
import SiteIcon from './Icons'

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

function SidebarSection({ title, items, showLabels }) {
  const [open, setOpen] = useState(true)
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
            icon === 'support' ? (
            <button className="sidebar-item" type="button" key={label} data-v-4fc2a52c="">
              <span className="sidebar-item-icon" data-v-4fc2a52c=""><SiteIcon name={icon} data-v-4fc2a52c="" /></span>
              {showLabels && <span className="sidebar-item-text" data-v-4fc2a52c="">{label}</span>}
            </button>
            ) : (
              <a className={`sidebar-item${icon === 'rewards' ? ' rewards' : ''}`} href={href} key={label} data-v-4fc2a52c="">
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

function Sidebar() {
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
        <SidebarSection title="Games" items={games} showLabels={showLabels} />
        {showLabels && (
          <a className="sidebar-race-banner" href="/race" data-v-9e395626="">
            <img className="sidebar-race-art" src="/race2.57df575d.png" alt="RoRisk weekly race" data-v-9e395626="" />
            <div className="sidebar-race-copy" data-v-9e395626="">
              <div className="sidebar-race-row" data-v-9e395626=""><img className="sidebar-race-icon" src="/Sidebar/sidebar-race-coin.bc4b0944.svg" alt="" width="14" height="14" data-v-9e395626="" /><span className="sidebar-race-title" data-v-9e395626="">500k race</span></div>
              <div className="sidebar-race-row" data-v-9e395626=""><img className="sidebar-race-icon" src="/Sidebar/sidebar-race-timer.79af31ab.svg" alt="" width="14" height="14" data-v-9e395626="" /><div className="race-timer is-inline" data-v-233720ce="" data-v-9e395626=""><div className="timer-inline" data-v-233720ce="">{'154:04:22'.split('').map((value, index) => value === ':' ? <span className="inline-colon" key={index} data-v-233720ce="">:</span> : <span className="inline-digit" key={index} data-v-233720ce=""><span className="flip-number" data-v-233720ce="">{value}</span></span>)}</div></div></div>
            </div>
          </a>
        )}
        <SidebarSection title="More" items={more} showLabels={showLabels} />
      </div>
    </aside>
  )
}

export default Sidebar
