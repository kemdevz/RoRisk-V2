import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SiteIcon from './Icons'
import ModalAnimation from './ModalAnimation'
import { notify } from '../lib/Notifications'

const scope = { 'data-v-7b767a0f': '' }
const rainPoolScope = { 'data-v-dea29896': '' }
const rainJoinScope = { 'data-v-248d2d1d': '' }
const messageScope = { 'data-v-668aced3': '' }
const systemMessageScope = { 'data-v-42a467e8': '' }
const languages = [
  { code: 'en', label: 'English', flag: '/Chat/en.2814d5d0.svg' },
  { code: 'tr', label: 'Turkish', flag: '/Chat/tr.adedd58e.svg' },
  { code: 'es', label: 'Spanish', flag: '/Chat/es.631560ac.svg' },
  { code: 'ru', label: 'Russian', flag: '/Chat/ru.a3e7bb2c.svg' },
  { code: 'de', label: 'German', flag: '/Chat/de.d28c9dc5.svg' },
]

function usePopupTransition(duration = 150) {
  const [phase, setPhase] = useState('closed')
  const phaseRef = useRef('closed')
  const frameRef = useRef(null)
  const secondFrameRef = useRef(null)
  const timerRef = useRef(null)

  const clearPending = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    if (secondFrameRef.current !== null) cancelAnimationFrame(secondFrameRef.current)
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    frameRef.current = null
    secondFrameRef.current = null
    timerRef.current = null
  }, [])

  const updatePhase = useCallback((nextPhase) => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [])

  const open = useCallback(() => {
    clearPending()
    updatePhase('enter')
    frameRef.current = requestAnimationFrame(() => {
      secondFrameRef.current = requestAnimationFrame(() => {
        updatePhase('entering')
        timerRef.current = window.setTimeout(() => updatePhase('open'), duration)
      })
    })
  }, [clearPending, duration, updatePhase])

  const close = useCallback(() => {
    if (phaseRef.current === 'closed' || phaseRef.current === 'leave') return
    clearPending()
    updatePhase('leave')
    timerRef.current = window.setTimeout(() => updatePhase('closed'), duration)
  }, [clearPending, duration, updatePhase])

  const toggle = useCallback(() => {
    if (phaseRef.current === 'closed' || phaseRef.current === 'leave') open()
    else close()
  }, [close, open])

  useEffect(() => clearPending, [clearPending])

  const menuClass = (name) => {
    if (phase === 'enter') return `${name}-enter-active ${name}-enter`
    if (phase === 'entering') return `${name}-enter-active`
    if (phase === 'leave') return `${name}-leave-active ${name}-leave-to`
    return ''
  }

  return {
    close,
    isExpanded: phase === 'enter' || phase === 'entering' || phase === 'open',
    isRendered: phase !== 'closed',
    menuClass,
    open,
    toggle,
  }
}

function TimerIcon({ join = false }) {
  const attrs = join ? rainJoinScope : rainPoolScope
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" {...attrs}><path d="M10.5944 13.0309L7 6L13.3229 10.891C14.2218 11.5863 14.2264 12.9111 13.3323 13.6123C12.4383 14.3135 11.1054 14.0304 10.5944 13.0309Z" fill="white" /><path fillRule="evenodd" clipRule="evenodd" d="M11.0227 1.25H12C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.937 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.937 1.25 12C1.25 8.99301 2.4859 6.27291 4.47496 4.323L5.84323 5.71874C4.21371 7.31619 3.20455 9.53936 3.20455 12C3.20455 16.8576 7.1424 20.7954 12 20.7954C16.8576 20.7954 20.7955 16.8576 20.7955 12C20.7955 7.47273 17.375 3.74436 12.9773 3.25823V5.15909H11.0227V1.25Z" fill="white" /></svg>
}

function LiveIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" {...rainPoolScope}><rect width="14" height="14" rx="7" fill="#8AFF8A" fillOpacity="0.2" /><g filter="url(#rain-live-inner-shadow)"><path d="M7 11C9.20914 11 11 9.20914 11 7C11 4.79086 9.20914 3 7 3C4.79086 3 3 4.79086 3 7C3 9.20914 4.79086 11 7 11Z" fill="#8AFF8A" /></g><defs><filter id="rain-live-inner-shadow" x="3" y="3" width="8" height="8" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" /><feOffset /><feGaussianBlur stdDeviation="2" /><feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" /><feColorMatrix type="matrix" values="0 0 0 0 0.984314 0 0 0 0 0.631373 0 0 0 0 0.0980392 0 0 0 0.2 0" /><feBlend mode="normal" in2="shape" result="effect1_innerShadow_800_2" /></filter></defs></svg>
}

function PeopleIcon() {
  return <svg width="41" height="32" viewBox="0 0 41 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...rainJoinScope}><path d="M13.035 13.0939C13.035 9.07755 16.1586 5.82163 20.0118 5.82163C23.865 5.82163 26.9885 9.07755 26.9885 13.0939C26.9885 16.0525 25.2935 18.5986 22.8605 19.7344C27.835 20.9412 31.6399 25.2368 31.6399 30.5455C31.6399 31.349 31.0151 32 30.2445 32H9.77941C9.00878 32 8.38406 31.349 8.38406 30.5455C8.38406 25.2368 12.1888 20.9414 17.1632 19.7344C14.7301 18.5986 13.035 16.0527 13.035 13.0939Z" fill="#243441" /><path d="M11.6397 0C7.78655 0 4.66294 3.25592 4.66294 7.27231C4.66294 10.231 6.35799 12.7771 8.79107 13.9127C3.81674 15.1199 0.0119629 19.4152 0.0119629 24.724C0.0119629 25.5273 0.636689 26.1785 1.40731 26.1785H6.29155C7.30953 23.1134 9.367 20.5801 11.9731 18.8744C10.8836 17.2328 10.2443 15.2401 10.2443 13.0901C10.2443 8.38769 13.3028 4.42983 17.4594 3.26005C16.2103 1.29544 14.0701 0 11.6397 0Z" fill="#243441" /><path d="M33.7323 26.1785C32.7143 23.1132 30.6568 20.58 28.0507 18.8742C29.14 17.2326 29.7792 15.2399 29.7792 13.0901C29.7792 8.38769 26.7208 4.42983 22.5642 3.26005C23.8133 1.29544 25.9534 0 28.3839 0C32.2371 0 35.3606 3.25592 35.3606 7.27231C35.3606 10.2309 33.6655 12.7769 31.2326 13.9127C36.2071 15.1197 40.012 19.415 40.012 24.724C40.012 25.5273 39.3872 26.1785 38.6166 26.1785H33.7323Z" fill="#243441" /></svg>
}

