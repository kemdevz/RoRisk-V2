import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Chat from './components/Chat'
import Footer from './components/Footer'
import Header from './components/Header'
import LoadingScreen from './components/LoadingScreen'
import Sidebar from './components/Sidebar'
import SigninModal from './components/SigninModal'
import Notifications from './components/Notifications'
import ModalAnimation from './components/ModalAnimation'
import SettingsModal from './components/SettingsModal'
import WalletModal from './components/WalletModal'
import StatisticsModal from './components/StatisticsModal'
import TransactionsModal from './components/TransactionsModal'
import { listenForPasswordRecovery, refreshSessionProfile, signOut, syncGoogleProfile } from './lib/Supabase'
import { notify } from './lib/Notifications'
import { preloadSound } from './lib/Sounds'

const pageLoaders = {
  home: () => import('./Pages/Home'),
  rewards: () => import('./Pages/Rewards'),
  welcome: () => import('./Pages/Welcome'),
  market: () => import('./Pages/Market'),
  affiliates: () => import('./Pages/Affiliates'),
  race: () => import('./Pages/Race'),
  cases: () => import('./Pages/Cases'),
  caseOpen: () => import('./Pages/CaseOpen'),
  battles: () => import('./Pages/Battles'),
  slots: () => import('./Pages/Slots'),
  liveCasino: () => import('./Pages/LiveCasino'),
  casinoGame: () => import('./Pages/CasinoGame'),
  dice: () => import('./Pages/Dice'),
  blackjack: () => import('./Pages/Blackjack'),
  coinflip: () => import('./Pages/Coinflip'),
  mines: () => import('./Pages/Mines'),
  xRoulette: () => import('./Pages/XRoulette'),
  upgrader: () => import('./Pages/Upgrader'),
  provablyFair: () => import('./Pages/ProvablyFair'),
}

const pageComponents = {
  '/': lazy(pageLoaders.home),
  '/rewards': lazy(pageLoaders.rewards),
  '/welcome': lazy(pageLoaders.welcome),
  '/market': lazy(pageLoaders.market),
  '/affiliates': lazy(pageLoaders.affiliates),
  '/race': lazy(pageLoaders.race),
  '/cases': lazy(pageLoaders.cases),
  '/battles': lazy(pageLoaders.battles),
  '/battles/create': lazy(pageLoaders.battles),
  '/slots': lazy(pageLoaders.slots),
  '/live-casino': lazy(pageLoaders.liveCasino),
  '/dice': lazy(pageLoaders.dice),
  '/blackjack': lazy(pageLoaders.blackjack),
  '/coinflip': lazy(pageLoaders.coinflip),
  '/mines': lazy(pageLoaders.mines),
  '/x-roulette': lazy(pageLoaders.xRoulette),
  '/upgrader': lazy(pageLoaders.upgrader),
  '/provably-fair': lazy(pageLoaders.provablyFair),
}

const routeLoaders = {
  '/': pageLoaders.home,
  '/rewards': pageLoaders.rewards,
  '/welcome': pageLoaders.welcome,
  '/market': pageLoaders.market,
  '/affiliates': pageLoaders.affiliates,
  '/race': pageLoaders.race,
  '/cases': pageLoaders.cases,
  '/battles': pageLoaders.battles,
  '/battles/create': pageLoaders.battles,
  '/slots': pageLoaders.slots,
  '/live-casino': pageLoaders.liveCasino,
  '/dice': pageLoaders.dice,
  '/blackjack': pageLoaders.blackjack,
  '/coinflip': pageLoaders.coinflip,
  '/mines': pageLoaders.mines,
  '/x-roulette': pageLoaders.xRoulette,
  '/upgrader': pageLoaders.upgrader,
  '/provably-fair': pageLoaders.provablyFair,
}

const CaseOpen = lazy(pageLoaders.caseOpen)
const CasinoGame = lazy(pageLoaders.casinoGame)

