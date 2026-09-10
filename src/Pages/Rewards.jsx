import { useEffect, useState } from 'react'
import SiteIcon from '../components/Icons'
import { notify } from '../lib/Notifications'

const pageScope = { 'data-v-34ad1ed0': '' }
const heroScope = { 'data-v-3323c608': '' }
const rakebackScope = { 'data-v-99985b44': '' }
const dailyScope = { 'data-v-3a305c7a': '' }
const faucetScope = { 'data-v-30d11958': '' }
const discordScope = { 'data-v-74315b22': '' }

const welcomeCases = [
  { theme: 'green', image: '/api/case-images/other/rewards-1.png' },
  { theme: 'gold', image: '/api/case-images/other/rewards-2.png' },
  { theme: 'blue', image: '/api/case-images/other/rewards-3.png' },
  { theme: 'rose', image: '/api/case-images/other/rewards-4.png' },
]

const rakebackItems = [
  { type: 'instant', title: 'Instant Rakeback', icon: 'rakeback-instant', enabled: true },
  { type: 'daily', title: 'Daily Rakeback', icon: 'rakeback-daily' },
  { type: 'weekly', title: 'Weekly Rakeback', icon: 'rakeback-weekly' },
  { type: 'monthly', title: 'Monthly Rakeback', icon: 'rakeback-monthly' },
]

const dailyCases = [
  [5, 'silver', '/api/case-images/other/daily-level-5.png'],
  [10, 'blue', '/api/case-images/other/daily-level-10.png'],
  [20, 'violet', '/api/case-images/other/daily-level-20.png'],
  [30, 'rose', '/api/case-images/other/daily-level-30.png'],
  [40, 'green', '/api/case-images/other/daily-level-40.png'],
  [50, 'orange', '/api/case-images/other/daily-level-50.png'],
  [60, 'amber', '/api/case-images/other/daily-level-60.png'],
  [70, 'indigo', '/api/case-images/other/daily-level-70.png'],
  [80, 'cyan', '/api/case-images/other/daily-level-80.png'],
  [90, 'crimson', '/api/case-images/other/daily-level-90.png'],
  [100, 'platinum', '/api/case-images/other/daily-level-100.png'],
]

