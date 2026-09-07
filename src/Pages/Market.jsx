import { useEffect, useRef, useState } from 'react'
import SiteIcon from '../components/Icons'

const pageScope = { 'data-v-d38421ba': '' }
const searchScope = { 'data-v-48f0de88': '' }
const categoryScope = { 'data-v-569323d8': '' }
const sortScope = { 'data-v-43e24a52': '' }

function SelectFilter({ type, value, values, open, onToggle, onPick }) {
  const isCategory = type === 'Category'
  const scope = isCategory ? categoryScope : sortScope
  return <div className={`${isCategory ? 'market-filter-category' : 'market-filter-sort'}${open ? ` ${isCategory ? 'category' : 'sort'}-open` : ''}`} {...scope}>
    <button className="button-toggle" type="button" onClick={onToggle} {...scope}><div className="button-inner" {...scope}><div className="inner-value" {...scope}>{type}: <span {...scope}>{value}</span></div><SiteIcon name="chevron-down" {...scope} /></div></button>
    {open && <div className={`${isCategory ? 'category' : 'sort'}-menu dropdown-enter-active`} {...scope}><div className="menu-inner" {...scope}>{values.map(([label, key]) => <button type="button" key={key} onClick={() => onPick(label)} {...scope}>{label}</button>)}</div></div>}
  </div>
}

function Market() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('Most Popular')
  const [open, setOpen] = useState(null)
  const root = useRef(null)
  useEffect(() => {
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])
  const empty = search ? 'No items match your search.' : 'No items are currently available.'
  return <div className="market" ref={root} {...pageScope}>
    <div className="market-header" {...pageScope}>
      <div className="header-title" {...pageScope}><SiteIcon name="market" {...pageScope} /><span {...pageScope}>Market</span></div>
      <div className="items-header" {...pageScope}>
        <div className="market-filter-search" {...searchScope}><SiteIcon name="search" {...searchScope} /><input type="text" placeholder="Search for an item..." value={search} onChange={(event) => setSearch(event.target.value)} {...searchScope} /></div>
        <div className="header-filters" {...pageScope}>
          <div className="filter-slot" {...pageScope}><SelectFilter type="Category" value={category} open={open === 'category'} onToggle={() => setOpen(open === 'category' ? null : 'category')} onPick={(value) => { setCategory(value); setOpen(null) }} values={['All', 'Back', 'Face', 'Gear', 'Hair', 'Hat', 'Shoulder', 'Other'].map((value) => [value, value])} /></div>
          <div className="filter-slot" {...pageScope}><SelectFilter type="Sort By" value={sort} open={open === 'sort'} onToggle={() => setOpen(open === 'sort' ? null : 'sort')} onPick={(value) => { setSort(value); setOpen(null) }} values={['Most Popular', 'Lowest', 'Highest', 'Highest RAP'].map((value) => [value, value])} /></div>
        </div>
      </div>
    </div>
    <div className="market-content" {...pageScope}><div className="content-empty fade-enter-active" {...pageScope}>{empty}</div></div>
  </div>
}

export default Market
