import { memo, useCallback, useEffect, useRef, useState } from 'react'
import FairSeedModal from '../components/FairSeedModal'
import SiteIcon from '../components/Icons'
import ModalAnimation from '../components/ModalAnimation'
import { getFairClientSeed, incrementFairNonce } from '../lib/Fairness'
import { notify } from '../lib/Notifications'
import { playSound } from '../lib/Sounds'

const pageScope = { 'data-v-44867e9e': '' }
const headerScope = { 'data-v-1a4cb656': '' }
const controlsScope = { 'data-v-ebb1163c': '' }
const gameScope = { 'data-v-b05eafda': '' }
const itemsScope = { 'data-v-0c9edaa5': '' }
const itemScope = { 'data-v-2dd1797c': '' }
const selectedScope = { 'data-v-20774182': '' }
const searchScope = { 'data-v-7e30e78e': '' }
const amountScope = { 'data-v-bdc848ca': '' }
const sortScope = { 'data-v-65b8f850': '' }

const MIN_BET = 50
const MAX_BET = 500000
const SETTLE_MS = 4000
const RESULT_HOLD_MS = 1000
const RESET_MS = 600
const amountRanges = [
  { label: 'Any', minimum: null, maximum: null },
  { label: '0 - 5,000', minimum: 0, maximum: 5000 },
  { label: '5,000 - 25,000', minimum: 5000, maximum: 25000 },
  { label: '25,000 - 100,000', minimum: 25000, maximum: 100000 },
  { label: '+100,000', minimum: 100000, maximum: null },
]

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))
const numberValue = (value) => Number(String(value).replace(/,/g, '')) || 0
const formatAmount = (value) => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US')
const currencyIcon = (currency) => currency === 'rocoins' ? '/rocoin.2d3febd5.svg' : '/Rewards/coin.12f4bce8.svg'
const itemValue = (item, currency = item?.currency || 'rocoins') => {
  const currencyValue = currency === 'coins' ? item?.coinValue : item?.rocoinValue
  if (currencyValue != null) return Math.max(0, Number(currencyValue) || 0)
  if (item?.value != null) return Math.max(0, Number(item.value) || 0)
  if (item?.amountFixed != null) return Math.max(0, Number(item.amountFixed) / 1000 || 0)
  return Math.max(0, Number(item?.amount) / 1000 || 0)
}
const normalizeTicket = (value) => ((Math.round(value) % 100000) + 100000) % 100000

function itemTier(item, currency) {
  const value = itemValue(item, currency)
  if (value < 250) return 'blue'
  if (value < 1000) return 'green'
  if (value < 5000) return 'purple'
  if (value < 20000) return 'red'
  return 'yellow'
}

function Chevron({ direction = 'down', scope }) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...scope}><path d={direction === 'left' ? 'M12.5 15 7.5 10l5-5' : direction === 'right' ? 'm7.5 5 5 5-5 5' : 'm5 7.5 5 5 5-5'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...scope} /></svg>
}

function Pattern() {
  const columns = [.6, 6.72, 12.84, 18.96, 25.08, 31.2, 37.32, 43.44, 49.56, 55.68]
  const rows = [.42, 6.54, 12.66, 18.78, 24.9, 31.02, 37.14, 43.26, 49.38, 55.5]
  const opacity = [
    [0, .01, .02, .02, .02, .02, .02, .02, .02, 0],
    [.02, .05, .08, .08, .08, .08, .08, .08, .05, .02],
    [.02, .08, .05, .15, .15, .15, .15, .05, .08, .02],
    [.02, .08, .15, .05, .02, .02, .05, .15, .08, .02],
    [.02, .08, .15, .02, .02, .02, .02, .15, .08, .02],
    [.02, .08, .15, .02, .02, .02, .02, .15, .08, .02],
    [.02, .08, .15, .05, .02, .02, .05, .15, .08, .02],
    [.02, .08, .05, .15, .15, .15, .15, .05, .08, .02],
    [.02, .05, .08, .08, .08, .08, .08, .08, .05, .02],
    [.02, .02, .02, .02, .02, .02, .02, .02, .02, 0],
  ]
  return <svg className="pattern-bg from-colored-text position-absolute" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 62 62" fill="" aria-hidden="true" {...itemScope}>{columns.flatMap((x, column) => rows.map((y, row) => opacity[column][row] ? <path d={`M${x} ${y}h5.76v5.76H${x}z`} fill="currentColor" opacity={opacity[column][row]} key={`${column}-${row}`} {...itemScope} /> : null))}</svg>
}

function SelectedCheck() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...itemScope}><rect width="24" height="24" rx="5" fill="#52A4FF" {...itemScope} /><path d="M6.75 12 10.5 15.75 18 8.25" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...itemScope} /></svg>
}

function EmptyItemIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 90 90" fill="none" aria-hidden="true" {...selectedScope}><path d="M83.9609 54.9297C81.738 60.0533 78.9558 64.6179 75.6194 68.6279L83.5949 79.8809C84.5032 79.2324 85.4291 78.7401 86.2779 78.499L90 84.2959C89.8474 87.9457 87.8608 90.0578 84.2965 89.999L78.5 86.2754C78.7285 85.4412 79.2231 84.5132 79.8816 83.5928L68.5939 75.5938C64.671 78.7988 60.2237 81.4799 55.2524 83.6367L50.2524 78.6367C54.697 76.5133 58.6945 73.9975 62.2798 71.1191L47.2407 60.4609C48.6936 59.5373 50.488 58.2931 52.498 56.8799L65.4824 68.3535C66.4735 67.4308 67.432 66.4731 68.3562 65.4834L57.589 53.2988C59.1554 52.2039 60.7764 51.0843 62.411 49.9902L71.1301 62.293C74.1638 58.5439 76.7634 54.4128 78.9609 49.9287L83.9609 54.9297Z" fill="url(#paint0_linear_2491_156)" fillOpacity=".15" {...selectedScope} /><path d="M31.4159 6.25488L44 22.4998C41.8443 24.8384 39.9221 28.1342 38.1928 30.3486L31.3738 23.6318L18.8023 18.8018L23.6321 31.373L31.5088 39.2168C29.6598 41.956 27.8969 44.3679 26.4658 46.5L6.25538 31.415L0 0L31.4159 6.25488Z" fill="url(#paint1_linear_2491_156)" fillOpacity=".15" {...selectedScope} /><path d="M0.0442112 84.296C0.196463 87.9458 2.17893 90.0578 5.73636 89.999L11.5219 86.2761C11.2939 85.4418 10.8005 84.5133 10.1432 83.5928L21.4089 75.5936C25.3242 78.7986 29.7621 81.4804 34.7236 83.6372L39.7145 78.637C35.2785 76.5136 31.2887 73.9976 27.7102 71.1192L83.6252 31.4152L89.8681 0.000221252L58.514 6.25527L18.8768 62.2932C15.8491 58.5441 13.2548 54.4131 11.0616 49.9289L6.07113 54.9297C8.28968 60.0534 11.0665 64.6178 14.3965 68.628L6.43634 79.8815C5.52979 79.2331 4.6065 78.7398 3.75934 78.4988L0.0442112 84.296ZM21.6454 65.4836L58.5557 23.6318L71.1024 18.8021L66.282 31.3732L24.5137 68.3537C23.5245 67.4309 22.5678 66.4734 21.6454 65.4836Z" fill="url(#paint2_linear_2491_156)" fillOpacity=".15" {...selectedScope} /><defs {...selectedScope}>{[0, 1, 2].map((index) => <linearGradient id={`paint${index}_linear_2491_156`} x1="45" y1="0" x2="45" y2="90.0002" gradientUnits="userSpaceOnUse" key={index} {...selectedScope}><stop {...selectedScope} /><stop offset="1" stopOpacity=".15" {...selectedScope} /></linearGradient>)}</defs></svg>
}

function UpgraderHeader({ onFairness }) {
  return <div className="upgrader-header" {...headerScope}><div className="upgrader-header-left" {...headerScope}><SiteIcon name="upgrader" {...headerScope} /> Upgrader</div><div className="upgrader-header-center" {...headerScope}><img src="/Footer/logo.ee8858f3.png" alt="logo" {...headerScope} /></div><div className="upgrader-header-right" role="button" tabIndex="0" onClick={onFairness} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onFairness() }} {...headerScope}><SiteIcon name="fairness" {...headerScope} /> Fairness</div></div>
}

