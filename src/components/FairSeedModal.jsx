import { useMemo, useState } from 'react'
import { createFairClientSeed, createFairHash, getFairSeedState, persistFairSeedState } from '../lib/Fairness'
import { copyText, notify } from '../lib/Notifications'

const scope = { 'data-v-3d9a5020': '' }

function CopyIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...scope}><path d="M15.4567 1.6667H7.87683C6.29075 1.6667 5.00008 2.95737 5.00008 4.54345V5.00004H4.5435C2.95741 5.00004 1.66675 6.2907 1.66675 7.87679V15.4565C1.66675 17.0427 2.95741 18.3334 4.5435 18.3334H12.1232C13.5803 18.3334 14.7751 17.2402 14.9619 15.8334H15.4566C17.0427 15.8334 18.3334 14.5427 18.3334 12.9566V4.54345C18.3334 2.95737 17.0427 1.6667 15.4567 1.6667ZM16.6667 12.9566C16.6667 13.6239 16.1239 14.1667 15.4567 14.1667H15.0001V7.87679C15.0001 6.2907 13.7094 5.00004 12.1233 5.00004H6.66675V4.54345C6.66675 3.8762 7.20958 3.33337 7.87683 3.33337H15.4566C16.1239 3.33337 16.6667 3.8762 16.6667 4.54345V12.9566Z" fill="currentColor" {...scope} /></svg>
}

function SeedValue({ children, onCopy }) {
  return <div className="element-content" {...scope}><span {...scope}>{children}</span><button className="button-copy" type="button" title="Copy to clipboard" onClick={onCopy} {...scope}><CopyIcon /></button></div>
}

function FairSeedModal({ user }) {
  const initialState = useMemo(() => getFairSeedState(user), [user])
  const [seedState, setSeedState] = useState(initialState)
  const [clientSeed, setClientSeed] = useState(initialState.seedNext.seedClient)
  const [busy, setBusy] = useState(false)

  const copy = async (value) => {
    try {
      await copyText(String(value))
      notify({ type: 'success', message: 'Copied to your clipboard.' })
    } catch {
      notify({ type: 'error', message: 'Failed to copy.' })
    }
  }

  const save = () => {
    const value = clientSeed.trim()
    if (!value) {
      notify({ type: 'error', message: 'Please enter a client seed to save.' })
      return
    }
    setBusy(true)
    const next = { ...seedState, seedNext: { ...seedState.seedNext, seedClient: value } }
    persistFairSeedState(user, next)
    setSeedState(next)
    window.setTimeout(() => setBusy(false), 180)
  }

  const cycle = () => {
    const value = clientSeed.trim()
    if (!value) {
      notify({ type: 'error', message: 'Please enter a client seed to save.' })
      return
    }
    setBusy(true)
    const next = {
      seed: { seedClient: value, hash: seedState.seedNext.hash, nonce: 0 },
      seedNext: { seedClient: createFairClientSeed(), hash: createFairHash() },
    }
    persistFairSeedState(user, next)
    setSeedState(next)
    setClientSeed(next.seedNext.seedClient)
    window.setTimeout(() => setBusy(false), 180)
  }

  return <div className="modal-fair-game" {...scope}>
    <div className="game-group" {...scope}>
      <div className="game-header" {...scope}><span {...scope}>Seed Fairness</span></div>
      <div className="game-element" {...scope}><div className="element-title" {...scope}>Active Client Seed</div><SeedValue onCopy={() => copy(seedState.seed.seedClient)}>{seedState.seed.seedClient}</SeedValue></div>
      <div className="game-element" {...scope}><div className="element-title" {...scope}>Active Server Seed (Hashed)</div><SeedValue onCopy={() => copy(seedState.seed.hash)}>{seedState.seed.hash}</SeedValue></div>
      <div className="game-element" {...scope}><div className="element-title" {...scope}>Active Nonce</div><SeedValue onCopy={() => copy(seedState.seed.nonce)}>{seedState.seed.nonce}</SeedValue></div>
      <div className="game-element" {...scope}>
        <div className="element-title" {...scope}>Next Client Seed</div>
        <div className="element-content save-cycle-container" {...scope}>
          <input type="text" value={clientSeed} onChange={(event) => setClientSeed(event.target.value)} {...scope} />
          <button className="button-save" type="button" disabled={busy} onClick={save} {...scope}><div className="button-inner" {...scope}>Save</div></button>
          <button className="button-cycle" type="button" disabled={busy} onClick={cycle} {...scope}><div className="button-inner" {...scope}>Cycle</div></button>
        </div>
      </div>
      <div className="game-element" {...scope}><div className="element-title" {...scope}>Next Server Seed (Hashed)</div><SeedValue onCopy={() => copy(seedState.seedNext.hash)}>{seedState.seedNext.hash}</SeedValue></div>
    </div>
  </div>
}

export default FairSeedModal
