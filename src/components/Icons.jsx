import { createElement } from 'react'
import exactIcons from '../assets/exact-icons.json'

const fallbackPaths = {
  bets: 'M4 4h16v16H4zM7 8h10M7 12h7M7 16h5',
  community: 'M8 11a4 4 0 100-8 4 4 0 000 8zm8-1a3 3 0 100-6 3 3 0 000 6zM1 22a7 7 0 0114 0zm13 0a6 6 0 019 0',
  promotions: 'M4 13l13-7v12L4 13zm0 0v6h4v-4m9-5h4m-3-3 3-3m-3 9 3 3',
  'chevron-left': 'M15 5l-7 7 7 7',
  'chevron-right': 'M9 5l7 7-7 7',
  'chevron-down': 'M5 9l7 7 7-7',
}

const attributeNames = {
  'clip-path': 'clipPath',
  'clip-rule': 'clipRule',
  'color-interpolation-filters': 'colorInterpolationFilters',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  'flood-opacity': 'floodOpacity',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-width': 'strokeWidth',
}

const styleNames = {
  'mask-type': 'maskType',
}

function renderNode(node, key, rootProps = {}) {
  const dataIsChildren = Array.isArray(node.data)
  const data = dataIsChildren ? {} : (node.data || {})
  const children = dataIsChildren ? node.data : (node.children || [])
  const attributes = Object.fromEntries(
    Object.entries(data.attrs || {}).map(([name, value]) => [attributeNames[name] || name, value]),
  )
  const styles = Object.fromEntries(
    Object.entries(data.staticStyle || {}).map(([name, value]) => [styleNames[name] || name, value]),
  )
  const props = {
    ...attributes,
    ...(data.staticClass ? { className: data.staticClass } : {}),
    ...(data.staticStyle ? { style: styles } : {}),
    ...(node.tag === 'svg' ? rootProps : {}),
    key,
  }
  return createElement(
    node.tag,
    props,
    ...children.map((child, index) => renderNode(child, `${key}-${index}`)),
  )
}

function SiteIcon({ name, className = '', ...props }) {
  const exact = exactIcons[name]
  if (exact) {
    const originalClass = exact.data?.staticClass || ''
    return renderNode(exact, name, {
      ...props,
      className: [originalClass, className].filter(Boolean).join(' '),
      'aria-hidden': 'true',
    })
  }

  const chevron = name?.startsWith('chevron')
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d={fallbackPaths[name] || fallbackPaths.bets} fill="none" stroke="currentColor" strokeWidth={chevron ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default SiteIcon