function UpgraderControls({ amount, setAmount, selected, balance, currency, busy, onPlay, onFairness }) {
  const wager = numberValue(amount)
  const target = itemValue(selected, currency)
  const multiplier = wager > 0 && target > 0 ? target / wager : 0
  const commitAmount = (value) => setAmount(formatAmount(clamp(Math.floor(value || MIN_BET), MIN_BET, MAX_BET)))
  const amountAction = (action) => {
    if (action === 'half') commitAmount(wager / 2)
    else if (action === 'double') commitAmount(wager * 2)
    else commitAmount(Math.min(MAX_BET, balance))
  }
  const commitMultiplier = (input) => {
    const next = Number(input.value)
    if (target && Number.isFinite(next) && next > 0) commitAmount(target / next)
    else input.value = multiplier ? multiplier.toFixed(2) : '0.00'
  }
  const preset = (percent) => selected && commitAmount(target * percent)

  const displayedMultiplier = multiplier ? (multiplier % 1 === 0 ? String(multiplier) : multiplier.toFixed(2)) : ''
  return <div className="upgrader-controls" {...controlsScope}><div className="bet-amount-section" {...controlsScope}><div className="section-title" {...controlsScope}>Bet Amount</div><div className="bet-amount-selector" {...controlsScope}><img className="bet-icon" src={currencyIcon(currency)} alt="Bet" {...controlsScope} /><input className="bet-amount-display" type="text" inputMode="numeric" placeholder="0" value={amount} onFocus={() => setAmount(String(amount).replace(/,/g, ''))} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ''))} onBlur={() => commitAmount(wager)} {...controlsScope} /><div className="bet-actions" {...controlsScope}><button type="button" onClick={() => amountAction('half')} {...controlsScope}>1/2</button><button type="button" onClick={() => amountAction('double')} {...controlsScope}>2x</button><button type="button" onClick={() => amountAction('max')} {...controlsScope}>Max</button></div></div></div><div className="multiplier-section" {...controlsScope}><div className="section-title" {...controlsScope}>Multiplier</div><div className="multiplier-input-row" {...controlsScope}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...controlsScope}><path d="M5 5 15 15M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...controlsScope} /></svg><input className="multiplier-input" type="text" inputMode="decimal" placeholder="0" key={`${selected?.id || 'none'}-${multiplier.toFixed(4)}`} defaultValue={displayedMultiplier} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/[^0-9.]/g, '') }} onBlur={(event) => commitMultiplier(event.currentTarget)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} {...controlsScope} /></div><div className="multiplier-buttons" {...controlsScope}>{[10, 25, 50, 80].map((percent) => <button className={`mult-btn${selected && Math.abs(wager - target * percent / 100) < 1 ? ' active' : ''}`} type="button" onClick={() => preset(percent / 100)} key={percent} {...controlsScope}>{percent}%</button>)}</div></div><div className="play-button-section" {...controlsScope}><button className="button-action button-play" type="button" disabled={busy} onClick={onPlay} {...controlsScope}>{busy ? <span className="upgrader-button-loading" aria-label="Starting game" {...controlsScope}><i {...controlsScope} /><i {...controlsScope} /><i {...controlsScope} /></span> : <span {...controlsScope}>Start Game</span>}</button></div><div className="fairness-section" {...controlsScope}><button className="button-fairness" type="button" onClick={onFairness} {...controlsScope}><SiteIcon name="fairness" {...controlsScope} /> Fairness</button></div></div>
}

