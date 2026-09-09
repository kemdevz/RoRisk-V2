import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NOTIFICATION_EVENT } from '../lib/Notifications'
import { playSound } from '../lib/Sounds'

const listScope = { 'data-v-164ec0fb': '' }
const itemScope = { 'data-v-40da4c14': '' }
const DURATION = 8000
const TRANSITION_DURATION = 250

function SuccessIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="37" height="37" viewBox="0 0 37 37" fill="none"><rect x="0.187256" y="0.497559" width="36" height="36" rx="6" fill="#81FF4F" /><path d="M13.5205 18.4976L16.8538 21.831L23.5205 15.1643" stroke="#172D39" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function ErrorIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="37" height="37" viewBox="0 0 37 37" fill="none"><rect x="0.187256" y="0.497559" width="36" height="36" rx="6" fill="#FF4F58" /><path d="M21.3905 13.3905C21.9112 12.8698 22.7546 12.8698 23.2753 13.3905C23.796 13.9112 23.796 14.7546 23.2753 15.2753L20.2177 18.3329L23.2753 21.3905C23.796 21.9112 23.796 22.7546 23.2753 23.2753C22.7546 23.796 21.9112 23.796 21.3905 23.2753L18.3329 20.2177L15.2753 23.2753C14.7546 23.796 13.9112 23.796 13.3905 23.2753C12.8698 22.7546 12.8698 21.9112 13.3905 21.3905L16.4481 18.3329L13.3905 15.2753C12.8698 14.7546 12.8698 13.9112 13.3905 13.3905C13.9112 12.8698 14.7546 12.8698 15.2753 13.3905L18.3329 16.4481L21.3905 13.3905Z" fill="#172D39" /></svg>
}

function NotificationItem({ notification, onRemove }) {
  const [remaining, setRemaining] = useState(DURATION)
  const [phase, setPhase] = useState('enter')

  const remove = useCallback(() => {
    setPhase('leave')
    window.setTimeout(() => onRemove(notification.id), TRANSITION_DURATION)
  }, [notification.id, onRemove])

  useEffect(() => {
    let secondFrame
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setPhase('open'))
    })
    const expiresAt = Date.now() + DURATION
    const interval = window.setInterval(() => {
      const next = expiresAt - Date.now()
      setRemaining(next)
      if (next <= 0) {
        window.clearInterval(interval)
        remove()
      }
    }, 100)
    return () => {
      cancelAnimationFrame(firstFrame)
      if (secondFrame) cancelAnimationFrame(secondFrame)
      window.clearInterval(interval)
    }
  }, [remove])

  const transitionClass = phase === 'enter' ? ' slide-enter-active slide-enter' : phase === 'leave' ? ' slide-leave-active slide-leave-to' : ' slide-enter-active'

  return (
    <div className={`notifications-element element-${notification.type}${transitionClass}`} onClick={remove} role="status" {...itemScope} {...listScope}>
      <div className="icon" {...itemScope}>{notification.type === 'error' ? <ErrorIcon /> : <SuccessIcon />}</div>
      <div className="message" {...itemScope}>
        <div className="title" {...itemScope}>{notification.title}</div>
        <div className="text" {...itemScope}>{notification.message}</div>
      </div>
      <div className="countdown-bar" {...itemScope}>
        <div className="countdown-progress" style={{ width: `${Math.max(0, remaining / DURATION * 100)}%` }} {...itemScope} />
      </div>
    </div>
  )
}

function Notifications() {
  const [notifications, setNotifications] = useState([])
  const remove = useCallback((id) => setNotifications((current) => current.filter((item) => item.id !== id)), [])

  useEffect(() => {
    const show = (event) => {
      playSound(event.detail?.type === 'error' ? 'error' : 'success', { volume: 0.5 })
      setNotifications((current) => [...current.slice(-3), event.detail])
    }
    window.addEventListener(NOTIFICATION_EVENT, show)
    return () => window.removeEventListener(NOTIFICATION_EVENT, show)
  }, [])

  return createPortal(
    <div className="notifications" {...listScope}>{notifications.map((notification) => <NotificationItem notification={notification} onRemove={remove} key={notification.id} />)}</div>,
    document.body,
  )
}

export default Notifications
