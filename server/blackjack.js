import { createHash, randomBytes } from 'node:crypto'

export async function handleBlackjackRequest({ request, response, url, env, api }) {
  const { sendJson, readJson, startRealtimeSession, supabaseRequest, requestSessionUser, selectedCurrency, blackjackCardValue, blackjackNatural, createBlackjackDeck, publicBlackjackGame, settleBlackjack, broadcastRealtime } = api
    if (request.method === 'GET' && url.pathname === '/api/blackjack/current') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) {
        sendJson(response, 200, { game: null })
        return true
      }
      const query = new URLSearchParams({
        user_uuid: `eq.${sessionUser.uuid}`,
        state: 'in.(insurance,playing)',
        select: '*',
        order: 'created_at.desc',
        limit: '1',
      })
      const games = await supabaseRequest(env, `/rest/v1/rorisk_blackjack_games?${query}`)
      sendJson(response, 200, { game: games?.[0] ? publicBlackjackGame(games[0]) : null })
      return true
    }

    if (request.method === 'POST' && url.pathname === '/api/blackjack/start') {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const body = await readJson(request)
      const amount = Math.trunc(Number(body.amount))
      const nonce = Math.max(0, Math.trunc(Number(body.nonce)) || 0)
      if (!Number.isSafeInteger(amount) || amount < 50 || amount > 500000) throw new Error('Your entered bet amount is invalid.')
      const currency = selectedCurrency(body.currency)
      const clientSeed = String(body.clientSeed || sessionUser.uuid).slice(0, 128)
      const serverSeed = randomBytes(24).toString('hex')
      const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex')
      const deck = createBlackjackDeck(serverSeed, clientSeed, nonce)
      const playerCards = [deck[0], deck[2]]
      const dealerCards = [deck[1], deck[3]]
      let deckPosition = 4
      let state = dealerCards[0].rank === 'A' ? 'insurance' : 'playing'
      let activeHand = 'main'
      let outcomes = {}
      let payout = 0
      if (state === 'playing' && (blackjackNatural(playerCards) || blackjackNatural(dealerCards))) {
        const settled = settleBlackjack({ dealerCards, playerCards, cardsLeft: [], cardsRight: [], deck, deckPosition, betAmount: amount })
        deckPosition = settled.deckPosition
        outcomes = settled.outcomes
        payout = settled.payout
        state = 'completed'
        activeHand = 'completed'
      }
      const result = await supabaseRequest(env, '/rest/v1/rpc/start_rorisk_blackjack', {
        method: 'POST',
        body: JSON.stringify({
          p_user_uuid: sessionUser.uuid,
          p_amount: amount,
          p_currency: currency,
          p_state: state,
          p_active_hand: activeHand,
          p_dealer_cards: dealerCards,
          p_player_cards: playerCards,
          p_deck: deck,
          p_deck_position: deckPosition,
          p_outcomes: outcomes,
          p_payout: payout,
          p_client_seed: clientSeed,
          p_server_seed: serverSeed,
          p_server_seed_hash: serverSeedHash,
          p_nonce: nonce,
        }),
      })
      if (result?.user) startRealtimeSession(request, response, env, result.user)
      const game = publicBlackjackGame({ ...result.game, level: result.user?.level, rank: result.user?.rank })
      if (game.state === 'completed') broadcastRealtime({ type: 'blackjackBet', game })
      sendJson(response, 200, { ...result, game })
      return true
    }

    const blackjackActionRoute = url.pathname.match(/^\/api\/blackjack\/([a-fA-F0-9-]+)\/(insurance|hit|stand|split|double)$/)
    if (request.method === 'POST' && blackjackActionRoute) {
      const sessionUser = requestSessionUser(request, env)
      if (!sessionUser?.uuid) throw new Error('Please sign in to perform this action.')
      const body = await readJson(request)
      const [gameId, action] = blackjackActionRoute.slice(1)
      const query = new URLSearchParams({ uuid: `eq.${gameId}`, user_uuid: `eq.${sessionUser.uuid}`, state: 'in.(insurance,playing)', select: '*', limit: '1' })
      const rows = await supabaseRequest(env, `/rest/v1/rorisk_blackjack_games?${query}`)
      const row = rows?.[0]
      if (!row) throw new Error('You have no running blackjack game at the moment.')

      const deck = Array.isArray(row.deck) ? row.deck.map((card) => ({ ...card })) : []
      const dealerCards = Array.isArray(row.dealer_cards) ? row.dealer_cards.map((card) => ({ ...card })) : []
      const playerCards = Array.isArray(row.player_cards) ? row.player_cards.map((card) => ({ ...card })) : []
      let cardsLeft = Array.isArray(row.cards_left) ? row.cards_left.map((card) => ({ ...card })) : []
      let cardsRight = Array.isArray(row.cards_right) ? row.cards_right.map((card) => ({ ...card })) : []
      const actions = Array.isArray(row.actions) ? [...row.actions] : []
      const betAmount = Number(row.bet_amount) || 0
      let insuranceAmount = Number(row.insurance_amount) || 0
      let deckPosition = Number(row.deck_position) || 4
      let state = row.state
      let activeHand = row.active_hand || 'main'
      let outcomes = row.outcomes && typeof row.outcomes === 'object' ? row.outcomes : {}
      let payout = 0
      let extraWager = 0
      const draw = () => {
        if (deckPosition >= deck.length) throw new Error('The blackjack deck is exhausted.')
        const card = deck[deckPosition]
        deckPosition += 1
        return card
      }
      const complete = (mainHandWager = betAmount) => {
        const settled = settleBlackjack({ dealerCards, playerCards, cardsLeft, cardsRight, deck, deckPosition, betAmount: mainHandWager, insuranceAmount })
        deckPosition = settled.deckPosition
        outcomes = settled.outcomes
        payout = settled.payout
        state = 'completed'
        activeHand = 'completed'
      }

      if (action === 'insurance') {
        if (state !== 'insurance') throw new Error('Insurance is no longer available.')
        const accepted = body.insurance === true
        actions.push(accepted ? 'insurance' : 'no-insurance')
        if (accepted) { insuranceAmount = Math.floor(betAmount / 2); extraWager = insuranceAmount }
        if (blackjackNatural(dealerCards) || blackjackNatural(playerCards)) complete()
        else state = 'playing'
      } else {
        if (state !== 'playing') throw new Error('This blackjack action is not available.')
        if (action === 'hit') {
          if (cardsLeft.length && cardsRight.length && cardsLeft[0]?.rank === 'A' && cardsRight[0]?.rank === 'A') throw new Error('Split aces cannot receive another card.')
          actions.push('hit')
          if (cardsLeft.length && cardsRight.length) {
            const hand = activeHand === 'left' ? cardsLeft : cardsRight
            hand.push(draw())
            if (blackjackCardValue(hand) >= 21) {
              if (activeHand === 'right') activeHand = 'left'
              else complete()
            }
          } else {
            playerCards.push(draw())
            if (blackjackCardValue(playerCards) >= 21) complete()
          }
        } else if (action === 'stand') {
          actions.push('stand')
          if (cardsLeft.length && cardsRight.length && activeHand === 'right') activeHand = 'left'
          else complete()
        } else if (action === 'split') {
          if (cardsLeft.length || cardsRight.length || playerCards.length !== 2 || playerCards[0]?.rank !== playerCards[1]?.rank) throw new Error('This hand cannot be split.')
          extraWager = betAmount
          actions.push('split')
          cardsLeft = [playerCards[0], draw()]
          cardsRight = [playerCards[1], draw()]
          activeHand = blackjackCardValue(cardsRight) >= 21 ? 'left' : 'right'
        } else if (action === 'double') {
          if (cardsLeft.length || cardsRight.length || playerCards.length !== 2) throw new Error('This hand cannot be doubled.')
          extraWager = betAmount
          actions.push('double')
          playerCards.push(draw())
          complete(betAmount * 2)
        }
      }

      const result = await supabaseRequest(env, '/rest/v1/rpc/update_rorisk_blackjack', {
        method: 'POST',
        body: JSON.stringify({
          p_game_uuid: gameId,
          p_user_uuid: sessionUser.uuid,
          p_expected_updated_at: row.updated_at,
          p_extra_wager: extraWager,
          p_payout: payout,
          p_state: state,
          p_active_hand: activeHand,
          p_dealer_cards: dealerCards,
          p_player_cards: playerCards,
          p_cards_left: cardsLeft,
          p_cards_right: cardsRight,
          p_deck_position: deckPosition,
          p_actions: actions,
          p_outcomes: outcomes,
          p_insurance_amount: insuranceAmount,
        }),
      })
      if (result?.user) startRealtimeSession(request, response, env, result.user)
      const game = publicBlackjackGame({ ...result.game, level: result.user?.level, rank: result.user?.rank })
      if (game.state === 'completed') broadcastRealtime({ type: 'blackjackBet', game })
      sendJson(response, 200, { ...result, game })
      return true
    }

  return false
}

