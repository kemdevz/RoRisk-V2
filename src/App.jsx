import { useCallback, useEffect, useState } from 'react'
import Chat from './components/Chat'
import Footer from './components/Footer'
import Header from './components/Header'
import Homepage from './components/Homepage'
import LoadingScreen from './components/LoadingScreen'
import Sidebar from './components/Sidebar'
import SigninModal from './components/SigninModal'

function App() {
  const [isChatOpen, setIsChatOpen] = useState(() => window.innerWidth > 1800)
  const [authModal, setAuthModal] = useState(null)
  const [loaderPhase, setLoaderPhase] = useState('visible')
  const [pagePhase, setPagePhase] = useState('idle')
  const handleChatToggle = useCallback((open) => setIsChatOpen(open), [])

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

  return (
    <div className={`app${pagePhase !== 'idle' ? ' fade-enter-active' : ''}${pagePhase === 'enter' ? ' fade-enter-from' : ''}`}>
      <Header onSignIn={() => setAuthModal('login')} onRegister={() => setAuthModal('login')} />
      <div className="app-body">
        <Sidebar />
        <main
          className={`background${isChatOpen ? ' chat-open' : ''}`}
          style={{ backgroundImage: "url('/main.c55d6769.png')" }}
        >
          <div className="content-wrapper">
            <Homepage />
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