function ResultGraphic({ won }) {
  const wonPath = 'M5.36404.119978H7.15204L4.47604 5.92798V8.92798H2.68804V5.98798L.0000368655.119978H1.80004L3.57604 4.36798 5.36404.119978ZM12.8234 9.04798H9.88344C8.63544 9.04798 8.16744 8.24398 8.16744 7.33198V1.71598C8.16744.803978 8.67144-.0000216961 9.88344-.0000216961H12.8234C13.8194-.0000216961 14.5514.611978 14.5514 1.71598V7.33198C14.5514 8.49598 13.8074 9.04798 12.8234 9.04798ZM10.2914 7.34398H12.4274C12.6434 7.34398 12.7634 7.21198 12.7634 6.99598V2.06398C12.7634 1.83598 12.6434 1.70398 12.4274 1.70398H10.2914C10.0754 1.70398 9.95544 1.84798 9.95544 2.06398V6.99598C9.95544 7.21198 10.0754 7.34398 10.2914 7.34398ZM21.2677 9.04798H18.4597C17.4517 9.04798 16.7437 8.32798 16.7437 7.33198V.119978H18.5317V6.99598C18.5317 7.21198 18.6517 7.34398 18.8797 7.34398H20.8597C21.0877 7.34398 21.2077 7.21198 21.2077 6.99598V.119978H22.9957V7.33198C22.9957 8.24398 22.3237 9.04798 21.2677 9.04798ZM35.7027 5.56798 36.9267.119978H38.6787L36.5187 8.92798H34.8387L33.4227 3.02398 32.0067 8.92798H30.2427L28.0947.119978H29.8347L31.1067 5.73598 32.5587.119978H34.2747L35.7027 5.56798ZM44.6033 9.04798H41.6633C40.4153 9.04798 39.9473 8.24398 39.9473 7.33198V1.71598C39.9473.803978 40.4513-.0000216961 41.6633-.0000216961H44.6033C45.5993-.0000216961 46.3313.611978 46.3313 1.71598V7.33198C46.3313 8.49598 45.5873 9.04798 44.6033 9.04798ZM42.0713 7.34398H44.2073C44.4233 7.34398 44.5433 7.21198 44.5433 6.99598V2.06398C44.5433 1.83598 44.4233 1.70398 44.2073 1.70398H42.0713C41.8553 1.70398 41.7353 1.84798 41.7353 2.06398V6.99598C41.7353 7.21198 41.8553 7.34398 42.0713 7.34398ZM53.4915 5.85598V.119978H55.2795V8.92798H53.3475L50.3115 3.26398V8.92798H48.5235V.119978H50.4675L53.4915 5.85598ZM59.392 5.93998H57.688V.119978H59.392V5.93998ZM59.488 8.92798H57.616V7.13998H59.488V8.92798Z'
  const lostPath = 'M5.36397.119978H7.15197L4.47597 5.92798V8.92798H2.68797V5.98798L-.0000317991.119978H1.79997L3.57597 4.36798 5.36397.119978ZM12.8234 9.04798H9.88337C8.63537 9.04798 8.16737 8.24398 8.16737 7.33198V1.71598C8.16737.803978 8.67137-.0000216961 9.88337-.0000216961H12.8234C13.8194-.0000216961 14.5514.611978 14.5514 1.71598V7.33198C14.5514 8.49598 13.8074 9.04798 12.8234 9.04798ZM10.2914 7.34398H12.4274C12.6434 7.34398 12.7634 7.21198 12.7634 6.99598V2.06398C12.7634 1.83598 12.6434 1.70398 12.4274 1.70398H10.2914C10.0754 1.70398 9.95537 1.84798 9.95537 2.06398V6.99598C9.95537 7.21198 10.0754 7.34398 10.2914 7.34398ZM21.2676 9.04798H18.4596C17.4516 9.04798 16.7436 8.32798 16.7436 7.33198V.119978H18.5316V6.99598C18.5316 7.21198 18.6516 7.34398 18.8796 7.34398H20.8596C21.0876 7.34398 21.2076 7.21198 21.2076 6.99598V.119978H22.9956V7.33198C22.9956 8.24398 22.3236 9.04798 21.2676 9.04798ZM34.4306 8.92798H29.0066V.131978H30.7946V7.22398H34.4306V8.92798ZM40.3493 9.04798H37.4093C36.1613 9.04798 35.6933 8.24398 35.6933 7.33198V1.71598C35.6933.803978 36.1973-.0000216961 37.4093-.0000216961H40.3493C41.3453-.0000216961 42.0773.611978 42.0773 1.71598V7.33198C42.0773 8.49598 41.3333 9.04798 40.3493 9.04798ZM37.8173 7.34398H39.9533C40.1693 7.34398 40.2893 7.21198 40.2893 6.99598V2.06398C40.2893 1.83598 40.1693 1.70398 39.9533 1.70398H37.8173C37.6013 1.70398 37.4813 1.84798 37.4813 2.06398V6.99598C37.4813 7.21198 37.6013 7.34398 37.8173 7.34398ZM48.6616 9.04798H45.9136C44.9176 9.04798 44.2096 8.33998 44.2096 7.33198V6.20398H45.9856V6.97198C45.9856 7.19998 46.0936 7.34398 46.3696 7.34398H48.2536C48.4696 7.34398 48.5896 7.21198 48.5896 6.99598V5.98798C48.5896 5.77198 48.4816 5.61598 48.1576 5.53198L45.4096 4.91998C44.6896 4.75198 44.1976 4.22398 44.1976 3.37198V1.71598C44.1976.683978 44.8816-.0000216961 45.9136-.0000216961H48.5056C49.5376-.0000216961 50.2336.719978 50.2336 1.71598V2.75998H48.4456V2.06398C48.4456 1.87198 48.3376 1.70398 48.1096 1.70398H46.3216C46.1056 1.70398 45.9856 1.84798 45.9856 2.06398V2.96398C45.9856 3.19198 46.0936 3.38398 46.3696 3.44398L48.6256 3.91198C49.5496 4.11598 50.3776 4.48798 50.3776 5.66398V7.33198C50.3776 8.33998 49.6696 9.04798 48.6616 9.04798ZM51.51.119978H57.834V1.82398H55.554V8.92798H53.778V1.82398H51.51V.119978ZM61.0175 5.93998H59.3135V.119978H61.0175V5.93998ZM61.1135 8.92798H59.2415V7.13998H61.1135V8.92798Z'
  return <svg className="result-icon" viewBox={won ? '0 0 60 10' : '0 0 62 10'} role="img" aria-label={won ? 'You won' : 'You lost'} {...gameScope}><path d={won ? wonPath : lostPath} fill={won ? '#7DFFA4' : '#FF6A7D'} {...gameScope} /></svg>
}

