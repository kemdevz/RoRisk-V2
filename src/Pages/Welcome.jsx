import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ItemCard, Spinner, clearConfettiCanvases, createReel, launchConfetti, pickVisualItem, reelGeometry } from './CaseOpen'
import { notify } from '../lib/Notifications'
import { playSound } from '../lib/Sounds'
import { getCachedWelcomeData, requestWelcomeData, storedWelcomeCurrency } from '../lib/WelcomePreload'

const pageScope = { 'data-v-02fdf3c5': '' }
const heroScope = { 'data-v-1c2febfe': '' }
const controlsScope = { 'data-v-7f08c9d6': '' }
const riskSpinItem = {
  index: 'risk-spin',
  name: 'Risk Spin',
  image: '/assets/images/battles/risk-spin.png',
  chance: '0.001%',
  tickets: 1,
  color: 'yellow',
  coinPrice: 0,
  rocoinPrice: 0,
  riskSpin: true,
}

function FastIcon() {
  return <svg className="welcome-controls-toggle-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...controlsScope}><path d="M16.7971 8.71966L10.6931 8.74433C10.542 8.74493 10.444 8.57326 10.5127 8.42847L13.8866 1.31761C13.9881 1.1038 13.7397 0.897073 13.573 1.05657L3.06811 11.1056C2.9301 11.2376 3.01573 11.4833 3.20036 11.485L8.77294 11.5363C8.9182 11.5376 9.01459 11.6989 8.95548 11.8418L6.12076 18.6931C6.03288 18.9055 6.27472 19.0978 6.43754 18.9451L16.9304 9.10043C17.0712 8.96834 16.9839 8.71892 16.7971 8.71966Z" {...controlsScope} /></svg>
}

