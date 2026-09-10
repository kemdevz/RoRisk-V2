import { useEffect, useMemo, useRef, useState } from 'react'
import SiteIcon from '../components/Icons'

const casesScope = { 'data-v-2696d139': '' }
const headerScope = { 'data-v-f008bb16': '' }
const searchScope = { 'data-v-74e302fc': '' }
const priceScope = { 'data-v-76f166bf': '' }
const sortScope = { 'data-v-58a58ac8': '' }
const overviewScope = { 'data-v-5e243141': '' }
const boxScope = { 'data-v-0a362090': '' }

const priceOptions = [
  ['Any', 'Any'],
  ['0 - 5,000', '0 - 5,000'],
  ['5,000 - 25,000', '5K - 25K'],
  ['25,000 - 100,000', '25K - 100K'],
  ['+100,000', '+100,000'],
]

function Dropdown({ kind, value, options, open, onToggle, onSelect }) {
  const isPrice = kind === 'Price Range'
  const scope = isPrice ? priceScope : sortScope
  const className = isPrice ? 'cases-filter-price' : 'cases-filter-sort'
  const menuName = isPrice ? 'price' : 'sort'
  return <div className={`${className}${open ? ` ${menuName}-open` : ''}`} {...scope}>
    <button className="button-toggle" type="button" aria-expanded={open} onClick={onToggle} {...scope}><div className="button-inner" {...scope}><div className="inner-value" {...scope}>{kind}: <span {...scope}>{value}</span></div><SiteIcon name="chevron-down" {...scope} /></div></button>
    {open && <div className={`${menuName}-menu dropdown-enter-active`} {...scope}><div className="menu-inner" {...scope}>{options.map(([label, key]) => <button type="button" key={key} onClick={() => onSelect(key)} {...scope}>{label}</button>)}</div></div>}
  </div>
}

function CaseCard({ box }) {
  const image = box.imageUrl
  return <a className="cases-box-element" href={`/cases/${box.caseId}`} {...boxScope}>
    <div className="box-content" {...boxScope}>
      <div className="box-image" {...boxScope}><img className="box-image-top" src={image} loading="lazy" decoding="async" alt="" {...boxScope} /><img className="box-image-glow" src={image} loading="lazy" decoding="async" alt="" {...boxScope} /></div>
      <div className="box-name-container" {...boxScope}><div className="box-info" {...boxScope}><div className="box-name" {...boxScope}>{box.name}</div><div className="box-price" {...boxScope}><div className="price-content" {...boxScope}><img src="/rocoin.2d3febd5.svg" alt="RoCoins" {...boxScope} /><span {...boxScope}>{Math.floor(Number(box.rocoinAmount) || 0).toLocaleString('en-US')}</span></div><div className="open-case-content" {...boxScope}><span {...boxScope}>View Case</span></div></div></div></div>
    </div>
  </a>
}

function LoadingGrid() {
  return <div className="overview-loading" {...overviewScope}>{Array.from({ length: 24 }, (_, index) => <div className="loading-placeholder" key={index} {...overviewScope}><div className="placeholder-image" {...overviewScope} /><div className="placeholder-info" {...overviewScope}><div className="placeholder-name" {...overviewScope} /><div className="placeholder-price" {...overviewScope} /></div></div>)}</div>
}

function Cases() {
  const root = useRef(null)
  const [boxes, setBoxes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [price, setPrice] = useState('Any')
  const [sort, setSort] = useState('highest')
  const [dropdown, setDropdown] = useState(null)

  useEffect(() => {
    document.title = 'Cases - RoRisk.com'
    const controller = new AbortController()
    fetch('/api/cases', { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Unable to load cases.')
        setBoxes(Array.isArray(payload.cases) ? payload.cases : [])
      })
      .catch((error) => { if (error.name !== 'AbortError') setBoxes([]) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const close = (event) => { if (!root.current?.contains(event.target)) setDropdown(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim()
    const result = boxes.filter((box) => {
      const categories = Array.isArray(box.categories) ? box.categories : []
      if (!categories.includes('featured')) return false
      if (query && !box.name.toLowerCase().includes(query)) return false
      const amount = Number(box.rocoinAmount) || 0
      if (price === '0 - 5,000') return amount <= 5_000
      if (price === '5K - 25K') return amount > 5_000 && amount <= 25_000
      if (price === '25K - 100K') return amount > 25_000 && amount <= 100_000
      if (price === '+100,000') return amount > 100_000
      return true
    })
    return result.sort((left, right) => sort === 'highest' ? right.rocoinAmount - left.rocoinAmount : left.rocoinAmount - right.rocoinAmount)
  }, [boxes, price, search, sort])

  const limiteds = filtered.filter((box) => box.type !== 'mm2')
  const mm2 = filtered.filter((box) => box.type === 'mm2')
  const list = (items) => <div className="overview-list" {...overviewScope}>{items.map((box) => <CaseCard box={box} key={box.caseId} />)}</div>

  return <div className="cases" ref={root} {...casesScope}>
    <div className="cases-header" {...casesScope}><div className="cases-header-overview" {...headerScope}><div className="header-title" {...headerScope}><SiteIcon name="cases" {...headerScope} /><span {...headerScope}>Cases</span></div><div className="header-filters" {...headerScope}><div className="filters-search" {...headerScope}><div className="cases-filter-search" {...searchScope}><SiteIcon name="search" {...searchScope} /><input type="text" placeholder="Search for a case..." value={search} onChange={(event) => setSearch(event.target.value)} {...searchScope} /></div></div><div className="filters-price" {...headerScope}><Dropdown kind="Price Range" value={price} options={priceOptions} open={dropdown === 'price'} onToggle={() => setDropdown(dropdown === 'price' ? null : 'price')} onSelect={(value) => { setPrice(value); setDropdown(null) }} /></div><div className="filters-sort" {...headerScope}><Dropdown kind="Sort By" value={sort === 'highest' ? 'Highest' : 'Lowest'} options={[["Lowest", 'lowest'], ["Highest", 'highest']]} open={dropdown === 'sort'} onToggle={() => setDropdown(dropdown === 'sort' ? null : 'sort')} onSelect={(value) => { setSort(value); setDropdown(null) }} /></div></div></div></div>
    <div className="cases-content" {...casesScope}><div className="cases-overview" {...overviewScope}>{loading ? <LoadingGrid /> : filtered.length ? <div className="overview-sections" {...overviewScope}>{limiteds.length > 0 && list(limiteds)}{limiteds.length > 0 && mm2.length > 0 && <div className="overview-separator" {...overviewScope}><div className="separator-line" {...overviewScope} /><div className="separator-label" {...overviewScope}><span className="separator-title" {...overviewScope}>Murder Mystery 2</span><span className="separator-subtitle" {...overviewScope}>Cases</span></div><div className="separator-line" {...overviewScope} /></div>}{mm2.length > 0 && list(mm2)}</div> : <div className="overview-empty fade-enter-active" {...overviewScope}>There currently are no cases with this filter.</div>}</div></div>
  </div>
}

export default Cases
