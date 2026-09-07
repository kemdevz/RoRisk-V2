import { useEffect, useState } from 'react'

const pageScope = { 'data-v-0e940f3a': '' }
const podiumScope = { 'data-v-59edd702': '' }
const statsScope = { 'data-v-5c5c2a36': '' }
const rowScope = { 'data-v-04f03a4f': '' }
const timerScope = { 'data-v-233720ce': '' }

const podium = [
  { place: 2, ordinal: 'nd', ribbon: '/Race/place-ribbon-2.87e86a0b.svg' },
  { place: 1, ordinal: 'st', ribbon: '/Race/place-ribbon-1.dd1dfd16.svg' },
  { place: 3, ordinal: 'rd', ribbon: '/Race/place-ribbon-3.4d16accb.svg' },
]

function RaceTimer() {
  const [remaining, setRemaining] = useState((154 * 60 * 60 + 4 * 60 + 22) * 1000)
  useEffect(() => {
    const tick = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1000)), 1000)
    return () => window.clearInterval(tick)
  }, [])
  const total = Math.floor(remaining / 1000)
  const text = `${String(Math.floor(total / 3600)).padStart(3, '0')}:${String(Math.floor(total % 3600 / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  return <div className="race-timer is-compact" {...timerScope}><div className="timer-inline" {...timerScope}>{text.split('').map((value, index) => value === ':' ? <span className="inline-colon" key={index} {...timerScope}>:</span> : <span className="inline-digit" key={index} {...timerScope}><span className="flip-number" {...timerScope}>{value}</span></span>)}</div></div>
}

function Race() {
  return <div className="race" {...pageScope}>
    <div className="race-hero-image" {...pageScope}><img src="/Race/race.87859592.png" alt="Weekly Race" {...pageScope} /><div className="race-hero-overlay" {...pageScope}><div className="hero-copy" {...pageScope}><div className="hero-title" data-text="weekly race" {...pageScope}>weekly race</div><div className="hero-prize" {...pageScope}><span className="hero-coin" {...pageScope}><img className="hero-coin-white" src="/Race/hero-prize-coin.f9dc7e4f.svg" alt="" {...pageScope} /><img className="hero-coin-fill" src="/Race/hero-prize-coin.f9dc7e4f.svg" alt="" {...pageScope} /></span><div className="hero-amount" data-text="500,000" {...pageScope}>500,000</div></div></div><RaceTimer /></div></div>
    <div className="race-stats" {...statsScope}><div className="race-stats-title" {...statsScope}>Your stats</div><div className="race-stats-side" {...statsScope}><div className="stats-chip stats-chip--place" {...statsScope}><span className="stats-chip-label" {...statsScope}>Your Place:</span><span className="stats-chip-value" {...statsScope}><span className="stats-chip-icon stats-chip-icon--medal" {...statsScope}><img src="/Race/race-medal.9794a12f.svg" alt="" {...statsScope} /></span>--</span></div><div className="stats-chip stats-chip--points" {...statsScope}><span className="stats-chip-label" {...statsScope}>Points:</span><span className="stats-chip-value" {...statsScope}><span className="stats-chip-icon stats-chip-icon--points" {...statsScope}><img src="/Race/points.6eb375c8.svg" alt="" {...statsScope} /></span>0</span></div></div><div className="race-stats-side race-stats-side--right" {...statsScope}><div className="stats-chip stats-chip--won" {...statsScope}><span className="stats-chip-label" {...statsScope}>won:</span><span className="stats-chip-icon stats-chip-icon--flag" {...statsScope}><img src="/Race/race-flag-won.4c0e8144.svg" alt="" {...statsScope} /></span><span className="stats-chip-value stats-chip-value--won" {...statsScope}>0</span></div><button className="stats-claim" type="button" disabled {...statsScope}>Claim Rewards</button></div></div>
    <div className="race-special-ranks" {...podiumScope}>{podium.map((rank) => <div className={`race-special-rank rank-${rank.place}`} key={rank.place} {...podiumScope}><div className="rank-card" {...podiumScope}><div className="rank-card-bg" aria-hidden="true" {...podiumScope}><div className="rank-card-base" {...podiumScope} /><img className="rank-card-scene rank-card-scene--blend" src="/Race/race-card-pattern.99d1addb.png" alt="" {...podiumScope} /><img className="rank-card-scene" src="/Race/race-card-pattern.99d1addb.png" alt="" {...podiumScope} /><div className="rank-card-glow" {...podiumScope} /><div className="rank-flag" {...podiumScope}><img className="rank-flag-img" src="/Race/race-flag.0ad9c9c0.png" alt="" {...podiumScope} /><img className="rank-flag-img rank-flag-img--soft" src="/Race/race-flag.0ad9c9c0.png" alt="" {...podiumScope} /></div></div><div className="race-special-rank-user" {...podiumScope}><div className="user-avatar" {...podiumScope}><img src="/default-avatar.png" alt="" {...podiumScope} /></div><span className="user-username" {...podiumScope}>--</span></div><div className="points-pill" {...podiumScope}><span className="points-label" {...podiumScope}>points:</span><span className="points-value" {...podiumScope}><span className="points-icon" {...podiumScope}><img src="/Race/points.6eb375c8.svg" alt="" {...podiumScope} /></span><span className="points-amount" {...podiumScope}>0</span></span></div><div className="rank-divider" {...podiumScope} /><div className="race-special-rank-prize" {...podiumScope}><div className="prize-button" {...podiumScope}><span className="prize-coin" {...podiumScope}><img src="/Race/prize-coin.4c029a97.svg" alt="" {...podiumScope} /></span><span className="prize-amount" {...podiumScope}>0</span></div></div></div><div className="rank-badge" {...podiumScope}><img className="rank-badge-ribbon" src={rank.ribbon} alt="" {...podiumScope} /><span className="rank-badge-text" {...podiumScope}><span className="rank-badge-num" {...podiumScope}>{rank.place}</span><span className="rank-badge-ord" {...podiumScope}>{rank.ordinal}&nbsp;</span><span className="rank-badge-place" {...podiumScope}>PLACE</span></span></div></div>)}</div>
    <div className="race-ranks" {...pageScope}><div className="ranks-header" {...rowScope}><div className="rank-pos" {...rowScope}>place</div><div className="rank-user" {...rowScope}>User</div><div className="rank-wagered" {...rowScope}>points</div><div className="rank-prize" {...rowScope}>Prize</div></div><div className="ranks-content" {...pageScope}><div className="content-empty fade-enter-active" {...pageScope}>Currently no active race.</div></div></div>
  </div>
}

export default Race