function UpgraderGame({ mode, setMode, rangeStart, setRangeStart, threshold, result, phase, busy, ringRotation, ringRef }) {
  const spinnerRef = useRef(null)
  const draggingRef = useRef(false)
  const arc = threshold / 1000
  const primaryLength = Math.min(arc, (100000 - rangeStart) / 1000)
  const wrapLength = Math.max(0, arc - primaryLength)
  const primaryOffset = 100 - rangeStart / 1000
  const ticketsEnd = normalizeTicket(rangeStart + threshold)
  const chance = threshold / 1000
  const rangeText = threshold ? `${formatAmount(rangeStart)} - ${formatAmount(ticketsEnd)}` : '0 - 100,000'

  const updateFromPointer = useCallback((clientX, clientY) => {
    const rect = spinnerRef.current?.getBoundingClientRect()
    if (!rect) return
    const degrees = (Math.atan2(clientY - rect.top - rect.height / 2, clientX - rect.left - rect.width / 2) * 180 / Math.PI + 450) % 360
    setRangeStart(normalizeTicket(degrees / 360 * 100000))
  }, [setRangeStart])
  const pointerDown = (event) => {
    if (busy || result) return
    draggingRef.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    updateFromPointer(event.clientX, event.clientY)
  }
  const pointerMove = (event) => draggingRef.current && updateFromPointer(event.clientX, event.clientY)
  const pointerUp = () => { draggingRef.current = false }

  return <div className="upgrader-game" {...gameScope}><div className="game-mid" {...gameScope}><div ref={spinnerRef} className={`mid-spinner${phase === 'settling' ? ' settling' : ''}${result && phase === 'result' ? result.won ? ' result-win' : ' result-loss' : ''}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} {...gameScope}><div className="spinner-arrow" aria-hidden="true" {...gameScope}><svg viewBox="0 0 512 512" height="1em" width="1em" fill="currentColor" aria-hidden="true" {...gameScope}><path d="m98 190.06 139.78 163.12a24 24 0 0 0 36.44 0L414 190.06c13.34-15.57 2.28-39.62-18.22-39.62h-279.6c-20.5 0-31.56 24.05-18.18 39.62z" {...gameScope} /></svg></div><div className="spinner-graph" {...gameScope}><div ref={ringRef} className="spinner-ring" style={{ transform: `rotate(${ringRotation}deg)` }} {...gameScope}><svg viewBox="0 0 32.75 32.75" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" {...gameScope}><circle cx="16.365" cy="16.365" r="15.91549430918954" stroke="#8EC4FF" strokeDasharray={`${primaryLength} ${100 - primaryLength}`} strokeDashoffset={primaryOffset} {...gameScope} />{wrapLength > 0 && <circle cx="16.365" cy="16.365" r="15.91549430918954" stroke="#8EC4FF" strokeDasharray={`${wrapLength} ${100 - wrapLength}`} strokeDashoffset="100" {...gameScope} />}</svg></div></div><div className="spinner-inner" {...gameScope}><div className="inner-chance-block" style={{ opacity: phase === 'result' ? 0 : 1, transform: phase === 'result' ? 'translateY(-70px)' : 'translateY(0)', transition: phase === 'result' ? 'opacity .3s ease, transform .3s ease' : 'opacity .4s ease .12s, transform .4s cubic-bezier(.34,1.56,.64,1) .12s' }} {...gameScope}><span className="inner-label" {...gameScope}>Chance</span><div className="inner-chance" {...gameScope}>{chance.toFixed(2)}<span {...gameScope}>%</span></div><div className="inner-tickets" {...gameScope}>{rangeText}</div></div><div className="inner-result-block" style={{ opacity: phase === 'result' ? 1 : 0, transform: phase === 'result' ? 'translateY(0)' : 'translateY(70px)', transition: phase === 'result' ? 'opacity .4s ease .12s, transform .4s cubic-bezier(.34,1.56,.64,1) .12s' : 'opacity .3s ease, transform .3s ease' }} {...gameScope}>{result && <><ResultGraphic won={result.won} /><div className="inner-tickets inner-result-tickets" {...gameScope}>{formatAmount(result.outcome)}</div></>}</div></div></div></div><div className="game-mode-buttons" {...gameScope}><button className={`mode-btn${mode === 'under' ? ' active' : ''}`} type="button" disabled={busy} onClick={() => setMode('under')} {...gameScope}>Under</button><button className={`mode-btn${mode === 'over' ? ' active' : ''}`} type="button" disabled={busy} onClick={() => setMode('over')} {...gameScope}>Over</button></div></div>
}

function SelectedItem({ item, busy, currency, onClear }) {
  const tier = item ? itemTier(item, currency) : 'default'
  const [imageItem, setImageItem] = useState(item)
  const [infoItem, setInfoItem] = useState(item)
  const imageRef = useRef(null)
  const infoRef = useRef(null)
  const imageId = item?.id || 'empty'
  const displayedImageId = imageItem?.id || 'empty'
  const displayedInfoId = infoItem?.id || 'empty'

  useEffect(() => {
    if (imageId === displayedImageId) return undefined
    let cancelled = false
    const outgoing = imageRef.current
    const swap = async () => {
      if (outgoing) await outgoing.animate([{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(-10px) scale(.9)' }], { duration: 250, easing: 'cubic-bezier(.55,.085,.68,.53)', fill: 'forwards' }).finished.catch(() => {})
      if (cancelled) return
      setImageItem(item)
      requestAnimationFrame(() => imageRef.current?.animate([{ opacity: 0, transform: 'translateY(12px) scale(.85)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 350, easing: 'cubic-bezier(.175,.885,.32,1.275)' }))
    }
    swap()
    return () => { cancelled = true; outgoing?.getAnimations().forEach((animation) => animation.cancel()) }
  }, [displayedImageId, imageId, item])

  useEffect(() => {
    if (imageId === displayedInfoId) return undefined
    let cancelled = false
    const outgoing = infoRef.current
    const swap = async () => {
      if (outgoing) await outgoing.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 220, easing: 'cubic-bezier(.55,.085,.68,.53)', fill: 'forwards' }).finished.catch(() => {})
      if (cancelled) return
      setInfoItem(item)
      requestAnimationFrame(() => infoRef.current?.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300, easing: 'cubic-bezier(.25,.46,.45,.94)' }))
    }
    swap()
    return () => { cancelled = true; outgoing?.getAnimations().forEach((animation) => animation.cancel()) }
  }, [displayedInfoId, imageId, item])

  return <div className={`upgrader-item-upgrader element-${tier}${item && !busy ? ' clickable-deselect' : ''}${busy ? ' game-in-progress' : ''}`} onClick={() => item && !busy && onClear()} {...selectedScope} {...pageScope}><div className="items-title" {...selectedScope}>{item ? 'Selected Item' : 'Select an item to upgrade'}</div><div className="items-image" {...selectedScope}><div ref={imageRef} className="items-image-inner" {...selectedScope}>{imageItem ? <img src={imageItem.image} alt="" {...selectedScope} /> : <EmptyItemIcon />}</div></div><div ref={infoRef} className={`items-info${infoItem ? '' : ' items-info-empty'}`} {...selectedScope}>{infoItem ? <><div className="items-info-name" {...selectedScope}>{infoItem.name}</div><div className="items-info-price" {...selectedScope}><img src={currencyIcon(currency)} alt="" {...selectedScope} />{formatAmount(itemValue(infoItem, currency))}</div></> : 'Click an item below to start'}</div></div>
}

function Dropdown({ type, open, setOpen, label, value, options, onSelect }) {
  const scope = type === 'amount' ? amountScope : sortScope
  const rootRef = useRef(null)
  const closeTimer = useRef(null)
  const [closing, setClosing] = useState(false)
  const close = useCallback(() => {
    if (!open || closing) return
    setClosing(true)
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => { setOpen(false); setClosing(false) }, 200)
  }, [closing, open, setOpen])
  useEffect(() => {
    if (!open) return undefined
    const outside = (event) => { if (!rootRef.current?.contains(event.target)) close() }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [close, open])
  useEffect(() => () => window.clearTimeout(closeTimer.current), [])
  const toggle = () => { if (open) close(); else { setClosing(false); setOpen(true) } }
  return <div ref={rootRef} className={`upgrader-filter-${type}${open ? ` ${type}-open` : ''}`} {...scope}><button className="button-toggle" type="button" aria-expanded={open} onClick={toggle} {...scope}><div className="button-inner" {...scope}><div className="inner-value" {...scope}>{label}: <span {...scope}>{value}</span></div><Chevron scope={scope} /></div></button>{open && <div className={`${type}-menu ${closing ? 'upgrader-dropdown-out' : 'upgrader-dropdown-in'}`} {...scope}><div className="menu-inner" {...scope}>{options.map((option) => <button type="button" onClick={() => { onSelect(option); close() }} key={option.label || option} {...scope}>{option.label || option}</button>)}</div></div>}</div>
}

const ItemCard = memo(function ItemCard({ item, selected, disabled, currency, onSelect }) {
  const tier = itemTier(item, currency)
  const activate = () => { if (!disabled) onSelect(item) }
  return <div className={`upgrader-item-element element-${tier}${selected ? ' element-selected' : ''}${disabled ? ' is-disabled' : ''}`} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} onClick={activate} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') activate() }} {...itemScope}><div className={`inner-selected-icon${selected ? ' is-visible' : ''}`} {...itemScope}><SelectedCheck /></div><div className="inner-vector-container" {...itemScope}><Pattern /></div><div className="inner-image" {...itemScope}><div className={`inner-glow element-${tier}`} {...itemScope} /><img src={item.image} alt={item.name} loading="lazy" decoding="async" {...itemScope} /></div><div className="inner-info" {...itemScope}><div className="inner-name" title={item.name} {...itemScope}>{item.name}</div><div className="inner-price" {...itemScope}><img src={currencyIcon(currency)} alt={currency === 'rocoins' ? 'RoCoins' : 'Coins'} {...itemScope} /><div className="price-value" {...itemScope}>{formatAmount(itemValue(item, currency))}</div></div></div></div>
})

const UpgraderItems = memo(function UpgraderItems({ selected, onSelect, disabled, currency }) {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [range, setRange] = useState(amountRanges[0])
  const [sort, setSort] = useState('Highest')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [amountOpen, setAmountOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  useEffect(() => { const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1) }, 350); return () => window.clearTimeout(timer) }, [search])
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), sort: sort.toLowerCase(), currency })
    if (query) params.set('search', query)
    if (range.minimum != null) params.set('amountMin', String(range.minimum))
    if (range.maximum != null) params.set('amountMax', String(range.maximum))
    queueMicrotask(() => { if (!controller.signal.aborted) setLoading(true) })
    fetch(`/api/upgrader/items?${params}`, { signal: controller.signal }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); return payload }).then((payload) => { setItems(payload.items || []); setTotalPages(Math.max(1, Number(payload.totalPages) || 1)) }).catch((error) => { if (error.name !== 'AbortError') notify({ type: 'error', message: error.message || 'Unable to load items.' }) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [currency, page, query, range, sort])

  return <div className="upgrader-items" {...itemsScope}><div className="items-header" {...itemsScope}><div className="upgrader-filter-search" {...searchScope}><SiteIcon name="search" className="icon-search" {...searchScope} /><input type="text" placeholder="Search for an item..." value={search} onChange={(event) => setSearch(event.target.value)} {...searchScope} /></div><div className="header-filters" {...itemsScope}><Dropdown type="amount" open={amountOpen} setOpen={(open) => { setAmountOpen(open); if (open) setSortOpen(false) }} label="Price Range" value={range.label} options={amountRanges} onSelect={(next) => { setRange(next); setPage(1) }} /><Dropdown type="sort" open={sortOpen} setOpen={(open) => { setSortOpen(open); if (open) setAmountOpen(false) }} label="Sort By" value={sort} options={['Lowest', 'Highest']} onSelect={(next) => { setSort(next); setPage(1) }} /></div></div><div className="items-content" {...itemsScope}>{loading ? <div className="content-loading" {...itemsScope}><div className="content-loading-spinner" {...itemsScope} /><div className="content-loading-text" {...itemsScope}>Loading Items...</div></div> : items.length ? <div className="content-list-wrap" {...itemsScope}><div className={`content-list${disabled ? ' cursor-disabled' : ''}`} {...itemsScope}>{items.map((item) => <ItemCard item={item} selected={selected?.id === item.id} disabled={disabled} currency={currency} onSelect={onSelect} key={item.id} />)}</div>{totalPages > 1 && <div className="content-pagination" {...itemsScope}><button className="pagination-btn" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} {...itemsScope}><Chevron direction="left" scope={itemsScope} /></button><div className="pagination-info" {...itemsScope}>Page {page} of {totalPages}</div><button className="pagination-btn" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} {...itemsScope}><Chevron direction="right" scope={itemsScope} /></button></div>}</div> : <div className="content-empty" {...itemsScope}>No items found.</div>}</div></div>
})

function Upgrader({ user }) {
  const [amount, setAmount] = useState('0')
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('under')
  const [rangeStart, setRangeStartState] = useState(0)
  const [phase, setPhase] = useState('idle')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [ringRotation, setRingRotation] = useState(-90)
  const [showFairness, setShowFairness] = useState(false)
  const [currency, setCurrency] = useState(() => window.localStorage.getItem('currency') === 'coins' ? 'coins' : 'rocoins')
  const timers = useRef([])
  const ringRef = useRef(null)
  const wager = numberValue(amount)
  const target = itemValue(selected, currency)
  const multiplierBps = wager > 0 && target > 0 ? Math.floor(target / wager * 100) : 0
  const threshold = multiplierBps >= 101 && multiplierBps <= 10000 ? clamp(Math.floor(9000000 / multiplierBps), 1, 99000) : 0
  const balance = Number(user?.[currency]) || 0

  const setRangeStart = useCallback((value) => setRangeStartState(normalizeTicket(value)), [])
  useEffect(() => { document.title = 'Upgrader - RoRisk.com'; const activeTimers = timers.current; return () => activeTimers.forEach(window.clearTimeout) }, [])
  useEffect(() => { const update = (event) => setCurrency(event.detail?.currency === 'coins' ? 'coins' : 'rocoins'); window.addEventListener('rorisk:currency-change', update); return () => window.removeEventListener('rorisk:currency-change', update) }, [])

  const openFairness = () => user ? setShowFairness(true) : notify({ type: 'error', message: 'Please sign in to perform this action.' })
  const selectItem = useCallback((item) => {
    if (busy) return
    if (!item || selected?.id === item.id) { setSelected(null); return }
    setSelected(item)
    setAmount(formatAmount(clamp(itemValue(item, currency) * .1, MIN_BET, MAX_BET)))
  }, [busy, currency, selected?.id])
  const schedule = (callback, delay) => { const timer = window.setTimeout(callback, delay); timers.current.push(timer); return timer }
  const play = async () => {
    if (!user) return notify({ type: 'error', message: 'Please sign in to perform this action.' })
    if (!selected) return notify({ type: 'error', message: 'Select an item to upgrade.' })
    if (!Number.isFinite(wager) || wager <= 0) return notify({ type: 'error', message: 'Enter a valid bet amount.' })
    if (wager < MIN_BET) return notify({ type: 'error', message: 'You can only bet a min amount of 50 Coins per game.' })
    if (wager > MAX_BET) return notify({ type: 'error', message: 'You can only bet a max amount of 500,000 Coins per game.' })
    if (multiplierBps < 101 || multiplierBps > 10000) return notify({ type: 'error', message: 'Payout must be 1.01x – 100x your bet. Bet more or pick a lower-value item.' })
    if (wager > balance) return notify({ type: 'error', message: 'Insufficient balance.' })
    timers.current.forEach(window.clearTimeout)
    timers.current = []
    setBusy(true)
    setPhase('settling')
    setResult(null)
    setRingRotation(-90)
    window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: { ...user, [currency]: balance - wager } } }))
    try {
      const response = await fetch('/api/upgrader/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Math.floor(wager), currency, targetAssetId: selected.assetId, mode, rangeStart, clientSeed: getFairClientSeed(user) }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to start this game.')
      incrementFairNonce(user, 1)
      const game = payload.game
      const outcomeDegrees = Number(game.outcome) / 100000 * 360
      const destination = mode === 'under' ? -90 - outcomeDegrees + 630 + 1080 + 90 : -90 - outcomeDegrees - 1440
      if (ringRef.current) ringRef.current.style.transform = 'rotate(-90deg)'
      const animation = ringRef.current?.animate([{ transform: 'rotate(-90deg)' }, { transform: `rotate(${destination}deg)` }], { duration: SETTLE_MS, easing: 'cubic-bezier(.25,.46,.45,.94)', fill: 'forwards' })
      await animation?.finished
      setRingRotation(destination)
      setResult(game)
      setPhase('result')
      setBusy(false)
      window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user: payload.user } }))
      if (game.won) playSound('cash')
      schedule(() => {
        setPhase('resetting')
        const normalized = ((destination + 90) % 360 + 360) % 360 - 90
        setRingRotation(normalized)
        requestAnimationFrame(() => {
          const reset = ringRef.current?.animate([{ transform: `rotate(${normalized}deg)` }, { transform: 'rotate(-90deg)' }], { duration: RESET_MS, easing: 'cubic-bezier(.25,.46,.45,.94)', fill: 'forwards' })
          reset?.finished.then(() => { setRingRotation(-90); setResult(null); setPhase('idle') }).catch(() => setPhase('idle'))
        })
      }, RESULT_HOLD_MS)
    } catch (error) {
      window.dispatchEvent(new CustomEvent('rorisk:user-update', { detail: { user } }))
      setRingRotation(-90)
      setPhase('idle')
      setBusy(false)
      notify({ type: 'error', message: error.message || 'Unable to start this game.' })
    }
  }

  const changeMode = useCallback((nextMode) => {
    setMode(nextMode)
    setRangeStart(nextMode === 'over' ? 100000 - threshold : 0)
  }, [setRangeStart, threshold])
  return <div className="upgrader" {...pageScope}><UpgraderHeader onFairness={openFairness} /><div className="upgrader-container" {...pageScope}><UpgraderControls amount={amount} setAmount={setAmount} selected={selected} balance={user ? balance : MAX_BET} currency={currency} busy={busy} onPlay={play} onFairness={openFairness} /><UpgraderGame mode={mode} setMode={changeMode} rangeStart={rangeStart} setRangeStart={setRangeStart} threshold={threshold} result={result} phase={phase} busy={busy} ringRotation={ringRotation} ringRef={ringRef} /><SelectedItem item={selected} busy={busy} currency={currency} onClear={() => setSelected(null)} /></div><UpgraderItems selected={selected} onSelect={selectItem} disabled={busy} currency={currency} />{showFairness && <ModalAnimation label="Seed Fairness" onClose={() => setShowFairness(false)}><FairSeedModal user={user} /></ModalAnimation>}</div>
}

export default Upgrader
