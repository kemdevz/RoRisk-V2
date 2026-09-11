import { useEffect, useMemo, useState } from 'react'
import { copyText, notify } from '../lib/Notifications'

const pageScope = { 'data-v-0b677aea': '' }
const gameScopes = {
  Battles: { 'data-v-25c04c2f': '' },
  Blackjack: { 'data-v-6810e1d0': '' },
  Upgrader: { 'data-v-519d3548': '' },
  Slide: { 'data-v-8945c3ec': '' },
  Mines: { 'data-v-54a8d2b9': '' },
  Coinflip: { 'data-v-3b2570d3': '' },
  Limbo: { 'data-v-2aa24297': '' },
  Dice: { 'data-v-6d630948': '' },
  XRoulette: { 'data-v-9f23aa50': '' },
  Cases: { 'data-v-57d6fd1c': '' },
}

const games = [
  ['Battles', 'Battles'],
  ['Blackjack', 'Blackjack'],
  ['Upgrader', 'Upgrader'],
  ['Slide', 'Slide'],
  ['Mines', 'Mines'],
  ['Coinflip', 'Coinflip'],
  ['Limbo', 'Limbo'],
  ['Dice', 'Dice'],
  ['XRoulette', 'X-Roulette'],
  ['Cases', 'Cases'],
]

const codepenIds = {
  Slide: 'wBWGQYy',
  Coinflip: 'myEPQaw',
  Mines: 'OPXNarz',
  Limbo: 'dPXMQwp',
  Blackjack: 'ogLyGob',
  Battles: 'pvbyQQq',
  Cases: 'GgqZwPv',
  Upgrader: 'bNeyZwO',
  Dice: 'vEgrzJB',
  XRoulette: 'gbgKdRa',
}

const coinflipCode = `const crypto = require('crypto');

const serverSeed = 'exampleServerSeed';
const eosBlockId = 'exampleEosBlockId';

const fairGetCoinflipOutcome = () => {
    const hash = crypto.createHash('sha512').update(\`${'${serverSeed}-${eosBlockId}'}\`).digest('hex');
    
    // Generate ticket using the same range as competitor (0 to 999,999)
    const min = 0;
    const max = (100 * 10000) - 1; // 999,999
    const ticket = seededRandomInteger(hash, min, max);
    
    // Determine winner: first 500,000 tickets = blue, last 500,000 tickets = orange
    const winningCoin = ticket < 500000 ? 'blue' : 'orange';

    console.log(\`Hash: ${'${hash}'}\`);
    console.log(\`Generated ticket: ${'${ticket}'}\`);
    console.log(\`Winning Coin: ${'${winningCoin}'}\`);
}

function seededRandomInteger(hash, min, max) {
    const uintValue = parseInt(hash.slice(0, 16), 16);
    const range = max - min + 1;
    return min + (uintValue % range);
}

fairGetCoinflipOutcome();`

const battlesCode = `const crypto = require('crypto');

const serverSeed = 'exampleServerSeed';
const eosBlockId = 'exampleEosBlockId';
const roundIndex = 0;
const playerIndex = 0;

const fairGetBattlesOutcome = () => {
    const combined = \`${'${serverSeed}-${eosBlockId}-${roundIndex}-${playerIndex}'}\`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    const ticket = parseInt(hash.slice(0, 8), 16) % 100000;
    
    console.log(\`Hash: ${'${hash}'}\`);
    console.log(\`Round: ${'${roundIndex}'}, Player: ${'${playerIndex}'}\`);
    console.log(\`Generated Ticket: ${'${ticket}'}\`);
    console.log('This ticket determines which item is won from the box');
}

fairGetBattlesOutcome();`

