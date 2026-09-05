import { useCallback, useEffect, useState } from 'react'

const scope = { 'data-v-119d36d9': '' }

function ModalAnimation({ children, onClose, label, closeRequest = false }) {
  const [phase, setPhase] = useState('enter')

  useEffect(() => {
    let secondFrame
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setPhase('open'))
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      if (secondFrame) cancelAnimationFrame(secondFrame)
    }
  }, [])

  const close = useCallback(() => {
    if (phase === 'leave') return
    setPhase('leave')
    window.setTimeout(onClose, 300)
  }, [onClose, phase])

  useEffect(() => {
    if (!closeRequest) return undefined
    const frame = requestAnimationFrame(close)
    return () => cancelAnimationFrame(frame)
  }, [close, closeRequest])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [close])

  const overlayClass = `modals-overlay fade-${phase === 'leave' ? 'leave' : 'enter'}-active${phase === 'enter' ? ' fade-enter' : ''}${phase === 'leave' ? ' fade-leave-to' : ''}`
  const holderClass = `modals-holder slide-fade-${phase === 'leave' ? 'leave' : 'enter'}-active${phase === 'enter' ? ' slide-fade-enter' : ''}${phase === 'leave' ? ' slide-fade-leave-to' : ''}`

  return (
    <div className="modals" {...scope}>
      <div className={overlayClass} {...scope} />
      <div className={holderClass} onMouseDown={(event) => { if (event.target === event.currentTarget) close() }} {...scope}>
        <div
          className="holder-body"
          onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}
          {...scope}
        >
          <div className="body-modal" role="dialog" aria-modal="true" aria-label={label} {...scope}>
            <button className="close-btn" type="button" aria-label="Close" onClick={close} {...scope}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...scope}>
                <path d="M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="modal-content-host" {...scope}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModalAnimation
