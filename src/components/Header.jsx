import { useCallback, useEffect, useRef, useState } from 'react'
import SiteIcon from './Icons'
import { playSound } from '../lib/Sounds'

const cashierScope = { 'data-v-d934db46': '' }
const amountNumberScope = { 'data-v-2edbedb3': '' }
const userScope = { 'data-v-37d0061e': '' }
const notificationScope = { 'data-v-16e4a512': '' }

function useDropdownTransition(duration, transitionName) {
  const [phase, setPhase] = useState('closed')
  const phaseRef = useRef('closed')
  const frameRef = useRef(null)
  const timerRef = useRef(null)

  const clearPending = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    frameRef.current = null
    timerRef.current = null
  }, [])
  const update = useCallback((value) => {
    phaseRef.current = value
    setPhase(value)
  }, [])
  const close = useCallback(() => {
    if (phaseRef.current === 'closed' || phaseRef.current === 'leave') return
    clearPending()
    update('leave')
    timerRef.current = window.setTimeout(() => update('closed'), duration)
  }, [clearPending, duration, update])
  const open = useCallback(() => {
    clearPending()
    update('enter')
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => {
        update('open')
        frameRef.current = null
      })
    })
  }, [clearPending, update])
  const toggle = useCallback(() => {
    if (phaseRef.current === 'closed' || phaseRef.current === 'leave') open()
    else close()
  }, [close, open])

  useEffect(() => () => clearPending(), [clearPending])

  const transitionClass = phase === 'enter'
    ? `${transitionName}-enter-active ${transitionName}-enter`
    : phase === 'leave'
      ? `${transitionName}-leave-active ${transitionName}-leave-to`
      : phase === 'open'
        ? `${transitionName}-enter-active`
        : ''

  return { close, expanded: phase !== 'closed' && phase !== 'leave', rendered: phase !== 'closed', toggle, transitionClass }
}

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

function formatBalance(value) {
  return Math.floor(Number(value) || 0).toLocaleString('en-US')
}

function AmountNumber({ amount, className = '', isPlus = false }) {
  const target = Number(amount) || 0
  const [current, setCurrent] = useState(target)
  const currentRef = useRef(target)
  const intervalRef = useRef(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      currentRef.current = target
      setCurrent(target)
      return undefined
    }

    if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
    const step = Math.floor(target - currentRef.current) / 60
    intervalRef.current = window.setInterval(() => {
      const next = Math.floor(currentRef.current + step)
      if ((step >= 0 && next >= target) || (step <= 0 && next <= target)) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
        currentRef.current = target
        setCurrent(target)
        return
      }
      currentRef.current = next
      setCurrent(next)
    }, 1000 / 60)

    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [target])

  return <div className={`amount-number${className ? ` ${className}` : ''}`} {...amountNumberScope} {...cashierScope}>{isPlus && current > 0 && <span>+</span>}<span>{formatBalance(current)}</span></div>
}

function levelTheme(level) {
  if (level >= 100) return 'red'
  if (level >= 75) return 'orange'
  if (level >= 50) return 'purple'
  if (level >= 25) return 'green'
  return 'blue'
}

function RankBadge({ rank, className = '' }) {
  if (!['admin', 'mod', 'partner'].includes(rank)) return null
  return <div className={`box-rank rank-${rank}${className ? ` ${className}` : ''}`} data-v-fc8af502=""><div className="rank-inner" data-v-fc8af502=""><img src={`/${rank}.${rank === 'admin' ? 'f6df244d' : rank === 'mod' ? '998a884b' : '0a259ddf'}.svg`} alt={rank} data-v-fc8af502="" /></div></div>
}

