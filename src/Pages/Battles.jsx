import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import confetti from "canvas-confetti";
import BattleIcon from "../components/BattleIcons";
import CaseInfoModal from "../components/CaseInfoModal";
import SiteIcon from "../components/Icons";
import ModalAnimation from "../components/ModalAnimation";
import { ItemCard, Pattern } from "./CaseOpen";
import { copyText, notify } from "../lib/Notifications";
import { playSound } from "../lib/Sounds";

const rootScope = { "data-v-59b5911a": "" };
const overviewHeaderScope = { "data-v-0f572e4b": "" };
const createHeaderScope = { "data-v-5aa6d116": "" };
const overviewScope = { "data-v-54553e2c": "" };
const rowScope = { "data-v-4c06dbed": "" };
const boxesScope = { "data-v-1ddbe082": "" };
const cardScope = { "data-v-f7d7dc88": "" };
const riskScope = { "data-v-44aab034": "" };
const pickerScope = { "data-v-328b41d2": "" };
const priceScope = { "data-v-6b9961fc": "" };
const sortScope = { "data-v-29346ece": "" };
const joinScope = { "data-v-846341c2": "" };
const borrowScope = { "data-v-902238ce": "" };
const fundingScope = { "data-v-75aea6f4": "" };
const createScope = { "data-v-62b2ff82": "" };
const modesScope = { "data-v-53edb736": "" };
const gameScope = { "data-v-6fe5bfb4": "" };
const gameHeaderScope = { "data-v-3ecfa966": "" };
const gameInfoScope = { "data-v-1b3d6508": "" };
const spinnerScope = { "data-v-7abeddf6": "" };
const reelScope = { "data-v-ec54b15c": "" };
const betScope = { "data-v-2235eb20": "" };
const jackpotScope = { "data-v-51bff416": "" };
const placeholderScope = { "data-v-f88cce48": "" };
const fairnessScope = { "data-v-a4722fc8": "" };

const battleXpRanks = [
  [120, "Ruby", "/assets/ranks/ruby.550e6038.svg"],
  [100, "Emerald", "/assets/ranks/emerald.2fc26a46.svg"],
  [80, "Diamond", "/assets/ranks/diamond.e915302c.svg"],
  [60, "Gold", "/assets/ranks/gold.49b1d38b.svg"],
  [40, "Silver", "/assets/ranks/silver.81ba8fbc.svg"],
  [20, "Bronze", "/assets/ranks/bronze.f59206cb.svg"],
  [0, "Rust", "/assets/ranks/rust.0b56e484.svg"],
];

const PLAYER_OPTIONS = [
  ["1v1", 2],
  ["1v1v1", 3],
  ["1v1v1v1", 4],
  ["2v2", 4],
  ["2v2v2", 6],
  ["3v3", 6],
];
const PRICE_OPTIONS = [
  "Any",
  "0 - 5,000",
  "5K - 25K",
  "25K - 100K",
  "+100,000",
];
const MODES = [
  ["crazy", "Crazy", "Lowest amount pulled out of the battle wins!", "crazy"],
  ["jackpot", "Jackpot", "Your winnings are your chance to win!", "jackpot"],
  [
    "terminal",
    "Terminal",
    "Only the last case will determine the winner.",
    "terminal",
  ],
  [
    "riskSpin",
    "Risk Spin",
    "Rare items are hidden behind a Risk Spin.",
    "risk-spin",
  ],
  [
    "fastSpin",
    "Fast Mode",
    "Speed up the case opening animation.",
    "fast-spin",
  ],
  ["funding", "Funding", "Sponsor the battle so joiners pay less!", "funding"],
  ["borrow", "Borrow", "Pay less upfront and run bigger battles!", "borrow"],
  [
    "group",
    "Group",
    "All the profit at the end will split among all players.",
    "group",
  ],
];
const riskTones = ["green", "blue", "yellow", "orange"];

function formatAmount(value) {
  return Math.floor(Number(value) || 0).toLocaleString("en-US");
}

function currencyIcon(currency) {
  return currency === "coins" ? "/assets/currency/coin.svg" : "/assets/currency/rocoin.2d3febd5.svg";
}

function mergeBattleUpdate(current, incoming) {
  if (!incoming) return current;
  const sameBattle =
    current && String(current._id) === String(incoming._id);
  const replayStartedAt = sameBattle
    ? current.clientReplayStartedAt ||
      (incoming.storedState === "countdown" ? Date.now() : null)
    : incoming.storedState === "countdown"
      ? Date.now()
      : null;
  const next = replayStartedAt
    ? { ...incoming, clientReplayStartedAt: replayStartedAt }
    : incoming;
  if (!sameBattle) return next;
  const currentVersion = Number(current.version) || 0;
  const incomingVersion = Number(incoming.version) || 0;
  if (incomingVersion < currentVersion) {
    if (
      !current.clientReplayStartedAt &&
      incoming.storedState === "countdown"
    )
      return { ...current, clientReplayStartedAt: Date.now() };
    return current;
  }
  const currentUpdatedAt = new Date(current.updatedAt || 0).getTime() || 0;
  const incomingUpdatedAt = new Date(incoming.updatedAt || 0).getTime() || 0;
  if (
    incomingVersion === currentVersion &&
    incomingUpdatedAt <= currentUpdatedAt
  ) {
    if (!current.clientReplayStartedAt && replayStartedAt)
      return { ...current, clientReplayStartedAt: replayStartedAt };
    return current;
  }
  return next;
}

function userId(user) {
  return user?.uuid || user?.id || null;
}

function navigate(path) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.error || "Unable to complete this action.");
  return payload;
}

const battleCaseRequests = new Map();
let pendingBattleRecreate = null;

function loadBattleCases(currency) {
  const key = currency === "coins" ? "coins" : "rocoins";
  if (battleCaseRequests.has(key)) return battleCaseRequests.get(key);
  const pending = request(`/api/cases?currency=${key}`)
    .then((payload) => payload.cases || [])
    .catch((error) => {
      battleCaseRequests.delete(key);
      throw error;
    });
  battleCaseRequests.set(key, pending);
  return pending;
}

function battleTheme(game) {
  if (game?.options?.crazy) return "crazy";
  if (game?.options?.jackpot) return "jackpot";
  if (game?.options?.terminal) return "terminal";
  if (game?.options?.riskSpin) return "risk-spin";
  if (Number(game?.options?.funding) > 0) return "funding";
  if (game?.mode === "group") return "group";
  if (Number(game?.options?.borrow) > 0) return "borrow";
  if (game?.options?.fastSpin) return "fast-spin";
  return "default";
}

function battleLabel(game) {
  if (["2v2", "3v3", "2v2v2"].includes(game?.mode))
    return `${game.mode} Battle`;
  if (game?.mode === "group") return "Group Battle";
  if (game?.playerCount === 2) return "1v1 Battle";
  return `${game?.playerCount || 2}-Way Battle`;
}

function fixedBets(game) {
  return Array.from(
    { length: Number(game?.playerCount) || 2 },
    (_, slot) => game?.bets?.find((bet) => Number(bet.slot) === slot) || null,
  );
}

function visibleJackpotWeights(bets = [], crazy = false, enabled = false, visibleRounds = 0) {
  if (!enabled) return [];
  const totals = bets.map((bet) =>
    (bet?.results || [])
      .filter((result) => Number(result.roundIndex) < visibleRounds)
      .reduce((sum, result) => sum + Math.max(0, Number(result.itemAmount) || 0), 0),
  );
  const raw = totals.map((total) =>
    crazy
      ? total > 0
        ? 1 / total
        : 0
      : total,
  );
  const rawTotal = raw.reduce((sum, weight) => sum + weight, 0);
  const fallback = rawTotal <= 0;
  const denominator = fallback ? Math.max(1, bets.length) : rawTotal;
  return bets.map((bet, index) => ({
    slot: Number(bet?.slot) || index,
    weight: fallback ? 1 : raw[index],
    percentage: Number(
      (((fallback ? 1 : raw[index]) / denominator) * 100).toFixed(2),
    ),
  }));
}

function effectiveJoinAmount(game) {
  if (Number.isFinite(Number(game?.joinAmount))) return Number(game.joinAmount);
  const funding = Math.min(
    100,
    Math.max(0, Number(game?.options?.funding) || 0),
  );
  const borrow = Math.min(80, Math.max(0, Number(game?.options?.borrow) || 0));
  return Math.floor(
    (Math.floor(((Number(game?.amount) || 0) * (100 - funding)) / 100) *
      (100 - borrow)) /
      100,
  );
}

function optionBadges(game, scope = rowScope) {
  return (
    <>
      {game?.options?.crazy && (
        <>
          <span className="separator" {...scope}>
            {"\u00a0•\u00a0"}
          </span>
          <span className="option-text crazy" {...scope}>
            Crazy
          </span>
        </>
      )}
      {game?.options?.terminal && (
        <>
          <span className="separator" {...scope}>
            {"\u00a0•\u00a0"}
          </span>
          <span className="option-text terminal" {...scope}>
            Terminal
          </span>
        </>
      )}
      {game?.options?.jackpot && (
        <>
          <span className="separator" {...scope}>
            {"\u00a0•\u00a0"}
          </span>
          <span className="option-text jackpot" {...scope}>
            <BattleIcon name="jackpot" {...scope} />
          </span>
        </>
      )}
      {Number(game?.options?.funding) > 0 && (
        <>
          <span className="separator" {...scope}>
            {"\u00a0•\u00a0"}
          </span>
          <span className="option-text funding" {...scope}>
            <BattleIcon name="funding" {...scope} /> (-{game.options.funding}%)
          </span>
        </>
      )}
      {Number(game?.options?.levelMin) > 0 && (
        <>
          <span className="separator" {...scope}>
            {"\u00a0•\u00a0"}
          </span>
          <span className="option-text level" {...scope}>
            Lvl {game.options.levelMin}+
          </span>
        </>
      )}
      {Number(game?.options?.borrow) > 0 && (
        <>
          <span className="separator" {...scope}>
            {"\u00a0•\u00a0"}
          </span>
          <span className="option-text borrow" {...scope}>
            <BattleIcon name="borrow" {...scope} /> {game.options.borrow}%
          </span>
        </>
      )}
    </>
  );
}