function Welcome({ user, onSignIn, onOpenWallet }) {
  const [currency, setCurrency] = useState(storedWelcomeCurrency)
  const [data, setData] = useState(() => getCachedWelcomeData(storedWelcomeCurrency()))
  const [affiliateCode, setAffiliateCode] = useState(() => window.localStorage.getItem('rorisk_affiliate_code') || '')
  const [fast, setFast] = useState(false)
  const [riskSpin, setRiskSpin] = useState(true)
  const [running, setRunning] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [winnerVisible, setWinnerVisible] = useState(false)
  const [reels, setReels] = useState([])
  const [styles, setStyles] = useState([{}])
  const [timeNow, setTimeNow] = useState(0)
  const spinnerRef = useRef(null)
  const timers = useRef([])
  const initializedCaseRef = useRef('')
  const codeInput = useRef(null)
  const caseData = data?.case
  const affiliate = data?.affiliate || {}
  const claimedCount = Math.min(4, Number(affiliate.rewardCasesClaimed) || 0)
  const allClaimed = claimedCount >= 4
  const hasRedeemedCode = Boolean(affiliate.referrer)
  const referredAt = affiliate.referredAt ? new Date(affiliate.referredAt).getTime() : 0
  const switchAt = referredAt + 14 * 24 * 60 * 60 * 1000
  const canSwitch = !hasRedeemedCode || !referredAt || timeNow >= switchAt
  const daysRemaining = Math.max(0, Math.ceil((switchAt - timeNow) / 86400000))
  const inputLocked = hasRedeemedCode && !canSwitch
  const disabled = running || requesting
  const items = useMemo(() => [...(caseData?.items || [])].sort((a, b) => Number.parseFloat(a.chance) - Number.parseFloat(b.chance)), [caseData])
  const caseSignature = useMemo(() => `${caseData?.caseId || caseData?.id || caseData?.slug || ''}:${items.map((item) => `${item.index || item.name}:${item.image}`).join('|')}`, [caseData, items])

  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout)
    timers.current = []
  }, [])

  const load = useCallback(async () => {
    try {
      const payload = await requestWelcomeData(currency)
      setData(payload)
      setTimeNow(Date.now())
      if (payload.affiliate?.redeemedCode) setAffiliateCode(payload.affiliate.redeemedCode)
    } catch (error) {
      notify({ type: 'error', message: error.message })
    }
  }, [currency])

  useEffect(() => {
    document.title = 'Welcome Cases - RoRisk.com'
    Promise.resolve().then(load)
  }, [load, user])

  useEffect(() => {
    const update = (event) => setCurrency(event.detail?.currency === 'coins' ? 'coins' : 'rocoins')
    window.addEventListener('rorisk:currency-change', update)
    return () => window.removeEventListener('rorisk:currency-change', update)
  }, [])

  const positionReel = useCallback((targetIndex = 20, transition = 'none', jitter = 0) => {
    const geometry = reelGeometry(spinnerRef.current, false)
    if (!geometry) return false
    const offset = (targetIndex === 60 ? geometry.targetOffset : geometry.initialOffset) - jitter
    setStyles([{ transform: `translateX(${offset}px) translateY(0px)`, transition }])
    return true
  }, [])

  useLayoutEffect(() => {
    if (!items.length || !caseSignature || initializedCaseRef.current === caseSignature) return
    initializedCaseRef.current = caseSignature
    const frame = window.requestAnimationFrame(() => {
      setWinnerVisible(false)
      setReels([createReel(items, null, `welcome-${Date.now()}`)])
      window.requestAnimationFrame(() => positionReel())
    })
    return () => window.cancelAnimationFrame(frame)
  }, [caseSignature, items, positionReel])

  useEffect(() => () => {
    clearTimers()
    clearConfettiCanvases(spinnerRef.current)
  }, [clearTimers])

  useEffect(() => {
    for (const source of [...new Set(items.map((item) => item?.image).filter(Boolean))]) {
      const image = new Image()
      image.decoding = 'async'
      image.src = source
    }
  }, [items])

  useEffect(() => {
    if (!running) return undefined
    let animationFrame
    let previous = 20
    const track = () => {
      const spinner = spinnerRef.current
      const geometry = reelGeometry(spinner, false)
      const reel = spinner?.querySelector('.cases-reel')
      if (geometry && reel) {
        const matrix = new DOMMatrixReadOnly(window.getComputedStyle(reel).transform)
        const position = Math.max(0, Math.min(79, Math.round(20 + (geometry.initialOffset - matrix.m41) / geometry.itemSpacing)))
        if (position !== previous) {
          reel.querySelector('.element-active')?.classList.remove('element-active')
          reel.querySelectorAll('.reel-element')[position]?.classList.add('element-active')
          previous = position
          playSound('tick', { volume: 0.8 })
        }
      }
      animationFrame = window.requestAnimationFrame(track)
    }
    animationFrame = window.requestAnimationFrame(track)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [running])

  const spin = useCallback(async (opening, nextUser) => {
    const item = opening?.item
    if (!item) throw new Error('The case result was incomplete.')
    const usesRiskSpin = opening?.riskSpin === true
    clearTimers()
    clearConfettiCanvases(spinnerRef.current)
    setRunning(true)
    setWinnerVisible(false)
    positionReel(20)
    setReels([createReel(items, usesRiskSpin ? riskSpinItem : item, `welcome-result-${opening.outcome ?? Date.now()}`)])
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)))
    const geometry = reelGeometry(spinnerRef.current, false)
    if (!geometry) throw new Error('The case reel could not be measured.')
    const updatedAt = opening.updatedAt || opening.updated_at || new Date().toISOString()
    const duration = fast ? 1.3 : Math.max(0, new Date(updatedAt).getTime() + 5000 - Date.now()) / 1010
    const jitter = Math.floor(Math.random() * 7 + 1) * geometry.itemSpacing / 8
    positionReel(60, `transform ${duration}s cubic-bezier(0.1, 0.6, 0.3, 1)`, jitter)

    const reveal = () => {
      const chance = Number.parseFloat(String(item.chance || '0').replace('%', '')) || 0
      const itemValue = Number(currency === 'coins' ? item.coinPrice : item.rocoinPrice) || 0
      const caseValue = Number(currency === 'coins' ? caseData?.coinAmount : caseData?.rocoinAmount) || 0
      playSound(item.color === 'yellow' && itemValue > caseValue ? 'unboxBig' : item.color === 'red' ? 'unboxRare' : 'unbox')
      if (chance < 15 && itemValue >= caseValue) launchConfetti(spinnerRef.current?.querySelector('.confetti-canvas'), 0)
      setWinnerVisible(true)
      setRunning(false)
      if (nextUser) window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: nextUser } }))
      load()
    }

    const settleResult = (spinDuration) => timers.current.push(window.setTimeout(() => {
      const settled = reelGeometry(spinnerRef.current, false)
      if (settled) setStyles([{ transform: `translateX(${settled.finalOffset}px) translateY(0px)`, transition: 'transform .25s cubic-bezier(.1,.6,.3,1)' }])
      timers.current.push(window.setTimeout(reveal, 300))
    }, spinDuration * 1000 + 200))

    if (!usesRiskSpin) {
      settleResult(duration)
      return
    }

    timers.current.push(window.setTimeout(() => {
      const settled = reelGeometry(spinnerRef.current, false)
      if (settled) setStyles([{ transform: `translateX(${settled.finalOffset}px) translateY(0px)`, transition: 'transform .25s cubic-bezier(.1,.6,.3,1)' }])
      playSound('riskSpin')
      timers.current.push(window.setTimeout(() => {
        const eligibleItems = items.filter((entry) => (Number.parseFloat(String(entry.chance || '0')) || 0) < 10)
        setReels([createReel(eligibleItems.length ? eligibleItems : [item], item, `welcome-risk-${opening.outcome ?? Date.now()}`)])
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          positionReel(20)
          timers.current.push(window.setTimeout(() => {
            const secondGeometry = reelGeometry(spinnerRef.current, false)
            if (!secondGeometry) return reveal()
            const secondDuration = fast ? 0.85 : 1.35
            const secondJitter = Math.floor(Math.random() * 7 + 1) * secondGeometry.itemSpacing / 8
            positionReel(60, `transform ${secondDuration}s cubic-bezier(0.1, 0.6, 0.3, 1)`, secondJitter)
            settleResult(secondDuration)
          }, 40))
        }))
      }, 1600))
    }, duration * 1000 + 200))
  }, [caseData, clearTimers, currency, fast, items, load, positionReel])

  const open = async (demo) => {
    if (disabled || !caseData) return
    if (!demo && !user) {
      onSignIn?.()
      return
    }
    if (!demo && !hasRedeemedCode) {
      codeInput.current?.focus()
      notify({ type: 'error', message: 'Redeem an affiliate code to unlock reward cases.' })
      return
    }
    if (!demo && !data.hasRewardCaseDeposit) {
      notify({ type: 'error', message: 'You need to deposit at least $10 to open welcome cases.' })
      onOpenWallet?.('deposit')
      return
    }
    if (!demo && allClaimed) {
      notify({ type: 'error', message: 'You have already claimed this reward case.' })
      return
    }
    try {
      setRequesting(true)
      if (demo) {
        const item = pickVisualItem(items)
        const chance = Number.parseFloat(String(item?.chance || '0').replace('%', '')) || 0
        const itemValue = Number(currency === 'coins' ? item?.coinPrice : item?.rocoinPrice) || 0
        const caseValue = Number(currency === 'coins' ? caseData?.coinAmount : caseData?.rocoinAmount) || 0
        await spin({
          demo: true,
          outcome: Math.floor(Math.random() * 100000) + 1,
          item,
          riskSpin: riskSpin && chance < 10 && itemValue > caseValue,
          updatedAt: new Date().toISOString(),
        }, null)
        return
      }
      const response = await fetch('/api/welcome/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency, riskSpin }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Reward case is not available yet.')
      await spin(payload.opening, payload.user)
    } catch (error) {
      notify({ type: 'error', message: error.message })
    } finally {
      setRequesting(false)
    }
  }

  const redeem = async () => {
    if (!user) return onSignIn?.()
    const code = affiliateCode.trim()
    if (!code || !/^[A-Za-z0-9_]{3,12}$/.test(code)) {
      notify({ type: 'error', message: 'Your entered referral code is invalid.' })
      return
    }
    if (inputLocked) {
      notify({ type: 'error', message: `You can switch this code in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.` })
      return
    }
    if (hasRedeemedCode && code.toLowerCase() === String(affiliate.redeemedCode || '').toLowerCase()) {
      codeInput.current?.focus()
      codeInput.current?.select()
      return
    }
    try {
      setRequesting(true)
      const response = await fetch('/api/affiliates/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Your entered referral code is invalid.')
      window.localStorage.removeItem('rorisk_affiliate_code')
      notify({ type: 'success', message: "You've successfully applied an affiliate code." })
      await load()
    } catch (error) {
      notify({ type: 'error', message: error.message })
    } finally {
      setRequesting(false)
    }
  }

  const inviteName = affiliate.referrerUser?.username || affiliate.redeemedCode || 'RoRisk'
  const inviteAvatar = affiliate.referrerUser?.avatar || '/assets/users/default-avatar.png'

  return <div className="welcome-cases" {...pageScope}>
    <div className="welcome-hero" {...heroScope}>
      <div className="welcome-hero-invite" {...heroScope}>
        <div className="welcome-hero-avatar" {...heroScope}><img src={inviteAvatar} alt="" {...heroScope} /></div>
        <p className="welcome-hero-invite-copy" {...heroScope}><span className="welcome-hero-invite-name" {...heroScope}>{inviteName}</span><span className="welcome-hero-invite-mid" {...heroScope}>has invited you to claim your</span><span className="welcome-hero-invite-strong" {...heroScope}>4 Free Cases</span></p>
      </div>
    </div>
    <div className="welcome-cases-game" {...pageScope}>
      {reels.length > 0 && <Spinner count={1} reels={reels} styles={styles} winnerVisible={winnerVisible} spinnerRef={spinnerRef} currency={currency} variant="welcome" />}
      <div className={`welcome-controls${disabled ? ' welcome-controls-disabled' : ''}`} {...controlsScope}>
        <div className="welcome-controls-art" {...controlsScope}><div className="welcome-controls-chest-blur" aria-hidden="true" {...controlsScope}><div className="welcome-controls-chest-blur-inner" {...controlsScope}><img src="/assets/welcome/welcome-chicken.4c912e1c.png" alt="" {...controlsScope} /></div></div><img className="welcome-controls-chest" src="/assets/welcome/welcome-chicken.4c912e1c.png" alt="" {...controlsScope} /></div>
        <div className="welcome-controls-copy" {...controlsScope}>
          <h2 className="welcome-controls-title" {...controlsScope}>Welcome Case</h2>
          <div className="welcome-controls-code" {...controlsScope}><span className="welcome-controls-code-label" {...controlsScope}>Using code</span><div className="welcome-controls-code-chip" {...controlsScope}><input ref={codeInput} className="welcome-controls-code-value" type="text" placeholder="code" maxLength="12" size={Math.max(affiliateCode.length, 4)} disabled={inputLocked} autoComplete="off" spellCheck="false" value={affiliateCode} onChange={(event) => setAffiliateCode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); redeem() } }} {...controlsScope} /><button className="welcome-controls-code-edit" type="button" disabled={disabled} aria-label="Edit referral code" onClick={redeem} {...controlsScope}><img src="/assets/welcome/edit.e4f1634b.svg" alt="" width="22" height="22" {...controlsScope} /></button></div></div>
          {inputLocked && <p className="welcome-controls-hint" {...controlsScope}>You can switch this code in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}.</p>}
          <div className="welcome-controls-actions" {...controlsScope}>
            <div className="welcome-controls-buttons" {...controlsScope}><button className={`welcome-controls-open${allClaimed ? ' welcome-controls-open-opened' : ''}`} type="button" disabled={disabled || allClaimed} onClick={() => open(false)} {...controlsScope}><span {...controlsScope}>{allClaimed ? 'Opened' : 'Open Case'}</span><span className="welcome-controls-count" {...controlsScope}>{claimedCount}/4</span></button><button className="welcome-controls-demo" type="button" disabled={disabled} onClick={() => open(true)} {...controlsScope}>Demo Spin</button></div>
            <button className={`welcome-controls-toggle${fast ? ' is-on' : ''}`} type="button" disabled={disabled} onClick={() => setFast((value) => !value)} {...controlsScope}><FastIcon /><span {...controlsScope}>Fast Spin</span><span className={`welcome-switch welcome-switch-fast${fast ? ' is-on' : ''}`} {...controlsScope} /></button>
            <button className={`welcome-controls-toggle${riskSpin ? ' is-on' : ''}`} type="button" disabled={disabled} onClick={() => setRiskSpin((value) => !value)} {...controlsScope}><img className="welcome-controls-toggle-icon" src="/assets/welcome/risk-spin.2fb55d91.png" alt="" {...controlsScope} /><span {...controlsScope}>Risk Spin</span><span className={`welcome-switch welcome-switch-risk${riskSpin ? ' is-on' : ''}`} {...controlsScope} /></button>
          </div>
        </div>
      </div>
      <div className="welcome-cases-rule" aria-hidden="true" {...pageScope} />
      <div className="welcome-cases-drops" {...pageScope}><div className="welcome-cases-drops-header" {...pageScope}><img src="/assets/welcome/drops.4ce60956.svg" alt="" {...pageScope} /><span {...pageScope}>Possible Drops</span></div>{items.length > 0 && <div className="welcome-cases-drops-grid" {...pageScope}>{items.map((item) => <ItemCard item={item} items={items} currency={currency} key={item.index || item.name} />)}</div>}</div>
    </div>
  </div>
}

export default Welcome
