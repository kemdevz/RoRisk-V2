const XP_RANKS = [
  { name: 'Rust', min: 1, accent: '#dd7c5c', icon: '/Ranks/rust.0b56e484.svg' },
  { name: 'Bronze', min: 20, accent: '#d08a4c', icon: '/Ranks/bronze.f59206cb.svg' },
  { name: 'Silver', min: 40, accent: '#c0c7d1', icon: '/Ranks/silver.81ba8fbc.svg' },
  { name: 'Gold', min: 60, accent: '#ffc74d', icon: '/Ranks/gold.49b1d38b.svg' },
  { name: 'Diamond', min: 80, accent: '#7dd3fc', icon: '/Ranks/diamond.e915302c.svg' },
  { name: 'Emerald', min: 100, accent: '#34d399', icon: '/Ranks/emerald.2fc26a46.svg' },
  { name: 'Ruby', min: 120, accent: '#e11d48', icon: '/Ranks/ruby.550e6038.svg' },
]

const STAFF_ACCENTS = {
  admin: '#F7DE50',
  mod: '#78FF78',
  partner: '#FF7785',
}

function normalizeStaffRank(rank) {
  const value = String(rank || 'user').toLowerCase()
  return value === 'moderator' ? 'mod' : value
}

function xpRankForLevel(level) {
  const numericLevel = Number(level) || 0
  let rank = XP_RANKS[0]
  for (const candidate of XP_RANKS) {
    if (numericLevel >= candidate.min) rank = candidate
  }
  return rank
}

function staffAccent(rank) {
  return STAFF_ACCENTS[normalizeStaffRank(rank)] || null
}

function rankAccent(rank, level) {
  return staffAccent(rank) || xpRankForLevel(level).accent
}

export { normalizeStaffRank, rankAccent, staffAccent, xpRankForLevel }
