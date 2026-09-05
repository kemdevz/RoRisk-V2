import { useEffect, useState } from 'react'

const scope = { 'data-v-b6856792': '' }

function LoadingScreen({ leaving = false }) {
  const [isDone, setIsDone] = useState(false)
  const [logoPhase, setLogoPhase] = useState('idle')

  useEffect(() => {
    let fadeInTimer
    let fadeOutTimer
    let resetTimer
    let cancelled = false

    const startLogoAnimationLoop = () => {
      fadeInTimer = window.setTimeout(() => {
        if (cancelled) return
        setLogoPhase('fade-in')
        fadeOutTimer = window.setTimeout(() => {
          if (cancelled) return
          setLogoPhase('fade-out')
          resetTimer = window.setTimeout(() => {
            if (cancelled) return
            setLogoPhase('idle')
            startLogoAnimationLoop()
          }, 800)
        }, 1500)
      }, 400)
    }

    const readyTimer = window.setTimeout(() => {
      setIsDone(true)
      startLogoAnimationLoop()
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(readyTimer)
      window.clearTimeout(fadeInTimer)
      window.clearTimeout(fadeOutTimer)
      window.clearTimeout(resetTimer)
    }
  }, [])

  return (
    <div className={`app app-loader${isDone ? ' fade-in' : ''}${leaving ? ' fade-leave-active' : ''}`} {...scope}>
      <div className="background" {...scope} />
      <div className="container" {...scope}>
        <img
          className={`logo static-logo${logoPhase !== 'idle' ? ` ${logoPhase}` : ''}`}
          src="/Footer/logo.ee8858f3.png"
          alt="Logo"
          {...scope}
        />
      </div>
    </div>
  )
}

export default LoadingScreen