const details = {
  Battles: {
    intro: 'Our battles system generates the result for each game using a secure provably fair system with SHA-256:',
    rows: [
      ['Server Seed:', ' A cryptographically secure pseudo-randomly generated string.'],
      ['EOS Block ID:', ' The EOS blockchain block ID that is publicly verifiable.'],
      ['Round Index:', ' The index of the current round in the battle.'],
      ['Player Index:', ' The position/index of the player in the battle.'],
      ['Battles System:', ' Generates a random ticket for each player in each round using the combined inputs. That ticket is then used to determine which item is won from the box for that specific player and round.'],
    ],
    code: battlesCode,
  },
  Coinflip: {
    intro: 'Our coinflip system generates the result for each game using a secure ticket-based system with SHA-512:',
    rows: [
      ['Server Seed:', ' A cryptographically secure pseudo-randomly generated string.'],
      ['EOS Block ID:', ' The EOS blockchain block ID that is publicly verifiable.'],
      ['Ticket System:', ' Generates a random ticket (0-999,999). Tickets 0-499,999 = BLUE, Tickets 500,000-999,999 = ORANGE.'],
    ],
    code: coinflipCode,
  },
}

function FairGameDetails({ game }) {
  const config = details[game] || {
    intro: `Our ${game === 'XRoulette' ? 'X-Roulette' : game.toLowerCase()} system uses cryptographically secure seeds to generate independently verifiable game results.`,
    rows: [
      ['Server Seed:', ' A cryptographically secure pseudo-randomly generated string.'],
      ['Client Seed:', ' A string determined by the user and changeable at any time.'],
      ['Nonce:', ' A number that is incremented with every user bet.'],
    ],
    code: '// Use the interactive verifier above to verify this game result.',
  }
  const prefix = game === 'XRoulette' ? 'xroulette' : game.toLowerCase()
  const scope = gameScopes[game]

  return <div className={`fair-${prefix}`} {...scope} {...pageScope}>
    <div className={`${prefix}-text`} {...scope}>
      <p {...scope}>{config.intro}</p>
      {config.rows.map(([label, text]) => <p key={label} {...scope}><span {...scope}>{label}</span>{text}</p>)}
    </div>
    <div className={`${prefix}-code`} {...scope}><pre {...scope}><code {...scope}>{config.code}</code></pre></div>
  </div>
}

function DropdownIcon({ rotated }) {
  return <svg className={rotated ? 'rotated' : ''} width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...pageScope}><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...pageScope} /></svg>
}

function CopyIcon() {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...pageScope}><path d="M15.4567 1.6667H7.87683C6.29075 1.6667 5.00008 2.95737 5.00008 4.54345V5.00004H4.5435C2.95741 5.00004 1.66675 6.2907 1.66675 7.87679V15.4565C1.66675 17.0427 2.95741 18.3334 4.5435 18.3334H12.1232C13.5803 18.3334 14.7751 17.2402 14.9619 15.8334H15.4566C17.0427 15.8334 18.3334 14.5427 18.3334 12.9566V4.54345C18.3334 2.95737 17.0427 1.6667 15.4567 1.6667ZM16.6667 12.9566C16.6667 13.6239 16.1239 14.1667 15.4567 14.1667H15.0001V7.87679C15.0001 6.2907 13.7094 5.00004 12.1233 5.00004H6.66675V4.54345C6.66675 3.8762 7.20958 3.33337 7.87683 3.33337H15.4566C16.1239 3.33337 16.6667 3.8762 16.6667 4.54345V12.9566Z" fill="currentColor" {...pageScope} /></svg>
}

