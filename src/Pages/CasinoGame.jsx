import { useEffect, useMemo, useState } from 'react'
import SiteIcon from '../components/Icons'
import { CasinoCard } from '../components/CasinoLobby'
import { loadCasinoCatalog } from '../lib/CasinoCatalog'

const detailScope = { 'data-v-5c300062': '' }

function CasinoGame({ gameId, live = false }) {
  const [fullscreen, setFullscreen] = useState(false)
  const [playMode, setPlayMode] = useState('real')
  const [games, setGames] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(true)
  const routeBase = live ? '/live-casino' : '/slots'
  const game = games.find((entry) => entry.code === gameId)
  const suggestions = useMemo(() => games.filter((entry) => entry.code !== gameId).slice(0, 12), [games, gameId])
  const demoPlayAllowed = !game || game.demoSupport === true
  const showFunPlay = loadingSuggestions || demoPlayAllowed

  useEffect(() => {
    let active = true
    loadCasinoCatalog().then((catalog) => {
      if (active) setGames(catalog[live ? 'live' : 'slots'])
    }).finally(() => {
      if (active) setLoadingSuggestions(false)
    })
    return () => { active = false }
  }, [live])

  useEffect(() => {
    document.title = `${game?.name || (live ? 'Live Casino' : 'Slots')} - RoRisk`
    const update = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [game, live])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.querySelector('.slot-details-shell')?.requestFullscreen().catch(() => {})
  }

  return (
    <div className="slot-details-shell" {...detailScope}>
      <div className={`slot-game${fullscreen ? ' fullscreen' : ''}`} {...detailScope}>
        <div className={`slot-container${fullscreen ? ' fullscreen' : ''}`} {...detailScope}>
          <div className={`game-iframe-container${fullscreen ? ' fullscreen' : ''}`} {...detailScope}>
            <div className="iframe-stage" {...detailScope}>
              <div className="game-loader-overlay" aria-busy="true" aria-live="polite" {...detailScope}>
                <div className="game-loader-inner" {...detailScope}><div className="spinner" {...detailScope} /><span className="game-loader-text" {...detailScope}>{'Loading game\u2026'}</span></div>
              </div>
            </div>
            <div className="slot-toolbar" {...detailScope}>
              {fullscreen ? <div className="toolbar-spacer" {...detailScope} /> : <button className="fullscreen-btn" type="button" onClick={toggleFullscreen} {...detailScope}><span>Fullscreen</span></button>}
              <div className={`play-mode-toggle sort-dropdown-style${showFunPlay ? '' : ' play-mode-real-only'}`} role="group" aria-label="Play mode" {...detailScope}>
                {showFunPlay && <button className={`segment segment-fun${playMode === 'demo' ? ' active' : ''}`} type="button" disabled={loadingSuggestions || !demoPlayAllowed} onClick={() => setPlayMode('demo')} {...detailScope}>Fun Play</button>}
                <button className={`segment segment-real${playMode === 'real' ? ' active' : ''}`} type="button" onClick={() => setPlayMode('real')} {...detailScope}>Real Play</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {!fullscreen && <section className="suggested-section" aria-labelledby="suggested-heading" {...detailScope}>
        <h2 className="subsection-heading suggested-heading" id="suggested-heading" {...detailScope}><SiteIcon name="slots" className="suggested-icon" {...detailScope} /> Suggested</h2>
        {loadingSuggestions ? <div className="suggested-loading" {...detailScope}><div className="spinner" {...detailScope} /></div> : <div className="slot-grid slot-grid--suggested" {...detailScope}>{suggestions.map((entry, index) => <CasinoCard key={entry.code} game={entry} routeBase={routeBase} index={index} />)}</div>}
      </section>}
    </div>
  )
}

export default CasinoGame