const formatTimer = (seconds) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`

function RainPool({ amount, timer, onTip }) {
  const [displayAmount, setDisplayAmount] = useState(amount)
  const previousAmountRef = useRef(amount)
  useEffect(() => {
    const from = previousAmountRef.current
    previousAmountRef.current = amount
    if (from === amount) return undefined
    const startedAt = performance.now()
    let frame
    const animate = (now) => {
      const progress = Math.min((now - startedAt) / 1000, 1)
      const eased = 1 - Math.pow(1 - progress, 5)
      setDisplayAmount(Math.floor(from + (amount - from) * eased))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [amount])
  const [minutes, seconds] = formatTimer(timer).split(':')
  return <div className="rain-container" {...rainPoolScope} {...scope}><div className="rain-tip-dropdown" {...rainPoolScope}><button className="button-toggle" type="button" onClick={onTip} {...rainPoolScope}><div className="rain-info" {...rainPoolScope}><div className="live-rain" {...rainPoolScope}><LiveIcon /> Rain Pool</div><div className="timer" {...rainPoolScope}><TimerIcon /><div className="timer-text" {...rainPoolScope}><div className="number-box" {...rainPoolScope}><div className="flip-number" key={minutes} {...rainPoolScope}>{minutes}</div></div> : <div className="number-box" {...rainPoolScope}><div className="flip-number" key={seconds} {...rainPoolScope}>{seconds}</div></div></div></div></div><div className="big-box" {...rainPoolScope}><div className="rain-amount" {...rainPoolScope}><img src="/coin.svg" alt="icon" {...rainPoolScope} /><span {...rainPoolScope}>{displayAmount.toLocaleString()}</span></div><span className="tip-btn" aria-hidden="true" {...rainPoolScope}><svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26" fill="none" {...rainPoolScope}><path d="M23 14.4286H14.4286V23H11.5714V14.4286H3V11.5714H11.5714V3H14.4286V11.5714H23V14.4286Z" fill="currentColor" /></svg></span></div><div className="rain-tip-background" {...rainPoolScope}><img src="/Chat/rain.f9c11ead.png" alt="rain tip background" {...rainPoolScope} /></div></button></div></div>
}

function RainJoin({ amount, timer, joined, participantsCount, onJoin }) {
  const [displayAmount, setDisplayAmount] = useState(amount)
  const previousAmountRef = useRef(amount)
  useEffect(() => {
    const from = previousAmountRef.current
    previousAmountRef.current = amount
    if (from === amount) return undefined
    const startedAt = performance.now()
    let frame
    const animate = (now) => {
      const progress = Math.min((now - startedAt) / 1000, 1)
      setDisplayAmount(Math.floor(from + (amount - from) * progress))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [amount])
  return <div className="rain-join" {...rainJoinScope} {...scope}><div className="rain-info" {...rainJoinScope}><div className="rain-info-container" {...rainJoinScope}><div className="rain-info-title-container" {...rainJoinScope}><div className="rain-amount" {...rainJoinScope}><img src="/coin.svg" alt="icon" {...rainJoinScope} /><span className="animated-number" {...rainJoinScope}>{displayAmount.toLocaleString()}</span></div><div className="rain-info-title" {...rainJoinScope}><span {...rainJoinScope}>It's raining now!</span></div></div><div className="rain-timer" {...rainJoinScope}><TimerIcon join /><span {...rainJoinScope}>{formatTimer(timer)}</span></div></div><div className="rain-buttons" {...rainJoinScope}><button className="join-btn" type="button" disabled={joined} onClick={onJoin} {...rainJoinScope}><span {...rainJoinScope}>{joined ? 'Already Joined' : 'Join Rain'} <span className="rain-players" {...rainJoinScope}><PeopleIcon /><span {...rainJoinScope}>{participantsCount}</span></span></span></button></div></div></div>
}

function MessageContent({ text, emojis }) {
  const emojiMap = useMemo(() => new Map(emojis.map((emoji) => [emoji.code, emoji.src])), [emojis])
  return text.split(/:([a-z0-9][a-z0-9_-]*):/gi).map((part, index) => emojiMap.has(part.toLowerCase()) ? <img className="chat-emoji" src={emojiMap.get(part.toLowerCase())} alt={`:${part}:`} title={`:${part}:`} key={`${part}-${index}`} {...messageScope} /> : <span key={`${part}-${index}`} {...messageScope}>{part}</span>)
}

function levelTheme(level) {
  if (level >= 100) return 'red'
  if (level >= 75) return 'orange'
  if (level >= 50) return 'purple'
  if (level >= 25) return 'green'
  return 'blue'
}

function ChatRankBadge({ rank }) {
  if (!['admin', 'mod', 'partner'].includes(rank)) return null
  const hash = rank === 'admin' ? 'f6df244d' : rank === 'mod' ? '998a884b' : '0a259ddf'
  return <div className={`box-rank rank-${rank} rank-box`} data-v-fc8af502="" {...messageScope}><div className="rank-inner" data-v-fc8af502=""><img src={`/${rank}.${hash}.svg`} alt={rank} data-v-fc8af502="" /></div></div>
}

function ChatMessage({ message, emojis }) {
  let systemContent = null
  if (message.type === 'rainCompleted') {
    const count = Number(message.claimedCount) || 0
    const grammar = count === 1 ? 'person has' : 'people have'
    const amount = Math.abs(Number(message.rain?.amount) || 0).toLocaleString()
    systemContent = <><span className="highlighted-count">{count}</span> {grammar} claimed the rain payout of <span className="coin-amount">{amount}</span> Coins!</>
  } else if (message.type === 'rainTip') {
    const username = message.transaction?.user?.username || 'Someone'
    const amount = Math.abs(Number(message.transaction?.amount) || 0).toLocaleString()
    systemContent = <><span className="highlighted-username">{username}</span> has tipped <span className="coin-amount">{amount}</span> Coins to the rain!</>
  }
  if (systemContent) return <div className="chat-message-element element-system" {...messageScope} {...scope}><div className="chat-message-element element-system" {...messageScope} {...systemMessageScope}><div className="element-message" {...systemMessageScope}><div className="message-content" {...systemMessageScope}><div className="user-message-group" {...systemMessageScope}><button className="button-user" type="button" {...systemMessageScope}><div className="system-avatar" {...systemMessageScope}><img src="/Chat/system.c68aca3f.png" alt="System" {...systemMessageScope} /></div><div className="user-username-group" {...systemMessageScope}><div className="user-username-group-inner" {...systemMessageScope}><span className="user-username" {...systemMessageScope}>System Message</span></div><div className="element-text" {...systemMessageScope}>{systemContent}</div></div></button></div></div></div></div></div>
  const messageUser = message.user || message
  const level = Math.min(100, Math.max(0, Number(messageUser.level) || 0))
  const rank = String(messageUser.rank || 'user').toLowerCase()
  const avatar = messageUser.avatar_headshot || messageUser.avatar || '/default-avatar.png'
  const username = messageUser.username || ''
  return <div className="chat-message-element" {...messageScope} {...scope}><div className={`element-message${rank !== 'user' ? ` ${rank}-message` : ''}`} {...messageScope}><div className="message-content" {...messageScope}><div className="user-message-group" {...messageScope}><button className="button-user" type="button" {...messageScope}><div className="avatar-image user-avatar" data-v-6adb23f8="" {...messageScope}><img src={avatar} alt={username} data-v-6adb23f8="" /></div><div className="user-username-group" {...messageScope}><div className="user-username-group-inner" {...messageScope}><span className="user-username" {...messageScope}>{username}</span>{rank === 'user' ? <div className={`box-level level-${levelTheme(level)} level-box`} data-v-ff759fba="" {...messageScope}><div className="level-inner" data-v-ff759fba="">{level}</div></div> : <ChatRankBadge rank={rank} />}</div><div className="element-text" {...messageScope}><MessageContent text={message.text} emojis={emojis} /></div></div></button></div></div></div></div>
}

/*
function ChatModalContent({ type, onClose, onStartRain }) {
  const [amount, setAmount] = useState('100')
  if (!type) return null
  return <div className="chat-modal-overlay" role="presentation" onMouseDown={onClose}><div className="chat-modal-shell" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button className="chat-modal-close" type="button" aria-label="Close" onClick={onClose}>×</button>{type === 'rain' ? <div className="modal-tip-rain" data-v-0d50ed68=""><div className="live-rain" data-v-0d50ed68="">Tip Rain</div><div className="tip-info" data-v-0d50ed68=""><div className="tip-amount-section" data-v-0d50ed68=""><div className="tip-title" data-v-0d50ed68="">Tip Amount</div><div className="tip-input" data-v-0d50ed68=""><img className="tip-icon" src="/coin.svg" alt="icon" data-v-0d50ed68="" /><input className="tip-amount-display" type="text" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))} placeholder="0" data-v-0d50ed68="" /><div className="tip-actions-buttons" data-v-0d50ed68=""><button type="button" onClick={() => setAmount(String(Math.max(100, Math.floor((Number(amount) || 100) / 2))))} data-v-0d50ed68="">1/2</button><button type="button" onClick={() => setAmount(String(Math.min(500000, (Number(amount) || 100) * 2)))} data-v-0d50ed68="">2x</button><button type="button" onClick={() => setAmount('500000')} data-v-0d50ed68="">Max</button></div></div></div><div className="tip-actions" data-v-0d50ed68=""><button className="button-tip" type="button" disabled={(Number(amount) || 0) < 100} onClick={() => onStartRain(Math.min(500000, Number(amount)))} data-v-0d50ed68=""><div className="button-inner" data-v-0d50ed68=""><div className="inner-content" data-v-0d50ed68="">Send Tip</div></div></button></div></div></div> : <div className="chat-rules-modal"><h2>Chat Rules</h2><p>Be respectful to other players.</p><p>Do not spam, advertise, impersonate staff, or share personal information.</p><p>Keep messages appropriate and use the correct language channel.</p><button type="button" onClick={onClose}>I Understand</button></div>}</div></div>
}

function ChatModal({ type, onClose, onStartRain }) {
  if (!type) return null
  return <Modal onClose={onClose} label={type === 'rain' ? 'Tip Rain' : 'Chat Rules'}><ChatModalContent type={type} onClose={onClose} onStartRain={onStartRain} /></Modal>
}

*/
function RainTipModal({ balance, onSubmit }) {
  const [amount, setAmount] = useState('100')
  const numericAmount = Math.floor(Number(amount.replaceAll(',', '')) || 0)
  const maximum = Math.min(500000, Math.max(0, Math.floor(Number(balance) || 0)))
  const valid = numericAmount >= 100 && numericAmount <= 500000 && numericAmount <= maximum
  const formatAmount = (value) => Math.max(100, Math.min(500000, Math.floor(value || 100))).toLocaleString()

  return <div className="modal-tip-rain" data-v-0d50ed68=""><div className="live-rain" data-v-0d50ed68="">Tip Rain</div><div className="tip-info" data-v-0d50ed68=""><div className="tip-amount-section" data-v-0d50ed68=""><div className="tip-title" data-v-0d50ed68="">Tip Amount</div><div className="tip-input" data-v-0d50ed68=""><img className="tip-icon" src="/coin.svg" alt="icon" data-v-0d50ed68="" /><input className="tip-amount-display" type="text" inputMode="numeric" value={amount} onFocus={() => setAmount((value) => value.replaceAll(',', ''))} onBlur={() => setAmount(formatAmount(numericAmount))} onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))} placeholder="0" data-v-0d50ed68="" /><div className="tip-actions-buttons" data-v-0d50ed68=""><button type="button" onClick={() => setAmount(formatAmount(numericAmount / 2))} data-v-0d50ed68="">1/2</button><button type="button" onClick={() => setAmount(formatAmount(numericAmount * 2))} data-v-0d50ed68="">2x</button><button type="button" onClick={() => setAmount(formatAmount(maximum))} data-v-0d50ed68="">Max</button></div></div></div><div className="tip-actions" data-v-0d50ed68=""><button className="button-tip" type="button" disabled={!valid} onClick={() => onSubmit(numericAmount)} data-v-0d50ed68=""><div className="button-inner" data-v-0d50ed68=""><div className="inner-content" data-v-0d50ed68="">Send Tip</div></div></button></div></div></div>
}

function Chat({ onToggle, user }) {
  const authenticatedUserId = user?.uuid || user?.id || null
  const [isChatOpen, setIsChatOpen] = useState(() => window.innerWidth > 1800)
  const [language, setLanguage] = useState(() => languages.find((item) => item.code === window.localStorage.getItem('chatRoom')) || languages[0])
  const { close: closeLanguagePopup, isExpanded: isLanguageExpanded, isRendered: isLanguageRendered, menuClass: languageMenuClass, toggle: toggleLanguagePopup } = usePopupTransition()
  const { close: closeEmojiPopup, isExpanded: isEmojiExpanded, isRendered: isEmojiRendered, menuClass: emojiMenuClass, toggle: toggleEmojiPopup } = usePopupTransition()
  const { close: closeRainJoin, isRendered: isRainJoinRendered, menuClass: rainJoinClass, open: openRainJoin } = usePopupTransition(200)
  const [chatMessage, setChatMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [onlineByRoom, setOnlineByRoom] = useState({ en: 0, tr: 0, es: 0, ru: 0, de: 0 })
  const [rain, setRain] = useState(null)
  const [showRainTip, setShowRainTip] = useState(false)
  const [serverOffset, setServerOffset] = useState(0)
  const [clock, setClock] = useState(() => Date.now())
  const [chatEmojis, setChatEmojis] = useState([])
  const [emojiButton, setEmojiButton] = useState({ code: 'hahaa', src: '/emojis/1000-hahaa.ab605861.png' })
  const chatRef = useRef(null)
  const languageRef = useRef(null)
  const emojiRef = useRef(null)
  const inputRef = useRef(null)
  const messagesRef = useRef(null)
  const socketRef = useRef(null)
  const languageCodeRef = useRef(language.code)
  const requireAuth = () => {
    if (user) return true
    notify({ type: 'error', message: 'Please sign in to perform this action.' })
    return false
  }

  useEffect(() => { onToggle?.(isChatOpen) }, [isChatOpen, onToggle])
  useEffect(() => { languageCodeRef.current = language.code }, [language.code])
  useEffect(() => {
    let disposed = false
    let reconnectTimer = null
    let reconnectDelay = 750
    const sessionId = window.sessionStorage.getItem('rorisk_chat_session') || crypto.randomUUID()
    window.sessionStorage.setItem('rorisk_chat_session', sessionId)

    const connect = () => {
      if (disposed) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/realtime`)
      socketRef.current = socket
      socket.addEventListener('open', () => {
        reconnectDelay = 750
        socket.send(JSON.stringify({ type: 'hello', room: languageCodeRef.current, sessionId }))
      })
      socket.addEventListener('message', (event) => {
        let payload
        try { payload = JSON.parse(event.data) } catch { return }
        if (payload.type === 'presence' && payload.counts) setOnlineByRoom(payload.counts)
        if (payload.type === 'history' && payload.room === languageCodeRef.current) setMessages(Array.isArray(payload.messages) ? payload.messages : [])
        if (payload.type === 'message' && payload.message?.room === languageCodeRef.current) setMessages((current) => [...current.filter((item) => item.id !== payload.message.id), payload.message].slice(-50))
        if (payload.type === 'rain' && payload.rain) {
          setRain(payload.rain)
          if (Number.isFinite(payload.serverTime)) setServerOffset(payload.serverTime - Date.now())
        }
        if (payload.type === 'rainJoined' && payload.rain) {
          setRain(payload.rain)
          notify({ type: 'success', message: "You've successfully joined the rain." })
        }
        if (payload.type === 'rainTipped' && payload.rain) {
          setRain(payload.rain)
          setShowRainTip(false)
        }
        if ((payload.type === 'userUpdate' || payload.type === 'userPublicUpdate') && payload.user) {
          if (payload.type === 'userUpdate') window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: payload.user } }))
          setMessages((current) => current.map((message) => {
            const messageId = message.user?.uuid || message.user?.id
            const profileId = payload.user.uuid || payload.user.id
            return messageId === profileId ? { ...message, user: { ...message.user, ...payload.user } } : message
          }))
        }
        if (payload.type === 'error' && payload.message) notify({ type: 'error', message: payload.message })
      })
      socket.addEventListener('close', () => {
        if (disposed) return
        reconnectTimer = window.setTimeout(connect, reconnectDelay)
        reconnectDelay = Math.min(10000, reconnectDelay * 1.75)
      })
    }

    connect()
    return () => {
      disposed = true
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      if (socketRef.current) socketRef.current.close()
      socketRef.current = null
    }
  }, [authenticatedUserId])
  useEffect(() => {
    window.localStorage.setItem('chatRoom', language.code)
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'join', room: language.code }))
  }, [language.code])
  useEffect(() => {
    let active = true
    fetch('/emojis/emojis.json')
      .then((response) => response.json())
      .then((emojis) => {
        if (!active || !Array.isArray(emojis) || emojis.length === 0) return
        setChatEmojis(emojis)
        setEmojiButton(emojis[Math.floor(Math.random() * emojis.length)])
      })
      .catch(() => {})
    return () => { active = false }
  }, [])
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (isLanguageExpanded && !languageRef.current?.contains(event.target)) closeLanguagePopup()
      if (isEmojiExpanded && !emojiRef.current?.contains(event.target)) closeEmojiPopup()
      if (window.innerWidth <= 1800 && isChatOpen && !chatRef.current?.contains(event.target)) setIsChatOpen(false)
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [closeEmojiPopup, closeLanguagePopup, isChatOpen, isEmojiExpanded, isLanguageExpanded])

  const submitMessage = () => {
    if (!user) return notify({ type: 'error', message: 'Please sign in to perform this action.' })
    const text = chatMessage.trim()
    if (!text) return notify({ type: 'error', message: 'Please enter a message.' })
    if (text.length < 2) return notify({ type: 'error', message: 'Your message must be at least 2 characters long.' })
    const containsLink = /https?:\/\/\S+|www\.\S+/i.test(text)
    const allowedStreamLink = /^(https?:\/\/)?(www\.)?(twitch\.tv|kick\.com)\/\S+$/i.test(text)
    if (containsLink && !allowedStreamLink) return notify({ type: 'error', message: 'Only Twitch and Kick links are allowed in chat.' })
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) return notify({ type: 'error', message: 'Chat is reconnecting. Please try again.' })
    socket.send(JSON.stringify({ type: 'message', text }))
    setChatMessage('')
    closeEmojiPopup()
  }
  const addEmoji = (code) => { setChatMessage((message) => `${message}${message && !/\s$/.test(message) ? ' ' : ''}:${code}: `); closeEmojiPopup(); requestAnimationFrame(() => inputRef.current?.focus()) }
  const switchLanguage = (item) => {
    if (item.code !== language.code) setMessages([])
    setLanguage(item)
    closeLanguagePopup()
  }

  const rainEndsAt = rain?.endsAt ? new Date(rain.endsAt).getTime() : 0
  const rainStartsAt = rain?.startsAt ? new Date(rain.startsAt).getTime() : 0
  const rainJoinEndsAt = rain?.joinEndsAt ? new Date(rain.joinEndsAt).getTime() : rainEndsAt
  const synchronizedNow = clock + serverOffset
  const rainTimer = rain ? Math.max(0, Math.floor((rainEndsAt - synchronizedNow) / 1000)) : 30 * 60
  const rainAmount = Number(rain?.amount) || 200
  const rainRunning = Boolean(rain && rain.status !== 'completed' && synchronizedNow >= rainStartsAt && synchronizedNow < rainJoinEndsAt)
  const rainAcceptsTips = Boolean(rain && rain.status !== 'completed' && synchronizedNow < rainStartsAt)
  const userId = user?.uuid || user?.id
  const joinedRain = Boolean(userId && rain?.entries?.some((entry) => entry.uuid === userId))
  useEffect(() => {
    if (rainRunning) openRainJoin()
    else closeRainJoin()
  }, [closeRainJoin, openRainJoin, rainRunning])
  const joinRain = () => {
    if (!requireAuth()) return
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) {
      notify({ type: 'error', message: 'Chat is reconnecting. Please try again.' })
      return
    }
    socket.send(JSON.stringify({ type: 'rainJoin' }))
  }
  const openRainTip = () => {
    if (!requireAuth()) return
    if (!rainAcceptsTips) {
      notify({ type: 'error', message: 'This rain can no longer receive tips.' })
      return
    }
    setShowRainTip(true)
  }
  const tipRain = (amount) => {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) {
      notify({ type: 'error', message: 'Chat is reconnecting. Please try again.' })
      return
    }
    socket.send(JSON.stringify({ type: 'rainTip', amount }))
    setShowRainTip(false)
  }

  return (
    <aside ref={chatRef} id="chat" className={`${isChatOpen ? 'chat-open' : ''}${isRainJoinRendered ? ' chat-rain' : ''}${isEmojiExpanded ? ' chat-emoji-open' : ''}`.trim()} {...scope}>
      <div className="chat-header" {...scope}>
        <RainPool amount={rainAmount} timer={rainTimer} onTip={openRainTip} />
      </div>
      <div className="chat-proper-functions" {...scope}>
        <div className="chat-content" {...scope}>
          <div className="chat-shadow" {...scope} />
          <div ref={messagesRef} className="content-messages" {...scope}>
            <div className="messages-list" {...scope}>{messages.map((message) => <ChatMessage message={message} emojis={chatEmojis} key={message.id} />)}</div>
          </div>
        </div>
        {isRainJoinRendered && <div className={`content-rain ${rainJoinClass('fade')}`.trim()} {...scope}><RainJoin amount={rainAmount} timer={rainTimer} joined={joinedRain} participantsCount={rain?.participantsCount || rain?.entries?.length || 0} onJoin={joinRain} /></div>}
        <div className="chat-footer" {...scope}>
          <div className="footer-input-wrapper" {...scope}>
            <div ref={emojiRef} className={`footer-input${isEmojiExpanded ? ' footer-input-emoji-open' : ''}`} {...scope}>
              <input ref={inputRef} type="text" placeholder="Write a message..." value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} onKeyUp={(event) => event.key === 'Enter' && submitMessage()} {...scope} />
              <div className="emoji-selector" {...scope}>
                <button className="button-emoji" type="button" aria-expanded={isEmojiExpanded} aria-label="Emojis" title="Emojis" onClick={(event) => { event.stopPropagation(); toggleEmojiPopup(); closeLanguagePopup() }} {...scope}>
                  <img src={emojiButton.src} alt={emojiButton.code} {...scope} />
                </button>
              </div>
              <button className="button-send" type="button" aria-label="Send message" onClick={submitMessage} {...scope}>
                <svg viewBox="0 0 24 24" aria-hidden="true" {...scope}><path d="M3.4 20.4 21.85 12 3.4 3.6l-.01 6.53L16.6 12 3.39 13.87l.01 6.53Z" {...scope} /></svg>
              </button>
              {isEmojiRendered && <div className={`emoji-menu ${emojiMenuClass('emoji-menu')}`.trim()} {...scope}>{chatEmojis.map((emoji) => <button className="emoji-menu-item" type="button" title={`:${emoji.code}:`} onClick={() => addEmoji(emoji.code)} key={emoji.code} {...scope}><img src={emoji.src} alt={emoji.code} loading="lazy" {...scope} /></button>)}</div>}
            </div>
            <div className="footer-bottom" {...scope}>
              <div className="footer-quick-actions" {...scope}>
                <button type="button" aria-label="Twitter" title="Twitter" onClick={() => window.open('https://x.com/roriskcom', '_blank', 'noopener,noreferrer')} {...scope}><SiteIcon name="twitter" {...scope} /></button>
                <button type="button" aria-label="Discord" title="Discord" onClick={() => window.open('https://discord.gg/rorisk', '_blank', 'noopener,noreferrer')} {...scope}><SiteIcon name="discord" {...scope} /></button>
                <button className="chat-rules" type="button" aria-label="Chat rules" title="Chat rules" {...scope}><SiteIcon name="chat-rules" {...scope} /></button>
              </div>
              <div className="footer-channel-controls" {...scope}>
                <div ref={languageRef} className="language-selector" {...scope}>
                  <button className="language-selector-toggle" type="button" aria-expanded={isLanguageExpanded} onClick={(event) => { event.stopPropagation(); toggleLanguagePopup(); closeEmojiPopup() }} {...scope}>
                    <img className="language-flag" src={language.flag} alt="" {...scope} />
                    <span className="language-code" {...scope}>{language.code.toUpperCase()}</span>
                    <span className="language-online-dot" {...scope} />
                    <span className="language-online-count" {...scope}>{onlineByRoom[language.code] || 0}</span>
                    <SiteIcon name="chevron-down" className={`language-chevron${isLanguageExpanded ? ' language-chevron-open' : ''}`} {...scope} />
                  </button>
                  {isLanguageRendered && <div className={`language-menu ${languageMenuClass('language-menu')}`.trim()} {...scope}>{languages.map((item) => <button key={item.code} className={item.code === language.code ? 'language-active' : ''} type="button" onClick={() => switchLanguage(item)} {...scope}><img src={item.flag} alt="" {...scope} /><span {...scope}>{item.label}</span></button>)}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="chat-toggle" {...scope}>
        <button type="button" aria-label={isChatOpen ? 'Close chat' : 'Open chat'} onClick={() => setIsChatOpen((open) => !open)} {...scope}><div className="button-inner" {...scope}><SiteIcon name="chat" {...scope} /></div></button>
      </div>
      {showRainTip && <ModalAnimation label="Tip Rain" onClose={() => setShowRainTip(false)}><RainTipModal balance={user?.coins} onSubmit={tipRain} /></ModalAnimation>}
    </aside>
  )
}

export default Chat
