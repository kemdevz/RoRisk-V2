import { useCallback, useEffect, useRef, useState } from 'react'
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
import Home from './Pages/Home'
import Rewards from './Pages/Rewards'
import Market from './Pages/Market'
import Affiliates from './Pages/Affiliates'
import Race from './Pages/Race'
import Cases from './Pages/Cases'
import CaseOpen from './Pages/CaseOpen'
import Slots from './Pages/Slots'
import LiveCasino from './Pages/LiveCasino'
import CasinoGame from './Pages/CasinoGame'
import { listenForPasswordRecovery, signOut, syncGoogleProfile } from './lib/Supabase'
import { notify } from './lib/Notifications'

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
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [displayedPath, setDisplayedPath] = useState(() => window.location.pathname)
  const displayedPathRef = useRef(window.location.pathname)
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
    const updateUser = (event) => {
      const profile = event.detail?.user
      if (!profile) return
      setUser((current) => {
        if (!current || (current.uuid || current.id) !== (profile.uuid || profile.id)) return current
        const next = { ...current, ...profile }
        window.localStorage.setItem('rorisk_user', JSON.stringify(next))
        return next
      })
    }
    window.addEventListener('rorisk:user-update', updateUser)
    return () => window.removeEventListener('rorisk:user-update', updateUser)
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
      if (url.origin !== window.location.origin || !(/^\/(?:cases|slots|live-casino)\/[a-zA-Z0-9_.-]+$/.test(url.pathname) || ['/', '/rewards', '/market', '/affiliates', '/race', '/cases', '/slots', '/live-casino'].includes(url.pathname))) return

      event.preventDefault()
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) return
      window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
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
    const leaveTimer = window.setTimeout(() => setLoaderPhase('leaving'), 2400)
    return () => window.clearTimeout(leaveTimer)
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
  const casinoMatch = displayedPath.match(/^\/(slots|live-casino)\/([a-zA-Z0-9_.-]+)$/)
  const pages = { '/': Home, '/rewards': Rewards, '/market': Market, '/affiliates': Affiliates, '/race': Race, '/cases': Cases, '/slots': Slots, '/live-casino': LiveCasino }
  const Page = caseMatch ? CaseOpen : casinoMatch ? CasinoGame : pages[displayedPath] || Home
  const openWallet = (tab = 'deposit') => { setSiteModalClosing(false); setSiteModal({ type: 'wallet', tab }) }
  const openSettings = () => { setSiteModalClosing(false); setSiteModal({ type: 'settings' }) }
  const openStatistics = () => { setSiteModalClosing(false); setSiteModal({ type: 'statistics' }) }
  const openTransactions = () => { setSiteModalClosing(false); setSiteModal({ type: 'transactions' }) }
  const closeSiteModal = () => setSiteModalClosing(true)
  const openRobloxFromSettings = () => {
    closeSiteModal()
    window.setTimeout(() => setAuthModal('roblox'), 320)
  }
  const routeClass = routePhase === 'leaving'
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
          style={{ backgroundImage: pathname === '/rewards' ? "url('/img/rewards.82057e5f.png')" : "url('/img/main.c55d6769.png')" }}
        >
          <div className="content-wrapper">
            <div className={routeClass}>
              <Page key={displayedPath} user={user} caseId={caseMatch?.[1]} gameId={casinoMatch?.[2]} live={casinoMatch?.[1] === 'live-casino'} onSignIn={() => setAuthModal('login')} />
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