function NavbarCashier({ user, onOpenWallet }) {
  const [currency, setCurrency] = useState(() => window.localStorage.getItem('currency') === 'coins' ? 'coins' : 'rocoins')
  const [balanceChanges, setBalanceChanges] = useState([])
  const { close: closeDropdown, expanded, rendered, toggle, transitionClass } = useDropdownTransition(160, 'currency-dropdown')
  const areaRef = useRef(null)
  const previousBalanceRef = useRef(null)
  const balanceKeyRef = useRef(null)
  const animationFramesRef = useRef(new Set())
  const animationTimersRef = useRef(new Set())
  const isRoCoins = currency === 'rocoins'
  const balance = Number(isRoCoins ? (user?.balanceRocoins ?? user?.rocoins) : (user?.balance ?? user?.coins)) || 0
  const currencyIcon = isRoCoins ? '/rocoin.2d3febd5.svg' : '/Rewards/coin.12f4bce8.svg'
  const alternateIcon = isRoCoins ? '/Rewards/coin.12f4bce8.svg' : '/rocoin.2d3febd5.svg'
  const alternateCurrency = isRoCoins ? 'coins' : 'rocoins'
  const alternateLabel = isRoCoins ? 'Coins' : 'RoCoins'

  const selectCurrency = () => {
    window.localStorage.setItem('currency', alternateCurrency)
    setCurrency(alternateCurrency)
    closeDropdown()
  }

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!areaRef.current?.contains(event.target)) closeDropdown()
    }
    const closeOnEscape = (event) => { if (event.key === 'Escape') closeDropdown() }
    document.addEventListener('click', handleOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('click', handleOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [closeDropdown])

  useEffect(() => {
    const previousBalance = previousBalanceRef.current
    previousBalanceRef.current = balance
    if (balanceKeyRef.current !== currency) {
      balanceKeyRef.current = currency
      return
    }
    if (previousBalance === null || balance === previousBalance) return

    playSound('balance', { volume: 0.5 })

    const id = Date.now() + Math.random()
    setBalanceChanges((changes) => [...changes, { id, amount: balance - previousBalance, phase: 'enter' }])
    const firstFrame = requestAnimationFrame(() => {
      animationFramesRef.current.delete(firstFrame)
      const secondFrame = requestAnimationFrame(() => {
        animationFramesRef.current.delete(secondFrame)
        setBalanceChanges((changes) => changes.map((change) => change.id === id ? { ...change, phase: 'open' } : change))
      })
      animationFramesRef.current.add(secondFrame)
    })
    animationFramesRef.current.add(firstFrame)

    const leaveTimer = window.setTimeout(() => {
      animationTimersRef.current.delete(leaveTimer)
      setBalanceChanges((changes) => changes.map((change) => change.id === id ? { ...change, phase: 'leave' } : change))
      const removeTimer = window.setTimeout(() => {
        animationTimersRef.current.delete(removeTimer)
        setBalanceChanges((changes) => changes.filter((change) => change.id !== id))
      }, 200)
      animationTimersRef.current.add(removeTimer)
    }, 3000)
    animationTimersRef.current.add(leaveTimer)
  }, [balance, currency])

  useEffect(() => () => {
    for (const frame of animationFramesRef.current) cancelAnimationFrame(frame)
    for (const timer of animationTimersRef.current) window.clearTimeout(timer)
  }, [])

  return (
    <div className="navbar-cashier" {...cashierScope}>
      <div className="cashier-container" {...cashierScope}>
        <div className="balance-area" ref={areaRef} {...cashierScope}>
          <div className="cashier-balance" {...cashierScope}>
            <div className={`balance-inner ${isRoCoins ? 'rocoin' : 'coin'}`} role="button" tabIndex="0" aria-expanded={expanded} onClick={toggle} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle() } }} {...cashierScope}>
              <div className="balance-inner-left" {...cashierScope}>
                <img src={currencyIcon} alt="icon" {...cashierScope} />
                <AmountNumber className="cashier-balance-text" amount={balance} />
              </div>
              <div className="balance-inner-right" {...cashierScope}>
                <span className={`currency-badge navbar-currency-badge ${isRoCoins ? 'rocoin' : 'coin'}`} {...cashierScope}>{isRoCoins ? 'RoCoins' : 'Coins'}</span>
              </div>
            </div>
          </div>
          {rendered && (
            <div className={`currency-dropdown ${transitionClass}`.trim()} {...cashierScope}>
              <div className="currency-dropdown-options" {...cashierScope}>
                <button className="currency-dropdown-option currency-change-option" type="button" onClick={selectCurrency} {...cashierScope}>
                  <img src={alternateIcon} alt="" {...cashierScope} />
                  <span className="currency-change-copy" {...cashierScope}><span className="currency-change-label" {...cashierScope}>Change to <strong className={isRoCoins ? 'coin-text' : 'rocoin-text'} {...cashierScope}>{alternateLabel}</strong></span></span>
                  <span className="currency-info-wrap" onClick={(event) => event.stopPropagation()} {...cashierScope}>
                    <button className="currency-info-btn" type="button" aria-label="Currency information" {...cashierScope}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...cashierScope}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M12 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="8" r="1.25" fill="currentColor" /></svg></button>
                    <span className="currency-info-tooltip" role="tooltip" {...cashierScope}>{isRoCoins ? 'Coins are for crypto deposits and withdrawals. This balance is separate from RoCoins.' : 'RoCoins are for Robux and Limiteds. This balance is separate from Coins.'}</span>
                  </span>
                </button>
                <div className="currency-dropdown-divider" aria-hidden="true" {...cashierScope} />
                <button className="currency-dropdown-option vault-option" type="button" onClick={() => { closeDropdown(); onOpenWallet?.('vault') }} {...cashierScope}><SiteIcon name="vault" {...cashierScope} /><span {...cashierScope}>Vault</span></button>
              </div>
            </div>
          )}
          <div className="balance-changes" {...cashierScope}>
            {balanceChanges.map((change) => {
              const animationClass = change.phase === 'enter'
                ? ' fade-zoom-enter-active fade-zoom-enter'
                : change.phase === 'leave'
                  ? ' fade-zoom-leave-active fade-zoom-leave-to'
                  : ' fade-zoom-enter-active'
              return <div key={change.id} className={`balance-change ${isRoCoins ? 'rocoin' : 'coin'} ${change.amount > 0 ? 'plus' : 'minus'}${animationClass}`} {...cashierScope}><img src={currencyIcon} alt="icon" {...cashierScope} /><AmountNumber className="balance-change-text" amount={change.amount} isPlus={change.amount > 0} /></div>
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function NavbarNotifications() {
  const [open, setOpen] = useState(false)
  const areaRef = useRef(null)
  useEffect(() => {
    const close = (event) => {
      if (!areaRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])
  return (
    <div className="notification-area" ref={areaRef} {...notificationScope}>
      <button className="button-notifications" type="button" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((value) => !value)} {...notificationScope}>
        <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...notificationScope}><path d="M255.9 456c31.1 0 48.1-22 48.1-53h-96.3c0 31 17 53 48.2 53zM412 352.2c-15.4-20.3-45.7-32.2-45.7-123.1 0-93.3-41.2-130.8-79.6-139.8-3.6-.9-6.2-2.1-6.2-5.9v-2.9c0-13.4-11-24.7-24.4-24.6-13.4-.2-24.4 11.2-24.4 24.6v2.9c0 3.7-2.6 5-6.2 5.9-38.5 9.1-79.6 46.5-79.6 139.8 0 90.9-30.3 102.7-45.7 123.1-9.9 13.1-.5 31.8 15.9 31.8h280.1c16.3 0 25.7-18.8 15.8-31.8z" fill="currentColor" /></svg>
      </button>
      <div className={`notifications-panel${open ? ' panel-active' : ''}`} {...notificationScope}>
        <div className="panel-header" {...notificationScope}><h3 {...notificationScope}>Notifications</h3></div>
        <div className="panel-content" {...notificationScope}><p className="no-notifications" {...notificationScope}>No notifications yet.</p></div>
        <div className="panel-footer" {...notificationScope}><button className="clear-all" type="button" {...notificationScope}>Clear All</button></div>
      </div>
    </div>
  )
}

function NavbarUser({ user, onSignOut, onOpenWallet, onOpenSettings, onOpenStatistics, onOpenTransactions }) {
  const { close: closeDropdown, expanded, rendered, toggle, transitionClass } = useDropdownTransition(150, 'language-menu')
  const menuRef = useRef(null)
  const { level, progress } = userLevelData(user)
  const avatar = user?.avatar_headshot || user?.avatar || '/default-avatar.png'
  const rank = String(user?.rank || 'user').toLowerCase()
  const hasStaffRank = rank !== 'user'

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) closeDropdown()
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [closeDropdown])

  const navigate = (path) => {
    closeDropdown()
    if (path === '/settings') {
      onOpenSettings?.()
    } else if (path === '/wallet') {
      onOpenWallet?.('redeem')
    } else if (path === '/statistics') {
      onOpenStatistics?.()
    } else if (path === '/transactions') {
      onOpenTransactions?.()
    } else if (path) {
      window.history.pushState({}, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  return (
    <div className="navbar-user" ref={menuRef} {...userScope}>
      <button className={`navbar-user-dropdown${expanded ? ' navbar-user-dropdown-open' : ''}`} type="button" aria-expanded={expanded} onClick={toggle} {...userScope}>
        <div className="user-button" {...userScope}><div className="avatar-image user-pfp-image" data-v-6adb23f8="" {...userScope}><img src={avatar} alt="avatar" data-v-6adb23f8="" {...userScope} /></div></div>
        <div className="user-meta" {...userScope}>
          <div className="user-info" {...userScope}>{hasStaffRank ? <RankBadge rank={rank} /> : <div className={`box-level level-${levelTheme(level)}`} data-v-ff759fba=""><div className="level-inner" data-v-ff759fba="">{level}</div></div>}<div className="username" {...userScope}>{user?.username || 'Loading...'}</div></div>
          <div className="user-xp" title={`Level ${level}`} {...userScope}><div className="user-xp-fill" style={{ width: `${progress}%` }} {...userScope} /></div>
        </div>
        <div className="icon-dropdown-wrapper" {...userScope}><SiteIcon name="chevron-down" className={`icon-dropdown${expanded ? ' icon-dropdown-open' : ''}`} {...userScope} /></div>
      </button>
      {rendered && (
        <div className={`user-dropdown-menu ${transitionClass}`.trim()} {...userScope}>
          {[['bets', 'Statistics'], ['wallet', 'Transactions'], ['affiliates', 'Affiliates'], ['rewards', 'Redeem'], ['settings', 'Settings']].map(([icon, label]) => (
            <button type="button" key={label} onClick={() => navigate(label === 'Statistics' ? '/statistics' : label === 'Transactions' ? '/transactions' : label === 'Redeem' ? '/wallet' : label === 'Affiliates' ? '/affiliates' : '/settings')} {...userScope}><SiteIcon name={icon} className="user-dropdown-icon" {...userScope} /><span {...userScope}>{label}</span></button>
          ))}
          <button className="user-dropdown-logout" type="button" onClick={onSignOut} {...userScope}><SiteIcon name="back" className="user-dropdown-icon" {...userScope} /><span {...userScope}>Sign Out</span></button>
        </div>
      )}
    </div>
  )
}

function NavbarLogo() {
  const logoMediaQuery = '(min-width: 1301px)'
  const [showVideoLogo, setShowVideoLogo] = useState(() =>
    window.matchMedia(logoMediaQuery).matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(logoMediaQuery)
    const updateLogo = (event) => setShowVideoLogo(event.matches)

    mediaQuery.addEventListener('change', updateLogo)
    return () => mediaQuery.removeEventListener('change', updateLogo)
  }, [])

  if (showVideoLogo) {
    return (
      <div data-v-1cdc1483="" className="navbar-left-logo" bis_skin_checked="1">
        <video
          data-v-1cdc1483=""
          src="/Logos/rorisk.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          aria-label="RoRisk"
        />
      </div>
    )
  }

  return (
    <div
      data-v-1cdc1483=""
      className="navbar-left-logo-mobile"
      bis_skin_checked="1"
    >
      <img data-v-1cdc1483="" src="/Logos/rorisk.png" alt="logo" />
    </div>
  )
}

function Header({ pathname, user, onSignIn, onRegister, onSignOut, onOpenWallet, onOpenSettings, onOpenStatistics, onOpenTransactions }) {
  return (
    <div className="app-header" bis_skin_checked="1">
      <nav data-v-1cdc1483="" id="navbar" className={user ? undefined : 'navbar-guest'}>
        <div data-v-1cdc1483="" className="navbar-left" bis_skin_checked="1">
          <a
            data-v-1cdc1483=""
            href="/"
            aria-current={pathname === '/' ? 'page' : undefined}
            className={pathname === '/' ? 'router-link-exact-active router-link-active' : undefined}
          >
            <NavbarLogo />
          </a>
          <div
            data-v-1cdc1483=""
            className="navbar-left-actions"
            bis_skin_checked="1"
          >
            <a data-v-1cdc1483="" href="/rewards" aria-current={pathname === '/rewards' ? 'page' : undefined} className={`navbar-claim-cases${pathname === '/rewards' ? ' router-link-active' : ''}`}>
              <svg
                data-v-1cdc1483=""
                xmlns="http://www.w3.org/2000/svg"
                width="25"
                height="25"
                viewBox="0 0 25 25"
                fill="none"
                className="navbar-claim-cases-icon"
              >
                <path
                  d="M3.3 16.5875V22.6125C3.30329 22.9154 3.4259 23.2046 3.64121 23.4176C3.85653 23.6306 4.14715 23.75 4.45 23.75H11.475V16.5875H3.3ZM13.525 23.75H20.55C20.8529 23.75 21.1435 23.6306 21.3587 23.4176C21.5741 23.2046 21.6968 22.9154 21.7 22.6125V16.5875H13.525V23.75ZM22.625 6.3625H20.325C20.5606 5.88403 20.6845 5.35833 20.6875 4.825C20.6842 3.8757 20.3048 2.96641 19.6324 2.29632C18.9599 1.62625 18.0492 1.24999 17.1 1.25C16.1083 1.29703 15.1501 1.62364 14.3361 2.19209C13.5222 2.76054 12.8856 3.54764 12.5 4.4625C12.1144 3.54764 11.4778 2.76054 10.6638 2.19209C9.84986 1.62364 8.8917 1.29703 7.9 1.25C6.9507 1.24999 6.04009 1.62625 5.36766 2.29632C4.69524 2.96641 4.31581 3.8757 4.3125 4.825C4.31546 5.35833 4.43941 5.88403 4.675 6.3625H2.375C1.75 6.3625 1.25 7.1 1.25 8V12.9125C1.25 13.8125 1.75 14.55 2.375 14.55H11.475V6.3625H13.525V14.55H22.625C23.25 14.55 23.75 13.8125 23.75 12.9125V8C23.75 7.1 23.25 6.3625 22.625 6.3625ZM7.9 6.3625C7.68729 6.38174 7.4729 6.35645 7.2705 6.28824C7.0681 6.22003 6.88214 6.1104 6.72445 5.96634C6.56677 5.82227 6.44084 5.64694 6.35468 5.4515C6.26851 5.25607 6.22401 5.04484 6.22401 4.83125C6.22401 4.61766 6.26851 4.40642 6.35468 4.211C6.44084 4.01556 6.56677 3.84022 6.72445 3.69616C6.88214 3.5521 7.0681 3.44247 7.2705 3.37426C7.4729 3.30605 7.68729 3.28076 7.9 3.3C9.65 3.3 10.6375 5.1 11.125 6.3625H7.9ZM17.1 6.3625H13.875C14.3625 5.1125 15.35 3.3 17.1 3.3C17.3127 3.28076 17.5271 3.30605 17.7295 3.37426C17.9319 3.44247 18.1179 3.5521 18.2755 3.69616C18.4333 3.84022 18.5591 4.01556 18.6454 4.211C18.7315 4.40642 18.776 4.61766 18.776 4.83125C18.776 5.04484 18.7315 5.25607 18.6454 5.4515C18.5591 5.64694 18.4333 5.82227 18.2755 5.96634C18.1179 6.1104 17.9319 6.22003 17.7295 6.28824C17.5271 6.35645 17.3127 6.38174 17.1 6.3625Z"
                  fill="currentColor"
                />
              </svg>
              <span data-v-1cdc1483="">Claim Free 4 Cases</span>
            </a>
            <div
              data-v-1cdc1483=""
              aria-hidden="true"
              className="divider-vertical"
              bis_skin_checked="1"
            />
            <a
              data-v-1cdc1483=""
              href="/race"
              className="navbar-race-btn"
              title="Weekly Race"
              aria-label="Weekly Race"
            >
              <svg
                data-v-1cdc1483=""
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 22 22"
                fill="none"
              >
                <path
                  d="M3.95801 1.09961H18.0413V2.26011H16.4463V8.02741C16.4462 8.74908 16.3028 9.46355 16.0242 10.1293C15.7457 10.7951 15.3376 11.3988 14.8237 11.9055C14.3099 12.4122 13.7004 12.8118 13.0308 13.081C12.3612 13.3501 11.6448 13.4836 10.9232 13.4735C7.95981 13.4328 5.55521 10.9941 5.55301 8.03071V2.26011H3.95801V1.09961ZM13.6116 17.1981C14.2518 17.1981 14.771 17.7173 14.771 18.3575V19.7391H16.4474V20.8996H5.55301V19.7391H7.22941V18.3586C7.22941 17.7184 7.74861 17.1992 8.38881 17.1992H9.29851V14.4129C9.85349 14.5617 10.4256 14.6368 11.0002 14.6362C11.5747 14.6365 12.1468 14.5618 12.7019 14.414V17.1992L13.6116 17.1981Z"
                  fill="currentColor"
                />
                <path
                  d="M17.6078 3.42102V4.58042H19.7396V7.19072C19.7389 7.8817 19.4919 8.5498 19.0429 9.07501C18.5939 9.60022 17.9724 9.94813 17.2899 10.0562C17.1558 10.4706 16.9811 10.8707 16.7685 11.2508H16.84C17.9164 11.2494 18.9482 10.8211 19.7093 10.06C20.4704 9.29894 20.8986 8.26708 20.9001 7.19072V3.41992L17.6078 3.42102ZM2.2606 7.19072C2.26138 7.88218 2.50885 8.55068 2.95852 9.07596C3.40818 9.60124 4.03052 9.94884 4.7136 10.0562C4.84825 10.4707 5.02364 10.8709 5.2372 11.2508H5.1602C4.08384 11.2494 3.05198 10.8211 2.29088 10.06C1.52978 9.29894 1.10155 8.26708 1.1001 7.19072V3.41992H4.3924V4.58042H2.2606V7.19072Z"
                  fill="currentColor"
                />
              </svg>
            </a>
          </div>
        </div>
        <div data-v-1cdc1483="" className="navbar-mid" bis_skin_checked="1">{user && <NavbarCashier user={user} onOpenWallet={onOpenWallet} />}</div>
        <div data-v-1cdc1483="" className="navbar-right" bis_skin_checked="1">
          {!user ? <div
            data-v-48b2574b=""
            data-v-1cdc1483=""
            className="auth-button-wrap"
            bis_skin_checked="1"
          >
            <button
              type="button"
              data-v-48b2574b=""
              className="auth-button auth-button-secondary"
              onClick={onSignIn}
            >
              Sign In
            </button>
            <button
              type="button"
              data-v-48b2574b=""
              className="auth-button auth-button-primary"
              onClick={onRegister}
            >
              Register
            </button>
          </div> : <>
            <div className="navbar-cashier-actions" data-v-1cdc1483="">
              <button className="navbar-action-btn navbar-action-btn-deposit" type="button" aria-label="Deposit" onClick={() => onOpenWallet?.('deposit')} data-v-1cdc1483=""><span className="navbar-action-label" data-v-1cdc1483="">Deposit</span><span className="navbar-action-plus" aria-hidden="true" data-v-1cdc1483="">+</span></button>
              <button className="navbar-action-btn navbar-action-btn-withdraw" type="button" onClick={() => onOpenWallet?.('withdraw')} data-v-1cdc1483="">Withdraw</button>
            </div>
            <div className="divider-vertical" aria-hidden="true" data-v-1cdc1483="" />
            <NavbarNotifications />
            <NavbarUser user={user} onSignOut={onSignOut} onOpenWallet={onOpenWallet} onOpenSettings={onOpenSettings} onOpenStatistics={onOpenStatistics} onOpenTransactions={onOpenTransactions} />
          </>}
        </div>
      </nav>
    </div>
  )
}

export default Header