function pageLoader(pathname) {
  if (/^\/r\/[A-Za-z0-9_]{3,12}$/.test(pathname)) return pageLoaders.welcome
  if (/^\/cases\/[a-zA-Z0-9_-]+$/.test(pathname)) return pageLoaders.caseOpen
  if (/^\/battles\/[a-zA-Z0-9-]+$/.test(pathname)) return pageLoaders.battles
  if (/^\/(?:slots|live-casino)\/[a-zA-Z0-9_.-]+$/.test(pathname)) return pageLoaders.casinoGame
  return routeLoaders[pathname] || pageLoaders.home
}

const initialReferralMatch = window.location.pathname.match(/^\/r\/([A-Za-z0-9_]{3,12})$/)
if (initialReferralMatch) {
  window.localStorage.setItem('rorisk_affiliate_code', initialReferralMatch[1])
  window.history.replaceState({}, '', '/welcome')
}
const initialPathname = initialReferralMatch ? '/welcome' : window.location.pathname

function readStoredUser() {
  try {
    const stored = window.localStorage.getItem('rorisk_user')
    return stored ? JSON.parse(stored) : null
  } catch {
    window.localStorage.removeItem('rorisk_user')
    return null
  }
}

function App() {
  const [pathname, setPathname] = useState(initialPathname)
  const [displayedPath, setDisplayedPath] = useState(initialPathname)
  const displayedPathRef = useRef(initialPathname)
  const [routePhase, setRoutePhase] = useState('idle')
  const [isChatOpen, setIsChatOpen] = useState(() => window.innerWidth > 1800)
  const [authModal, setAuthModal] = useState(null)
  const [siteModal, setSiteModal] = useState(null)
  const [siteModalClosing, setSiteModalClosing] = useState(false)
  const [user, setUser] = useState(readStoredUser)
  const [loaderPhase, setLoaderPhase] = useState('visible')
  const [pagePhase, setPagePhase] = useState('idle')
  const handleChatToggle = useCallback((open) => setIsChatOpen(open), [])

  useEffect(() => listenForPasswordRecovery(() => setAuthModal('recovery')), [])

  useEffect(() => {
    preloadSound('slideStarted')
  }, [])

  const authenticatedUserId = user?.uuid || user?.id || null
  useEffect(() => {
    if (loaderPhase !== 'done' || !authenticatedUserId) return undefined
    let disposed = false
    let inFlight = false
    let timer
    let controller

    const schedule = () => {
      if (timer) window.clearTimeout(timer)
      if (!disposed && !document.hidden) timer = window.setTimeout(refresh, 1000)
    }
    const refresh = async () => {
      if (disposed || inFlight || document.hidden) return
      inFlight = true
      controller = new AbortController()
      try {
        const profile = await refreshSessionProfile({ signal: controller.signal })
        if (!disposed && (profile?.uuid || profile?.id) === authenticatedUserId) {
          window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: profile } }))
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          // Keep the current session usable during a temporary network interruption.
        }
      } finally {
        inFlight = false
        schedule()
      }
    }
    const refreshWhenVisible = () => {
      if (document.hidden) return
      void refresh()
    }

    void refresh()
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      disposed = true
      if (timer) window.clearTimeout(timer)
      controller?.abort()
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [authenticatedUserId, loaderPhase])

  useEffect(() => {
    if (loaderPhase !== 'done') return undefined
    const loaders = [...new Set(Object.values(pageLoaders))]
    let index = 0
    let idleId
    let timer
    let cancelled = false
    const warmNext = () => {
      if (cancelled || index >= loaders.length) return
      if (document.hidden) {
        timer = window.setTimeout(scheduleNext, 1000)
        return
      }
      loaders[index++]().catch(() => {})
      timer = window.setTimeout(scheduleNext, 300)
    }
    const scheduleNext = () => {
      if (cancelled || index >= loaders.length) return
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(warmNext, { timeout: 2500 })
      } else {
        timer = window.setTimeout(warmNext, 500)
      }
    }
    scheduleNext()
    return () => {
      cancelled = true
      if (idleId) window.cancelIdleCallback(idleId)
      if (timer) window.clearTimeout(timer)
    }
  }, [loaderPhase])

  useEffect(() => {
    const balanceFields = {
      coins: new Set(['coins', 'balance']),
      rocoins: new Set(['rocoins', 'balanceRocoins', 'balance_rocoins']),
    }
    const holds = new Map()
    const pending = { coins: {}, rocoins: {} }
    const heldCurrency = (currency) => [...holds.values()].some((hold) => !hold.currency || hold.currency === currency)
    const storeUser = (profile) => {
      setUser((current) => {
        if (!current || (current.uuid || current.id) !== (profile.uuid || profile.id)) return current
        const next = { ...current, ...profile }
        window.localStorage.setItem('rorisk_user', JSON.stringify(next))
        return next
      })
    }
    const release = (id) => {
      const hold = holds.get(id)
      if (hold?.timer) window.clearTimeout(hold.timer)
      holds.delete(id)
      for (const currency of ['coins', 'rocoins']) {
        if (heldCurrency(currency) || !Object.keys(pending[currency]).length) continue
        const profile = pending[currency]
        pending[currency] = {}
        storeUser(profile)
      }
    }
    const updateUser = (event) => {
      const profile = event.detail?.user
      if (!profile) return
      const immediate = { ...profile }
      for (const currency of ['coins', 'rocoins']) {
        if (!heldCurrency(currency)) continue
        for (const field of balanceFields[currency]) {
          if (!Object.prototype.hasOwnProperty.call(immediate, field)) continue
          pending[currency][field] = immediate[field]
          delete immediate[field]
        }
        pending[currency].uuid = profile.uuid || profile.id
        pending[currency].id = profile.id || profile.uuid
      }
      storeUser(immediate)
    }
    const updateHold = (event) => {
      const detail = event.detail || {}
      const id = String(detail.id || 'game')
      if (detail.active === false) return release(id)
      const existing = holds.get(id)
      if (existing?.timer) window.clearTimeout(existing.timer)
      const until = Math.max(Date.now(), Number(detail.until) || Date.now())
      const hold = { currency: detail.currency, timer: null }
      hold.timer = window.setTimeout(() => release(id), Math.max(0, until - Date.now()))
      holds.set(id, hold)
    }
    window.addEventListener('rorisk:user-update', updateUser)
    window.addEventListener('rorisk:balance-notification-hold', updateHold)
    return () => {
      window.removeEventListener('rorisk:user-update', updateUser)
      window.removeEventListener('rorisk:balance-notification-hold', updateHold)
      for (const hold of holds.values()) window.clearTimeout(hold.timer)
    }
  }, [])

  useEffect(() => {
    if (loaderPhase !== 'done') return
    const isGoogleCallback = new URLSearchParams(window.location.search).has('code')
    syncGoogleProfile().then((user) => {
      if (user) {
        window.localStorage.setItem('rorisk_user', JSON.stringify(user))
        setUser(user)
        if (isGoogleCallback) notify({ type: 'success', message: 'Signed in with Google successfully.' })
      }
    }).catch((error) => {
      if (isGoogleCallback) notify({ type: 'error', message: error.message || 'Google sign in failed. Please try again.' })
    })
  }, [loaderPhase])

  const handleAuthenticated = useCallback((authenticatedUser) => {
    if (!authenticatedUser) return
    window.localStorage.setItem('rorisk_user', JSON.stringify(authenticatedUser))
    setUser(authenticatedUser)
    setAuthModal(null)
  }, [])

  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
    } finally {
      window.localStorage.removeItem('rorisk_user')
      setUser(null)
      notify({ type: 'success', message: 'Signed out successfully.' })
    }
  }, [])

  useEffect(() => {
    const updatePathname = () => setPathname(window.location.pathname)
    const handleInternalLink = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin || !(/^\/(?:cases|slots|live-casino)\/[a-zA-Z0-9_.-]+$/.test(url.pathname) || /^\/battles\/[a-zA-Z0-9-]+$/.test(url.pathname) || /^\/r\/[A-Za-z0-9_]{3,12}$/.test(url.pathname) || ['/', '/rewards', '/welcome', '/market', '/affiliates', '/race', '/cases', '/battles', '/battles/create', '/slots', '/live-casino', '/dice', '/blackjack', '/coinflip', '/mines', '/x-roulette', '/upgrader', '/provably-fair'].includes(url.pathname))) return

      event.preventDefault()
      const referralMatch = url.pathname.match(/^\/r\/([A-Za-z0-9_]{3,12})$/)
      if (referralMatch) window.localStorage.setItem('rorisk_affiliate_code', referralMatch[1])
      const targetPath = referralMatch ? '/welcome' : url.pathname
      if (targetPath === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) return
      pageLoader(targetPath)().catch(() => {})
      window.history.pushState({}, '', `${targetPath}${url.search}${url.hash}`)
      updatePathname()
    }

    window.addEventListener('popstate', updatePathname)
    document.addEventListener('click', handleInternalLink)
    return () => {
      window.removeEventListener('popstate', updatePathname)
      document.removeEventListener('click', handleInternalLink)
    }
  }, [])

  useEffect(() => {
    if (pathname === displayedPathRef.current) return undefined

    let firstFrame
    let secondFrame
    let enterTimer
    setRoutePhase('leaving')

    const leaveTimer = window.setTimeout(() => {
      displayedPathRef.current = pathname
      setDisplayedPath(pathname)
      setRoutePhase('entering')
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          setRoutePhase('entered')
          enterTimer = window.setTimeout(() => setRoutePhase('idle'), 200)
        })
      })
    }, 200)

    return () => {
      window.clearTimeout(leaveTimer)
      if (enterTimer) window.clearTimeout(enterTimer)
      if (firstFrame) window.cancelAnimationFrame(firstFrame)
      if (secondFrame) window.cancelAnimationFrame(secondFrame)
    }
  }, [pathname])

  useEffect(() => {
    const main = document.querySelector('main.background')
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' })
  }, [displayedPath])

  useEffect(() => {
    if (loaderPhase !== 'visible') return undefined
    let cancelled = false
    const minimumDelay = new Promise((resolve) => window.setTimeout(resolve, 2400))
    const routeReady = pageLoader(window.location.pathname)()
    Promise.all([minimumDelay, routeReady]).then(() => { if (!cancelled) setLoaderPhase('leaving') })
    return () => { cancelled = true }
  }, [loaderPhase])

  useEffect(() => {
    if (loaderPhase !== 'leaving') return undefined
    const doneTimer = window.setTimeout(() => {
      setLoaderPhase('done')
      setPagePhase('enter')
    }, 500)
    return () => window.clearTimeout(doneTimer)
  }, [loaderPhase])

  useEffect(() => {
    if (pagePhase === 'enter') {
      let secondFrame
      const firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => setPagePhase('active'))
      })
      return () => {
        window.cancelAnimationFrame(firstFrame)
        if (secondFrame) window.cancelAnimationFrame(secondFrame)
      }
    }
    if (pagePhase === 'active') {
      const doneTimer = window.setTimeout(() => setPagePhase('idle'), 500)
      return () => window.clearTimeout(doneTimer)
    }
    return undefined
  }, [pagePhase])

  if (loaderPhase !== 'done') return <LoadingScreen leaving={loaderPhase === 'leaving'} />

  const caseMatch = displayedPath.match(/^\/cases\/([a-zA-Z0-9_-]+)$/)
  const battleMatch = displayedPath === '/battles/create'
    ? null
    : displayedPath.match(/^\/battles\/([a-zA-Z0-9-]+)$/)
  const casinoMatch = displayedPath.match(/^\/(slots|live-casino)\/([a-zA-Z0-9_.-]+)$/)
  const Page = caseMatch ? CaseOpen : battleMatch ? pageComponents['/battles'] : casinoMatch ? CasinoGame : pageComponents[displayedPath] || pageComponents['/']
  const openWallet = (tab = 'deposit') => { setSiteModalClosing(false); setSiteModal({ type: 'wallet', tab }) }
  const openSettings = () => { setSiteModalClosing(false); setSiteModal({ type: 'settings' }) }
  const openStatistics = () => { setSiteModalClosing(false); setSiteModal({ type: 'statistics' }) }
  const openTransactions = () => { setSiteModalClosing(false); setSiteModal({ type: 'transactions' }) }
  const closeSiteModal = () => setSiteModalClosing(true)
  const openRobloxFromSettings = () => {
    closeSiteModal()
    window.setTimeout(() => setAuthModal('roblox'), 320)
  }
  const diceHandlesEntry = displayedPath === '/dice' && (routePhase === 'entering' || routePhase === 'entered')
  const routeClass = diceHandlesEntry
    ? 'route-page'
    : routePhase === 'leaving'
    ? 'route-page page-leave-active page-leave-to'
    : routePhase === 'entering'
      ? 'route-page page-enter-active page-enter-from'
      : routePhase === 'entered'
        ? 'route-page page-enter-active'
        : 'route-page'

  return (
    <div className={`app${pagePhase !== 'idle' ? ' fade-enter-active' : ''}${pagePhase === 'enter' ? ' fade-enter-from' : ''}`}>
      <Header pathname={pathname} user={user} onSignIn={() => setAuthModal('login')} onRegister={() => setAuthModal('login')} onSignOut={handleSignOut} onOpenWallet={openWallet} onOpenSettings={openSettings} onOpenStatistics={openStatistics} onOpenTransactions={openTransactions} />
      <div className="app-body">
        <Sidebar pathname={pathname} user={user} onOpenWallet={openWallet} onOpenSettings={openSettings} />
        <main
          className={`background${isChatOpen ? ' chat-open' : ''}`}
          style={{ backgroundImage: pathname === '/rewards' ? "url('/assets/images/rewards.82057e5f.png')" : "url('/assets/images/main.c55d6769.png')" }}
        >
          <div className="content-wrapper">
            <div className={routeClass}>
              <Suspense fallback={null}>
                <Page key={displayedPath} user={user} caseId={caseMatch?.[1]} battleId={battleMatch?.[1]} battleCreate={displayedPath === '/battles/create'} gameId={casinoMatch?.[2]} live={casinoMatch?.[1] === 'live-casino'} onSignIn={() => setAuthModal('login')} onOpenWallet={openWallet} />
              </Suspense>
            </div>
          </div>
          <Footer />
        </main>
      </div>
      <Chat user={user} onToggle={handleChatToggle} />
      {authModal && <SigninModal initialTab={authModal} onClose={() => setAuthModal(null)} onAuthenticated={handleAuthenticated} />}
      {siteModal && <ModalAnimation label={siteModal.type === 'wallet' ? 'Wallet' : siteModal.type === 'settings' ? 'Settings' : siteModal.type === 'statistics' ? 'User Statistics' : 'Transactions'} closeRequest={siteModalClosing} onClose={() => { setSiteModal(null); setSiteModalClosing(false) }}>
        {siteModal.type === 'wallet' ? <WalletModal initialTab={siteModal.tab} user={user} onRequestClose={closeSiteModal} /> : siteModal.type === 'settings' ? <SettingsModal user={user} onRequestClose={closeSiteModal} onConnectRoblox={openRobloxFromSettings} /> : siteModal.type === 'statistics' ? <StatisticsModal user={user} /> : <TransactionsModal user={user} />}
      </ModalAnimation>}
      <Notifications />
    </div>
  )
}

export default App