function AnimatedNumber({ value, format = formatAmount }) {
  const elementRef = useRef(null);
  const previous = useRef(Number(value) || 0);
  useLayoutEffect(() => {
    const from = previous.current;
    const to = Number(value) || 0;
    const element = elementRef.current;
    if (!element) return undefined;
    if (from === to) {
      element.textContent = format(to);
      return undefined;
    }
    if (to < from) {
      previous.current = to;
      element.textContent = format(to);
      return undefined;
    }
    const start = performance.now();
    let frame;
    const animate = (time) => {
      const progress = Math.min(1, (time - start) / 800);
      const eased = 1 - (1 - progress) ** 3;
      const next = from + (to - from) * eased;
      previous.current = next;
      element.textContent = format(next);
      if (progress < 1) frame = requestAnimationFrame(animate);
      else previous.current = to;
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [format, value]);
  return <span ref={elementRef} aria-label={format(Number(value) || 0)} />;
}

function BattleBoxes({ game }) {
  const rounds = game?.rounds?.length
    ? game.rounds.map((round) => round.box)
    : (game?.boxes || []).flatMap((entry) =>
        Array.from({ length: entry.count || 1 }, () => entry.box),
      );
  return (
    <div className="battles-game-boxes-wrapper" {...boxesScope}>
      <div
        className={`battles-game-boxes${game?.state === "rolling" ? " boxes-rolling" : ""}${game?.state === "completed" ? " boxes-completed" : ""}`}
        {...boxesScope}
      >
        <div className="boxes-list" {...boxesScope}>
          {rounds.map((box, index) => (
            <button
              className={`button-box${(index === 0 && ["created", "countdown", "pending"].includes(game?.state)) || index + 1 === Number(game?.currentRound) ? " button-active" : ""}`}
              type="button"
              key={`${box?._id || box?.caseId}-${index}`}
              title={box?.name}
              {...boxesScope}
            >
              <img
                className="image-loaded"
                src={box?.imageUrl || box?.image}
                loading="lazy"
                decoding="async"
                alt={box?.name || ""}
                {...boxesScope}
              />
              <img
                className="image-loaded"
                src={box?.imageUrl || box?.image}
                loading="lazy"
                decoding="async"
                aria-hidden="true"
                alt=""
                {...boxesScope}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="rounds-display" {...boxesScope}>
        <span {...boxesScope}>{game?.currentRound || 0}</span>
        <span className="rounds-separator" {...boxesScope}>/</span>
        <span className="rounds-total" {...boxesScope}>{rounds.length}</span>
        <span className="rounds-label" {...boxesScope}> Rounds</span>
      </div>
    </div>
  );
}

const BattleRow = memo(function BattleRow({ game, onJoin, rowRef }) {
  const bets = fixedBets(game);
  const theme = battleTheme(game);
  const totalRounds = Number(game.totalRounds) || game.rounds?.length || 1;
  const currentRound =
    game.state === "completed"
      ? totalRounds
      : Math.min(totalRounds, Number(game.currentRound) || 0);
  const viewMode =
    game.state === "completed" || game.bets?.length >= game.playerCount;
  const joinAmount = effectiveJoinAmount(game);
  const classes = [
    "battles-game-element",
    `element-${game.state}`,
    `element-${game.mode}`,
    `player-count-${game.playerCount}`,
    ["2v2", "3v3", "2v2v2"].includes(game.mode) ? "element-team" : "",
    game.options?.crazy ? "element-crazy" : "",
    game.options?.terminal ? "element-terminal" : "",
    game.options?.jackpot ? "element-jackpot" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const open = () => navigate(`/battles/${game._id}`);
  return (
    <div className={classes} ref={rowRef} {...rowScope}>
      <div
        className={`round-progress round-progress-${theme}${currentRound === 0 ? " round-progress-idle" : ""}`}
        {...rowScope}
      >
        <div className="round-progress-ring" {...rowScope}>
          <svg viewBox="0 0 64 64" aria-hidden="true" {...rowScope}>
            <circle
              className="round-progress-track"
              cx="32"
              cy="32"
              r="27"
              {...rowScope}
            />
            <circle
              className="round-progress-fill"
              cx="32"
              cy="32"
              r="27"
              style={{
                strokeDashoffset: 169.646 * (1 - currentRound / totalRounds),
              }}
              {...rowScope}
            />
          </svg>
          <div className="round-progress-value" {...rowScope}>
            {currentRound}/{totalRounds}
          </div>
        </div>
        <span className="round-progress-label" {...rowScope}>
          Rounds
        </span>
      </div>
      <div className="wrapper-players" {...rowScope}>
        <div className="info-section" {...rowScope}>
          <div className="info-title" {...rowScope}>
            <span {...rowScope}>{battleLabel(game)}</span>
            {optionBadges(game)}
          </div>
        </div>
        <div className="players-section" {...rowScope}>
          {bets.map((bet, index) => (
            <Fragment key={index}>
              <div
                className="players-element"
                data-index={index}
                onClick={() => {
                  if (!bet && !viewMode) onJoin(game, index);
                }}
                {...rowScope}
              >
                <div
                  className={`element-user user-${!bet ? "empty" : bet.bot ? "bot" : bet.user?.rank || "user"}${bet && !bet.bot ? ` user-${bet.user?._id || bet.user?.uuid || ""}` : ""}${game.state === "completed" && bet?.payout > 0 ? " user-winner" : ""}`}
                  {...rowScope}
                >
                  <img
                    className="avatar-image"
                    src={!bet ? "/assets/images/battles/no-player.png" : bet.bot ? "/assets/images/battles/risk-bot.png" : bet.user?.avatar || "/assets/users/default-avatar.png"}
                    alt={!bet ? "No Player" : bet.bot ? "Bot" : bet.user?.username || "Player"}
                    loading="lazy"
                    decoding="async"
                    {...rowScope}
                  />
                </div>
              </div>
              {index < bets.length - 1 && (
                <div
                  className="element-separator"
                  data-index={index}
                  {...rowScope}
                >
                  <BattleIcon name="versus" {...rowScope} />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="cases-section" {...rowScope}>
        <BattleBoxes game={game} />
      </div>
      <div className="right-section" {...rowScope}>
        <div className="right-action" {...rowScope}>
          <button
            className={`action-button ${viewMode ? `link-replay link-replay-${theme}` : "button-join"}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              open();
            }}
            {...rowScope}
          >
            {viewMode ? (
              <BattleIcon
                className="action-button-icon"
                name="eye"
                {...rowScope}
              />
            ) : (
              <BattleIcon
                className="action-button-icon"
                name="join"
                {...rowScope}
              />
            )}
            <span {...rowScope}>
              {viewMode ? "View Battle" : "Join Battle"}
            </span>
          </button>
          <div
            className={`effective-amount${joinAmount <= 0 ? " is-free" : ""}`}
            {...rowScope}
          >
            {joinAmount > 0 && (
              <img src={currencyIcon(game.currency)} alt="" {...rowScope} />
            )}
            <span className="effective-value" {...rowScope}>
              {joinAmount <= 0 ? "FREE" : formatAmount(joinAmount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}, (previous, next) =>
  previous.onJoin === next.onJoin &&
  previous.game?._id === next.game?._id &&
  previous.game?.version === next.game?.version &&
  previous.game?.state === next.game?.state &&
  previous.game?.currentRound === next.game?.currentRound,
);

function Lobby({ games, loading, sort, setSort, currency, onJoin }) {
  const [clock, setClock] = useState(() => Date.now());
  const battleNodes = useRef(new Map());
  const battlePositions = useRef(new Map());
  const battleAnimations = useRef(new Map());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  const liveGames = useMemo(
    () => games.map((game) => deriveLiveGame(game, clock)),
    [clock, games],
  );
  const sorted = useMemo(
    () => {
      const isActive = (game) =>
        ["created", "countdown", "pending", "rolling", "jackpot_spinning"].includes(
          game.state,
        );
      return [...liveGames].sort((left, right) => {
        const leftActive = isActive(left);
        const rightActive = isActive(right);
        if (leftActive !== rightActive) return leftActive ? -1 : 1;
        return sort === "price"
          ? Number(right.amount) - Number(left.amount)
          : new Date(right.createdAt) - new Date(left.createdAt);
      });
    },
    [liveGames, sort],
  );
  const registerBattleNode = useCallback((id, node) => {
    if (node) battleNodes.current.set(String(id), node);
    else battleNodes.current.delete(String(id));
  }, []);
  const sortedOrder = sorted.map((game) => String(game._id)).join("|");
  useLayoutEffect(() => {
    for (const animation of battleAnimations.current.values())
      animation.cancel();
    battleAnimations.current.clear();
    const nextPositions = new Map();
    for (const id of sortedOrder ? sortedOrder.split("|") : []) {
      const node = battleNodes.current.get(id);
      if (!node) continue;
      const nextTop = node.getBoundingClientRect().top;
      nextPositions.set(id, nextTop);
      const previousTop = battlePositions.current.get(id);
      const delta = Number.isFinite(previousTop) ? previousTop - nextTop : 0;
      if (Math.abs(delta) < 0.5) continue;
      const animation = node.animate(
        [
          { transform: `translateY(${delta}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: 400, easing: "ease" },
      );
      battleAnimations.current.set(id, animation);
      animation.addEventListener("finish", () => {
        if (battleAnimations.current.get(id) === animation)
          battleAnimations.current.delete(id);
      });
    }
    battlePositions.current = nextPositions;
  }, [sortedOrder]);
  useEffect(
    () => () => {
      for (const animation of battleAnimations.current.values())
        animation.cancel();
      battleAnimations.current.clear();
    },
    [],
  );
  const joinable = liveGames.filter(
    (game) => game.state === "created" && game.bets?.length < game.playerCount,
  ).length;
  const activeGames = liveGames.filter((game) =>
    ["created", "countdown", "pending", "rolling", "jackpot_spinning"].includes(
      game.state,
    ),
  );
  const total = activeGames
    .filter((game) => game.currency === currency)
    .reduce((sum, game) => sum + Number(game.amount || 0), 0);
  return (
    <>
      <div className="battles-header" {...rootScope}>
        <div className="battles-header-overview" {...overviewHeaderScope}>
          <div className="overview-title-container" {...overviewHeaderScope}>
            <div className="overview-title" {...overviewHeaderScope}>
              <SiteIcon name="battles" {...overviewHeaderScope} />
              Battles
            </div>
            <div className="overview-stats" {...overviewHeaderScope}>
              <div className="stats-item" {...overviewHeaderScope}>
                <span className="stats-number" {...overviewHeaderScope}>
                  <AnimatedNumber value={activeGames.length} />
                </span>
                <span className="stats-label" {...overviewHeaderScope}>
                  Total Games
                </span>
              </div>
              <div className="stats-divider" {...overviewHeaderScope} />
              <div className="stats-item" {...overviewHeaderScope}>
                <span className="stats-number" {...overviewHeaderScope}>
                  <AnimatedNumber value={joinable} />
                </span>
                <span className="stats-label" {...overviewHeaderScope}>
                  Joinable
                </span>
              </div>
              <div className="stats-divider" {...overviewHeaderScope} />
              <div className="stats-item" {...overviewHeaderScope}>
                <img
                  src={currencyIcon(currency)}
                  alt=""
                  {...overviewHeaderScope}
                />
                <span
                  className="stats-number coin-value"
                  {...overviewHeaderScope}
                >
                  <AnimatedNumber value={total} />
                </span>
              </div>
            </div>
          </div>
          <div className="overview-controls" {...overviewHeaderScope}>
            <button
              className={`filter-button${sort === "price" ? " active" : ""}`}
              type="button"
              onClick={() => setSort("price")}
              {...overviewHeaderScope}
            >
              Price
            </button>
            <button
              className={`filter-button${sort === "date" ? " active" : ""}`}
              type="button"
              onClick={() => setSort("date")}
              {...overviewHeaderScope}
            >
              Latest
            </button>
            <a
              className="button-create"
              href="/battles/create"
              onClick={(event) => {
                event.preventDefault();
                navigate("/battles/create");
              }}
              {...overviewHeaderScope}
            >
              Create Battle
            </a>
          </div>
        </div>
      </div>
      <div className="battles-content" {...rootScope}>
        <div className="battles-overview" {...overviewScope}>
          <div className="overview-content" {...overviewScope}>
            {loading ? (
              <div className="overview-loading" {...overviewScope}>
                {Array.from({ length: 20 }, (_, index) => (
                  <div
                    className="loading-placeholder"
                    key={index}
                    {...overviewScope}
                  >
                    <div className="placeholder-cases" {...overviewScope}>
                      {Array.from({ length: 5 }, (_, child) => (
                        <div
                          className="placeholder-case"
                          key={child}
                          {...overviewScope}
                        />
                      ))}
                    </div>
                    <div className="placeholder-right" {...overviewScope}>
                      <div className="placeholder-price" {...overviewScope} />
                      <div className="placeholder-button" {...overviewScope} />
                    </div>
                  </div>
                ))}
              </div>
            ) : sorted.length ? (
              <div className="content-list" {...overviewScope}>
                <div className="battles-list-container" {...overviewScope}>
                  {sorted.map((game) => (
                    <BattleRow
                      game={game}
                      onJoin={onJoin}
                      rowRef={(node) => registerBattleNode(game._id, node)}
                      key={game._id}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div
                className="content-empty"
                aria-hidden="true"
                {...overviewScope}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const BattleCaseCard = memo(function BattleCaseCard({
  box,
  count,
  currency,
  onAdd,
  onRemove,
  draggable = false,
}) {
  const amount =
    currency === "coins"
      ? (box.coinAmount ?? box.amount)
      : (box.rocoinAmount ?? box.amount);
  const isNew = Array.isArray(box.categories) && box.categories.includes("new");
  return (
    <div
      className={`battles-box-element${count > 0 ? " element-selected" : ""}${draggable ? " is-draggable" : ""}`}
      data-draggable={draggable || undefined}
      onClick={() => count === 0 && onAdd(box)}
      {...cardScope}
    >
      {isNew && (
        <div className="box-new" {...cardScope}>
          New
        </div>
      )}
      <div className="box-content" {...cardScope}>
        <div className="box-image" {...cardScope}>
          <img
            className="box-image-top"
            src={box.imageUrl || box.image}
            loading="lazy"
            decoding="async"
            alt=""
            {...cardScope}
          />
          <img
            className="box-image-glow"
            src={box.imageUrl || box.image}
            loading="lazy"
            decoding="async"
            alt=""
            {...cardScope}
          />
        </div>
        <div className="box-name-container" {...cardScope}>
          <div className="box-info" {...cardScope}>
            <div className="box-name" {...cardScope}>
              {box.name}
            </div>
            <div className="box-price" {...cardScope}>
              <img src={currencyIcon(currency)} alt="" {...cardScope} />
              <span {...cardScope}>
                {formatAmount(Number(amount) * Math.max(1, count))}
              </span>
            </div>
            <CaseRiskBar bar={box.rarityBar} />
          </div>
        </div>
        {count > 0 ? (
          <div className="quantity-controls" {...cardScope}>
            <button
              className="control-btn"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(box);
              }}
              {...cardScope}
            >
              <BattleIcon name="minus" size={16} {...cardScope} />
            </button>
            <span className="quantity" {...cardScope}>
              {count}
            </span>
            <button
              className={`control-btn${count >= 50 ? " disabled" : ""}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAdd(box);
              }}
              {...cardScope}
            >
              <BattleIcon name="add" size={18} {...cardScope} />
            </button>
          </div>
        ) : (
          <div className="add-case-container" {...cardScope}>
            <button
              className="add-case-btn"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAdd(box);
              }}
              {...cardScope}
            >
              Add Case
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

function CaseRiskBar({ bar }) {
  if (!bar) return null;
  const markerValue = Number(bar.marker);
  const marker = Number.isFinite(markerValue)
    ? Math.max(0, Math.min(100, markerValue))
    : 50;
  const toneIndex = riskTones.indexOf(bar.tone);
  const activeIndex =
    toneIndex >= 0 ? toneIndex : Math.min(3, Math.floor(marker / 25));

  return (
    <div className="cases-rarity-bar" {...riskScope}>
      <div className="rarity-segments" {...riskScope}>
        {riskTones.map((tone, index) => (
          <div
            className={`rarity-segment segment-${index}${
              index === activeIndex ? ` is-active tone-${tone}` : ""
            }`}
            key={tone}
            {...riskScope}
          />
        ))}
      </div>
      <div
        className="rarity-tick"
        style={{ left: `calc(${marker}% - 1.5px)` }}
        {...riskScope}
      />
    </div>
  );
}

function PickerDropdown({ type, value, open, onToggle, onSelect }) {
  const price = type === "Price Range";
  const scope = price ? priceScope : sortScope;
  const root = price ? "battles-filter-price" : "battles-filter-sort-cases";
  const menu = price ? "price" : "cases";
  const options = price ? PRICE_OPTIONS : ["Lowest", "Highest"];
  return (
    <div className={`${root}${open ? ` ${menu}-open` : ""}`} {...scope}>
      <button
        className="button-toggle"
        type="button"
        onClick={onToggle}
        {...scope}
      >
        <div className="button-inner" {...scope}>
          <div className="inner-value" {...scope}>
            {type}: <span {...scope}>{value}</span>
          </div>
          <SiteIcon name="chevron-down" {...scope} />
        </div>
      </button>
      {open && (
        <div className={`${menu}-menu dropdown-enter-active`} {...scope}>
          <div className="menu-inner" {...scope}>
            {options.map((option) => (
              <button
                type="button"
                onClick={() => onSelect(option)}
                key={option}
                {...scope}
              >
                {option === "5K - 25K"
                  ? "5,000 - 25,000"
                  : option === "+100,000"
                    ? "+100K"
                    : option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CasePicker({ boxes, selected, currency, onAdd, onRemove, onClose }) {
  const [search, setSearch] = useState("");
  const [price, setPrice] = useState("Any");
  const [sort, setSort] = useState("Highest");
  const [dropdown, setDropdown] = useState(null);
  const counts = useMemo(
    () =>
      selected.reduce(
        (map, box) => map.set(box.caseId, (map.get(box.caseId) || 0) + 1),
        new Map(),
      ),
    [selected],
  );
  const filtered = useMemo(
    () =>
      boxes
        .filter((box) => {
          const amount =
            Number(currency === "coins" ? box.coinAmount : box.rocoinAmount) ||
            0;
          if (!box.name.toLowerCase().includes(search.trim().toLowerCase()))
            return false;
          if (price === "0 - 5,000") return amount <= 5000;
          if (price === "5K - 25K") return amount > 5000 && amount <= 25000;
          if (price === "25K - 100K") return amount > 25000 && amount <= 100000;
          if (price === "+100,000") return amount > 100000;
          return true;
        })
        .sort(
          (a, b) =>
            (sort === "Highest" ? -1 : 1) *
            ((Number(currency === "coins" ? a.coinAmount : a.rocoinAmount) ||
              0) -
              (Number(currency === "coins" ? b.coinAmount : b.rocoinAmount) ||
                0)),
        ),
    [boxes, currency, price, search, sort],
  );
  const { limiteds, mm2 } = useMemo(
    () => ({
      limiteds: filtered.filter((box) => box.type !== "mm2"),
      mm2: filtered.filter((box) => box.type === "mm2"),
    }),
    [filtered],
  );
  const list = (items) => (
    <div className="content-list" {...pickerScope}>
      {items.map((box) => (
        <BattleCaseCard
          box={box}
          count={counts.get(box.caseId) || 0}
          currency={currency}
          onAdd={onAdd}
          onRemove={onRemove}
          key={box.caseId}
        />
      ))}
    </div>
  );
  const total = selected.reduce(
    (sum, box) =>
      sum + Number(currency === "coins" ? box.coinAmount : box.rocoinAmount),
    0,
  );
  return (
    <div className="modal-battles-select" {...pickerScope}>
      <div className="modal-battles-select-content" {...pickerScope}>
        <div className="modal-battles-select-header-title" {...pickerScope}>
          <span {...pickerScope}>Select Cases</span>
        </div>
        <div className="modal-battles-select-filters" {...pickerScope}>
          <div className="modal-battles-select-filters-search" {...pickerScope}>
            <SiteIcon name="search" {...pickerScope} />
            <input
              type="text"
              placeholder="Search for a case..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              {...pickerScope}
            />
          </div>
          <div className="modal-battles-select-filters" {...pickerScope}>
            <PickerDropdown
              type="Price Range"
              value={price}
              open={dropdown === "price"}
              onToggle={() =>
                setDropdown(dropdown === "price" ? null : "price")
              }
              onSelect={(next) => {
                setPrice(next);
                setDropdown(null);
              }}
            />
            <PickerDropdown
              type="Sort By"
              value={sort}
              open={dropdown === "sort"}
              onToggle={() => setDropdown(dropdown === "sort" ? null : "sort")}
              onSelect={(next) => {
                setSort(next);
                setDropdown(null);
              }}
            />
          </div>
        </div>
        <div className="modal-battles-select-boxes" {...pickerScope}>
          {filtered.length ? (
            <>
              {limiteds.length > 0 && list(limiteds)}
              {limiteds.length > 0 && mm2.length > 0 && (
                <div className="cases-separator" {...pickerScope}>
                  <div className="separator-line" {...pickerScope} />
                  <div className="separator-label" {...pickerScope}>
                    <span className="separator-title" {...pickerScope}>
                      Murder Mystery 2
                    </span>
                    <span className="separator-subtitle" {...pickerScope}>
                      Cases
                    </span>
                  </div>
                  <div className="separator-line" {...pickerScope} />
                </div>
              )}
              {mm2.length > 0 && list(mm2)}
            </>
          ) : (
            <div className="content-empty" {...pickerScope}>
              No cases available.
            </div>
          )}
        </div>
        <div className="modal-battles-select-footer" {...pickerScope}>
          <div className="modal-battles-select-footer-info" {...pickerScope}>
            <div className="footer-item" {...pickerScope}>
              <span {...pickerScope}>Total Cases:</span>
              <span className="value" {...pickerScope}>
                {selected.length}
              </span>
            </div>
            <div className="footer-item" {...pickerScope}>
              <span {...pickerScope}>Total Selected:</span>
              <span className="value" {...pickerScope}>
                {formatAmount(total)}
              </span>
            </div>
          </div>
          <button
            className="continue-button"
            type="button"
            onClick={onClose}
            {...pickerScope}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function SliderModal({
  type,
  value,
  onChange,
  onClose,
  baseCost,
  playerCount,
  borrow,
  currency,
}) {
  const max = type === "Borrow" ? 80 : 100;
  const isBorrow = type === "Borrow";
  const scope = isBorrow ? borrowScope : fundingScope;
  const prefix = isBorrow ? "borrow" : "funding";
  const borrowingAmount = Math.floor((baseCost * value) / 100);
  const joinersPayAmount = Math.floor(
    ((baseCost - Math.floor((baseCost * value) / 100)) * (100 - borrow)) / 100,
  );
  const fundedCost = Math.floor(
    ((baseCost +
      Math.floor((baseCost * Math.max(0, playerCount - 1) * value) / 100)) *
      (100 - borrow)) /
      100,
  );
  const youPayAmount = isBorrow ? baseCost - borrowingAmount : fundedCost;
  return (
    <div className={`modal-battles-${prefix}`} {...scope}>
      <div className={`${prefix}-header`} {...scope}>
        <div className={`${prefix}-header-icon`} {...scope}>
          <BattleIcon name={isBorrow ? "borrow" : "funding"} {...scope} />
        </div>
        <span className={`${prefix}-title`} {...scope}>
          {type} Mode
        </span>
      </div>
      <div className={`${prefix}-info`} {...scope}>
        {isBorrow
          ? "Borrow up to 80% of the battle cost. If you win, the borrowed amount will be deducted from your winnings."
          : "Cover up to 100% of the join cost. Joiners pay less, and you cover that discount for each of them."}
      </div>
      <div className={`${prefix}-rows`} {...scope}>
        <div className={`${prefix}-row`} {...scope}>
          <span className={`${prefix}-label`} {...scope}>
            {type} Percentage
          </span>
          <span className={`${prefix}-value`} {...scope}>
            {value}%
          </span>
        </div>
        <div className={`${prefix}-slider-wrap`} {...scope}>
          <div className={`${prefix}-slider-track`} {...scope}>
            <span className={`${prefix}-slider-line`} {...scope} />
            <span
              className={`${prefix}-slider-fill`}
              style={{ width: `${(value / max) * 100}%` }}
              {...scope}
            />
            <input
              className={`${prefix}-slider-input`}
              type="range"
              min="0"
              max={max}
              step="1"
              aria-label={`${type} percentage`}
              value={value}
              onChange={(event) => onChange(Number(event.target.value))}
              {...scope}
            />
          </div>
          <div className={`${prefix}-slider-labels`} {...scope}>
            <span {...scope}>0%</span>
            <span {...scope}>{max}%</span>
          </div>
        </div>
        <div className={`${prefix}-row`} {...scope}>
          <span className={`${prefix}-label`} {...scope}>
            {isBorrow ? "Borrowing" : "Joiners Pay"}
          </span>
          <span className={`${prefix}-value`} {...scope}>
            <img
              className="row-icon"
              src={currencyIcon(currency)}
              alt=""
              {...scope}
            />
            {formatAmount(isBorrow ? borrowingAmount : joinersPayAmount)}
          </span>
        </div>
        <div className={`${prefix}-row`} {...scope}>
          <span className={`${prefix}-label`} {...scope}>
            You Pay
          </span>
          <span className={`${prefix}-value`} {...scope}>
            <img
              className="row-icon"
              src={currencyIcon(currency)}
              alt=""
              {...scope}
            />
            {formatAmount(youPayAmount)}
          </span>
        </div>
      </div>
      <button
        className={`${prefix}-submit`}
        type="button"
        onClick={onClose}
        {...scope}
      >
        Confirm {type}
      </button>
    </div>
  );
}

function JoinModal({ busy, onCancel, onConfirm }) {
  return (
    <div className="modal-battles-join" {...joinScope}>
      <div className="join-title" {...joinScope}>
        <span className="join-message-title" {...joinScope}>
          Join Battle
        </span>
      </div>
      <div className="join-message" {...joinScope}>
        <p {...joinScope}>Are you sure you want to join this battle?</p>
      </div>
      <div className="join-actions" {...joinScope}>
        <button
          className="button-cancel"
          type="button"
          disabled={busy}
          onClick={onCancel}
          {...joinScope}
        >
          <div className="button-inner" {...joinScope}>
            Cancel
          </div>
        </button>
        <button
          className="button-confirm"
          type="button"
          disabled={busy}
          onClick={onConfirm}
          {...joinScope}
        >
          <div className="button-inner" {...joinScope}>
            <span {...joinScope}>Confirm</span>
          </div>
        </button>
      </div>
    </div>
  );
}

function CreateBattle({ boxes, currency, user, onUserUpdate }) {
  const [selected, setSelected] = useState([]);
  const [size, setSize] = useState("1v1");
  const [playersOpen, setPlayersOpen] = useState(false);
  const [playersMounted, setPlayersMounted] = useState(false);
  const playersDropdownRef = useRef(null);
  const playersCloseTimerRef = useRef(null);
  const [modes, setModes] = useState({
    crazy: false,
    jackpot: false,
    terminal: false,
    riskSpin: false,
    fastSpin: false,
    group: false,
    funding: 0,
    borrow: 0,
  });
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const playerCount =
    PLAYER_OPTIONS.find(([label]) => label === size)?.[1] || 2;
  const base = selected.reduce(
    (sum, box) =>
      sum + Number(currency === "coins" ? box.coinAmount : box.rocoinAmount),
    0,
  );
  const total = Math.floor(
    ((base +
      Math.floor((base * Math.max(0, playerCount - 1) * modes.funding) / 100)) *
      (100 - modes.borrow)) /
      100,
  );
  const grouped = useMemo(
    () => [
      ...selected
        .reduce(
          (map, box) =>
            map.set(box.caseId, {
              box,
              count: (map.get(box.caseId)?.count || 0) + 1,
            }),
          new Map(),
        )
        .values(),
    ],
    [selected],
  );
  const add = useCallback(
    (box) =>
      setSelected((current) =>
        current.length >= 50 ? current : [...current, box],
      ),
    [],
  );
  const remove = useCallback(
    (box) =>
      setSelected((current) => {
        const index = current.findLastIndex(
          (entry) => entry.caseId === box.caseId,
        );
        return index < 0
          ? current
          : current.filter((_, itemIndex) => itemIndex !== index);
      }),
    [],
  );
  const closePlayers = useCallback(() => {
    setPlayersOpen(false);
    window.clearTimeout(playersCloseTimerRef.current);
    playersCloseTimerRef.current = window.setTimeout(
      () => setPlayersMounted(false),
      200,
    );
  }, []);
  const togglePlayers = () => {
    if (playersMounted) return closePlayers();
    window.clearTimeout(playersCloseTimerRef.current);
    setPlayersMounted(true);
    window.requestAnimationFrame(() => setPlayersOpen(true));
  };
  useEffect(() => {
    if (!playersMounted) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!playersDropdownRef.current?.contains(event.target)) closePlayers();
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [closePlayers, playersMounted]);
  useEffect(() => () => window.clearTimeout(playersCloseTimerRef.current), []);
  useEffect(() => {
    const raw = window.sessionStorage.getItem("rorisk_battle_recreate");
    if (!pendingBattleRecreate && !raw) return;
    try {
      const recreated = pendingBattleRecreate || JSON.parse(raw);
      const recreatedBoxes = recreated.boxes || [];
      if (!boxes.length && recreatedBoxes.some((entry) => !entry.box)) return;
      const selectedBoxes = recreatedBoxes.flatMap((entry) => {
        const caseId = String(entry._id || entry.caseId || "");
        const box =
          entry.box ||
          boxes.find(
            (candidate) =>
              String(candidate.caseId || candidate._id) === caseId,
          );
        return box
          ? Array.from(
              { length: Math.max(1, Number(entry.count) || 1) },
              () => box,
            )
          : [];
      });
      window.sessionStorage.removeItem("rorisk_battle_recreate");
      pendingBattleRecreate = null;
      const count = Number(recreated.playerCount) || 2;
      const recreatedSize = ["2v2", "3v3", "2v2v2"].includes(recreated.mode)
        ? recreated.mode
        : count === 3
          ? "1v1v1"
          : count === 4
            ? "1v1v1v1"
            : "1v1";
      const frame = window.requestAnimationFrame(() => {
        setSelected(selectedBoxes.slice(0, 50));
        setSize(recreatedSize);
        setModes({
          crazy: Boolean(recreated.crazy),
          jackpot: Boolean(recreated.jackpot),
          terminal: Boolean(recreated.terminal),
          riskSpin: Boolean(recreated.riskSpin),
          fastSpin: Boolean(recreated.fastSpin),
          group: recreated.mode === "group" || Boolean(recreated.group),
          funding: Number(recreated.funding) || 0,
          borrow: Number(recreated.borrow) || 0,
        });
        if (
          recreated.currency === "coins" ||
          recreated.currency === "rocoins"
        ) {
          window.localStorage.setItem("currency", recreated.currency);
          window.dispatchEvent(
            new CustomEvent("rorisk:currency-change", {
              detail: { currency: recreated.currency },
            }),
          );
        }
      });
      return () => window.cancelAnimationFrame(frame);
    } catch {
      window.sessionStorage.removeItem("rorisk_battle_recreate");
      pendingBattleRecreate = null;
    }
  }, [boxes]);
  const toggle = (key) => {
    if (key === "funding" || key === "borrow") return setModal(key);
    if (
      key === "group" &&
      (["2v2", "3v3", "2v2v2"].includes(size) ||
        modes.crazy ||
        modes.terminal ||
        modes.jackpot)
    )
      return notify({
        type: "error",
        message:
          "Group battles cannot be combined with team, Crazy, Terminal, or Jackpot modes.",
      });
    if (key === "terminal" && modes.jackpot)
      return notify({
        type: "error",
        message: "Terminal mode cannot be combined with Jackpot mode.",
      });
    setModes((current) => ({
      ...current,
      [key]: !current[key],
      ...(key === "jackpot" && !current.jackpot
        ? { terminal: false, group: false }
        : {}),
      ...(["crazy", "terminal"].includes(key) && !current[key]
        ? { group: false }
        : {}),
    }));
  };
  const create = async () => {
    if (!user)
      return notify({
        type: "error",
        message: "Please sign in to perform this action.",
      });
    if (!selected.length)
      return notify({
        type: "error",
        message: "Please select at least one case.",
      });
    setBusy(true);
    try {
      const payload = await request("/api/battles", {
        method: "POST",
        body: JSON.stringify({
          boxes: grouped.map(({ box, count }) => ({ _id: box.caseId, count })),
          playerCount,
          mode: ["2v2", "3v3", "2v2v2"].includes(size)
            ? size
            : modes.group
              ? "group"
              : "standard",
          levelMin: 0,
          funding: modes.funding,
          hostJoin: true,
          private: false,
          affiliateOnly: false,
          crazy: modes.crazy,
          terminal: modes.terminal,
          jackpot: modes.jackpot,
          fastSpin: modes.fastSpin,
          riskSpin: modes.riskSpin,
          borrow: modes.borrow,
          currency,
        }),
      });
      if (payload.user) onUserUpdate(payload.user);
      playSound("join", { volume: 0.55 });
      navigate(`/battles/${payload.game._id}`);
    } catch (error) {
      notify({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="battles-header" {...rootScope}>
        <div className="battles-header-create" {...createHeaderScope}>
          <div className="battles-header-create-left" {...createHeaderScope}>
            <a
              className="link-back"
              href="/battles"
              onClick={(event) => {
                event.preventDefault();
                navigate("/battles");
              }}
              {...createHeaderScope}
            >
              <BattleIcon name="back" {...createHeaderScope} />
            </a>
            <div className="create-title" {...createHeaderScope}>
              Create Battle
            </div>
          </div>
          <div className="battles-header-create-right" {...createHeaderScope}>
            <div className="total-value" {...createHeaderScope}>
              <span className="total-value-label" {...createHeaderScope}>
                {modes.borrow ? "Total Value Borrow" : "Total Value"}
              </span>
              <div className="total-value-amount" {...createHeaderScope}>
                <img
                  src={currencyIcon(currency)}
                  alt=""
                  {...createHeaderScope}
                />
                <span {...createHeaderScope}>{formatAmount(total)}</span>
              </div>
            </div>
            <div className="divider" {...createHeaderScope} />
            <div
              className="players-dropdown-wrapper"
              ref={playersDropdownRef}
              {...createHeaderScope}
            >
              <div
                className="players-dropdown"
                onClick={togglePlayers}
                {...createHeaderScope}
              >
                <span className="players-label" {...createHeaderScope}>
                  Players:
                </span>
                <span {...createHeaderScope}>{size}</span>
                <SiteIcon
                  className={playersOpen ? "rotated" : ""}
                  name="chevron-down"
                  {...createHeaderScope}
                />
              </div>
              {playersMounted && (
                <div
                  className={`players-dropdown-options${playersOpen ? " is-visible" : ""}`}
                  {...createHeaderScope}
                >
                  {PLAYER_OPTIONS.map(([option]) => (
                    <div
                      className={`players-option${size === option ? " option-active" : ""}`}
                      onClick={() => {
                        setSize(option);
                        closePlayers();
                        if (["2v2", "3v3", "2v2v2"].includes(option))
                          setModes((current) => ({ ...current, group: false }));
                      }}
                      key={option}
                      {...createHeaderScope}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              className="button-create"
              type="button"
              disabled={busy}
              onClick={create}
              {...createHeaderScope}
            >
              Create Battle
            </button>
          </div>
        </div>
      </div>
      <div className="battles-content" {...rootScope}>
        <div className="battles-create" {...createScope}>
          <div className="create-container" {...createScope}>
            <h2 className="subtitle" {...createScope}>
              Selected Cases
            </h2>
            <div className="grid-wrapper" {...createScope}>
              <div className="add-case-wrapper" {...createScope}>
                <button
                  className="button-add"
                  type="button"
                  onClick={() => setModal("cases")}
                  {...createScope}
                >
                  <div className="button-icon-wrapper" {...createScope}>
                    <BattleIcon name="add" {...createScope} />
                  </div>
                  <span className="button-text" {...createScope}>
                    Add Cases
                  </span>
                </button>
              </div>
              {grouped.map(({ box, count }) => (
                <div
                  className="draggable-box"
                  data-id={box.caseId}
                  key={box.caseId}
                  {...createScope}
                >
                  <BattleCaseCard
                    box={box}
                    count={count}
                    currency={currency}
                    onAdd={add}
                    onRemove={remove}
                    draggable
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="battles-create-footer" {...modesScope}>
            <h2 className="subtitle" {...modesScope}>
              Battle Mode
            </h2>
            <div className="battles-gamemode-selector" {...modesScope}>
              {MODES.map(([key, title, description, className]) => {
                const active =
                  key === "group"
                    ? modes.group
                    : Number(modes[key]) > 0 || modes[key] === true;
                const disabled =
                  (key === "group" &&
                    (["2v2", "3v3", "2v2v2"].includes(size) ||
                      modes.crazy ||
                      modes.terminal ||
                      modes.jackpot)) ||
                  (key === "terminal" && modes.jackpot);
                return (
                  <div
                    className={`gamemode-option ${className}${active ? " active" : ""}`}
                    style={{
                      opacity: disabled ? 0.3 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                    onClick={() => !disabled && toggle(key)}
                    key={key}
                    {...modesScope}
                  >
                    <div className="option-header" {...modesScope}>
                      <div className="option-header-title" {...modesScope}>
                        {key === "riskSpin" ? (
                          <img
                            className={`risk-spin-logo${active ? " active" : ""}`}
                            src="/assets/images/battles/risk-spin.png"
                            alt=""
                            {...modesScope}
                          />
                        ) : (
                          <BattleIcon
                            name={key === "fastSpin" ? "fast" : key}
                            {...modesScope}
                          />
                        )}
                        <span className="title" {...modesScope}>
                          {title}
                          {(["funding", "borrow"].includes(key) &&
                            Number(modes[key]) > 0)
                            ? ` ${modes[key]}%`
                            : ""}
                        </span>
                      </div>
                      <div
                        className={`toggle-button${active ? " active" : ""}`}
                        {...modesScope}
                      />
                    </div>
                    <p className="description" {...modesScope}>
                      {description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {modal && (
        <ModalAnimation
          label={
            modal === "cases"
              ? "Select Cases"
              : modal === "borrow"
                ? "Borrow Battle"
                : "Funding Battle"
          }
          onClose={() => setModal(null)}
        >
          {modal === "cases" ? (
            <CasePicker
              boxes={boxes}
              selected={selected}
              currency={currency}
              onAdd={add}
              onRemove={remove}
              onClose={() => setModal(null)}
            />
          ) : (
            <SliderModal
              type={modal === "borrow" ? "Borrow" : "Funding"}
              value={modes[modal]}
              baseCost={base}
              playerCount={playerCount}
              borrow={modes.borrow}
              currency={currency}
              onChange={(value) =>
                setModes((current) => ({ ...current, [modal]: value }))
              }
              onClose={() => setModal(null)}
            />
          )}
        </ModalAnimation>
      )}
    </>
  );
}

function battleRoundNeedsCelebration(game, index) {
  const boxAmount = Number(game?.rounds?.[index]?.box?.amount) || 0;
  return (game?.bets || []).some((bet) => {
    const result = bet?.results?.find(
      (entry) => Number(entry?.roundIndex) === index,
    );
    const chance =
      Number.parseFloat(
        String(result?.item?.chance || "100").replace("%", ""),
      ) || 100;
    return chance < 15 && Number(result?.itemAmount || 0) >= boxAmount;
  });
}

function battleRoundDuration(game, index) {
  const hasRiskSpin =
    game?.options?.riskSpin &&
    (game?.bets || []).some(
      (bet) => Number(bet?.riskOutcomes?.[index]) >= 0,
    );
  const base = game?.options?.fastSpin
    ? hasRiskSpin
      ? 6350
      : 3900
    : hasRiskSpin
      ? 8650
      : 6700;
  return (
    base +
    750 +
    (hasRiskSpin || battleRoundNeedsCelebration(game, index) ? 500 : 0)
  );
}

function deriveLiveGame(game, now) {
  if (!game?.startedAt) return game;
  const replayEpoch =
    Number(game.clientReplayStartedAt) || new Date(game.startedAt).getTime();
  const elapsed = Math.max(0, now - replayEpoch);
  const lead = 3000;
  if (game.storedState === "countdown") {
    return {
      ...game,
      state: "pending",
      currentRound: 0,
      fair: {
        ...game.fair,
        eosCountdown:
          elapsed < lead
            ? Math.min(3, Math.max(1, Math.ceil((lead - elapsed) / 1000)))
            : null,
      },
    };
  }
  if (game.storedState !== "completed") return game;
  const rounds = Number(game.totalRounds) || game.rounds?.length || 1;
  const roundDurations = Array.from({ length: rounds }, (_, index) =>
    battleRoundDuration(game, index),
  );
  const rollingDuration = roundDurations.reduce(
    (total, duration) => total + duration,
    0,
  );
  const rollingEnd = lead + rollingDuration;
  const end = rollingEnd + (game.options?.jackpot ? 5500 : 500);
  if (elapsed < lead)
    return {
      ...game,
      state: "pending",
      currentRound: 0,
      fair: {
        ...game.fair,
        eosCountdown: Math.min(
          3,
          Math.max(1, Math.ceil((lead - elapsed) / 1000)),
        ),
      },
    };
  if (elapsed < rollingEnd) {
    const animationElapsed = elapsed - lead;
    let passed = 0;
    let current = rounds;
    let progress = 1;
    for (let index = 0; index < roundDurations.length; index += 1) {
      const duration = roundDurations[index];
      if (animationElapsed < passed + duration) {
        current = index + 1;
        progress = (animationElapsed - passed) / duration;
        break;
      }
      passed += duration;
    }
    return {
      ...game,
      state: "rolling",
      currentRound: current,
      roundProgress: progress,
      fair: { ...game.fair, eosCountdown: null },
    };
  }
  if (game.options?.jackpot && elapsed < end)
    return { ...game, state: "jackpot_spinning", currentRound: rounds };
  if (game.state === "completed" && Number(game.currentRound) === rounds)
    return game;
  return { ...game, state: "completed", currentRound: rounds };
}

function battlePhaseElapsed(game, now) {
  if (!game?.startedAt || game.storedState !== "completed") return 0;
  const replayEpoch =
    Number(game.clientReplayStartedAt) || new Date(game.startedAt).getTime();
  const elapsed = Math.max(0, now - replayEpoch);
  const lead = 3000;
  if (elapsed <= lead) return 0;
  const rounds = Number(game.totalRounds) || game.rounds?.length || 1;
  let phaseStartedAt = lead;
  for (let index = 0; index < rounds; index += 1) {
    const duration = battleRoundDuration(game, index);
    if (elapsed < phaseStartedAt + duration)
      return Math.max(0, elapsed - phaseStartedAt);
    phaseStartedAt += duration;
  }
  if (game.options?.jackpot && elapsed < phaseStartedAt + 5500)
    return Math.max(0, elapsed - phaseStartedAt);
  return 0;
}

function BattleFairness({ game }) {
  const fair = game?.fair || {};
  const copy = async (value) => {
    try {
      await copyText(String(value ?? ""));
      notify({ type: "success", message: "Copied to your clipboard." });
    } catch {
      notify({ type: "error", message: "Failed to copy." });
    }
  };
  const field = (label, value, className = "game-element") => (
    <div className={className} {...fairnessScope}>
      <div className="element-title" {...fairnessScope}>
        {label}
      </div>
      <div className="element-content" {...fairnessScope}>
        <span {...fairnessScope}>{String(value ?? "")}</span>
        <button
          className="button-copy"
          type="button"
          title="Copy to clipboard"
          onClick={() => copy(value)}
          {...fairnessScope}
        >
          <BattleIcon name="copy" size={17} {...fairnessScope} />
        </button>
      </div>
    </div>
  );
  return (
    <div className="modal-fair-game" {...fairnessScope}>
      <div className="game-group" {...fairnessScope}>
        <div className="game-header" {...fairnessScope}>
          <span {...fairnessScope}>Game Fairness</span>
        </div>
        {field("Game ID", game?.gameId || game?._id)}
        {field("Server Seed (Hashed)", fair.serverSeedHash || fair.hash || "")}
        {fair.serverSeed ? field("Server Seed", fair.serverSeed) : null}
        {fair.eosBlockId ? field("EOS Block ID", fair.eosBlockId) : null}
        {fair.eosBlockNumber
          ? field("EOS Block Number", fair.eosBlockNumber)
          : null}
        {fair.ticket ? field("Ticket", fair.ticket) : null}
        <div className="game-group" {...fairnessScope}>
          {field(
            "Client Seed",
            fair.seed?.seedClient || fair.clientSeed || "",
            "group-element",
          )}
          {field("Nonce", fair.nonce || 0, "group-element")}
        </div>
        {fair.serverSeed && (
          <div className="verify-button-container" {...fairnessScope}>
            <button
              className="button-verify"
              type="button"
              onClick={() => navigate("/provably-fair")}
              {...fairnessScope}
            >
              Verify Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function battleRarity(item) {
  if (item?.chroma === true) return "chroma";
  const rarity = String(item?.rarity || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (rarity.includes("chroma")) return "chroma";
  if (rarity.includes("uncommon")) return "uncommon";
  if (rarity.includes("legendary")) return "legendary";
  if (rarity.includes("ancient")) return "ancient";
  if (rarity.includes("classic")) return "classic";
  if (rarity.includes("godly")) return "godly";
  if (rarity.includes("rare")) return "rare";
  return "common";
}

function BattleUserRank({ user }) {
  const rank = String(user?.rank || "user").toLowerCase();
  if (["admin", "mod", "partner"].includes(rank)) {
    const hash =
      rank === "admin"
        ? "f6df244d"
        : rank === "mod"
          ? "998a884b"
          : "0a259ddf";
    return (
      <div
        className={`box-rank rank-${rank}`}
        data-v-fc8af502=""
        {...betScope}
      >
        <div className="rank-inner" data-v-fc8af502="" {...betScope}>
          <img
            src={`/assets/ranks/${rank}.${hash}.svg`}
            alt={rank}
            data-v-fc8af502=""
            {...betScope}
          />
        </div>
      </div>
    );
  }
  const level = Math.max(0, Number(user?.level) || 0);
  const [, name, icon] =
    battleXpRanks.find(([minimum]) => level >= minimum) ||
    battleXpRanks[battleXpRanks.length - 1];
  return (
    <img
      className="user-rank-icon"
      src={icon}
      alt={name}
      title={name}
      {...betScope}
    />
  );
}

function battleSeededRandom(seedValue) {
  let seed = 0;
  for (const character of String(seedValue))
    seed = Math.abs(
      ((seed << 5) - seed + character.charCodeAt(0)) | 0,
    );
  return () => {
    seed = (1664525 * seed + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function createBattleReel(items, winner, seedValue) {
  const source = Array.isArray(items) && items.length ? items : [winner];
  const weighted = source.flatMap((item) => {
    const chance =
      Number.parseFloat(String(item?.chance || "1").replace("%", "")) || 1;
    return Array.from({ length: Math.max(1, Math.floor(chance)) }, () => item);
  });
  const random = battleSeededRandom(seedValue);
  const reel = Array.from(
    { length: 80 },
    () => weighted[Math.floor(random() * weighted.length)] || winner,
  );
  if (winner) reel[60] = winner;
  return reel;
}

let riskSpinSpriteImage = null;
let riskSpinSpritePromise = null;

function loadRiskSpinSprite() {
  if (riskSpinSpriteImage?.complete && riskSpinSpriteImage.naturalWidth)
    return Promise.resolve(riskSpinSpriteImage);
  if (riskSpinSpritePromise) return riskSpinSpritePromise;
  riskSpinSpritePromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      riskSpinSpriteImage = image;
      resolve(image);
    };
    image.onerror = reject;
    image.src = "/assets/images/battles/risk-spin-sprite.png";
  });
  return riskSpinSpritePromise;
}

function RiskSpinCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let frame;
    let startedAt = 0;
    let cancelled = false;
    loadRiskSpinSprite().then((image) => {
      if (cancelled) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(100 * ratio);
      canvas.height = Math.floor(100 * ratio);
      canvas.style.width = "100px";
      canvas.style.height = "100px";
      const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      const columns = Math.max(1, Math.floor(image.width / 320));
      const draw = (time) => {
        if (!startedAt) startedAt = time;
        const sprite = Math.min(79, Math.floor((time - startedAt) / 15));
        const row = Math.floor(sprite / columns);
        const column = sprite % columns;
        context.clearRect(0, 0, 100, 100);
        context.drawImage(
          image,
          column * 320,
          row * 320,
          320,
          320,
          0,
          0,
          100,
          100,
        );
        if (sprite < 79) frame = window.requestAnimationFrame(draw);
      };
      frame = window.requestAnimationFrame(draw);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return <canvas ref={canvasRef} className="riskspin-canvas" aria-hidden="true" {...reelScope} />;
}

const BattleReelElement = memo(function BattleReelElement({
  item,
  active,
  winner,
  spriteActive,
  showInfo,
  resultAmount,
  currency,
}) {
  return (
    <div
      className={`reel-element ${item?.riskSpin ? "element-yellow" : `element-rarity-${battleRarity(item)}`}${spriteActive ? " element-risk-pause" : ""}${active ? " element-active" : ""}${winner ? " element-winner" : ""}`}
      {...reelScope}
    >
      <div className="element-image" {...reelScope}>
        {spriteActive && item?.riskSpin ? (
          <RiskSpinCanvas />
        ) : (
          <img
            src={item?.image || item?.imageUrl || "/assets/users/default-avatar.png"}
            alt=""
            decoding="async"
            {...reelScope}
          />
        )}
        <div className="element-glow" {...reelScope} />
      </div>
      {showInfo && (
        <div className="element-info element-info-landed" {...reelScope}>
          <span {...reelScope}>{item?.name || ""}</span>
          <div className="info-amount" {...reelScope}>
            <img src={currencyIcon(currency)} alt="" {...reelScope} />
            <div className="amount-value" {...reelScope}>
              {formatAmount(resultAmount)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const BattleReel = memo(function BattleReel({
  bet,
  box,
  gameId,
  round,
  running,
  fast,
  primary,
  currency,
  onRiskPhaseChange,
}) {
  const result = bet?.results?.find(
    (entry) => Number(entry.roundIndex) === Number(round),
  );
  const hasRiskSpin = Number(bet?.riskOutcomes?.[round]) >= 0;
  const riskItem = useMemo(() => {
    const eligible = (box?.items || []).filter((item) => {
      const chance =
        Number.parseFloat(String(item?.chance || "0").replace("%", "")) || 0;
      return chance > 0 && chance < 10;
    });
    const chance = eligible.reduce(
      (total, item) =>
        total +
        (Number.parseFloat(String(item?.chance || "0").replace("%", "")) || 0),
      0,
    );
    return {
      name: "Risk Spin",
      image: "/assets/images/battles/risk-spin.png",
      chance: `${chance}%`,
      rarity: "yellow",
      riskSpin: true,
    };
  }, [box?.items]);
  const [stage, setStage] = useState(hasRiskSpin ? "risk" : "normal");
  const items = useMemo(
    () => {
      if (hasRiskSpin && stage === "risk") {
        const source = (box?.items || []).filter((item) => {
          const chance =
            Number.parseFloat(String(item?.chance || "0").replace("%", "")) || 0;
          return chance >= 10;
        });
        return createBattleReel(
          [...source, riskItem],
          riskItem,
          `${gameId}-${bet?.slot}-${round}-risk-first`,
        );
      }
      const source = hasRiskSpin
        ? (box?.items || []).filter((item) => {
            const chance =
              Number.parseFloat(String(item?.chance || "0").replace("%", "")) || 0;
            return chance > 0 && chance < 10;
          })
        : box?.items;
      return createBattleReel(
        source,
        result?.item,
        `${gameId}-${bet?.slot}-${round}${hasRiskSpin ? "-risk-final" : ""}`,
      );
    },
    [bet?.slot, box?.items, gameId, hasRiskSpin, result?.item, riskItem, round, stage],
  );
  const [style, setStyle] = useState({
    transform: "translateX(0px) translateY(-2396.5px)",
    transition: "none",
  });
  const [landed, setLanded] = useState(false);
  const [finalLanded, setFinalLanded] = useState(false);
  const [spriteActive, setSpriteActive] = useState(false);
  const reelRef = useRef(null);
  const confettiAnchorRef = useRef(null);
  useEffect(() => {
    if (!running) return undefined;
    const random = battleSeededRandom(`${gameId}-${bet?.slot}-anim-${round}`);
    const timers = [];
    const frames = [];
    let trackingFrame = null;
    const stopTracking = () => {
      if (trackingFrame) window.cancelAnimationFrame(trackingFrame);
      trackingFrame = null;
    };
    const startTracking = () => {
      if (!primary) return;
      let previousPosition = 20;
      const track = () => {
        if (!reelRef.current) return;
        const matrix = new DOMMatrixReadOnly(
          window.getComputedStyle(reelRef.current).transform,
        );
        const position = Math.round(Math.abs(matrix.m42 + 2396.5) / 125) + 20;
        if (position !== previousPosition) {
          previousPosition = position;
          playSound("tick", { volume: 0.42, dedupeMs: 70 });
        }
        trackingFrame = window.requestAnimationFrame(track);
      };
      trackingFrame = window.requestAnimationFrame(track);
    };
    const finish = () => {
      onRiskPhaseChange?.(Number(bet?.slot), false);
      setLanded(true);
      setFinalLanded(true);
      const chance =
        Number.parseFloat(String(result?.item?.chance || "100").replace("%", "")) || 100;
      if (
        chance < 15 &&
        Number(result?.itemAmount || 0) >= Number(box?.amount || 0) &&
        confettiAnchorRef.current?.parentNode
      ) {
        const parent = confettiAnchorRef.current.parentNode;
        const canvas = document.createElement("canvas");
        const bounds = parent.getBoundingClientRect();
        canvas.className = "temp-battles-confetti";
        canvas.id = `battles-confetti-${bet?.slot}-${Date.now()}`;
        canvas.width = Math.max(1, Math.floor(bounds.width));
        canvas.height = Math.max(1, Math.floor(bounds.height));
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.pointerEvents = "none";
        canvas.style.zIndex = "10";
        canvas.style.opacity = "1";
        canvas.style.transition = "opacity 1.8s ease-out";
        parent.appendChild(canvas);
        const burst = confetti.create(canvas, { resize: true });
        burst({
          particleCount: 100,
          spread: 70,
          origin: { x: 0.5, y: 0.5 },
          colors: [
            "#FF0000",
            "#FF7F00",
            "#FFFF00",
            "#00FF00",
            "#0000FF",
            "#4B0082",
            "#9400D3",
            "#FF1493",
            "#00CED1",
            "#FFD700",
            "#FF69B4",
            "#00FF7F",
          ],
          scalar: 1.2,
        });
        window.setTimeout(() => {
          if (canvas.isConnected) {
            canvas.style.opacity = "0";
          }
          window.setTimeout(() => {
            burst.reset();
            canvas.remove();
          }, 1800);
        }, 3000);
      }
      playSound(chance <= 1 ? "unboxBig" : chance <= 15 ? "unboxRare" : "unbox", {
        volume: 0.65,
        dedupeMs: 90,
      });
    };
    const spin = (baseDuration, secondSpin = false) => {
      const duration = secondSpin
        ? baseDuration
        : Math.max(0.45, baseDuration + random() * 0.5 - 0.25);
      const jitter = Math.floor(random() * 7);
      const firstFrame = window.requestAnimationFrame(() => {
        const secondFrame = window.requestAnimationFrame(() => {
          setLanded(false);
          setFinalLanded(false);
          startTracking();
          setStyle({
            transform: `translateX(0px) translateY(-${(secondSpin ? 7365 : 7345) + (105 / 8) * jitter}px)`,
            transition: `transform ${duration}s cubic-bezier(0, 0.7, 0.15, 1)`,
          });
          timers.push(window.setTimeout(() => {
          stopTracking();
          setStyle({
            transform: "translateX(0px) translateY(-7396.5px)",
              transition: "transform 0.25s cubic-bezier(0.1, 0.6, 0.3, 1)",
          });
            timers.push(window.setTimeout(() => {
            setLanded(true);
              if (!hasRiskSpin || secondSpin) {
                finish();
                return;
              }
              setSpriteActive(true);
              playSound("riskSpin", { volume: 0.68, dedupeMs: 250 });
              timers.push(window.setTimeout(() => {
                setSpriteActive(false);
                setStage("final");
                setLanded(false);
                onRiskPhaseChange?.(Number(bet?.slot), true);
                setStyle({
                  transform: "translateX(0px) translateY(-2396.5px)",
                  transition: "none",
                });
                timers.push(window.setTimeout(
                  () => spin(fast ? 0.85 : 1.35, true),
                  150,
                ));
              }, 1600));
            }, 250));
          }, duration * 1000 + 200));
        });
        frames.push(secondFrame);
      });
      frames.push(firstFrame);
    };
    timers.push(
      window.setTimeout(
        () =>
          spin(
            fast ? (hasRiskSpin ? 1.4 : 2) : hasRiskSpin ? 3.2 : 4.8,
          ),
        250,
      ),
    );
    onRiskPhaseChange?.(Number(bet?.slot), false);
    return () => {
      onRiskPhaseChange?.(Number(bet?.slot), false);
      frames.forEach((frame) => window.cancelAnimationFrame(frame));
      timers.forEach((timer) => window.clearTimeout(timer));
      stopTracking();
    };
  }, [
    bet?.slot,
    box?.amount,
    fast,
    gameId,
    hasRiskSpin,
    onRiskPhaseChange,
    primary,
    result?.item?.chance,
    result?.itemAmount,
    round,
    running,
  ]);
  return (
    <>
      <canvas
        ref={confettiAnchorRef}
        className="confetti-canvas"
        aria-hidden="true"
        {...spinnerScope}
      />
      <div ref={reelRef} className="battles-reel" style={style} {...reelScope}>
      {items.map((item, index) => (
        <BattleReelElement
          key={`${index}-${item?.index || item?.name || "item"}`}
          item={item}
          active={index === (landed ? 60 : 20)}
          winner={index === 60 && landed}
          spriteActive={index === 60 && spriteActive}
          showInfo={index === 60 && finalLanded}
          resultAmount={index === 60 ? result?.itemAmount : 0}
          currency={currency}
        />
      ))}
      </div>
    </>
  );
});

function BattleResultPlaceholder({ box, round, currency }) {
  return (
    <div className="cases-item-placeholder-element" {...placeholderScope}>
      <div className="inner-vector-container" {...placeholderScope}>
        <Pattern scope={placeholderScope} />
      </div>
      <div className="inner-image" {...placeholderScope}>
        <img src={box?.imageUrl || box?.image} alt="" {...placeholderScope} />
        <div className="inner-glow" {...placeholderScope} />
      </div>
      <div className="inner-info" {...placeholderScope}>
        <div className="inner-round" {...placeholderScope}>
          Round {round}
        </div>
        <div className="inner-price" {...placeholderScope}>
          <img src={currencyIcon(currency)} alt="" {...placeholderScope} />
          <div className="price-value" {...placeholderScope}>
            <span {...placeholderScope}>{formatAmount(box?.amount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BattleSpinnerArrow({ side }) {
  return (
    <div
      className={`battles-spinner-arrow battles-spinner-arrow-${side}`}
      {...spinnerScope}
    >
      <svg
        fill="currentColor"
        viewBox="0 0 512 512"
        aria-hidden="true"
        {...spinnerScope}
      >
        <path
          d="m98 190.06 139.78 163.12a24 24 0 0 0 36.44 0L414 190.06c13.34-15.57 2.28-39.62-18.22-39.62h-279.6c-20.5 0-31.56 24.05-18.18 39.62z"
          {...spinnerScope}
        />
      </svg>
    </div>
  );
}

function JackpotSelector() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="50"
      height="50"
      viewBox="0 0 50 50"
      fill="none"
      aria-hidden="true"
      {...jackpotScope}
    >
      <defs>
        <linearGradient id="battle-selector-a" x1="25" y1="50" x2="5" y2="13" gradientUnits="userSpaceOnUse">
          <stop stopColor="#51BBE2" />
          <stop offset="1" stopColor="#93DBFF" />
        </linearGradient>
        <linearGradient id="battle-selector-b" x1="36" y1="12.5" x2="36" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#027380" />
          <stop offset="1" stopColor="#011E3A" />
        </linearGradient>
        <linearGradient id="battle-selector-c" x1="17" y1="25" x2="40" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#013D62" />
          <stop offset="1" stopColor="#0C5583" />
        </linearGradient>
        <linearGradient id="battle-selector-d" x1="25" y1="0" x2="22" y2="15.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#51A6E2" />
          <stop offset="1" stopColor="#93EBFF" />
        </linearGradient>
        <linearGradient id="battle-selector-e" x1="36" y1="12.5" x2="36" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#024380" />
          <stop offset="1" stopColor="#011A3A" />
        </linearGradient>
        <linearGradient id="battle-selector-f" x1="17" y1="8.3" x2="27" y2="21.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#014562" />
          <stop offset="1" stopColor="#036E81" />
        </linearGradient>
      </defs>
      <path d="M25 50 46.65 12.5H3.35L25 50Z" fill="url(#battle-selector-a)" />
      <path d="M25 50 46.65 12.5H25V50Z" fill="url(#battle-selector-b)" />
      <path d="M25 50 38.53 12.5H11.47L25 50Z" fill="url(#battle-selector-c)" />
      <path d="m25 0 21.65 12.5H3.35L25 0Z" fill="url(#battle-selector-d)" />
      <path d="m25 0 21.65 12.5H25V0Z" fill="url(#battle-selector-e)" />
      <path d="m25 0 13.53 12.5H11.47L25 0Z" fill="url(#battle-selector-f)" />
      <path d="m25 0 21.65 12.5H3.35L25 0Z" fill="#fff" fillOpacity=".12" />
    </svg>
  );
}

const jackpotColors = [
  "#FF4A4D",
  "#FEC76B",
  "#69B7FF",
  "#54FF82",
  "#bc6bfe",
  "#FC6BFE",
];

function hexRgb(color) {
  const value = String(color).replace("#", "");
  const parsed = Number.parseInt(value, 16);
  return `${(parsed >> 16) & 255}, ${(parsed >> 8) & 255}, ${parsed & 255}`;
}

function contrastText(color) {
  const channels = hexRgb(color).split(",").map(Number);
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] >
    0.55
    ? "#0b1620"
    : "#ffffff";
}

function jackpotWinnerSlot(game) {
  const bets = Array.isArray(game?.bets) ? game.bets : [];
  const explicitSlot = game?.winnerSlots
    ?.map(Number)
    .find((slot) => Number.isFinite(slot));
  if (Number.isFinite(explicitSlot)) return explicitSlot;

  const indexedWinner = bets[Number(game?.jackpotWinnerIndex)];
  const indexedSlot = Number(indexedWinner?.slot);
  if (Number.isFinite(indexedSlot)) return indexedSlot;

  const payoutWinner = bets.find((bet) => Number(bet?.payout) > 0);
  const payoutSlot = Number(payoutWinner?.slot);
  return Number.isFinite(payoutSlot) ? payoutSlot : null;
}

const JackpotWheel = memo(function JackpotWheel({ game }) {
  const innerRef = useRef(null);
  const reelRef = useRef(null);
  const winnerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(400);
  const [spinComplete, setSpinComplete] = useState(false);
  const [landed, setLanded] = useState(game?.state === "completed");
  const [winnerOnly, setWinnerOnly] = useState(game?.state === "completed");
  const [winnerExpanded, setWinnerExpanded] = useState(false);
  const [landingOffset, setLandingOffset] = useState(0);
  const [activeIndex, setActiveIndex] = useState(null);
  const weights = useMemo(() => {
    if (Array.isArray(game?.jackpotWeights) && game.jackpotWeights.length)
      return game.jackpotWeights;
    const raw = (game?.bets || []).map((bet) =>
      Math.max(
        1,
        game?.options?.crazy
          ? Math.floor(1e9 / Math.max(1, Number(bet?.total) || 0))
          : Number(bet?.total) || 0,
      ),
    );
    const total = raw.reduce((sum, weight) => sum + weight, 0);
    return raw.map((weight, index) => ({
      slot: Number(game?.bets?.[index]?.slot) || index,
      weight,
      percentage: Number(((weight / Math.max(1, total)) * 100).toFixed(2)),
    }));
  }, [game?.bets, game?.jackpotWeights, game?.options?.crazy]);
  const winnerSlot = jackpotWinnerSlot(game);
  const segments = useMemo(
    () =>
      weights.map((weight, index) => {
        const weightedSlot = Number(weight?.slot);
        const bet =
          game?.bets?.find(
            (entry) => Number(entry?.slot) === weightedSlot,
          ) || game?.bets?.[index];
        return {
          bet,
          percentage: Number(weight?.percentage || 0),
          name: bet?.user?.username || (bet?.bot ? "Risk Bot" : `Player ${index + 1}`),
          slot: Number.isFinite(Number(bet?.slot)) ? Number(bet.slot) : index,
        };
      }),
    [game?.bets, weights],
  );
  const winnerIndex = Math.max(
    0,
    segments.findIndex((segment) => Number(segment.slot) === winnerSlot),
  );
  const segmentWidth = useCallback(
    (percentage) =>
      Math.max(
        100,
        (Number(percentage || 0) / 100) *
          Math.max(600, Math.round(containerWidth * 1.6)),
      ),
    [containerWidth],
  );
  const repeated = useMemo(
    () =>
      Array.from({ length: 6 }, (_, cycle) =>
        segments.map((segment, index) => ({
          ...segment,
          key: `${cycle}-${index}`,
          winner: landed && cycle === 4 && index === winnerIndex,
        })),
      ).flat(),
    [landed, segments, winnerIndex],
  );
  const positionFor = useCallback(
    (stripIndex) => {
      if (!segments.length) return 0;
      const widths = segments.map((segment) => segmentWidth(segment.percentage));
      const cycleWidth = widths.reduce((sum, width) => sum + width, 0) + 12 * segments.length;
      const localIndex = ((stripIndex % segments.length) + segments.length) % segments.length;
      const cycle = Math.floor(stripIndex / segments.length);
      const before = widths
        .slice(0, localIndex)
        .reduce((sum, width) => sum + width + 12, 0);
      return 20 + cycle * cycleWidth + before + widths[localIndex] / 2;
    },
    [segmentWidth, segments],
  );
  const targetIndex = 4 * segments.length + winnerIndex;
  const wheelVisible = Boolean(
    game?.options?.jackpot &&
      segments.length &&
      ["jackpot_spinning", "completed"].includes(game?.state),
  );
  const reelStyle = useMemo(() => {
    if (!segments.length || winnerOnly)
      return { transform: "translateX(0px)", transition: "none" };
    const startIndex = segments.length;
    const center = containerWidth / 2;
    const index = spinComplete ? targetIndex : startIndex;
    const calculatedOffset =
      center - positionFor(index) + (spinComplete ? landingOffset : 0);
    return {
      transform: `translateX(${calculatedOffset}px)`,
      transition: spinComplete
        ? "transform 4000ms cubic-bezier(0.15, 0.5, 0.15, 1)"
        : "none",
    };
  }, [containerWidth, landingOffset, positionFor, segments.length, spinComplete, targetIndex, winnerOnly]);
  useLayoutEffect(() => {
    const element = innerRef.current;
    if (!element) return undefined;
    const update = () => setContainerWidth(element.offsetWidth || 400);
    update();
    const observer = window.ResizeObserver
      ? new ResizeObserver(update)
      : null;
    observer?.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [wheelVisible]);
  useEffect(() => {
    if (game?.state !== "jackpot_spinning" || !segments.length) return undefined;
    const nextLandingOffset = (Math.random() - 0.5) * 40;
    const prepare = window.setTimeout(() => {
      setSpinComplete(false);
      setLanded(false);
      setWinnerOnly(false);
      setWinnerExpanded(false);
      setLandingOffset(nextLandingOffset);
    }, 0);
    const start = window.setTimeout(() => setSpinComplete(true), 500);
    const finish = window.setTimeout(() => {
      setLanded(true);
      setActiveIndex(targetIndex);
      playSound("tick", { volume: 0.5, dedupeMs: 200 });
    }, 4500);
    const collapse = window.setTimeout(() => setWinnerOnly(true), 4750);
    return () => {
      window.clearTimeout(prepare);
      window.clearTimeout(start);
      window.clearTimeout(finish);
      window.clearTimeout(collapse);
    };
  }, [game?._id, game?.state, segments.length, targetIndex]);
  useEffect(() => {
    if (!spinComplete || landed || winnerOnly) return undefined;
    let frame;
    const track = () => {
      const reel = reelRef.current;
      const inner = innerRef.current;
      if (!reel || !inner) return;
      const bounds = inner.getBoundingClientRect();
      const center = bounds.left + bounds.width / 2;
      let closest = null;
      let distance = Number.POSITIVE_INFINITY;
      Array.from(reel.children).forEach((child, index) => {
        const childBounds = child.getBoundingClientRect();
        const next = Math.abs(childBounds.left + childBounds.width / 2 - center);
        if (next < distance) {
          closest = index;
          distance = next;
        }
      });
      setActiveIndex(closest);
      frame = window.requestAnimationFrame(track);
    };
    frame = window.requestAnimationFrame(track);
    return () => window.cancelAnimationFrame(frame);
  }, [landed, spinComplete, winnerOnly]);
  const isCompleted = game?.state === "completed";
  const displayWinnerOnly = isCompleted || winnerOnly;
  const winner = segments[winnerIndex] || segments[0];
  const winnerStartWidth = winner
    ? segmentWidth(winner.percentage)
    : 100;
  useLayoutEffect(() => {
    if (!displayWinnerOnly || !winnerRef.current) return undefined;
    const card = winnerRef.current;
    setWinnerExpanded(false);
    card.style.width = `${winnerStartWidth}px`;
    void card.offsetWidth;
    const frame = window.requestAnimationFrame(() => setWinnerExpanded(true));
    return () => window.cancelAnimationFrame(frame);
  }, [displayWinnerOnly, game?._id, winnerIndex, winnerStartWidth]);
  if (!wheelVisible) return null;
  const cardStyle = (segment, winnerCard = false) => ({
    width: winnerCard
      ? winnerExpanded
        ? "100%"
        : `${segmentWidth(segment.percentage)}px`
      : `${segmentWidth(segment.percentage)}px`,
    "--segment-rgb": hexRgb(jackpotColors[segment.slot % jackpotColors.length]),
    transition: winnerCard ? "width .6s cubic-bezier(.215,.61,.355,1)" : undefined,
  });
  const renderCard = (segment, index, winnerCard = false) => (
    <div
      ref={winnerCard ? winnerRef : undefined}
      className={`jackpot-segment-card${winnerCard ? " jackpot-segment-card--winner-only jackpot-segment-card-winner" : ""}${!winnerCard && index === activeIndex ? " jackpot-segment-card--active" : ""}${segment.winner ? " jackpot-segment-card-winner" : ""}`}
      style={cardStyle(segment, winnerCard)}
      key={segment.key || `winner-${segment.slot}`}
      {...jackpotScope}
    >
      <div className="jackpot-segment-avatar" {...jackpotScope}>
        <img
          className="avatar-img"
          src={
            segment.bet?.user?.avatar ||
            (segment.bet?.bot
              ? "/assets/images/battles/risk-bot.png"
              : "/assets/users/default-avatar.png")
          }
          alt={segment.name}
          {...jackpotScope}
        />
      </div>
      <span className="jackpot-segment-pct" {...jackpotScope}>
        {segment.percentage}%
      </span>
      <span className="jackpot-segment-name" {...jackpotScope}>
        {segment.name}
      </span>
    </div>
  );
  return (
    <div className="jackpot-wheel-summary" {...jackpotScope}>
      <div className="jackpot-wheel-outer" {...jackpotScope}>
        <div className="jackpot-wheel-selector" {...jackpotScope}>
          <JackpotSelector />
        </div>
        <div className="jackpot-wheel-inner" ref={innerRef} {...jackpotScope}>
          <div className="jackpot-wheel-shadow jackpot-wheel-shadow-left" {...jackpotScope} />
          {displayWinnerOnly ? (
            <div className="jackpot-wheel-winner-only" {...jackpotScope}>
              {renderCard(winner, winnerIndex, true)}
            </div>
          ) : (
            <div className="jackpot-wheel-reel" ref={reelRef} style={reelStyle} {...jackpotScope}>
              {repeated.map((segment, index) => renderCard(segment, index))}
            </div>
          )}
          <div className="jackpot-wheel-shadow jackpot-wheel-shadow-right" {...jackpotScope} />
        </div>
      </div>
    </div>
  );
}, (previous, next) =>
  previous.game?._id === next.game?._id &&
  previous.game?.state === next.game?.state &&
  previous.game?.bets === next.game?.bets &&
  previous.game?.jackpotWeights === next.game?.jackpotWeights &&
  previous.game?.winnerSlots === next.game?.winnerSlots &&
  previous.game?.jackpotWinnerIndex === next.game?.jackpotWinnerIndex,
);

const PlayerResult = memo(function PlayerResult({ bet, game }) {
  const winner =
    Number(bet?.payout) > 0 ||
    game?.winnerSlots?.map(Number).includes(Number(bet?.slot));
  const rounds = game?.rounds || [];
  const visibleCount =
    game.state === "completed" || game.state === "jackpot_spinning"
      ? rounds.length
      : game.state === "rolling"
        ? Math.max(
            0,
            Number(game.currentRound || 0) -
              (Number(game.roundProgress || 0) >= 0.88 ? 0 : 1),
          )
        : 0;
  const visibleResults = (bet?.results || [])
    .filter((result) => Number(result.roundIndex) < visibleCount)
    .sort((left, right) => Number(left.roundIndex) - Number(right.roundIndex));
  const currentTotal = visibleResults.reduce(
    (sum, result) => sum + Number(result.itemAmount || 0),
    0,
  );
  const jackpotWeight = game?.jackpotWeights?.find(
    (entry, index) =>
      Number(entry?.slot ?? game?.bets?.[index]?.slot) === Number(bet?.slot),
  );
  const jackpotColor = jackpotColors[
    ((Number(bet?.slot) || 0) % jackpotColors.length + jackpotColors.length) %
      jackpotColors.length
  ];
  return (
    <div
      className={`battles-bet-element${winner ? " element-winner" : game.state === "completed" ? " element-lost" : ""}`}
      {...betScope}
    >
      <div className="element-top" {...betScope}>
        <div className="info-user-container" {...betScope}>
          <div
            className={`info-user${bet?.bot ? " user-bot" : ""}`}
            {...betScope}
          >
            <div className="user-avatar" {...betScope}>
              <img
                className="avatar-image"
                src={
                  !bet
                    ? "/assets/images/battles/no-player.png"
                    : bet.bot
                      ? bet?.user?.avatar || "/assets/images/battles/risk-bot.png"
                      : bet?.user?.avatar || "/assets/users/default-avatar.png"
                }
                alt=""
                {...betScope}
              />
            </div>
              <div className="user-name-amount" {...betScope}>
                <div className="user-rank-level" {...betScope}>
                  {bet && !bet.bot && <BattleUserRank user={bet.user} />}
                  <span {...betScope}>
                  {bet?.user?.username || (bet?.bot ? "Risk Bot" : "Waiting...")}
                </span>
              </div>
              <div className="info-amount" {...betScope}>
                {!game.options?.jackpot && (
                  <img src={currencyIcon(game.currency)} alt="" {...betScope} />
                )}
                <div className="amount-value" {...betScope}>
                  {game.options?.jackpot ? (
                    <div
                      className="jackpot-chance-badge"
                      style={{
                        backgroundColor: jackpotColor,
                        color: contrastText(jackpotColor),
                      }}
                      {...betScope}
                    >
                      {Number(jackpotWeight?.percentage || 0).toFixed(2)}%
                    </div>
                  ) : (
                    <span {...betScope}>
                      <AnimatedNumber value={currentTotal} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="element-items" {...betScope}>
        <div className="items-list" {...betScope}>
          {rounds.map((round, index) => {
            const result = visibleResults.find(
              (entry) => Number(entry.roundIndex) === index,
            );
            return (
              <div key={round._id ? `${round._id}-${index}` : index}>
                {result ? (
                  <ItemCard
                    item={result.item}
                    items={round.box?.items || [result.item]}
                    currency={game.currency}
                  />
                ) : (
                  <BattleResultPlaceholder
                    box={round.box}
                    round={index + 1}
                    currency={game.currency}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}, (previous, next) => {
  const previousProgress = Number(previous.game?.roundProgress || 0) >= 0.88;
  const nextProgress = Number(next.game?.roundProgress || 0) >= 0.88;
  return (
    previous.bet === next.bet &&
    previous.game?._id === next.game?._id &&
    previous.game?.state === next.game?.state &&
    previous.game?.currentRound === next.game?.currentRound &&
    previous.game?.currency === next.game?.currency &&
    previous.game?.updatedAt === next.game?.updatedAt &&
    previousProgress === nextProgress
  );
});

function BattleDetail({ game: sourceGame, user, busy, onAction, onRefresh }) {
  const [clock, setClock] = useState(() => Date.now());
  const [playbackPauseMs, setPlaybackPauseMs] = useState(0);
  const [playbackResumeKey, setPlaybackResumeKey] = useState(0);
  const [riskSpinSlots, setRiskSpinSlots] = useState(() => new Set());
  const [fair, setFair] = useState(false);
  const [caseInfo, setCaseInfo] = useState(null);
  const [carouselOffset, setCarouselOffset] = useState(0);
  const celebrated = useRef(false);
  const carouselContainerRef = useRef(null);
  const carouselListRef = useRef(null);
  const winnerConfettiAnchorRef = useRef(null);
  const hiddenAtRef = useRef(null);
  const updateRiskSpinSlot = useCallback((slot, active) => {
    if (!Number.isFinite(slot)) return;
    setRiskSpinSlots((current) => {
      if (current.has(slot) === active) return current;
      const next = new Set(current);
      if (active) next.add(slot);
      else next.delete(slot);
      return next;
    });
  }, []);
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) setClock(Date.now());
    };
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (document.hidden && !hiddenAtRef.current)
      hiddenAtRef.current = Date.now();
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (hiddenAtRef.current) {
        const hiddenFor = Math.max(0, Date.now() - hiddenAtRef.current);
        const interruptedGame = deriveLiveGame(
          sourceGame,
          hiddenAtRef.current - playbackPauseMs,
        );
        const shouldResume = ["pending", "rolling", "jackpot_spinning"].includes(
          interruptedGame?.state,
        );
        const interruptedPhase = battlePhaseElapsed(
          sourceGame,
          hiddenAtRef.current - playbackPauseMs,
        );
        hiddenAtRef.current = null;
        if (shouldResume) {
          setPlaybackPauseMs(
            (current) => current + hiddenFor + interruptedPhase,
          );
          setPlaybackResumeKey((current) => current + 1);
        }
      }
      setClock(Date.now());
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [playbackPauseMs, sourceGame]);
  useEffect(() => {
    const urls = new Set();
    if (sourceGame?.options?.riskSpin) {
      loadRiskSpinSprite().catch(() => undefined);
      urls.add("/assets/images/battles/risk-spin.png");
    }
    for (const round of sourceGame?.rounds || []) {
      const caseImage = round?.box?.imageUrl || round?.box?.image;
      if (caseImage) urls.add(caseImage);
      for (const item of round?.box?.items || []) {
        const itemImage = item?.imageUrl || item?.image;
        if (itemImage) urls.add(itemImage);
      }
    }
    for (const bet of sourceGame?.bets || []) {
      const avatar = bet?.user?.avatar || bet?.user?.avatarHeadshot;
      if (avatar) urls.add(avatar);
      for (const result of bet?.results || []) {
        const itemImage = result?.item?.imageUrl || result?.item?.image;
        if (itemImage) urls.add(itemImage);
      }
    }
    if (!urls.size) return undefined;
    const images = [];
    const preload = () => {
      for (const url of urls) {
        const image = new Image();
        image.decoding = "async";
        image.src = url;
        image.decode?.().catch(() => undefined);
        images.push(image);
      }
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(preload, { timeout: 500 })
      : window.setTimeout(preload, 0);
    return () => {
      if (window.cancelIdleCallback && window.requestIdleCallback)
        window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [sourceGame]);
  const game = useMemo(
    () => deriveLiveGame(sourceGame, clock - playbackPauseMs),
    [clock, playbackPauseMs, sourceGame],
  );
  useEffect(() => {
    if (!sourceGame?.startedAt || !userId(user)) return;
    const participating = (sourceGame.bets || []).some(
      (bet) => userId(bet?.user) === userId(user),
    );
    if (!participating) return;
    const rounds = Number(sourceGame.totalRounds) || sourceGame.rounds?.length || 1;
    const rollingDuration = Array.from({ length: rounds }, (_, index) =>
      battleRoundDuration(sourceGame, index),
    ).reduce((sum, duration) => sum + duration, 0);
    const replayStartedAt =
      Number(sourceGame.clientReplayStartedAt) ||
      new Date(sourceGame.startedAt).getTime();
    const until =
      replayStartedAt +
      playbackPauseMs +
      3000 +
      rollingDuration +
      (sourceGame.options?.jackpot ? 5500 : 500);
    window.dispatchEvent(
      new CustomEvent("rorisk:balance-notification-hold", {
        detail: {
          id: `battle:${sourceGame._id}`,
          currency: sourceGame.currency,
          until,
          active: Date.now() < until,
        },
      }),
    );
  }, [playbackPauseMs, sourceGame, user]);
  const countdown = game?.fair?.eosCountdown;
  useEffect(() => {
    if (game?.state === "pending" && Number(countdown) > 0)
      playSound("countdown", { volume: 0.6, dedupeMs: 650 });
  }, [countdown, game?.state]);
  const bets = fixedBets(game);
  const creator = game?.options?.createdBy === userId(user);
  const creatorLost =
    game?.state === "completed" &&
    creator &&
    game?.options?.hostJoin !== false &&
    Number(bets[0]?.payout || 0) <= 0;
  const roundIndex = Math.max(0, (Number(game?.currentRound) || 1) - 1);
  useEffect(() => {
    const update = () => {
      const container = carouselContainerRef.current;
      const list = carouselListRef.current;
      const active = list?.children?.[roundIndex];
      if (!container || !active) return;
      setCarouselOffset(
        container.offsetWidth / 2 - (active.offsetLeft + active.offsetWidth / 2),
      );
    };
    const frame = window.requestAnimationFrame(update);
    const delayed = window.setTimeout(update, 500);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(delayed);
      window.removeEventListener("resize", update);
    };
  }, [game?._id, roundIndex]);
  const visibleRoundCount =
    game?.state === "completed" || game?.state === "jackpot_spinning"
      ? game?.rounds?.length || 0
      : game?.state === "rolling"
        ? Math.max(
            0,
            Number(game?.currentRound || 0) -
              (Number(game?.roundProgress || 0) >= 0.88 ? 0 : 1),
          )
        : 0;
  const visiblePot = useMemo(
    () =>
      (game?.bets || []).reduce(
        (total, bet) =>
          total +
          (bet?.results || [])
            .filter((result) => Number(result.roundIndex) < visibleRoundCount)
            .reduce((sum, result) => sum + Number(result.itemAmount || 0), 0),
        0,
      ),
    [game?.bets, visibleRoundCount],
  );
  const flowJackpotWeights = useMemo(
    () =>
      visibleJackpotWeights(
        game?.bets || [],
        game?.options?.crazy === true,
        game?.options?.jackpot === true,
        visibleRoundCount,
      ),
    [game?.bets, game?.options?.crazy, game?.options?.jackpot, visibleRoundCount],
  );
  const flowGame = useMemo(
    () =>
      game?.options?.jackpot
        ? { ...game, jackpotWeights: flowJackpotWeights }
        : game,
    [flowJackpotWeights, game],
  );
  useEffect(() => {
    if (game?.state !== "completed" || celebrated.current) return;
    celebrated.current = true;
    if (!creatorLost) {
      playSound("winner", { volume: 0.65, dedupeMs: 1000 });
      const anchor = winnerConfettiAnchorRef.current;
      const parent = anchor?.parentNode;
      if (!parent) return;
      const canvas = document.createElement("canvas");
      const bounds = parent.getBoundingClientRect();
      canvas.className = "temp-winners-confetti";
      canvas.width = Math.max(1, Math.floor(bounds.width));
      canvas.height = Math.max(1, Math.floor(bounds.height));
      canvas.setAttribute("aria-hidden", "true");
      Object.assign(canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "5",
        opacity: "1",
      });
      parent.appendChild(canvas);
      const burst = confetti.create(canvas, { resize: true, useWorker: true });
      burst({
        particleCount: 150,
        spread: 120,
        origin: { x: 0.5, y: 0.6 },
        colors: [
          "#FFD700",
          "#FFC0CB",
          "#00FFFF",
          "#FF4500",
          "#8A2BE2",
          "#FF6347",
        ],
        scalar: 1.2,
      });
      const cleanup = window.setTimeout(() => {
        burst.reset();
        canvas.remove();
      }, 5000);
      return () => {
        window.clearTimeout(cleanup);
        burst.reset();
        canvas.remove();
      };
    }
  }, [creatorLost, game?.state]);
  if (!game) return null;
  const share = async () => {
    try {
      await copyText(window.location.href);
      notify({ type: "success", message: "Link copied to clipboard." });
    } catch {
      notify({ type: "error", message: "Failed to copy." });
    }
  };
  const openFairness = () => {
    if (!user) {
      notify({
        type: "error",
        message: "Please sign in to perform this action.",
      });
      return;
    }
    setFair(true);
  };
  const winningSlot = jackpotWinnerSlot(game);
  const winningBets =
    game.options?.jackpot && Number.isFinite(winningSlot)
      ? [game.bets?.find((bet) => Number(bet?.slot) === winningSlot)].filter(
          Boolean,
        )
      : game.bets?.filter(
          (bet) =>
            Number(bet.payout) > 0 ||
            game.winnerSlots?.map(Number).includes(Number(bet.slot)),
        ) || [];
  const distributablePot = Math.floor(
    (game.bets || []).reduce(
      (total, bet) => total + Math.max(0, Number(bet.total) || 0),
      0,
    ) *
      (Math.max(
        0,
        100 - Math.min(80, Math.max(0, Number(game.options?.borrow) || 0)),
      ) /
        100),
  );
  const fallbackWinnerPayout = winningBets.length
    ? Math.floor(distributablePot / winningBets.length)
    : 0;
  const winners = winningBets.map((bet) => ({
    ...bet,
    payout: Number(bet.payout) || fallbackWinnerPayout,
  }));
  const headerModes = [
    game.options?.crazy && "crazy",
    game.options?.terminal && "terminal",
    game.options?.jackpot && "jackpot",
    Number(game.options?.borrow) > 0 && "borrow",
    Number(game.options?.funding) > 0 && "funding",
  ].filter(Boolean);
  const displayModes = headerModes.filter(
    (mode) => mode !== "borrow" && mode !== "funding",
  );
  const battleTypeDisplay = displayModes.length
    ? displayModes.join(", ")
    : "standard";
  const battleTypeClass = game.options?.crazy
    ? "crazy"
    : game.options?.terminal
      ? "terminal"
      : game.options?.jackpot
        ? "jackpot"
        : "standard";
  const playerCountDisplay = ["2v2", "3v3", "2v2v2"].includes(game.mode)
    ? game.mode
    : Number(game.playerCount) === 2
      ? "1v1"
      : Number(game.playerCount) === 3
        ? "1v1v1"
        : Number(game.playerCount) === 4
          ? "1v1v1v1"
          : `${game.playerCount}-Way`;
  const separatorIconVisible = (slot) => {
    if (["2v2", "3v3", "team"].includes(game.mode))
      return slot === Number(game.playerCount) / 2 - 1;
    if (game.mode === "2v2v2") return slot === 1 || slot === 3;
    return slot < bets.length - 1;
  };
  return (
    <>
      <div
        className={`battles-game game-${game.playerCount} game-${game.state}`}
        {...gameScope}
      >
        <div className="game-content" {...gameScope}>
      <div className="battles-header-game battle-cost-header" {...gameHeaderScope}>
        <div className="header-inner" {...gameHeaderScope}>
          <div className="battles-header-game-left" {...gameHeaderScope}>
            <div className="battles-header-game-left-info" {...gameHeaderScope}>
              <button
                className="back-button"
                type="button"
                onClick={() => navigate("/battles")}
                {...gameHeaderScope}
              >
                <BattleIcon name="back" {...gameHeaderScope} />
              </button>
              <div
                className="battles-header-game-left-info-item"
                {...gameHeaderScope}
              >
                <span
                  className="battles-header-game-left-info-label"
                  {...gameHeaderScope}
                >
                  Battle Cost
                </span>
                <div
                  className="battles-header-game-left-info-label-amount-container"
                  {...gameHeaderScope}
                >
                  {Number(game.options?.borrow) > 0 && (
                    <span
                      className="battles-header-game-left-info-label-amount normal"
                      {...gameHeaderScope}
                    >
                      <img
                        src={currencyIcon(game.currency)}
                        alt=""
                        {...gameHeaderScope}
                      />{" "}
                      {formatAmount(game.amount)}
                    </span>
                  )}
                  <span
                    className={`battles-header-game-left-info-label-amount${game.options?.borrow ? " borrow" : ""}${effectiveJoinAmount(game) <= 0 ? " is-free" : ""}`}
                    {...gameHeaderScope}
                  >
                    {effectiveJoinAmount(game) <= 0 ? (
                      "FREE"
                    ) : (
                      <>
                        <img
                          src={currencyIcon(game.currency)}
                          alt=""
                          {...gameHeaderScope}
                        />{" "}
                        {formatAmount(effectiveJoinAmount(game))}
                      </>
                    )}
                  </span>
                  {Number(game.options?.borrow) > 0 && (
                    <span
                      className="battles-header-game-left-info-label-amount-borrow"
                      {...gameHeaderScope}
                    >
                      -{game.options.borrow}%{" "}
                      <BattleIcon name="borrow" {...gameHeaderScope} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="battles-header-game-right" {...gameHeaderScope}>
            <div
              className="battles-header-game-right-actions"
              {...gameHeaderScope}
            >
              <button
                className="button-provably"
                type="button"
                onClick={openFairness}
                {...gameHeaderScope}
              >
                <SiteIcon name="fairness" {...gameHeaderScope} />
                <span {...gameHeaderScope}>Fairness</span>
              </button>
              <button
                className="button-copy"
                type="button"
                title="Share Battle"
                onClick={share}
                {...gameHeaderScope}
              >
                <BattleIcon name="copy" {...gameHeaderScope} />
                <span {...gameHeaderScope}>Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="battles-header-game battle-game-info battle-round-header" {...gameInfoScope}>
        <div className="header-inner" {...gameInfoScope}>
          <div className="battles-header-game-left" {...gameInfoScope}>
            <div className="battles-header-game-left-info" {...gameInfoScope}>
              <div
                className={`battles-header-game-left-info-item-icons ${battleTypeClass}${headerModes.length >= 2 ? " multi-mode" : ""}`}
                {...gameInfoScope}
              >
                {displayModes.length === 0 && (
                  <SiteIcon className="battle-type-icon" name="battles" {...gameInfoScope} />
                )}
                {headerModes.map((mode) => (
                  <BattleIcon
                    className="battle-type-icon"
                    name={mode}
                    key={mode}
                    {...gameInfoScope}
                  />
                ))}
              </div>
              <div
                className="battles-header-game-left-info-item"
                {...gameInfoScope}
              >
                <div
                  className="battles-header-game-left-info-label"
                  {...gameInfoScope}
                >
                  <span
                    className="battles-header-game-left-info-label-battle-type"
                    {...gameInfoScope}
                  >
                    {battleTypeDisplay}
                  </span>
                  <span
                    className="battles-header-game-left-info-label-player-count"
                    {...gameInfoScope}
                  >
                    {playerCountDisplay}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div
            className="battles-header-game-center"
            ref={carouselContainerRef}
            {...gameInfoScope}
          >
            <div
              className="carousel-list"
              ref={carouselListRef}
              style={{ transform: `translateX(${carouselOffset}px)` }}
              {...gameInfoScope}
            >
              {(game.rounds || []).map((round, index) => (
                <div
                  className={`carousel-item${index === roundIndex ? " active" : ""}`}
                  key={round._id || index}
                  onClick={() => setCaseInfo(round.box)}
                  {...gameInfoScope}
                >
                  <img
                    src={round.box?.imageUrl || round.box?.image}
                    alt=""
                    decoding="async"
                    style={
                      index === roundIndex
                        ? { transform: "scale(1.1)", opacity: 1, filter: "none" }
                        : {
                            transform: `scale(${Math.max(1 - 0.25 * Math.abs(index - roundIndex), 0.4)})`,
                            opacity: Math.max(
                              1 - 0.3 * Math.abs(index - roundIndex),
                              0.3,
                            ),
                            filter: "grayscale(1)",
                          }
                    }
                    {...gameInfoScope}
                  />
                  {index === roundIndex && (
                    <div className="item-info" {...gameInfoScope}>
                      <span className="item-name" {...gameInfoScope}>
                        {round.box?.name}
                      </span>
                      <span className="item-price" {...gameInfoScope}>
                        <img
                          src={currencyIcon(game.currency)}
                          alt=""
                          {...gameInfoScope}
                        />
                        {formatAmount(round.box?.amount)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="battles-header-game-right" {...gameInfoScope}>
            <div
              className="battles-header-game-right-actions"
              {...gameInfoScope}
            >
              {Math.max(1, Number(game.currentRound) || 1)}/
              {game.rounds?.length || 0} Rounds
            </div>
          </div>
        </div>
      </div>
          <JackpotWheel
            key={`${game._id}-${playbackResumeKey}`}
            game={flowGame}
          />
          <div
            className={`battles-spinner${["created", "countdown", "completed"].includes(game.state) ? " spinner-compact" : ""}`}
            {...spinnerScope}
          >
            <div className="shadow-top" {...spinnerScope} />
            <div className="shadow-bottom" {...spinnerScope} />
            {game.bets?.length > 0 &&
              ["rolling", "jackpot_spinning"].includes(game.state) && (
                <div
                  className={`jackpot-pot${Number(game.roundProgress || 0) >= 0.88 ? " animating" : ""}`}
                  {...spinnerScope}
                >
                  <span className="jackpot-pot-label" {...spinnerScope}>
                    <BattleIcon name="jackpot" {...spinnerScope} /> Jackpot
                  </span>
                  <div
                    className={`jackpot-pot-amount${Number(game.roundProgress || 0) >= 0.88 ? " animating" : ""}`}
                    {...spinnerScope}
                  >
                    <img
                      className="jackpot-pot-icon"
                      src={currencyIcon(game.currency)}
                      alt="Coins"
                      {...spinnerScope}
                    />
                    <span {...spinnerScope}>
                      <AnimatedNumber value={visiblePot} />
                    </span>
                  </div>
                </div>
              )}
            <div className="battles-spinner-background" {...spinnerScope}>
              <img
                src={
                  game.state === "completed"
                    ? creatorLost
                      ? "/assets/images/battles/battles-lost.png"
                      : "/assets/images/battles/battles-won.png"
                    : "/assets/images/battles/battles.png"
                }
                alt="Battles Background"
                {...spinnerScope}
              />
            </div>
            {game.state === "rolling" && (
              <>
                <BattleSpinnerArrow side="left" />
                <BattleSpinnerArrow side="right" />
              </>
            )}
            {game.state === "pending" && game.fair?.eosCountdown ? (
              <div
                className="battles-spinner-countdown"
                key={game.fair.eosCountdown}
                {...spinnerScope}
              >
                <span
                  className="battles-spinner-countdown-text"
                  {...spinnerScope}
                >
                  <span
                    className="battles-spinner-countdown-text-label"
                    {...spinnerScope}
                  >
                    Starting In
                  </span>{" "}
                  0{game.fair.eosCountdown}
                </span>
              </div>
            ) : game.state === "pending" ? (
              <div className="battles-awaiting-eos" {...spinnerScope}>
                <div className="battles-awaiting-eos-text" {...spinnerScope}>
                  <span {...spinnerScope}>
                    Awaiting EOS Block{" "}
                    {game.fair?.eosBlockNumber
                      ? `(#${game.fair.eosBlockNumber})`
                      : ""}
                  </span>
                </div>
              </div>
            ) : null}
            {bets.map((bet, slot) => {
              const riskSpinPhase =
                game.state === "rolling" &&
                riskSpinSlots.has(Number(bet?.slot));
              const adjacentRiskSpin =
                riskSpinPhase ||
                (game.state === "rolling" &&
                  riskSpinSlots.has(Number(bets[slot + 1]?.slot)));
              return (
                <div
                  className={`inner-element${riskSpinPhase ? " inner-element--risk-spin" : ""}${slot % 2 ? " inner-element--east" : ""}`}
                  key={slot}
                  {...spinnerScope}
                >
                  <div className="seat-pfp" {...spinnerScope}>
                    <img
                      src={
                        !bet
                          ? "/assets/images/battles/no-player.png"
                          : bet.bot
                            ? bet?.user?.avatar || "/assets/images/battles/risk-bot.png"
                            : bet?.user?.avatar || "/assets/users/default-avatar.png"
                      }
                      alt={
                        !bet
                          ? "Waiting"
                          : bet.bot
                            ? "Risk Bot"
                            : bet?.user?.username || "Player"
                      }
                      {...spinnerScope}
                    />
                  </div>
                  {!bet && ["created", "countdown"].includes(game.state) ? (
                    <div className="element-waiting" {...spinnerScope}>
                      <div className="waiting-spinner" {...spinnerScope} />
                      <div className="waiting-text" {...spinnerScope}>
                        Waiting
                        <span className="waiting-text-rest" {...spinnerScope}>
                          {" for Player"}
                        </span>
                      </div>
                      <div className="waiting-action" {...spinnerScope}>
                        <button
                          className="button-call-bot"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            onAction(creator ? "bot" : "join", slot)
                          }
                          {...spinnerScope}
                        >
                          <div className="button-inner" {...spinnerScope}>
                            <div className="inner-content" {...spinnerScope}>
                              {creator ? "Call Bot" : "Join Battle"}
                            </div>
                          </div>
                        </button>
                        {creator && slot === 0 && (
                            <button
                              className="button-fill-bots"
                              type="button"
                              disabled={busy}
                              onClick={() => onAction("fill-bots")}
                              {...spinnerScope}
                            >
                              <div className="button-inner" {...spinnerScope}>
                                <div
                                  className="inner-content"
                                  {...spinnerScope}
                                >
                                  Fill Bots
                                </div>
                              </div>
                            </button>
                          )}
                      </div>
                    </div>
                  ) : bet && ["created", "countdown"].includes(game.state) ? (
                    <div className="element-ready" {...spinnerScope}>
                      <BattleIcon name="ready-check" {...spinnerScope} />
                      <div className="ready-text" {...spinnerScope}>
                        <span {...spinnerScope}>Ready</span>
                      </div>
                      {creator && slot === 0 && bets.some((entry) => !entry) && (
                        <div className="ready-action" {...spinnerScope}>
                          <button
                            className="button-fill-bots"
                            type="button"
                            disabled={busy}
                            onClick={() => onAction("fill-bots")}
                            {...spinnerScope}
                          >
                            <div className="button-inner" {...spinnerScope}>
                              <div className="inner-content" {...spinnerScope}>
                                Fill Bots
                              </div>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : ["pending", "rolling", "jackpot_spinning"].includes(
                      game.state,
                    ) ? (
                    <div className="element-wheel" {...spinnerScope}>
                      <BattleReel
                        key={`${game._id}-${bet?.slot}-${roundIndex}-${playbackResumeKey}`}
                        bet={bet}
                        box={game.rounds?.[roundIndex]?.box}
                        gameId={game._id}
                        round={roundIndex}
                        running={game.state === "rolling"}
                        fast={game.options?.fastSpin}
                        primary={slot === 0}
                        currency={game.currency}
                        onRiskPhaseChange={updateRiskSpinSlot}
                      />
                    </div>
                  ) : null}
                  {slot < bets.length - 1 && game.state !== "completed" && (
                    <div
                      className={`element-seperator${adjacentRiskSpin ? " element-seperator--risk-spin" : ""}`}
                      {...spinnerScope}
                    >
                      {separatorIconVisible(slot) && (
                        <div className="seperator-box" {...spinnerScope}>
                          <div className="box-inner" {...spinnerScope}>
                            <BattleIcon
                              name={
                                ["2v2", "3v3", "2v2v2", "team"].includes(
                                  game.mode,
                                )
                                  ? "group"
                                  : "versus"
                              }
                              {...spinnerScope}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {game.state === "completed" && (
              <div className="winners-container" {...spinnerScope}>
                <canvas
                  ref={winnerConfettiAnchorRef}
                  className="confetti-canvas"
                  aria-hidden="true"
                  {...spinnerScope}
                />
                <h2 className="winners-title" {...spinnerScope}>
                  {winners.length > 1 ? "Battle Winners" : "Battle Winner"}
                </h2>
                <div className="winners-content" {...spinnerScope}>
                  {winners.map((winner) => (
                    <div
                      className="winner-item"
                      key={winner.slot}
                      {...spinnerScope}
                    >
                      <div className="winner-avatar" {...spinnerScope}>
                        <img
                          className="avatar-image"
                          src={
                            winner.bot
                              ? winner.user?.avatar || "/assets/images/battles/risk-bot.png"
                              : winner.user?.avatar || "/assets/users/default-avatar.png"
                          }
                          alt=""
                          {...spinnerScope}
                        />
                      </div>
                      <div className="winner-name" {...spinnerScope}>
                        {winner.user?.username || (winner.bot ? "Risk Bot" : "Player")}
                      </div>
                      <div
                        className="winner-amount-container"
                        {...spinnerScope}
                      >
                        <img
                          src={currencyIcon(game.currency)}
                          alt=""
                          {...spinnerScope}
                        />
                        <div className="winner-amount" {...spinnerScope}>
                          {formatAmount(winner.payout)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="winners-actions" {...spinnerScope}>
                  <button
                    className="button-recreate"
                    type="button"
                    onClick={() => onAction("recreate")}
                    {...spinnerScope}
                  >
                    <BattleIcon name="add" {...spinnerScope} /> Recreate Battle
                  </button>
                  <button
                    className="button-new-battle"
                    type="button"
                    onClick={() => navigate("/battles")}
                    {...spinnerScope}
                  >
                    <BattleIcon name="back" {...spinnerScope} /> Back to Battles
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="content-bets" {...gameScope}>
            <div className="content-bets-inner" {...gameScope}>
              {bets.map((bet, slot) => (
                <PlayerResult bet={bet} game={flowGame} key={slot} />
              ))}
            </div>
          </div>
        </div>
      </div>
      {fair && (
        <ModalAnimation label="Game Fairness" onClose={() => setFair(false)}>
          <BattleFairness game={game} />
        </ModalAnimation>
      )}
      {caseInfo && (
        <ModalAnimation
          label={`${caseInfo.name || "Case"} details`}
          onClose={() => setCaseInfo(null)}
        >
          <CaseInfoModal box={caseInfo} currency={game.currency} />
        </ModalAnimation>
      )}
      <button
        className="battle-refresh-accessible"
        type="button"
        onClick={onRefresh}
      >
        Refresh battle
      </button>
    </>
  );
}

function Battles({ user, battleId, battleCreate = false, onSignIn }) {
  const [games, setGames] = useState([]);
  const [game, setGame] = useState(null);
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("date");
  const [join, setJoin] = useState(null);
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState(() =>
    window.localStorage.getItem("currency") === "coins" ? "coins" : "rocoins",
  );
  const refresh = useCallback(async () => {
    try {
      if (battleId) {
        const payload = await request(
          `/api/battles/${encodeURIComponent(battleId)}`,
        );
        setGame((current) => mergeBattleUpdate(current, payload.game));
      } else if (!battleCreate) {
        const payload = await request("/api/battles");
        setGames(payload.games || []);
      }
    } catch (error) {
      if (battleId) notify({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }, [battleCreate, battleId]);
  useEffect(() => {
    document.title = battleCreate
      ? "Create Battle - RoRisk.com"
      : battleId
        ? "Battle - RoRisk.com"
        : "Battles - RoRisk.com";
    const initialRefresh = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, battleId ? 3000 : 4000);
    const realtime = (event) => {
      const updated = event.detail?.game;
      if (!updated?._id) return;
      setGames((current) => [
        updated,
        ...current.filter((entry) => entry._id !== updated._id),
      ]);
      if (
        battleId === updated._id ||
        String(battleId) === String(updated.gameId)
      )
        setGame((current) => mergeBattleUpdate(current, updated));
    };
    window.addEventListener("rorisk:battle-update", realtime);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
      window.removeEventListener("rorisk:battle-update", realtime);
    };
  }, [battleId, battleCreate, refresh]);
  useEffect(() => {
    if (!battleCreate) return undefined;
    let cancelled = false;
    loadBattleCases(currency)
      .then((cases) => {
        if (cancelled) return;
        setBoxes(
          cases.filter(
            (box) =>
              !(box.categories || []).some((category) =>
                ["daily", "rewards", "bonus"].includes(category),
              ),
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [battleCreate, currency]);
  useEffect(() => {
    const update = (event) =>
      setCurrency(event.detail?.currency === "coins" ? "coins" : "rocoins");
    window.addEventListener("rorisk:currency-change", update);
    return () => window.removeEventListener("rorisk:currency-change", update);
  }, []);
  const updateUser = (profile) =>
    profile &&
    window.dispatchEvent(
      new CustomEvent("rorisk:user-update", { detail: { user: profile } }),
    );
  const askJoin = useCallback((target, slot) => {
    if (!user) {
      onSignIn?.();
      return notify({
        type: "error",
        message: "Please sign in to perform this action.",
      });
    }
    setJoin({ game: target, slot });
  }, [onSignIn, user]);
  const action = async (type, slot) => {
    if (!user) {
      onSignIn?.();
      return notify({
        type: "error",
        message: "Please sign in to perform this action.",
      });
    }
    if (type === "join") return setJoin({ game, slot });
    if (type === "recreate") {
      const recreate = {
        boxes: (game.boxes || []).map((entry) => ({
          _id: entry.box?._id || entry.box?.caseId,
          count: Math.max(1, Number(entry.count) || 1),
          box: entry.box,
        })),
        playerCount: game.playerCount,
        mode: game.mode,
        ...game.options,
        currency: game.currency,
      };
      pendingBattleRecreate = recreate;
      window.sessionStorage.setItem(
        "rorisk_battle_recreate",
        JSON.stringify({
          ...recreate,
          boxes: recreate.boxes.map(({ _id, count }) => ({ _id, count })),
        }),
      );
      loadBattleCases(game.currency).catch(() => undefined);
      navigate("/battles/create");
      return;
    }
    setBusy(true);
    try {
      const payload = await request(`/api/battles/${game._id}/${type}`, {
        method: "POST",
        body: JSON.stringify({ slot }),
      });
      if (payload.user) updateUser(payload.user);
      if (payload.game)
        setGame((current) => mergeBattleUpdate(current, payload.game));
      playSound("join", { volume: 0.55, dedupeMs: 250 });
    } catch (error) {
      notify({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };
  const confirmJoin = async () => {
    setBusy(true);
    try {
      const payload = await request(`/api/battles/${join.game._id}/join`, {
        method: "POST",
        body: JSON.stringify({ slot: join.slot }),
      });
      updateUser(payload.user);
      setJoin(null);
      if (payload.game) {
        setGame((current) => mergeBattleUpdate(current, payload.game));
        setGames((current) => [
          payload.game,
          ...current.filter((entry) => entry._id !== payload.game._id),
        ]);
      }
      playSound("join", { volume: 0.55 });
      if (!battleId) navigate(`/battles/${payload.game._id}`);
    } catch (error) {
      notify({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className={`battles${battleId ? " battles-game-route" : ""}`}
      {...rootScope}
    >
      {battleCreate ? (
        <CreateBattle
          boxes={boxes}
          currency={currency}
          user={user}
          onUserUpdate={updateUser}
        />
      ) : battleId ? (
        loading && !game ? null : (
          <BattleDetail
            game={game}
            user={user}
            busy={busy}
            onAction={action}
            onRefresh={refresh}
          />
        )
      ) : (
        <Lobby
          games={games}
          loading={loading}
          sort={sort}
          setSort={setSort}
          currency={currency}
          onJoin={askJoin}
        />
      )}
      {join && (
        <ModalAnimation label="Join Battle" onClose={() => setJoin(null)}>
          <JoinModal
            busy={busy}
            onCancel={() => setJoin(null)}
            onConfirm={confirmJoin}
          />
        </ModalAnimation>
      )}
    </div>
  );
}

export default Battles;
