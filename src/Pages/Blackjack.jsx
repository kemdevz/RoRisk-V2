import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Bets from '../components/Bets'
import FairSeedModal from '../components/FairSeedModal'
import SiteIcon from '../components/Icons'
import ModalAnimation from '../components/ModalAnimation'
import { getFairClientSeed, getFairSeedState, incrementFairNonce } from '../lib/Fairness'
import { notify } from '../lib/Notifications'
import { playSound, preloadSound } from '../lib/Sounds'

const pageScope = { 'data-v-1aa2209e': '' }
const headerScope = { 'data-v-4bbc447d': '' }
const controlsScope = { 'data-v-12d059e9': '' }
const actionsScope = { 'data-v-1b01a6e8': '' }
const gameScope = { 'data-v-dd410dd8': '' }
const cardScope = { 'data-v-9dc6ce2a': '' }
const valueScope = { 'data-v-4a6fbf31': '' }
const loadingScope = { 'data-v-21317e4a': '' }

const MIN_BET = 50
const MAX_BET = 500000
const cards = {
  '10_club': '10_club.5bcb3007.jpg', '10_diamond': '10_diamond.378c20a4.jpg', '10_heart': '10_heart.bd9811c7.jpg', '10_spade': '10_spade.62feb2a6.jpg',
  '2_club': '2_club.cadad6d0.jpg', '2_diamond': '2_diamond.9a08fd4d.jpg', '2_heart': '2_heart.e3029a37.jpg', '2_spade': '2_spade.dbf7a29f.jpg',
  '3_club': '3_club.e170dac8.jpg', '3_diamond': '3_diamond.3e5b5834.jpg', '3_heart': '3_heart.1d60a5bb.jpg', '3_spade': '3_spade.300e75ff.jpg',
  '4_club': '4_club.34a8b629.jpg', '4_diamond': '4_diamond.e0842cf1.jpg', '4_heart': '4_heart.db91af62.jpg', '4_spade': '4_spade.91a883d3.jpg',
  '5_club': '5_club.e4f0cdf7.jpg', '5_diamond': '5_diamond.023812ce.jpg', '5_heart': '5_heart.67da4cdd.jpg', '5_spade': '5_spade.f275d4a9.jpg',
  '6_club': '6_club.7981acef.jpg', '6_diamond': '6_diamond.87edda44.jpg', '6_heart': '6_heart.d1d359fc.jpg', '6_spade': '6_spade.3ca0304c.jpg',
  '7_club': '7_club.536e6bc5.jpg', '7_diamond': '7_diamond.a6c1bca1.jpg', '7_heart': '7_heart.caeb1f5a.jpg', '7_spade': '7_spade.1c787c86.jpg',
  '8_club': '8_club.3e5819b6.jpg', '8_diamond': '8_diamond.b92a888d.jpg', '8_heart': '8_heart.2862db86.jpg', '8_spade': '8_spade.237d38f6.jpg',
  '9_club': '9_club.0c1aef5e.jpg', '9_diamond': '9_diamond.4f5052d9.jpg', '9_heart': '9_heart.3b955e3e.jpg', '9_spade': '9_spade.28f4e29b.jpg',
  'a_club': 'a_club.9ecaecbb.jpg', 'a_diamond': 'a_diamond.df8dda25.jpg', 'a_heart': 'a_heart.fbdf0201.jpg', 'a_spade': 'a_spade.742f8054.jpg',
  'j_club': 'j_club.cecbf8cd.jpg', 'j_diamond': 'j_diamond.88d8d132.jpg', 'j_heart': 'j_heart.927f9506.jpg', 'j_spade': 'j_spade.2db0872a.jpg',
  'k_club': 'k_club.780cbc21.jpg', 'k_diamond': 'k_diamond.3db3bb20.jpg', 'k_heart': 'k_heart.e197fc25.jpg', 'k_spade': 'k_spade.9c5f1970.jpg',
  'q_club': 'q_club.8eb37a5d.jpg', 'q_diamond': 'q_diamond.3ebc0895.jpg', 'q_heart': 'q_heart.bac28ed1.jpg', 'q_spade': 'q_spade.7ac72200.jpg',
}

const amountNumber = (value) => Number(String(value).replace(/,/g, '')) || 0
const formatAmount = (value) => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US')
const currencyIcon = (currency) => currency === 'rocoins' ? '/rocoin.2d3febd5.svg' : '/Rewards/coin.12f4bce8.svg'

function cardValue(hand) {
  let value = 0
  let aces = 0
  for (const card of hand || []) {
    if (card.rank === 'A') { value += 11; aces += 1 }
    else if (['K', 'Q', 'J'].includes(card.rank)) value += 10
    else if (card.rank !== 'hidden') value += Number(card.rank) || 0
  }
  while (value > 21 && aces) { value -= 10; aces -= 1 }
  return value
}

