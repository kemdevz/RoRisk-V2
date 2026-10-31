import { useRef, useState } from 'react'
import ModalAnimation from './ModalAnimation'

const scope = { 'data-v-37983f93': '' }
const rewardsAsset = (name) => `/assets/rewards/current/${name}`
const bonusAsset = (name) => `/assets/bonus-cases/${name}`

const sideCases = [
  ['is-far-left', 'chest-purple.4ca82826.png'],
  ['is-left', 'chest-green.7d23f200.png'],
  ['is-right', 'chest-blue.63ec7c71.png'],
  ['is-far-right', 'chest-gold.097ca2e4.png'],
]

function Sparkle({ index }) {
  return (
    <svg className={`bonus-cases-sparkle is-${index}`} viewBox="0 0 24 24" aria-hidden="true" {...scope}>
      <path d="M12 0C12.6 7 17 11.4 24 12C17 12.6 12.6 17 12 24C11.4 17 7 12.6 0 12C7 11.4 11.4 7 12 0Z" {...scope} />
    </svg>
  )
}

function BonusCases({ onClose, onRegister }) {
  const [closing, setClosing] = useState(false)
  const registerAfterClose = useRef(false)

  const finishClose = () => {
    onClose?.()
    if (registerAfterClose.current) onRegister?.()
  }

  const openCases = () => {
    registerAfterClose.current = true
    setClosing(true)
  }

  return (
    <ModalAnimation label="RoRisk Bonus Cases" closeRequest={closing} onClose={finishClose}>
      <div className="modal-bonus-cases" {...scope}>
        <h1 className="bonus-cases-title" {...scope}>
          <span {...scope}>RoRisk Bonus</span>
          <span className="bonus-cases-title-big" {...scope}>Cases!</span>
        </h1>
        <p className="bonus-cases-subtitle" {...scope}>
          The #1 Roblox case unboxing site<br {...scope} />with the best rewards!
        </p>
        <div className="bonus-cases-claim" {...scope}>
          <span className="bonus-cases-claim-text" {...scope}>Claim 4 Free Cases</span>
          <span className="bonus-cases-badge" {...scope}>Limited offer!</span>
        </div>
        <div className="bonus-cases-stage" aria-hidden="true" {...scope}>
          {[1, 2, 3, 4, 5].map((index) => <Sparkle index={index} key={index} />)}
          {sideCases.map(([className, assetName]) => (
            <img className={`bonus-cases-side ${className}`} src={bonusAsset(assetName)} alt="" key={className} {...scope} />
          ))}
          <video className="bonus-cases-main" src={bonusAsset('case.cbe7ca78.webm')} autoPlay loop muted playsInline aria-hidden="true" {...scope} />
        </div>
        <button className="bonus-cases-button" type="button" onClick={openCases} {...scope}>
          <img src={rewardsAsset('open-case.f85c68d7.svg')} alt="" {...scope} />
          Open Case
        </button>
      </div>
    </ModalAnimation>
  )
}

export default BonusCases
