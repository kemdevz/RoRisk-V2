import { useCallback, useEffect, useRef, useState } from 'react'
import Chat from './components/Chat'
import Footer from './components/Footer'
import Header from './components/Header'
import LoadingScreen from './components/LoadingScreen'
import Sidebar from './components/Sidebar'
import SigninModal from './components/SigninModal'
import Home from './Pages/Home'
import Rewards from './Pages/Rewards'

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [displayedPath, setDisplayedPath] = useState(() => window.location.pathname)
  const displayedPathRef = useRef(window.location.pathname)
  const [routePhase, setRoutePhase] = useState('idle')
  const [isChatOpen, setIsChatOpen] = useState(() => window.innerWidth > 1800)
  const [authModal, setAuthModal] = useState(null)
  const [loaderPhase, setLoaderPhase] = useState('visible')
  const [pagePhase, setPagePhase] = useState('idle')
  const handleChatToggle = useCallback((open) => setIsChatOpen(open), [])

  useEffect(() => {
    const updatePathname = () => setPathname(window.location.pathname)
    const handleInternalLink = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin || !['/', '/rewards'].includes(url.pathname)) return

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

  const Page = displayedPath === '/rewards' ? Rewards : Home
  const routeClass = routePhase === 'leaving'
    ? 'route-page page-leave-active page-leave-to'
    : routePhase === 'entering'
      ? 'route-page page-enter-active page-enter-from'
      : routePhase === 'entered'
        ? 'route-page page-enter-active'
        : 'route-page'

  return (
    <div className={`app${pagePhase !== 'idle' ? ' fade-enter-active' : ''}${pagePhase === 'enter' ? ' fade-enter-from' : ''}`}>
      <Header pathname={pathname} onSignIn={() => setAuthModal('login')} onRegister={() => setAuthModal('login')} />
      <div className="app-body">
        <Sidebar pathname={pathname} />
        <main
          className={`background${isChatOpen ? ' chat-open' : ''}`}
          style={{ backgroundImage: pathname === '/rewards' ? "url('/img/rewards.82057e5f.png')" : "url('/img/main.c55d6769.png')" }}
        >
          <div className="content-wrapper">
            <div className={routeClass}>
              <Page onSignIn={() => setAuthModal('login')} />
            </div>
          </div>
          <Footer />
        </main>
      </div>
      <Chat onToggle={handleChatToggle} />
      {authModal && <SigninModal initialTab={authModal} onClose={() => setAuthModal(null)} />}
    </div>
  )
}

export default App
