import { useEffect, useMemo, useRef, useState } from 'react'
import SiteIcon from './Icons'
import { casinoImageUrl, liveCasinoProviders, loadCasinoCatalog, slotProviders } from '../lib/CasinoCatalog'

const pageScope = { 'data-v-738b141a': '' }
const cardScope = { 'data-v-53767690': '' }

function CasinoCard({ game, routeBase, index = 0 }) {
  const path = `${routeBase}/${encodeURIComponent(game.code)}`
  const imageUrl = casinoImageUrl(game)
  const activate = () => {
    if (window.location.pathname === path) return
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  return (
    <div
      className="slot-card"
      style={{ animationDelay: `${Math.min(index * 30, 1000)}ms` }}
      role="button"
      tabIndex="0"
      aria-label={`Play ${game.name}`}
      aria-disabled="false"
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        activate()
      }}
      {...cardScope}
    >
      <div className="card-thumbnail" {...cardScope}>
        {imageUrl ? <img className="slot-image" src={imageUrl} alt={game.name} loading="lazy" {...cardScope} /> : <div className="slot-image slot-image-placeholder" title={game.name} {...cardScope} />}
      </div>
      <div className="slot-meta" {...cardScope}>
        <h3 className="slot-title" title={game.name} {...cardScope}>{game.name}</h3>
        <p className="slot-provider" {...cardScope}>{game.provider}</p>
      </div>
    </div>
  )
}

function Chevron() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" {...pageScope}><path d="M14.59 6.59003L10 11.17L5.41 6.59003L4 8.00003L10 14L16 8.00003L14.59 6.59003Z" fill="currentColor" {...pageScope} /></svg>
}

function SearchIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" {...pageScope}><path fillRule="evenodd" clipRule="evenodd" d="M19.8055 16.6529C19.1892 16.0366 18.3018 15.8566 17.5271 16.1129L15.8199 14.4056C16.8729 13.051 17.5 11.3487 17.5 9.5C17.5 5.08172 13.9183 1.5 9.5 1.5C5.08172 1.5 1.5 5.08172 1.5 9.5C1.5 13.9183 5.08172 17.5 9.5 17.5C11.3487 17.5 13.051 16.8729 14.4056 15.8199L16.1129 17.5271C15.8566 18.3018 16.0366 19.1892 16.6529 19.8055L18.6945 21.8471C19.5651 22.7176 20.9765 22.7176 21.8471 21.8471C22.7176 20.9765 22.7176 19.5651 21.8471 18.6945L19.8055 16.6529ZM3.5 9.5C3.5 6.18629 6.18629 3.5 9.5 3.5C12.8137 3.5 15.5 6.18629 15.5 9.5C15.5 12.8137 12.8137 15.5 9.5 15.5C6.18629 15.5 3.5 12.8137 3.5 9.5Z" {...pageScope} /></svg>
}