function cardImage(card) {
  if (!card || card.rank === 'hidden') return ''
  const filename = cards[`${String(card.rank).toLowerCase()}_${card.suit}`]
  return filename ? `/Blackjack/${filename}` : ''
}

function ActionIcon({ type }) {
  if (type === 'hit') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.3798 2H15.8197C16.8757 2 17.7396 2.94737 17.7396 4.10526V10.8421L14.3798 2ZM19.5635 3.68421L20.8115 4.31579C21.7714 4.73684 22.2514 6 21.8674 7.05263L19.5635 13.2632V3.68421ZM17.5476 16L12.7478 3.36842C12.4599 2.52632 11.7879 2.10526 11.0199 2.10526C10.7319 2.10526 10.5399 2.21053 10.2519 2.31579L3.14826 5.47368C2.1883 5.89474 1.70832 7.05263 2.1883 8.10526L6.98809 20.7368C7.27608 21.5789 7.94805 22 8.71601 22C9.004 22 9.19599 22 9.48398 21.7895L16.5877 18.6316C17.3556 18.3158 17.7396 17.5789 17.7396 16.7368C17.6436 16.5263 17.6436 16.2105 17.5476 16ZM11.2119 15.4737L8.14004 12.9474L8.52402 8.73684L11.5959 11.2632L11.2119 15.4737Z" fill="#84ff8a" /></svg>
  if (type === 'stand') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7.91688 2.66004C7.8218 2.41788 7.63639 2.22247 7.40003 2.11534C7.16368 2.00821 6.89502 1.99781 6.65114 2.08634C6.40727 2.17487 6.2074 2.35536 6.09402 2.58945C5.98064 2.82355 5.96267 3.09278 6.04395 3.33996L8.28549 9.57215C8.34494 9.74009 8.33631 9.92475 8.26146 10.0864C8.18661 10.248 8.05152 10.3736 7.88528 10.4363C7.71903 10.499 7.53492 10.4936 7.37258 10.4214C7.21024 10.3491 7.08265 10.2158 7.01728 10.0501L4.9202 4.63779C4.82125 4.39531 4.63142 4.2015 4.39155 4.09806C4.15168 3.99462 3.88094 3.98982 3.63758 4.08469C3.39422 4.17956 3.19769 4.36652 3.09027 4.60534C2.98285 4.84416 2.97314 5.11576 3.06321 5.3617L6.21032 13.4836C4.51473 13.2997 3.3043 13.7336 2.57406 14.1516C2.37661 14.2613 2.21706 14.4287 2.11654 14.6316C2.01602 14.8344 1.97928 15.0631 2.01119 15.2874C2.06996 15.7034 2.34891 16.0543 2.73545 16.2243C4.06642 16.8092 7.10494 18.312 9.70712 20.8037C10.7293 21.7816 12.2196 22.2735 13.6552 21.8436L16.4437 21.0057C17.2705 20.7567 17.9619 20.1198 18.212 19.2429C18.5109 18.196 18.9353 16.4233 18.9353 14.7485C18.9353 13.5986 18.5338 12.1638 18.1682 11.079C17.4429 8.93323 16.632 6.81351 15.8918 4.67179C15.8051 4.42119 15.6228 4.21541 15.385 4.09971C15.1471 3.98402 14.8732 3.96788 14.6235 4.05486C14.3739 4.14184 14.1688 4.32481 14.0535 4.56351C13.9383 4.80222 13.9222 5.0771 14.0089 5.3277L14.9991 8.19133C15.0607 8.36675 15.0503 8.55953 14.9702 8.72726C14.8902 8.89499 14.747 9.02393 14.5722 9.08572C14.3975 9.1475 14.2054 9.13707 14.0383 9.05673C13.8711 8.97638 13.7427 8.83269 13.6811 8.65727L11.9038 3.66392C11.8102 3.42079 11.6256 3.22398 11.3895 3.11543C11.1534 3.00687 10.8844 2.99515 10.6398 3.08276C10.3951 3.17037 10.1943 3.35039 10.08 3.58446C9.96572 3.81852 9.94703 4.08813 10.0279 4.33583L11.6398 8.86524C11.671 8.9521 11.6847 9.04426 11.6804 9.13647C11.676 9.22868 11.6536 9.31912 11.6145 9.40263C11.5753 9.48615 11.5201 9.5611 11.4521 9.62321C11.384 9.68532 11.3045 9.73338 11.2179 9.76463C11.1314 9.79588 11.0395 9.80972 10.9477 9.80535C10.8558 9.80098 10.7657 9.77849 10.6825 9.73917C10.5993 9.69985 10.5246 9.64447 10.4627 9.57618C10.4008 9.50789 10.3529 9.42804 10.3218 9.34118L7.91688 2.66004ZM18.5706 2.32209C18.6266 2.24119 18.6979 2.17216 18.7805 2.11894C18.8631 2.06571 18.9553 2.02933 19.0519 2.01187C19.1485 1.99442 19.2475 1.99623 19.3434 2.0172C19.4393 2.03818 19.5301 2.0779 19.6107 2.13411C20.4157 2.69404 21.0831 3.67791 21.5016 4.76077C21.924 5.85463 22.1292 7.14447 21.913 8.37831C21.8789 8.57428 21.7687 8.74863 21.6065 8.86301C21.4443 8.9774 21.2435 9.02244 21.0483 8.98823C20.853 8.95402 20.6793 8.84336 20.5653 8.6806C20.4514 8.51784 20.4065 8.31631 20.4406 8.12034C20.6 7.20746 20.4535 6.19659 20.1078 5.3027C19.7591 4.39682 19.2421 3.70291 18.7579 3.36595C18.6773 3.30976 18.6085 3.23819 18.5555 3.15531C18.5025 3.07244 18.4662 2.97989 18.4488 2.88296C18.4314 2.78602 18.4332 2.6866 18.4541 2.59036C18.475 2.49413 18.5146 2.40297 18.5706 2.32209ZM18.2369 4.23884C18.102 4.09312 17.915 4.00715 17.7169 3.99984C17.5189 3.99253 17.3261 4.06447 17.1809 4.19985C17.0357 4.33522 16.95 4.52294 16.9427 4.7217C16.9355 4.92046 17.0071 5.11399 17.142 5.25971C17.5585 5.70765 17.938 6.24958 17.938 7.24845C17.938 7.44734 18.0167 7.63808 18.1569 7.77871C18.297 7.91935 18.487 7.99836 18.6852 7.99836C18.8834 7.99836 19.0734 7.91935 19.2135 7.77871C19.3537 7.63808 19.4324 7.44734 19.4324 7.24845C19.4324 5.74765 18.8117 4.85876 18.2359 4.23784L18.2369 4.23884Z" fill="#FF68E8" /></svg>
  if (type === 'split') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.879 12L7.562 9.68291C6.70737 10.0453 5.7533 10.0992 4.86331 9.8353C3.97331 9.57139 3.20281 9.00615 2.68386 8.23643C2.1649 7.46671 1.92981 6.54046 2.01886 5.61641C2.10792 4.69236 2.51558 3.82806 3.17199 3.17163C3.82839 2.5152 4.69266 2.10752 5.61667 2.01846C6.54068 1.9294 7.4669 2.1645 8.23658 2.68348C9.00627 3.20245 9.57149 3.97299 9.83538 4.86302C10.0993 5.75305 10.0454 6.70715 9.683 7.56182L12 9.87991L18.374 3.50465C18.5597 3.31884 18.7802 3.17145 19.0229 3.07088C19.2656 2.97032 19.5258 2.91856 19.7885 2.91856C20.0512 2.91856 20.3113 2.97032 20.5541 3.07088C20.7968 3.17145 21.0173 3.31884 21.203 3.50465L21.91 4.21168L9.683 16.4382C10.0454 17.2928 10.0993 18.247 9.83538 19.137C9.57149 20.027 9.00627 20.7975 8.23658 21.3165C7.4669 21.8355 6.54068 22.0706 5.61667 21.9815C4.69266 21.8925 3.82839 21.4848 3.17199 20.8284C2.51558 20.1719 2.10792 19.3076 2.01886 18.3836C1.92981 17.4595 2.1649 16.5333 2.68386 15.7636C3.20281 14.9939 3.97331 14.4286 4.86331 14.1647C5.7533 13.9008 6.70737 13.9547 7.562 14.3171L9.88 12H9.879ZM6 7.99984C6.53043 7.99984 7.03914 7.78912 7.41421 7.41403C7.78929 7.03894 8 6.53021 8 5.99976C8 5.4693 7.78929 4.96057 7.41421 4.58548C7.03914 4.2104 6.53043 3.99967 6 3.99967C5.46957 3.99967 4.96086 4.2104 4.58579 4.58548C4.21071 4.96057 4 5.4693 4 5.99976C4 6.53021 4.21071 7.03894 4.58579 7.41403C4.96086 7.78912 5.46957 7.99984 6 7.99984ZM6 20.0003C6.53043 20.0003 7.03914 19.7896 7.41421 19.4145C7.78929 19.0394 8 18.5307 8 18.0002C8 17.4698 7.78929 16.9611 7.41421 16.586C7.03914 16.2109 6.53043 16.0002 6 16.0002C5.46957 16.0002 4.96086 16.2109 4.58579 16.586C4.21071 16.9611 4 17.4698 4 18.0002C4 18.5307 4.21071 19.0394 4.58579 19.4145C4.96086 19.7896 5.46957 20.0003 6 20.0003ZM15.535 13.4131L21.91 19.7893L21.203 20.4963C21.0173 20.6822 20.7968 20.8296 20.5541 20.9301C20.3113 21.0307 20.0512 21.0824 19.7885 21.0824C19.5258 21.0824 19.2656 21.0307 19.0229 20.9301C18.7802 20.8296 18.5597 20.6822 18.374 20.4963L13.414 15.5351L15.534 13.4131H15.535ZM16 11H18V13H16V11ZM20 11H22V13H20V11ZM6 11H8V13H6V11ZM2 11H4V13H2V11Z" fill="#6ab7ff" /></svg>
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17.1333 8.50909V8C17.1333 5.71818 13.6683 4 9.06667 4C4.465 4 1 5.71818 1 8V11.6364C1 13.5364 3.40167 15.0455 6.86667 15.5V16C6.86667 18.2818 10.3317 20 14.9333 20C19.535 20 23 18.2818 23 16V12.3636C23 10.4818 20.6717 8.97273 17.1333 8.50909ZM6.86667 14.0182V11.8636C7.59622 11.9566 8.33112 12.0022 9.06667 12C9.80221 12.0022 10.5371 11.9566 11.2667 11.8636V14.0182C10.5389 14.1307 9.80322 14.1854 9.06667 14.1818C8.33011 14.1854 7.59445 14.1307 6.86667 14.0182V14.0182ZM15.6667 10.3545V11.6364C15.6667 12.4 14.53 13.2182 12.7333 13.7182V11.5909C13.9158 11.3091 14.915 10.8818 15.6667 10.3545V10.3545ZM2.46667 11.6364V10.3545C3.21833 10.8818 4.2175 11.3091 5.4 11.5909V13.7182C3.60333 13.2182 2.46667 12.4 2.46667 11.6364ZM8.33333 16V15.6182L9.06667 15.6364C9.42722 15.6364 9.77556 15.6273 10.1117 15.6091C10.4783 15.7364 10.8633 15.8455 11.2667 15.9455V18.0818C9.47 17.5818 8.33333 16.7636 8.33333 16V16ZM12.7333 18.3818V16.2182C13.4628 16.3131 14.1976 16.3617 14.9333 16.3636C15.6689 16.3658 16.4038 16.3203 17.1333 16.2273V18.3818C15.6749 18.6 14.1918 18.6 12.7333 18.3818V18.3818ZM18.6 18.0818V15.9545C19.7825 15.6727 20.7817 15.2455 21.5333 14.7182V16C21.5333 16.7636 20.3967 17.5818 18.6 18.0818V18.0818Z" fill="#ffe564" /></svg>
}

