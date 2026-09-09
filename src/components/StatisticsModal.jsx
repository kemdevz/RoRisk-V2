const scope = { 'data-v-3b2e0e04': '' }

const amount = (value) => Math.floor((Number(value) || 0) / 1000).toLocaleString('en-US')
const integer = (value) => Math.floor(Number(value) || 0).toLocaleString('en-US')

function CurrencyRow({ currency, value, profit = false }) {
  const number = Number(value) || 0
  const tone = profit ? (number > 0 ? ' profit-positive' : number < 0 ? ' profit-negative' : '') : ''
  return <div className={`stat-value-row${tone}`} {...scope}><img className="Coins-icon" src={currency === 'rocoins' ? '/rocoin.2d3febd5.svg' : '/coin.svg'} alt="" {...scope} /><span {...scope}>{amount(number)}</span></div>
}

function CurrencyCard({ title, coins, rocoins, profit = false }) {
  return <div className="stat-card" {...scope}><div className="stat-card-header" {...scope}><span className="stat-card-title" {...scope}>{title}</span></div><div className="stat-card-value" {...scope}><CurrencyRow currency="coins" value={coins} profit={profit} /><CurrencyRow currency="rocoins" value={rocoins} profit={profit} /></div></div>
}

function StatisticCard({ title, value }) {
  return <div className="stat-card" {...scope}><div className="stat-card-header" {...scope}><span className="stat-card-title" {...scope}>{title}</span></div><div className="stat-card-value" {...scope}><span {...scope}>{integer(value)}</span></div></div>
}

function StatisticsModal({ user }) {
  const stats = user?.stats || user?.statistics || {}
  const rocoins = user?.statsRocoins || user?.stats_rocoins || user?.statistics_rocoins || {}
  const coin = (key) => Math.max(0, (Number(stats[key]) || 0) - (Number(rocoins[key]) || 0))
  const rocoin = (key) => Number(rocoins[key]) || 0

  return <div className="modal-user-stats" {...scope}><div className="stats-content" {...scope}><div className="stats-header" {...scope}><h2 className="stats-title" {...scope}>User Statistics</h2></div><div className="stats-section" {...scope}><h3 className="section-title" {...scope}>Financial Statistics</h3><div className="stats-cards" {...scope}><CurrencyCard title="Total Deposited" coins={coin('deposit')} rocoins={rocoin('deposit')} /><CurrencyCard title="Total Withdrawn" coins={coin('withdraw')} rocoins={rocoin('withdraw')} /><CurrencyCard title="Total Profit" coins={coin('withdraw') - coin('deposit')} rocoins={rocoin('withdraw') - rocoin('deposit')} profit /><CurrencyCard title="Rewards Claimed" coins={coin('rewards')} rocoins={rocoin('rewards')} /></div></div><div className="stats-grid" {...scope}><div className="stats-section" {...scope}><h3 className="section-title" {...scope}>Game Statistics</h3><div className="stats-cards" {...scope}><StatisticCard title="Total Bets" value={stats.games} /><CurrencyCard title="Total Wagered" coins={coin('bet')} rocoins={rocoin('bet')} /><CurrencyCard title="Total Won" coins={coin('won')} rocoins={rocoin('won')} /><CurrencyCard title="Total Lost" coins={coin('bet') - coin('won')} rocoins={rocoin('bet') - rocoin('won')} /></div></div></div></div></div>
}

export default StatisticsModal