function CasinoLobby({ live = false }) {
  const routeBase = live ? '/live-casino' : '/slots'
  const pageTitle = live ? 'Live Casino' : 'Slots'
  const [games, setGames] = useState([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sort, setSort] = useState('popular')
  const [provider, setProvider] = useState('')
  const [visibleCount, setVisibleCount] = useState(() => window.innerWidth > 768 ? 63 : 27)
  const [loadedCount, setLoadedCount] = useState(50)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [providerOpen, setProviderOpen] = useState(false)
  const pageRef = useRef(null)

  useEffect(() => {
    document.title = `${pageTitle} - RoRisk`
    const close = (event) => {
      if (!pageRef.current?.contains(event.target)) {
        setSortOpen(false)
        setProviderOpen(false)
      }
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [pageTitle])

  useEffect(() => {
    let active = true
    loadCasinoCatalog()
      .then((catalogue) => {
        if (active) setGames(Array.isArray(catalogue[live ? 'live' : 'slots']) ? catalogue[live ? 'live' : 'slots'] : [])
      })
      .finally(() => {
        if (active) setLoadingGames(false)
      })
    return () => { active = false }
  }, [live])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(search)
      setVisibleCount(window.innerWidth > 768 ? 63 : 27)
      setLoadedCount(50)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const providers = live ? liveCasinoProviders : slotProviders
  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const selectedProvider = providers.find((entry) => entry.code === provider)
    const values = games.filter((game) => (!selectedProvider || game.provider.toLowerCase().replace('pragmatic live', 'pragmatic play live') === selectedProvider.name.toLowerCase()) && (!query || game.name.toLowerCase().includes(query)))
    if (sort === 'alphabetical') return [...values].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'newest') return [...values].sort((a, b) => (a.newestRank ?? a.popularRank) - (b.newestRank ?? b.popularRank))
    return values
  }, [games, provider, providers, searchQuery, sort])
  const availableGames = filtered.slice(0, loadedCount)
  const visibleGames = availableGames.slice(0, visibleCount)
  const hasMore = visibleCount < availableGames.length || loadedCount < filtered.length
  const sortLabel = sort === 'newest' ? 'Newest' : sort === 'alphabetical' ? 'Alphabetical' : 'Most Popular'

  const loadMore = () => {
    if (loadingMore) return
    setLoadingMore(true)
    window.setTimeout(() => {
      if (visibleCount < availableGames.length) setVisibleCount((value) => value + (window.innerWidth > 768 ? 63 : 27))
      else setLoadedCount((value) => Math.min(filtered.length, value + 50))
      setLoadingMore(false)
    }, 300)
  }

  return (
    <div ref={pageRef} className="slots-page" {...pageScope}>
      <section className="slots-section" {...pageScope}>
        <header className="section-heading" {...pageScope}>
          <div className="heading-left-title" {...pageScope}><SiteIcon name="slots" {...pageScope} /> {pageTitle}</div>
        </header>
        <div className="filters-row" {...pageScope}>
          <div className="filters-search" {...pageScope}>
            <div className="slot-filter-search" {...pageScope}><SearchIcon /><input value={search} onChange={(event) => setSearch(event.target.value)} type="text" placeholder={live ? 'Search for a live game...' : 'Search for a slot...'} {...pageScope} /></div>
          </div>
          <div className="filters-controls" {...pageScope}>
            <div className={`sort-dropdown${sortOpen ? ' sort-open' : ''}`} {...pageScope}>
              <button className="button-toggle" type="button" onClick={(event) => { event.stopPropagation(); setSortOpen((value) => !value); setProviderOpen(false) }} {...pageScope}><div className="button-inner" {...pageScope}><div className="inner-value" {...pageScope}>Sort By: <span {...pageScope}>{sortLabel}</span></div><Chevron /></div></button>
              <div className={`sort-menu casino-dropdown-menu${sortOpen ? ' casino-dropdown-menu-open' : ''}`} aria-hidden={!sortOpen} {...pageScope}>
                <div className="menu-inner" {...pageScope}>{[['popular', 'Most Popular'], ['newest', 'Newest'], ['alphabetical', 'Alphabetical']].map(([value, label]) => <button type="button" key={value} onClick={() => { setSort(value); setVisibleCount(window.innerWidth > 768 ? 63 : 27); setLoadedCount(50); setSortOpen(false) }} {...pageScope}>{label}</button>)}</div>
              </div>
            </div>
            <div className={`publisher-dropdown${providerOpen ? ' publisher-open' : ''}`} {...pageScope}>
              <button className="button-toggle" type="button" onClick={(event) => { event.stopPropagation(); setProviderOpen((value) => !value); setSortOpen(false) }} {...pageScope}><div className="button-inner" {...pageScope}><div className="inner-value" {...pageScope}>Providers <span className="publisher-filter-badge" {...pageScope}>{providers.find((entry) => entry.code === provider)?.name || 'All Providers'}</span></div><Chevron /></div></button>
              <div className={`publisher-menu casino-dropdown-menu${providerOpen ? ' casino-dropdown-menu-open' : ''}`} aria-hidden={!providerOpen} {...pageScope}>
                <div className="publisher-menu-inner" {...pageScope}>
                  <div className="publisher-menu-title" {...pageScope}>Provider catalog</div>
                  <div className="publisher-checklist" {...pageScope}>
                    {[{ code: '', name: 'All Providers', count: games.length }, ...providers].map((entry) => {
                      return <label className="publisher-row" key={entry.name} {...pageScope}><input className="checkbox-custom" type="radio" name={`${routeBase}-provider`} checked={provider === entry.code} onChange={() => { setProvider(entry.code); setVisibleCount(window.innerWidth > 768 ? 63 : 27); setLoadedCount(50); setProviderOpen(false) }} {...pageScope} /><span className="publisher-name" {...pageScope}>{entry.name}</span><span className="publisher-count" {...pageScope}>{entry.countDisplay ?? entry.count}</span></label>
                    })}
                  </div>
                  {provider && <button className="publisher-clear-btn" type="button" onClick={() => { setProvider(''); setVisibleCount(window.innerWidth > 768 ? 63 : 27); setLoadedCount(50); setProviderOpen(false) }} {...pageScope}>Reset to default</button>}
                </div>
              </div>
            </div>
          </div>
        </div>
        {!loadingGames && !filtered.length && searchQuery.trim() && <div className="no-results" {...pageScope}>No games found matching &quot;{searchQuery}&quot;.</div>}
        {loadingGames ? <div className="loading-spinner loading-games" {...pageScope}><div className="spinner" {...pageScope} /></div> : <div className="slot-grid" {...pageScope}>{visibleGames.map((game, index) => <CasinoCard key={game.code} game={game} routeBase={routeBase} index={index} />)}</div>}
        {!loadingGames && hasMore && !loadingMore && <div className="button-container" {...pageScope}><button className="button-secondary load-more-btn" type="button" onClick={loadMore} {...pageScope}><span>Show More</span><Chevron /></button></div>}
        {loadingMore && <div className="loading-spinner" {...pageScope}><div className="spinner" {...pageScope} /></div>}
      </section>
    </div>
  )
}

export default CasinoLobby
export { CasinoCard }