function ButtonLoading() {
  return <div className="button-loading" {...loadingScope}>{Array.from({ length: 3 }, (_, index) => <div className="loading-element" key={index} {...loadingScope}><div className="element-inner" {...loadingScope} /></div>)}</div>
}

function BlackjackHeader({ onFairness }) {
  return <div className="blackjack-header" {...headerScope}><div className="blackjack-header-left" {...headerScope}><SiteIcon name="blackjack" {...headerScope} /> Blackjack</div><div className="blackjack-header-center" {...headerScope}><img src="/Footer/logo.ee8858f3.png" alt="logo" {...headerScope} /></div><div className="blackjack-header-right" role="button" tabIndex="0" onClick={onFairness} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onFairness() }} {...headerScope}><SiteIcon name="fairness" {...headerScope} /> Fairness</div></div>
}

function BlackjackValue({ value, state = '', className = '' }) {
  const [shown, setShown] = useState(0)
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [delayedState, setDelayedState] = useState('')
  const shownRef = useRef(0)
  useEffect(() => {
    let frame
    let pulseTimer
    const fadeTimer = window.setTimeout(() => setVisible(true), shownRef.current === 0 ? 500 : 0)
    const timer = window.setTimeout(() => {
      const from = shownRef.current
      const started = performance.now()
      if (value > from) {
        setAnimating(true)
        pulseTimer = window.setTimeout(() => setAnimating(false), 400)
      }
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / 400)
        const next = Math.floor(from + (value - from) * (1 - Math.pow(1 - progress, 3)))
        shownRef.current = next
        setShown(next)
        if (progress < 1) frame = window.requestAnimationFrame(tick)
      }
      frame = window.requestAnimationFrame(tick)
    }, 400)
    return () => { window.clearTimeout(timer); window.clearTimeout(fadeTimer); window.clearTimeout(pulseTimer); window.cancelAnimationFrame(frame) }
  }, [value])
  useEffect(() => {
    const timer = window.setTimeout(() => setDelayedState(state), state ? 700 : 0)
    return () => window.clearTimeout(timer)
  }, [state])
  return <div className={`blackjack-value${visible ? ' visible' : ' fade-in'}${delayedState ? ` value-${delayedState}` : ''}${className ? ` ${className}` : ''}`} {...valueScope}><span className={animating ? 'animating' : ''} {...valueScope}>{shown}</span></div>
}