function RewardsHero({ onSignIn }) {
  const [affiliateCode, setAffiliateCode] = useState('')
  const claimCode = () => {
    if (!affiliateCode.trim()) return notify({ type: 'error', message: 'Your entered referral code is invalid.' })
    onSignIn()
  }

  return (
    <div className="rewards-hero" {...heroScope}>
      <div className="rewards-hero-top" {...heroScope}>
        <p className="rewards-hero-kicker" {...heroScope}>Welcome to</p>
        <img className="rewards-hero-title-img" src="/Rewards/rewards-title.99905d45.png" alt="Rewards" {...heroScope} />
        <h2 className="rewards-hero-sub" {...heroScope}>Welcome Bonus</h2>
        <p className="rewards-hero-desc" {...heroScope}>Enjoy our Welcome Bonus — claim free welcome cases and start winning!</p>
      </div>

      <div className="rewards-hero-panel-shell" {...heroScope}>
        <div className="rewards-hero-panel" {...heroScope}>
          <div className="rewards-hero-panel-bg" aria-hidden="true" {...heroScope}>
            <div className="rewards-hero-panel-bg-base" {...heroScope} />
            <div className="rewards-hero-panel-bg-banner" {...heroScope} />
            <div className="rewards-hero-panel-bg-tint" {...heroScope} />
            <div className="rewards-hero-panel-bg-glow" {...heroScope} />
            <div className="rewards-hero-panel-bg-sheen" {...heroScope} />
          </div>

          <div className="rewards-hero-referral" {...heroScope}>
            <div className="rewards-hero-referral-copy" {...heroScope}>
              <h3 className="rewards-hero-referral-title" {...heroScope}>
                <span>Unbox 4 </span><span className="rewards-hero-accent" {...heroScope}>FREE</span><span> Cases to get started!</span>
              </h3>
              <p className="rewards-hero-referral-sub" {...heroScope}>Use a referral code and deposit $10 to start unboxing.</p>
            </div>
            <div className="rewards-hero-referral-divider" aria-hidden="true" {...heroScope} />
            <div className="rewards-hero-referral-form" {...heroScope}>
              <div className="rewards-hero-input-bar" {...heroScope}>
                <input className="rewards-hero-input" type="text" placeholder="Enter referral code" value={affiliateCode} onChange={(event) => setAffiliateCode(event.target.value)} autoComplete="off" {...heroScope} />
                <div className="rewards-hero-input-right" {...heroScope}>
                  <button className="rewards-hero-claim-btn" type="button" onClick={claimCode} {...heroScope}>Claim Code</button>
                </div>
              </div>
              <p className="rewards-hero-hint" {...heroScope}>Don’t have a code? Enter code <button className="rewards-hero-hint-code" type="button" onClick={() => setAffiliateCode('RISK')} {...heroScope}>&quot;RISK&quot;</button></p>
            </div>
          </div>

          <div className="rewards-hero-cards" {...heroScope}>
            {welcomeCases.map((reward) => (
              <div className={`rewards-hero-card rewards-hero-card--${reward.theme}`} key={reward.theme} role="button" tabIndex="-1" {...heroScope}>
                <div className="rewards-hero-card-visual" {...heroScope}><img src={reward.image} alt="" {...heroScope} /></div>
                <button className="rewards-hero-card-btn rewards-hero-card-btn--disabled" type="button" disabled {...heroScope}>Claim Code First</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function RewardsRakeback({ onProtectedAction }) {
  return (
    <div className="rewards-rakeback" {...rakebackScope}>
      {rakebackItems.map((item) => (
        <div className={`rewards-rakeback-content ${item.type}`} key={item.type} {...rakebackScope}>
          <SiteIcon name={item.icon} {...rakebackScope} />
          <div className="rewards-rakeback-content-title" {...rakebackScope}>{item.title}</div>
          <div className={`rewards-rakeback-content-available ${item.type}`} {...rakebackScope}>
            Available: <img src="/Rewards/coin.12f4bce8.svg" alt="currency" {...rakebackScope} /> <span {...rakebackScope}>0</span>
          </div>
          <button className={`rewards-rakeback-content-button ${item.type}`} type="button" disabled={!item.enabled} onClick={item.enabled ? onProtectedAction : undefined} {...rakebackScope}>Claim Now</button>
        </div>
      ))}
    </div>
  )
}

function RewardsDailyCases() {
  return (
    <div className="rewards-daily-cases" {...dailyScope}>
      <div className="daily-cases-heading" {...dailyScope}>
        <h3 {...dailyScope}>Daily Cases</h3>
        <p {...dailyScope}>Get a free case to unbox every day. Bet more to unlock higher-quality cases.</p>
      </div>
      <div className="daily-cases-grid" {...dailyScope}>
        {dailyCases.map(([level, theme, image]) => (
          <div className={`daily-case-card daily-case-card--${theme} daily-case-card--locked`} key={level} {...dailyScope}>
            <div className="daily-case-image-wrap" {...dailyScope}><img src={image} alt={`Level ${level} case`} {...dailyScope} /></div>
            <div className="daily-case-level" {...dailyScope}>Level {level}</div>
            <div className="daily-case-action daily-case-action--locked" {...dailyScope}>
              <img className="locked-icon" src="/Rewards/locked.8cc650fb.svg" alt="" {...dailyScope} /><span {...dailyScope}>Case locked</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Rewards({ onSignIn }) {
  useEffect(() => {
    document.title = 'Rewards - RoRisk.com'
  }, [])
  const protectedAction = () => notify({ type: 'error', message: 'Please sign in to perform this action.' })

  return (
    <div className="rewards" {...pageScope}>
      <RewardsHero onSignIn={onSignIn} />
      <div className="rewards-seperator" {...pageScope}>
        <div className="rewards-seperator-line left" {...pageScope} />
        <div className="rewards-seperator-line center" {...pageScope} />
        <div className="rewards-seperator-line right" {...pageScope} />
      </div>
      <div className="rewards-content" {...pageScope}>
        <div className="rewards-content-group" {...pageScope}>
          <div className="rewards-discord" onClick={() => window.open('https://discord.gg/rorisk', '_blank', 'noopener,noreferrer')} role="button" tabIndex="0" {...discordScope}>
            <div className="rewards-discord-sparks-overlay" {...discordScope} />
            <img src="/Rewards/discord-vector.71cac381.png" alt="Discord Icon" {...discordScope} />
            <div className="rewards-discord-header" {...discordScope}><span {...discordScope}>Discord Rewards</span><span className="rewards-discord-description" {...discordScope}>Join our Discord server to get the latest news and updates!</span></div>
          </div>
          <div className="rewards-faucet" onClick={protectedAction} role="button" tabIndex="0" {...faucetScope}>
            <div className="rewards-faucet-sparks-overlay" {...faucetScope} />
            <img src="/Rewards/faucet-vector.5c444398.png" alt="Faucet Icon" {...faucetScope} />
            <div className="rewards-faucet-header" {...faucetScope}><span {...faucetScope}>Free Faucet</span><span className="rewards-faucet-description" {...faucetScope}>Are you a high level? Claim free coins every hour!</span></div>
          </div>
        </div>
        <RewardsRakeback onProtectedAction={protectedAction} />
        <RewardsDailyCases />
      </div>
    </div>
  )
}

export default Rewards