function ProvablyFair({ user }) {
  const initialGame = useMemo(() => {
    const queryGame = new URLSearchParams(window.location.search).get('game')
    return games.some(([value]) => value === queryGame) ? queryGame : 'Battles'
  }, [])
  const [currentGame, setCurrentGame] = useState(initialGame)
  const [showPastSeeds, setShowPastSeeds] = useState(false)
  const [pastSeeds, setPastSeeds] = useState([])
  const [pastSeedsLoading, setPastSeedsLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const multiplayer = ['Slide', 'Coinflip', 'Battles', 'XRoulette'].includes(currentGame)
  const displayGame = currentGame === 'XRoulette' ? 'X-Roulette' : currentGame
  const embedUrl = `https://codepen.io/rorisk/embed/${codepenIds[currentGame]}?default-tab=result&theme-id=dark`

  useEffect(() => { document.title = 'Provably Fair - RoRisk.com' }, [])

  const loadPastSeeds = async (page = 1) => {
    if (!user) {
      setPastSeeds([])
      setPagination({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
      return
    }
    setPastSeedsLoading(true)
    try {
      const response = await fetch(`/api/fairness/past-seeds?page=${page}`, { headers: { Accept: 'application/json' } })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Failed to load past seeds.')
      setPastSeeds(Array.isArray(payload.seeds) ? payload.seeds : [])
      setPagination(payload.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 1 })
    } catch (error) {
      setPastSeeds([])
      notify({ type: 'error', message: error.message || 'Failed to load past seeds.' })
    } finally {
      setPastSeedsLoading(false)
    }
  }

  const togglePastSeeds = () => {
    if (!showPastSeeds && !pastSeeds.length) loadPastSeeds(1)
    setShowPastSeeds((shown) => !shown)
  }

  const formatDate = (value) => {
    const date = new Date(value)
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
  }

  const copySeed = async (seed) => {
    try {
      await copyText(`Client Seed: ${seed.clientSeed}\nServer Seed: ${seed.serverSeed}\nHash: ${seed.hash}\nNonce: ${seed.nonce}`)
      notify({ type: 'success', message: 'Seed data copied to clipboard' })
    } catch {
      notify({ type: 'error', message: 'Failed to copy seed data' })
    }
  }

  return <div className="provably-fair" {...pageScope}>
    <div className="fair-content" {...pageScope}>
      <div className="fair-header" {...pageScope}>
        <div className="title-part" {...pageScope}><h1 {...pageScope}>Provably Fair</h1><p className="title-bottom" {...pageScope}>Our games use a provably fair system that ensures complete transparency and randomness in all game outcomes:</p></div>
        <div className="fair-breakdown" {...pageScope}><ul {...pageScope}><h2 {...pageScope}>Breakdown</h2><li {...pageScope}>Every bet outcome is verifiable by players</li><li {...pageScope}>Results are cryptographically proven to be random</li><li {...pageScope}>Game outcomes cannot be manipulated or predicted</li><li {...pageScope}>Results use either blockchain-based random seeds or cryptographically secure client/server seed combinations</li></ul></div>
      </div>
      <div className="fair-mechanics" {...pageScope}><ul {...pageScope}><h2 {...pageScope}>Fair Mechanics</h2><li {...pageScope}>Before each game, we generate a 24-byte random server seed and hash it using SHA256</li><li {...pageScope}>The hash is shown to you before you place your bet</li><li {...pageScope}>After the game, we reveal the original server seed</li><li {...pageScope}>You can verify the hash matches the revealed seed</li><li {...pageScope}>Game outcomes are generated using different methods depending on the game type:</li><li {...pageScope}><strong>Slide, Coinflip, Battles, X-Roulette (Multiplayer):</strong> Server Seed + EOS Blockchain Block ID (same for all players in the game)</li><li {...pageScope}><strong>Mines, Limbo, Dice, Blackjack, Cases, Upgrader (Single Player):</strong> Server Seed + Client Seed + Nonce (unique per player)</li></ul></div>
      <div className="fair-verification" {...pageScope}><h2 {...pageScope}>Verify Previous Results</h2><p {...pageScope}>We provide you with the tools to independently verify the results of any previous game. The verification process differs depending on the game type:</p><p {...pageScope}><strong>Slide, Coinflip, Battles, and X-Roulette (Multiplayer Games):</strong> All players in the same game use the same EOS blockchain block ID. This means everyone can verify the exact same outcome using the server seed hash and the EOS block data that was used for that specific game.</p><p {...pageScope}><strong>Mines, Limbo, Dice, Blackjack, Cases, and Upgrader (Single Player Games):</strong> Each player has their own client seed and nonce, so verification is unique to each individual player's game.</p><p {...pageScope}>If you are comfortable with coding, you can execute the verification code using Node.js on your own system. However, we understand that setting up and using Node.js might not be feasible for everyone. To make the process more accessible, we have created a browser-based solution that allows you to run the same code directly, without the need for additional software installation or technical expertise.</p><p className="note" {...pageScope}><strong {...pageScope}>Note:</strong> Our Random Number Generator (RNG) algorithm was updated on January 18, 2026. For games played prior to this date, a different verification method must be used. The relevant code for these earlier games is also provided for your convenience.</p><p {...pageScope}>This process ensures that every game result is fair and transparent. We are committed to maintaining the highest standards of integrity and trust in our system. If you have any questions or need assistance, our support team is available to help.</p></div>
      <div className="games-nav" {...pageScope}>{games.map(([value, label]) => <button type="button" className={currentGame === value ? 'active' : ''} onClick={() => setCurrentGame(value)} key={value} {...pageScope}><span {...pageScope}>{label}</span></button>)}</div>
      <div className="codepen-embed-section" {...pageScope}><div className="codepen-header" {...pageScope}><h3 {...pageScope}>Independent Game Verification</h3><p {...pageScope}>Use the interactive CodePen below to verify game results. Enter your game data and run the verification code.</p></div><div className="codepen-container" {...pageScope}><iframe className="codepen-iframe" src={embedUrl} scrolling="no" title="Provably Fair Verification" frameBorder="no" loading="lazy" allowTransparency allowFullScreen {...pageScope} /></div></div>
      <div className="game-details" {...pageScope}><FairGameDetails game={currentGame} /></div>
      {multiplayer && <div className="multiplayer-note" {...pageScope}><div className="note-content" {...pageScope}><h3 {...pageScope}>Multiplayer Game Note</h3><p {...pageScope}><strong {...pageScope}>{displayGame}</strong> is a multiplayer game that uses EOS blockchain data. All players in the same game share the same EOS block ID, ensuring everyone can verify the exact same outcome. Individual user seeds are not used for multiplayer games to maintain fairness and prevent verification conflicts between players.</p></div></div>}
      <div className="past-seeds-section" {...pageScope}>
        <div className="past-seeds-toggle" {...pageScope}><button type="button" className={`toggle-button${showPastSeeds ? ' active' : ''}`} onClick={togglePastSeeds} {...pageScope}><span {...pageScope}>{showPastSeeds ? 'Hide' : 'Show'} Past Seeds</span><DropdownIcon rotated={showPastSeeds} /></button></div>
        {showPastSeeds && <div className="past-seeds-content" {...pageScope}>
          <div className="past-seeds-header" {...pageScope}><h3 {...pageScope}>Past User Seeds</h3><p {...pageScope}>View your previously cycled seeds that have been completed. These seeds were used for past games and are now available for verification.</p></div>
          {!pastSeedsLoading && pastSeeds.length > 0 && <div className="seeds-list" {...pageScope}>{pastSeeds.map((seed) => <div className="seed-item" key={seed.id} {...pageScope}>
            <div className="seed-header" {...pageScope}>
              {[['Client Seed:', seed.clientSeed], ['Server Seed:', seed.serverSeed], ['Server Seed (Hashed):', seed.hash], ['Nonce:', seed.nonce]].map(([label, value]) => <div className="seed-info" key={label} {...pageScope}><span className="seed-label" {...pageScope}>{label}</span><span className="seed-value" {...pageScope}>{value}</span></div>)}
            </div>
            <div className="seed-footer" {...pageScope}><div className="seed-date" {...pageScope}><span className="date-label" {...pageScope}>Completed:</span><span className="date-value" {...pageScope}>{formatDate(seed.completedAt)}</span></div><button className="copy-button" type="button" title="Copy seed data" onClick={() => copySeed(seed)} {...pageScope}><CopyIcon /></button></div>
          </div>)}</div>}
          {!pastSeedsLoading && pagination.totalPages > 1 && <div className="pagination" {...pageScope}><button className="pagination-button" type="button" disabled={pagination.page === 1} onClick={() => loadPastSeeds(pagination.page - 1)} {...pageScope}>Previous</button><span className="pagination-info" {...pageScope}>Page {pagination.page} of {pagination.totalPages}</span><button className="pagination-button" type="button" disabled={pagination.page === pagination.totalPages} onClick={() => loadPastSeeds(pagination.page + 1)} {...pageScope}>Next</button></div>}
          {pastSeedsLoading && <div className="loading" {...pageScope}><div className="loading-spinner" {...pageScope} /><p {...pageScope}>Loading past seeds...</p></div>}
        </div>}
      </div>
    </div>
  </div>
}

export default ProvablyFair