function BlackjackCard({ card, dealer, dealOrder, outcome }) {
  const rootRef = useRef(null)
  const innerRef = useRef(null)
  const previousRank = useRef(card.rank)
  const hidden = card.rank === 'hidden'
  const [animationComplete, setAnimationComplete] = useState(hidden)
  useEffect(() => {
    const root = rootRef.current
    const inner = innerRef.current
    if (!root || !inner) return undefined
    if (hidden) { root.style.opacity = '1'; root.style.transform = 'translate(0)'; inner.style.transform = 'rotateY(-180deg)'; return undefined }
    if (previousRank.current === 'hidden') {
      let flip
      const revealDelay = dealOrder <= 3 ? 360 * dealOrder : 180 * (dealOrder - 3)
      const revealTimer = window.setTimeout(() => {
        flip = inner.animate([{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0)' }], { duration: 800, easing: 'cubic-bezier(.25,.46,.45,.94)', fill: 'forwards' })
        flip.finished.then(() => setAnimationComplete(true)).catch(() => {})
      }, revealDelay)
      previousRank.current = card.rank
      return () => { window.clearTimeout(revealTimer); flip?.cancel() }
    }
    const delay = dealOrder <= 3 ? 360 * dealOrder : 180 * (dealOrder - 3)
    const timer = window.setTimeout(() => playSound('dealCard', { dedupeMs: 40 }), delay)
    const travel = root.animate([{ opacity: 0, transform: `translate(500px,${dealer ? -100 : -650}px)` }, { opacity: 1, transform: 'translate(0,0)' }], { delay, duration: 800, easing: 'cubic-bezier(.25,.46,.45,.94)', fill: 'forwards' })
    const flip = inner.animate([{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(-180deg)', offset: .5 }, { transform: 'rotateY(0)' }], { delay, duration: 800, easing: 'cubic-bezier(.25,.46,.45,.94)', fill: 'forwards' })
    travel.finished.then(() => setAnimationComplete(true)).catch(() => {})
    previousRank.current = card.rank
    return () => { window.clearTimeout(timer); travel.cancel(); flip.cancel() }
  }, [card.rank, dealer, dealOrder, hidden])
  const resultStyle = outcome === 'won' || outcome === 'push' ? { boxShadow: '0 0 0 3px #22c55e, 0 0 0 5px rgba(34,197,94,.3)', filter: 'drop-shadow(0 0 40px rgba(34,197,94,.2))', transition: 'box-shadow .3s ease .7s, filter .3s ease .7s' } : outcome === 'lose' ? { boxShadow: '0 0 0 3px #ef4444, 0 0 0 5px rgba(239,68,68,.3)', filter: 'drop-shadow(0 0 40px rgba(239,68,68,.2))', transition: 'box-shadow .3s ease .7s, filter .3s ease .7s' } : undefined
  return <div ref={rootRef} className={`blackjack-card${hidden ? ' card-hidden skip-motion' : ''} card-${card.suit}${dealer ? ' card-dealer' : ' card-player'}${animationComplete ? ' card-animated' : ''}${outcome ? ` card-${outcome === 'won' ? 'winner' : outcome === 'lose' ? 'loser' : 'push'}` : ''}`} data-animated={animationComplete} style={resultStyle} {...cardScope}><div ref={innerRef} className={`card-inner${animationComplete ? ' card-animated' : ''}`} {...cardScope}>{!hidden && <div className="inner-front" {...cardScope}><img src={cardImage(card)} alt="blackjack-logo" draggable="false" decoding="sync" {...cardScope} /></div>}<div className="inner-back" {...cardScope}><img src="/Blackjack/back.0a3ac3b7.png" alt="blackjack-logo" draggable="false" {...cardScope} /></div></div></div>
}

function AnimatedCardRow({ className, children, layoutKey }) {
  const ref = useRef(null)
  const previousRect = useRef(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const next = element.getBoundingClientRect()
    const previous = previousRect.current
    previousRect.current = next
    if (!previous) return
    const x = previous.left - next.left
    const y = previous.top - next.top
    if (Math.abs(x) < 1 && Math.abs(y) < 1) return
    element.animate([{ transform: `translate(${x}px,${y}px)` }, { transform: 'translate(0,0)' }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' })
  }, [layoutKey])
  return <div ref={ref} className={className} {...gameScope}>{children}</div>
}

function dealerResult(game) {
  if (game?.state !== 'completed') return ''
  const dealerCards = game.dealer_cards || []
  const dealerValue = cardValue(dealerCards)
  if (dealerValue > 21) return 'lose'
  const hands = game.cards_left?.length && game.cards_right?.length ? [game.cards_left, game.cards_right] : [game.player_cards || []]
  let winsAll = true
  let pushesAll = true
  for (const hand of hands) {
    const playerValue = cardValue(hand)
    const playerNatural = hand.length === 2 && playerValue === 21
    const dealerNatural = dealerCards.length === 2 && dealerValue === 21
    if (playerValue <= 21) {
      if (playerValue === dealerValue) winsAll = false
      else if (playerValue > dealerValue || (playerNatural && !dealerNatural)) { winsAll = false; pushesAll = false }
      else pushesAll = false
    } else pushesAll = false
  }
  return pushesAll ? 'push' : winsAll ? 'won' : 'lose'
}

function dealOrderFor(game, hand, index) {
  const left = game?.cards_left || []
  const right = game?.cards_right || []
  const main = game?.player_cards || []
  const split = left.length > 0 && right.length > 0
  if (hand === 'dealer') {
    if (index < 2) return 1 + 2 * index
    const extraPlayerCards = split ? Math.max(0, left.length - 1) + Math.max(0, right.length - 1) : Math.max(0, main.length - 2)
    return 4 + extraPlayerCards + (index - 2)
  }
  if (hand === 'main') return index < 2 ? 2 * index : index - 2 + 4
  if (hand === 'left') return index < 1 ? 0 : index - 1 + 4
  if (hand === 'right') return index < 1 ? 2 : 4 + Math.max(0, left.length - 1) + (index - 1)
  return index
}

function Hand({ cards: handCards, hand, dealer = false, game, split = false }) {
  const outcome = dealer ? dealerResult(game) : game?.state === 'completed' ? game.outcomes?.[hand] || '' : ''
  const active = !dealer && split && game?.state === 'playing' && game.active_hand !== hand
  const value = cardValue(handCards)
  const valueClass = handCards.length === 2 && value === 21 ? 'value-blackjack' : value > 21 ? 'value-bust' : ''
  return <div className={dealer ? 'game-dealer' : `hand-${hand}${active ? ' hand-inactive' : ''}`} {...gameScope}><div className="hand-value" {...gameScope}><BlackjackValue value={value} state={outcome} className={valueClass} /></div><AnimatedCardRow className={dealer ? 'dealer-cards' : 'player-cards'} layoutKey={`${handCards.length}:${split}`}>{handCards.map((card, index) => <BlackjackCard card={card} dealer={dealer} dealOrder={dealOrderFor(game, hand, index)} outcome={outcome} key={`${game.uuid}-${hand}-${index}`} />)}</AnimatedCardRow></div>
}

function BlackjackGame({ game }) {
  const split = Boolean(game?.cards_left?.length && game?.cards_right?.length)
  return <div className={`blackjack-game${game?.state === 'completed' ? ' game-completed' : ''}`} {...gameScope}><div className="game-deck" {...gameScope}><img src="/Blackjack/cards-deck.705f6419.png" alt="deck" {...gameScope} /></div><div className="game-background" {...gameScope}><img src="/main.c55d6769.png" alt="bg" {...gameScope} /></div><div className="game-information" {...gameScope}><img src="/Blackjack/game-info.b8474b72.svg" alt="" {...gameScope} /></div><div className="game-table" {...gameScope}>{game?.dealer_cards?.length > 0 && <Hand cards={game.dealer_cards} hand="dealer" dealer game={game} />}{game?.player_cards?.length > 0 && <div className={`player-hand${split ? ' has-split-hands' : ''}`} {...gameScope}>{split ? <><Hand cards={game.cards_left} hand="left" game={game} split /><Hand cards={game.cards_right} hand="right" game={game} split /></> : <Hand cards={game.player_cards} hand="main" game={game} />}</div>}</div></div>
}

function BlackjackControls({ amount, setAmount, game, currency, balance, busy, onStart, onAction, onFairness }) {
  const wager = amountNumber(amount)
  const active = game && game.state !== 'completed'
  const split = Boolean(game?.cards_left?.length && game?.cards_right?.length)
  const activeCards = split ? (game.active_hand === 'left' ? game.cards_left : game.cards_right) : game?.player_cards || []
  const splitAces = split && game.cards_left?.[0]?.rank === 'A' && game.cards_right?.[0]?.rank === 'A'
  const normalize = (value) => Math.min(MAX_BET, Math.max(MIN_BET, Math.floor(Number(value) || MIN_BET)))
  const setBet = (type) => setAmount(formatAmount(type === 'half' ? normalize(wager / 2) : type === 'double' ? normalize(wager * 2) : normalize(Math.min(balance, MAX_BET))))
  const canSplit = active && game.state === 'playing' && !split && game.player_cards?.length === 2 && game.player_cards[0]?.rank === game.player_cards[1]?.rank
  const canDouble = active && game.state === 'playing' && !split && game.player_cards?.length === 2
  const blocked = !active || game?.state !== 'playing'
  return <div className="blackjack-controls" {...controlsScope}><div className="bet-amount-section" {...controlsScope}><div className="blackjack-title" {...controlsScope}>Bet Amount</div><div className="bet-amount-selector" {...controlsScope}><img className="bet-icon" src={currencyIcon(currency)} alt="Bet" {...controlsScope} /><input className="bet-amount-display" type="text" inputMode="numeric" placeholder="0" disabled={active || busy} value={amount} onFocus={() => setAmount(String(amount).replace(/,/g, ''))} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ''))} onBlur={() => setAmount(formatAmount(normalize(wager)))} {...controlsScope} /><div className="bet-actions" {...controlsScope}><button type="button" disabled={active || busy} onClick={() => setBet('half')} {...controlsScope}>1/2</button><button type="button" disabled={active || busy} onClick={() => setBet('double')} {...controlsScope}>2x</button><button type="button" disabled={active || busy} onClick={() => setBet('max')} {...controlsScope}>Max</button></div></div></div><div className="play-button-section" {...controlsScope}><button className="button-action button-play" type="button" disabled={busy || active || wager < MIN_BET || wager > MAX_BET} onClick={onStart} {...controlsScope}>{busy && !active ? <ButtonLoading /> : <span {...controlsScope}>Start Game</span>}</button></div><div className="blackjack-controls-action" {...actionsScope}><div className="action-container" {...actionsScope}>{game?.state === 'insurance' ? <div className="container-insurance" {...actionsScope}><span className="blackjack-controls-action-title" {...actionsScope}>Would you like insurance?</span><div className="container-insurance-buttons" {...actionsScope}><button className="button-insurance accept-insurance-button" type="button" onClick={() => onAction('insurance', { insurance: true })} {...actionsScope}>Accept Insurance</button><button className="button-insurance no-insurance-button" type="button" onClick={() => onAction('insurance', { insurance: false })} {...actionsScope}>No Insurance</button></div></div> : <div className="container-normal" {...actionsScope}>{[['hit', 'Hit'], ['stand', 'Stand'], ['split', 'Split'], ['double', 'Double']].map(([type, label]) => <button className={`button-action button-${type}`} type="button" disabled={type === 'split' ? !canSplit : type === 'double' ? !canDouble : blocked || cardValue(activeCards) > 21 || (type === 'hit' && (cardValue(activeCards) >= 21 || splitAces))} onClick={() => onAction(type)} key={type} {...actionsScope}><ActionIcon type={type} />{label}</button>)}</div>}</div></div><div className="fairness-section" {...controlsScope}><button className="button-fairness" type="button" onClick={onFairness} {...controlsScope}><SiteIcon name="fairness" {...controlsScope} /> Fairness</button></div></div>
}

function Blackjack({ user }) {
  const [amount, setAmount] = useState('50')
  const [currency, setCurrency] = useState(() => window.localStorage.getItem('currency') === 'coins' ? 'coins' : 'rocoins')
  const [game, setGame] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showFairness, setShowFairness] = useState(false)
  const stagedTimers = useRef([])
  const balance = Number(user?.[currency]) || 0
  useEffect(() => {
    document.title = 'Blackjack - RoRisk.com'
    preloadSound('dealCard')
    const sources = ['/Blackjack/back.0a3ac3b7.png', '/Blackjack/cards-deck.705f6419.png', '/Blackjack/game-info.b8474b72.svg', ...Object.values(cards).map((name) => `/Blackjack/${name}`)]
    const images = sources.map((source) => { const image = new Image(); image.decoding = 'async'; image.src = source; return image })
    return () => images.forEach((image) => { image.src = '' })
  }, [])
  const clearStagedTimers = useCallback(() => {
    stagedTimers.current.forEach((timer) => window.clearTimeout(timer))
    stagedTimers.current = []
  }, [])
  useEffect(() => () => clearStagedTimers(), [clearStagedTimers])
  useEffect(() => {
    const update = (event) => setCurrency(event.detail?.currency === 'coins' ? 'coins' : 'rocoins')
    window.addEventListener('rorisk:currency-change', update)
    return () => window.removeEventListener('rorisk:currency-change', update)
  }, [])
  useEffect(() => {
    if (!user) return undefined
    let active = true
    fetch('/api/blackjack/current').then(async (response) => { const payload = await response.json(); if (active && response.ok) { setGame(payload.game || null); if (payload.game) { setAmount(formatAmount(payload.game.main_bet_amount)); setCurrency(payload.game.currency) } } }).catch(() => {})
    return () => { active = false }
  }, [user])
  const request = useCallback(async (path, body = {}) => {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to update this game.')
    return payload
  }, [])
  const applyPayload = useCallback((payload) => {
    clearStagedTimers()
    if (payload.game?.state === 'completed') {
      const finalGame = payload.game
      const dealerCards = Array.isArray(finalGame.dealer_cards) ? finalGame.dealer_cards : []
      const playerExtraCards = finalGame.cards_left?.length && finalGame.cards_right?.length
        ? Math.max(0, finalGame.cards_left.length - 1) + Math.max(0, finalGame.cards_right.length - 1)
        : Math.max(0, (finalGame.player_cards?.length || 0) - 2)
      const presentationGame = { ...finalGame, state: 'playing', outcomes: {}, dealer_cards: dealerCards }
      setGame(presentationGame)

      let completionDelay = 1880
      for (let index = 2; index < dealerCards.length; index += 1) {
        const order = 4 + playerExtraCards + (index - 2)
        const cardFinish = (order <= 3 ? 360 * order : 180 * (order - 3)) + 800
        completionDelay = Math.max(completionDelay, cardFinish)
      }

      const finishTimer = window.setTimeout(() => {
        setGame(payload.game)
        if (payload.user) window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: payload.user } }))
        window.dispatchEvent(new CustomEvent('rorisk:blackjack-bet', { detail: { game: payload.game } }))
        if (payload.game.won) {
          const cashTimer = window.setTimeout(() => playSound('cash'), 700)
          stagedTimers.current.push(cashTimer)
        }
        setBusy(false)
      }, completionDelay)
      stagedTimers.current.push(finishTimer)
      return true
    }
    setGame(payload.game)
    if (payload.user) window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: payload.user } }))
    return false
  }, [clearStagedTimers])
  const start = useCallback(async () => {
    if (!user) return notify({ type: 'error', message: 'Please sign in to perform this action.' })
    const wager = Math.trunc(amountNumber(amount))
    if (!Number.isSafeInteger(wager) || wager < MIN_BET || wager > MAX_BET) return notify({ type: 'error', message: 'Your entered bet amount is invalid.' })
    setBusy(true)
    setGame(null)
    try {
      const fair = getFairSeedState(user)
      const payload = await request('/api/blackjack/start', { amount: wager, currency, clientSeed: getFairClientSeed(user), nonce: fair.seed.nonce })
      incrementFairNonce(user, 1)
      const staged = applyPayload(payload)
      if (!staged) setBusy(false)
    } catch (error) { notify({ type: 'error', message: error.message || 'Unable to start this game.' }); setBusy(false) }
  }, [amount, applyPayload, currency, request, user])
  const action = useCallback(async (type, data = {}) => {
    if (!game || busy) return
    setBusy(true)
    try {
      const staged = applyPayload(await request(`/api/blackjack/${game.uuid}/${type}`, data))
      if (!staged) setBusy(false)
    } catch (error) { notify({ type: 'error', message: error.message || 'Unable to update this game.' }); setBusy(false) }
  }, [applyPayload, busy, game, request])
  const openFairness = () => user ? setShowFairness(true) : notify({ type: 'error', message: 'Please sign in to perform this action.' })
  const visualGame = useMemo(() => user ? game : null, [game, user])
  return <div className="blackjack" {...pageScope}><div className="blackjack-content" {...pageScope}><BlackjackHeader onFairness={openFairness} /><div className="blackjack-inner" {...pageScope}><BlackjackControls amount={amount} setAmount={setAmount} game={visualGame} currency={currency} balance={user ? balance : MAX_BET} busy={busy} onStart={start} onAction={action} onFairness={openFairness} /><BlackjackGame game={visualGame} /></div></div><Bets />{showFairness && <ModalAnimation label="Seed Fairness" onClose={() => setShowFairness(false)}><FairSeedModal user={user} /></ModalAnimation>}</div>
}

export default Blackjack
