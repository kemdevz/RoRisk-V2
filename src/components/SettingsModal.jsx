import { useState } from 'react'
import SiteIcon from './Icons'
import { notify } from '../lib/Notifications'
import { setSoundVolume } from '../lib/Sounds'

const scope = { 'data-v-dd524744': '', 'data-v-0eacb57e': '' }

function DropdownHeader({ children, open, onClick }) {
  return <button className="modal-user-settings-dropdown-header" type="button" aria-expanded={open} onClick={onClick} {...scope}><span {...scope}>{children}</span><SiteIcon name="chevron-down" className={open ? 'rotated' : ''} {...scope} /></button>
}

function SettingsModal({ user, onRequestClose, onConnectRoblox }) {
  const [generalOpen, setGeneralOpen] = useState(true)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [privacyMenu, setPrivacyMenu] = useState(false)
  const [privacy, setPrivacy] = useState(() => Boolean(user?.anonymous ?? user?.privacy_status))
  const [volume, setVolume] = useState(() => Number(window.localStorage.getItem('rorisk_sound_volume') ?? 1))
  const unavailable = (name) => notify({ type: 'error', message: `${name} is currently unavailable.` })
  const changeVolume = (event) => {
    const next = Number(event.target.value)
    setVolume(next)
    setSoundVolume(next)
  }

  return <div className="modal-user-settings" {...scope}>
    <div className="modal-user-settings-content-title" {...scope}>Settings</div>
    <div className="separator" {...scope} />
    <div className="modal-user-settings-dropdown" {...scope}>
      <DropdownHeader open={generalOpen} onClick={() => setGeneralOpen((value) => !value)}>General</DropdownHeader>
      <div className={`modal-user-settings-dropdown-content settings-collapse${generalOpen ? ' settings-collapse-open' : ''}`} {...scope}>
        <div className="sound-effects-container" {...scope}><div className="sound-effects-header" {...scope}><SiteIcon name="sound" {...scope} /><span {...scope}>Sound Effects</span><span className="sound-effects-value" {...scope}>{Math.round(volume * 100)}%</span></div><div className="sound-effects-slider-wrapper" {...scope}><div className="sound-effects-slider-fill" style={{ width: `${volume * 100}%` }} {...scope} /><input className="sound-effects-slider" type="range" min="0" max="1" step="0.01" value={volume} onChange={changeVolume} {...scope} /></div></div>
        <button className="button dropdown-button" type="button" onClick={onConnectRoblox} {...scope}><SiteIcon name="roblox" {...scope} /> Connect Roblox</button>
        <button className="button dropdown-button" type="button" onClick={() => unavailable('Discord connection')} {...scope}><SiteIcon name="discord" {...scope} /> Discord</button>
      </div>
    </div>
    <div className="modal-user-settings-dropdown" {...scope}>
      <DropdownHeader open={securityOpen} onClick={() => setSecurityOpen((value) => !value)}>Security &amp; Privacy</DropdownHeader>
      <div className={`modal-user-settings-dropdown-content settings-collapse${securityOpen ? ' settings-collapse-open' : ''}`} {...scope}>
        <div className="email-button-container" {...scope}><button className="button dropdown-button" type="button" onClick={() => setEmailOpen((value) => !value)} {...scope}><SiteIcon name="email" {...scope} /> Email</button>{emailOpen && <div className="email-display-container settings-slide" {...scope}>{user?.email ? <div className="email-display" {...scope}>{user.email}</div> : <input className="email-input" type="email" autoComplete="email" placeholder="Enter your email address" {...scope} />}<button className="verify-email-button" type="button" disabled={Boolean(user?.email_verified ?? user?.emailVerified)} onClick={() => unavailable('Email verification')} {...scope}>{user?.email ? (user?.email_verified || user?.emailVerified ? 'Email Verified' : 'Verify Email') : 'Save & Verify'}</button></div>}</div>
        <div className="email-button-container" {...scope}><button className="button dropdown-button" type="button" onClick={() => setPrivacyOpen((value) => !value)} {...scope}><SiteIcon name="privacy" {...scope} /> Privacy Status</button>{privacyOpen && <div className="email-display-container settings-slide" {...scope}><div className="privacy-status-select-wrapper" {...scope}><div className="privacy-status-dropdown" {...scope}><button className="privacy-status-dropdown-button" type="button" onClick={() => setPrivacyMenu((value) => !value)} {...scope}><span {...scope}>{privacy ? 'Enabled' : 'Disabled'}</span><SiteIcon name="chevron-down" className={privacyMenu ? 'rotated' : ''} {...scope} /></button>{privacyMenu && <div className="privacy-status-dropdown-menu" {...scope}>{[false, true].map((option) => <button className={`privacy-status-option${privacy === option ? ' active' : ''}`} type="button" key={String(option)} onClick={() => { setPrivacy(option); setPrivacyMenu(false) }} {...scope}>{option ? 'Enabled' : 'Disabled'}</button>)}</div>}</div></div><div className="privacy-status-description" {...scope}>If enabled, your username will be hidden from other users in live feeds, chat, race, and leaderboards.</div><button className="verify-email-button" type="button" onClick={() => unavailable('Privacy status')} {...scope}>Change Status</button></div>}</div>
        <button className="button dropdown-button" type="button" onClick={() => unavailable('Provably Fair settings')} {...scope}><SiteIcon name="fairness" className="icon-fairness" {...scope} /> Provably Fair</button>
      </div>
    </div>
    <button className="button back-button" type="button" onClick={onRequestClose} {...scope}>Back to User Profile</button>
  </div>
}

export default SettingsModal
