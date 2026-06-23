const playerInputs = [
  document.getElementById("p0Input"),
  document.getElementById("p1Input"),
  document.getElementById("p2Input"),
  document.getElementById("p3Input"),
];

const playerHands = [
  document.getElementById("p0Hand"),
  document.getElementById("p1Hand"),
  document.getElementById("p2Hand"),
  document.getElementById("p3Hand"),
];

const kittyInput = document.getElementById("kittyInput");
const kittyHand = document.getElementById("kittyHand");
const errors = document.getElementById("errors");

const VALID_RANKS = ["4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const VALID_SUITS = ["S", "H", "D", "C"];
const BID_SUITS = ["S", "C", "D", "H"];
const FULL_HAND_SIZE = 10;
const KITTY_SIZE = 3;
const TEAM_A = new Set([0, 2]);

const tracker = {
  phase: "setup",
  hands: [[], [], [], []],
  kitty: [],
  dealer: 0,
  currentBidder: 1,
  bidsTaken: 0,
  passStreak: 0,
  passedPlayers: [],
  highBid: null,
  trump: null,
  currentPlayer: 0,
  currentTrick: [],
  previousTrick: [],
  playedCards: [],
  buriedCards: [],
  selectedDiscards: [],
  teamTricks: [0, 0],
  trickNumber: 1,
  lastTrickMessage: "",
  moveInsights: [],
  history: [],
};

const advisor = {
  active: false,
  you: 0,
  dealer: 0,
  currentBidder: 1,
  biddingComplete: false,
  passStreak: 0,
  bidsTaken: 0,
  highBid: null,
  hand: [],
  kitty: [],
  trump: null,
  currentPlayer: 0,
  currentTrick: [],
  playedCards: [],
  teamTricks: [0, 0],
  trickNumber: 1,
  knownCards: new Set(),
};

function normalizeToken(token) {
  const cleaned = token.trim().toUpperCase();
  if (cleaned === "JOKER") return "JK";
  return cleaned;
}

function parseCards(text) {
  return text
    .split(/[\s,]+/)
    .map(normalizeToken)
    .filter(token => token.length > 0);
}

function rankOf(card) {
  if (card === "JK") return "JK";
  return card.slice(0, -1);
}

function suitOf(card) {
  if (card === "JK") return null;
  return card.slice(-1);
}

function isValidCard(card) {
  if (card === "JK") return true;
  const suit = suitOf(card);
  const rank = rankOf(card);
  if (!VALID_SUITS.includes(suit)) return false;
  if (!VALID_RANKS.includes(rank)) return false;
  return !(rank === "4" && (suit === "S" || suit === "C"));
}

function sameColorSuit(suit) {
  if (suit === "H") return "D";
  if (suit === "D") return "H";
  if (suit === "S") return "C";
  if (suit === "C") return "S";
  return null;
}

function isRightBower(card, trump) {
  return card !== "JK" && rankOf(card) === "J" && suitOf(card) === trump;
}

function isLeftBower(card, trump) {
  return card !== "JK" && rankOf(card) === "J" && suitOf(card) === sameColorSuit(trump);
}

function effectiveSuit(card, trump) {
  if (card === "JK") return trump;
  if (isLeftBower(card, trump)) return trump;
  return suitOf(card);
}

function rankValue(card) {
  const rank = rankOf(card);
  if (rank === "JK") return 20;
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  return Number(rank);
}

function cardStrength(card, trump, ledSuit) {
  if (card === "JK") return 1000;
  if (isRightBower(card, trump)) return 999;
  if (isLeftBower(card, trump)) return 998;

  const cardSuit = effectiveSuit(card, trump);
  if (cardSuit === trump) return 500 + rankValue(card);
  if (cardSuit === ledSuit) return 100 + rankValue(card);
  return rankValue(card);
}

function sortCards(cards, trump = null) {
  return [...cards].sort((a, b) => {
    if (trump) {
      return cardStrength(b, trump, effectiveSuit(b, trump)) - cardStrength(a, trump, effectiveSuit(a, trump));
    }
    if (a === "JK") return -1;
    if (b === "JK") return 1;
    return `${suitOf(a)}${String(20 - rankValue(a)).padStart(2, "0")}`
      .localeCompare(`${suitOf(b)}${String(20 - rankValue(b)).padStart(2, "0")}`);
  });
}

function playerName(index) {
  return `Player ${index + 1}`;
}

function teamIndex(player) {
  return TEAM_A.has(player) ? 0 : 1;
}

function nextPlayer(player) {
  return (player + 1) % 4;
}

function suitName(suit) {
  return { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" }[suit] || "Unknown";
}

function buildDeck() {
  const deck = [];
  for (const suit of VALID_SUITS) {
    for (const rank of VALID_RANKS) {
      if (rank === "4" && (suit === "S" || suit === "C")) continue;
      deck.push(`${rank}${suit}`);
    }
  }
  deck.push("JK");
  return deck;
}

function shuffle(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function setError(message) {
  errors.textContent = message;
}

function clearError() {
  errors.textContent = "";
}

function cardColorClass(card) {
  if (card === "JK") return "joker";
  const suit = suitOf(card);
  return suit === "H" || suit === "D" ? "red" : "black";
}

function compareBids(a, b) {
  if (!b) return 1;
  if (a.tricks !== b.tricks) return a.tricks - b.tricks;
  return BID_SUITS.indexOf(a.suit) - BID_SUITS.indexOf(b.suit);
}

function hasPassed(player) {
  return tracker.passedPlayers.includes(player);
}

function activeAuctionPlayers() {
  return [0, 1, 2, 3].filter(player => !hasPassed(player));
}

function shouldFinishTrackerAuction() {
  if (!tracker.highBid) return tracker.passedPlayers.length === 4;
  return activeAuctionPlayers().every(player => player === tracker.highBid.player);
}

function nextActiveBidder(afterPlayer) {
  let candidate = nextPlayer(afterPlayer);
  for (let i = 0; i < 4; i++) {
    if (!hasPassed(candidate)) return candidate;
    candidate = nextPlayer(candidate);
  }
  return null;
}

function bidText(bid) {
  if (!bid) return "No bid yet";
  return `${bid.tricks} ${suitName(bid.suit)} by ${playerName(bid.player)}`;
}

function snapshotTracker() {
  return {
    phase: tracker.phase,
    hands: tracker.hands.map(hand => [...hand]),
    kitty: [...tracker.kitty],
    dealer: tracker.dealer,
    currentBidder: tracker.currentBidder,
    bidsTaken: tracker.bidsTaken,
    passStreak: tracker.passStreak,
    passedPlayers: [...tracker.passedPlayers],
    highBid: tracker.highBid ? { ...tracker.highBid } : null,
    trump: tracker.trump,
    currentPlayer: tracker.currentPlayer,
    currentTrick: tracker.currentTrick.map(play => ({ ...play })),
    previousTrick: tracker.previousTrick.map(play => ({ ...play })),
    playedCards: [...tracker.playedCards],
    buriedCards: [...tracker.buriedCards],
    selectedDiscards: [...tracker.selectedDiscards],
    teamTricks: [...tracker.teamTricks],
    trickNumber: tracker.trickNumber,
    lastTrickMessage: tracker.lastTrickMessage,
    moveInsights: [...tracker.moveInsights],
    bidLog: [...document.getElementById("trackerBidLog").children].map(item => item.textContent),
  };
}

function saveTrackerHistory() {
  tracker.history.push(snapshotTracker());
  if (tracker.history.length > 50) tracker.history.shift();
}

function restoreTrackerSnapshot(snapshot) {
  tracker.phase = snapshot.phase;
  tracker.hands = snapshot.hands.map(hand => [...hand]);
  tracker.kitty = [...snapshot.kitty];
  tracker.dealer = snapshot.dealer;
  tracker.currentBidder = snapshot.currentBidder;
  tracker.bidsTaken = snapshot.bidsTaken;
  tracker.passStreak = snapshot.passStreak;
  tracker.passedPlayers = [...snapshot.passedPlayers];
  tracker.highBid = snapshot.highBid ? { ...snapshot.highBid } : null;
  tracker.trump = snapshot.trump;
  tracker.currentPlayer = snapshot.currentPlayer;
  tracker.currentTrick = snapshot.currentTrick.map(play => ({ ...play }));
  tracker.previousTrick = snapshot.previousTrick.map(play => ({ ...play }));
  tracker.playedCards = [...snapshot.playedCards];
  tracker.buriedCards = [...snapshot.buriedCards];
  tracker.selectedDiscards = [...snapshot.selectedDiscards];
  tracker.teamTricks = [...snapshot.teamTricks];
  tracker.trickNumber = snapshot.trickNumber;
  tracker.lastTrickMessage = snapshot.lastTrickMessage;
  tracker.moveInsights = [...snapshot.moveInsights];

  const bidLog = document.getElementById("trackerBidLog");
  bidLog.innerHTML = "";
  for (const text of snapshot.bidLog) {
    const item = document.createElement("li");
    item.textContent = text;
    bidLog.appendChild(item);
  }
}

function undoTrackerAction() {
  const snapshot = tracker.history.pop();
  if (!snapshot) return;
  clearError();
  restoreTrackerSnapshot(snapshot);
  syncTrackerInputsFromState();
  renderTracker();
}

function validateCardSet(cards, options = {}) {
  const invalidCards = cards.filter(card => !isValidCard(card));
  if (invalidCards.length > 0) return `Invalid cards: ${invalidCards.join(", ")}`;

  const seen = new Set(options.knownCards || []);
  const duplicates = [];
  for (const card of cards) {
    if (seen.has(card)) duplicates.push(card);
    seen.add(card);
  }

  if (duplicates.length > 0) return `Duplicate cards: ${duplicates.join(", ")}`;
  return "";
}

function validateFullDeal(hands, kitty) {
  const allCards = [...hands.flat(), ...kitty];
  if (allCards.length === 0) return "Enter cards for all 4 players and the kitty, or use Deal Random Hands.";

  const cardError = validateCardSet(allCards);
  if (cardError) return cardError;

  for (let i = 0; i < hands.length; i++) {
    if (hands[i].length !== FULL_HAND_SIZE) {
      return `${playerName(i)} has ${hands[i].length} cards. Each player needs exactly ${FULL_HAND_SIZE}.`;
    }
  }

  if (kitty.length !== KITTY_SIZE) return `Kitty has ${kitty.length} cards. It needs exactly ${KITTY_SIZE}.`;
  return "";
}

function winningPlayIndex(trick, trump) {
  if (trick.length === 0) return -1;
  const ledSuit = effectiveSuit(trick[0].card, trump);
  let bestIndex = 0;
  let bestStrength = cardStrength(trick[0].card, trump, ledSuit);

  for (let i = 1; i < trick.length; i++) {
    const strength = cardStrength(trick[i].card, trump, ledSuit);
    if (strength > bestStrength) {
      bestStrength = strength;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function legalMoves(hand, trump, trick) {
  if (trick.length === 0) return [...hand];
  const ledSuit = effectiveSuit(trick[0].card, trump);
  const matching = hand.filter(card => effectiveSuit(card, trump) === ledSuit);
  return matching.length > 0 ? matching : [...hand];
}

function estimateTricksForSuit(hand, suit) {
  let score = 0;
  const trumpCards = hand.filter(card => effectiveSuit(card, suit) === suit);

  if (hand.includes("JK")) score += 2.2;
  if (hand.some(card => isRightBower(card, suit))) score += 1.8;
  if (hand.some(card => isLeftBower(card, suit))) score += 1.4;
  if (trumpCards.some(card => rankOf(card) === "A" && !isLeftBower(card, suit))) score += 0.9;
  score += Math.max(0, trumpCards.length - 3) * 0.45;

  for (const sideSuit of VALID_SUITS) {
    if (sideSuit === suit) continue;
    const cards = hand.filter(card => effectiveSuit(card, suit) === sideSuit);
    if (cards.some(card => rankOf(card) === "A")) score += 0.65;
    if (cards.length === 0) score += 0.25;
    if (cards.length === 1) score += 0.15;
  }

  return Math.min(10, Math.max(0, 4 + score));
}

function recommendBid(hand, currentHighBid, player = 0) {
  const suitScores = BID_SUITS.map(suit => ({
    suit,
    estimate: estimateTricksForSuit(hand, suit),
  })).sort((a, b) => b.estimate - a.estimate);

  const best = suitScores[0];
  let tricks = Math.floor(best.estimate);
  if (best.estimate >= 6.75) tricks = Math.ceil(best.estimate);
  tricks = Math.max(6, Math.min(10, tricks));

  const candidate = { player, tricks, suit: best.suit };
  if (best.estimate < 5.9 || compareBids(candidate, currentHighBid) <= 0) {
    return {
      action: "pass",
      text: `Recommendation: pass. Best fit is ${suitName(best.suit)} at about ${best.estimate.toFixed(1)} tricks.`,
    };
  }

  return {
    action: "bid",
    bid: candidate,
    text: `Recommendation: bid ${tricks} ${suitName(best.suit)}. Estimated strength: ${best.estimate.toFixed(1)} tricks.`,
  };
}

function discardScore(card, trump) {
  if (card === "JK") return 1000;
  if (isRightBower(card, trump)) return 999;
  if (isLeftBower(card, trump)) return 998;
  if (effectiveSuit(card, trump) === trump) return 500 + rankValue(card);
  if (rankOf(card) === "A") return 220;
  if (rankOf(card) === "K") return 150;
  if (rankOf(card) === "Q") return 90;
  return rankValue(card);
}

function combinations(items, size) {
  if (size === 0) return [[]];
  if (items.length < size) return [];

  const [first, ...rest] = items;
  return [
    ...combinations(rest, size - 1).map(combo => [first, ...combo]),
    ...combinations(rest, size),
  ];
}

function countByEffectiveSuit(cards, trump) {
  const counts = { S: 0, H: 0, D: 0, C: 0 };
  for (const card of cards) {
    const suit = effectiveSuit(card, trump);
    if (counts[suit] !== undefined) counts[suit] += 1;
  }
  return counts;
}

function topTrumpCount(cards, trump) {
  return cards.filter(card =>
    card === "JK" ||
    isRightBower(card, trump) ||
    isLeftBower(card, trump) ||
    (effectiveSuit(card, trump) === trump && rankOf(card) === "A")
  ).length;
}

function recommendDiscards(hand, trump) {
  let best = null;

  for (const discards of combinations(hand, 3)) {
    const kept = hand.filter(card => !discards.includes(card));
    const keptCounts = countByEffectiveSuit(kept, trump);
    const discardedValue = discards.reduce((sum, card) => sum + discardScore(card, trump), 0);

    let voidBonus = 0;
    let singletonPenalty = 0;
    let aceKeepBonus = 0;

    for (const suit of VALID_SUITS) {
      if (suit === trump) continue;

      if (keptCounts[suit] === 0) voidBonus += 260;
      if (keptCounts[suit] === 1) singletonPenalty += 25;
      if (kept.some(card => effectiveSuit(card, trump) === suit && rankOf(card) === "A")) {
        aceKeepBonus += 140;
      }
    }

    const trumpPenalty = discards
      .filter(card => effectiveSuit(card, trump) === trump)
      .reduce((sum, card) => sum + 300 + discardScore(card, trump), 0);

    const score = discardedValue + trumpPenalty + singletonPenalty - voidBonus - aceKeepBonus;
    if (!best || score < best.score) best = { score, discards };
  }

  return best ? best.discards : [];
}

function knownOutCardsForPlayer(player, options = {}) {
  const playerHand = options.allHands?.[player] || [];
  const unavailable = new Set([
    ...playerHand,
    ...(options.playedCards || []),
    ...(options.buriedCards || []),
    ...((options.currentTrick || []).map(play => play.card)),
  ]);

  return buildDeck().filter(card => !unavailable.has(card));
}

function shouldBleedTrump(hand, trump, trick, player, options = {}) {
  if (trick.length !== 0) return false;
  const trumpCards = hand.filter(card => effectiveSuit(card, trump) === trump);
  if (trumpCards.length < 4) return false;

  const contract = options.highBid;
  const playerTeamOwnsBid = contract && teamIndex(contract.player) === teamIndex(player);
  const playerIsBidder = contract && contract.player === player;
  const playerIsPartnerOfBidder = contract && teamIndex(contract.player) === teamIndex(player) && contract.player !== player;
  const opponentOwnsBid = contract && teamIndex(contract.player) !== teamIndex(player);
  const highTrump = topTrumpCount(hand, trump);

  if (playerIsBidder && highTrump >= 2) return true;
  if (playerIsPartnerOfBidder) return false;
  if (playerTeamOwnsBid && !playerIsPartnerOfBidder && highTrump >= 3) return true;
  if (opponentOwnsBid && highTrump >= 2 && trumpCards.length >= 5) return true;
  return false;
}

function recommendPlayFromState(hand, trump, trick, player, label = "you", options = {}) {
  const legal = legalMoves(hand, trump, trick);
  if (legal.length === 0) return null;

  const ledSuit = trick.length ? effectiveSuit(trick[0].card, trump) : effectiveSuit(legal[0], trump);
  const sortedLow = [...legal].sort((a, b) => cardStrength(a, trump, ledSuit) - cardStrength(b, trump, ledSuit));
  const sortedHigh = [...legal].sort((a, b) => cardStrength(b, trump, ledSuit) - cardStrength(a, trump, ledSuit));
  const nonTrumpLow = sortedLow.filter(card => effectiveSuit(card, trump) !== trump);
  const nonTrumpHigh = sortedHigh.filter(card => effectiveSuit(card, trump) !== trump);

  if (trick.length === 0) {
    if (shouldBleedTrump(hand, trump, trick, player, options)) {
      const bestTrump = sortedHigh.find(card => effectiveSuit(card, trump) === trump);
      return {
        card: bestTrump,
        reason: `${label} has enough trump control to bleed trump and reduce opponents' ruffing power.`,
        legal,
      };
    }

    const sideAce = nonTrumpHigh.find(card => rankOf(card) === "A");
    const strongSide = nonTrumpHigh.find(card => rankOf(card) === "K" || rankOf(card) === "Q");
    const safeSide = nonTrumpLow[0];
    const onlyTrump = nonTrumpHigh.length === 0;

    return {
      card: sideAce || strongSide || safeSide || sortedHigh[0],
      reason: onlyTrump
        ? `${label} lead and only has trump, so lead the strongest trump.`
        : `${label} lead. Start with a side-suit winner or a low side card and save trump pressure.`,
      legal,
    };
  }

  const winningPlayer = trick[winningPlayIndex(trick, trump)].player;
  if (teamIndex(winningPlayer) === teamIndex(player)) {
    const saveTrumpCard = nonTrumpLow[0] || sortedLow[0];
    return {
      card: saveTrumpCard,
      reason: `${playerName(winningPlayer)} is currently winning for your team, so save strength.`,
      legal,
    };
  }

  const currentBest = trick[winningPlayIndex(trick, trump)].card;
  const currentBestStrength = cardStrength(currentBest, trump, ledSuit);
  const winners = sortedLow.filter(card => cardStrength(card, trump, ledSuit) > currentBestStrength);
  if (winners.length > 0) {
    const cheapestNonTrumpWinner = winners.find(card => effectiveSuit(card, trump) !== trump);
    return {
      card: cheapestNonTrumpWinner || winners[0],
      reason: "Play the cheapest legal card that currently wins.",
      legal,
    };
  }

  return {
    card: nonTrumpLow[0] || sortedLow[0],
    reason: "No legal card can win this trick, so throw the lowest legal card.",
    legal,
  };
}

function trackerFocusPlayer() {
  const value = document.getElementById("trackerFocusPlayerSelect").value;
  return value === "current" ? tracker.currentPlayer : Number(value);
}

function trackerRecommendationContext() {
  return {
    highBid: tracker.highBid,
    allHands: tracker.hands,
    playedCards: tracker.playedCards,
    buriedCards: tracker.buriedCards,
    currentTrick: tracker.currentTrick,
  };
}

function renderTrackerCounts() {
  const focus = trackerFocusPlayer();
  const outside = knownOutCardsForPlayer(focus, {
    allHands: tracker.hands,
    playedCards: tracker.playedCards,
    buriedCards: tracker.buriedCards,
    currentTrick: tracker.currentTrick,
  });
  const trump = tracker.trump || "S";
  const counts = countByEffectiveSuit(outside, trump);
  const suitCounter = document.getElementById("suitCounter");
  suitCounter.innerHTML = "";

  for (const suit of VALID_SUITS) {
    const div = document.createElement("div");
    const label = suit === tracker.trump ? `${suitName(suit)} trump` : suitName(suit);
    const examples = outside
      .filter(card => effectiveSuit(card, trump) === suit)
      .sort((a, b) => cardStrength(b, trump, suit) - cardStrength(a, trump, suit))
      .slice(0, 5)
      .join(" ");
    div.innerHTML = `<strong>${label}: ${counts[suit]}</strong><span>${examples || "none"}</span>`;
    suitCounter.appendChild(div);
  }

  const trumpLeft = tracker.trump ? counts[tracker.trump] : 0;
  document.getElementById("countSummary").textContent = tracker.trump
    ? `${playerName(focus)} view: ${outside.length} cards outside their hand are still live or unknown. ${trumpLeft} trump outside.`
    : `${playerName(focus)} view: start bidding to choose trump and enable trump counts.`;
}

function renderTrackerRecommendation() {
  const focus = trackerFocusPlayer();
  const legalContainer = document.getElementById("trackerLegalCards");
  const text = document.getElementById("trackerRecommendation");

  if (tracker.phase === "discard" && tracker.highBid?.player === focus) {
    const discards = recommendDiscards(tracker.hands[focus], tracker.trump);
    text.textContent = `Discard read: ${playerName(focus)} should try ${discards.join(" ")} to create voids while keeping trump and side aces.`;
    renderHand(discards, legalContainer);
    return;
  }

  if (tracker.phase !== "play" || !tracker.trump) {
    text.textContent = "Play recommendations appear once the hand is in play.";
    renderHand([], legalContainer);
    return;
  }

  const recommendation = recommendPlayFromState(
    tracker.hands[focus],
    tracker.trump,
    focus === tracker.currentPlayer ? tracker.currentTrick : [],
    focus,
    playerName(focus),
    trackerRecommendationContext(),
  );

  text.textContent = recommendation
    ? `${playerName(focus)} should play ${recommendation.card}. ${recommendation.reason}`
    : `${playerName(focus)} has no legal play available.`;
  renderHand(recommendation?.legal || [], legalContainer, {
    legalCards: recommendation?.legal || [],
  });
}

function renderMoveInsights() {
  const log = document.getElementById("moveInsightLog");
  log.innerHTML = "";

  if (tracker.moveInsights.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Insights will appear after cards are played.";
    log.appendChild(item);
    return;
  }

  for (const insight of tracker.moveInsights) {
    const item = document.createElement("li");
    item.textContent = insight;
    log.appendChild(item);
  }
}

function describeMoveInsight(player, card, trickBeforePlay, legalBeforePlay) {
  const pieces = [];
  const label = `${playerName(player)} played ${card}`;
  const isTrump = tracker.trump && effectiveSuit(card, tracker.trump) === tracker.trump;

  if (trickBeforePlay.length === 0) {
    if (isTrump) {
      pieces.push("led trump to pull trump from everyone else");
    } else if (rankOf(card) === "A") {
      pieces.push(`led the ${suitName(effectiveSuit(card, tracker.trump))} ace to try taking a side-suit trick`);
    } else {
      pieces.push(`led ${suitName(effectiveSuit(card, tracker.trump))}, testing that suit`);
    }
  } else {
    const ledSuit = effectiveSuit(trickBeforePlay[0].card, tracker.trump);
    const followed = effectiveSuit(card, tracker.trump) === ledSuit;
    if (followed) {
      pieces.push(`followed ${suitName(ledSuit)}`);
    } else if (isTrump) {
      pieces.push(`was void in ${suitName(ledSuit)} and trumped in`);
    } else {
      pieces.push(`was void in ${suitName(ledSuit)} and sloughed ${card}`);
    }

    const winnerBefore = trickBeforePlay[winningPlayIndex(trickBeforePlay, tracker.trump)].player;
    const trickAfter = [...trickBeforePlay, { player, card }];
    const winnerAfter = trickAfter[winningPlayIndex(trickAfter, tracker.trump)].player;
    if (winnerAfter === player && winnerBefore !== player) {
      pieces.push(`took the lead from ${playerName(winnerBefore)}`);
    } else if (winnerAfter !== player) {
      pieces.push(`${playerName(winnerAfter)} is still winning`);
    }

    if (teamIndex(winnerAfter) === teamIndex(player) && winnerAfter !== player) {
      pieces.push("partner is protected, so saving strength is good");
    }
  }

  const recommendation = recommendPlayFromState(
    tracker.hands[player],
    tracker.trump,
    trickBeforePlay,
    player,
    playerName(player),
    trackerRecommendationContext(),
  );
  if (recommendation?.card) {
    pieces.push(recommendation.card === card ? "matched the advisor read" : `advisor would prefer ${recommendation.card}`);
  }

  if (legalBeforePlay.length > 1) {
    pieces.push(`${legalBeforePlay.length} legal choices`);
  }

  return `${label}: ${pieces.join("; ")}.`;
}

function createCardElement(card, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `card ${cardColorClass(card)}`;
  button.textContent = card;
  if (options.selected) button.classList.add("selected");
  if (options.legal) button.classList.add("legal");
  if (options.disabled) button.disabled = true;
  if (options.onClick) button.addEventListener("click", options.onClick);
  return button;
}

function renderHand(cards, container, options = {}) {
  container.innerHTML = "";
  for (const card of cards) {
    container.appendChild(createCardElement(card, {
      disabled: !options.onCardClick,
      selected: options.selectedCards?.includes(card),
      legal: options.legalCards?.includes(card),
      onClick: options.onCardClick ? () => options.onCardClick(card) : null,
    }));
  }
}

function renderPlays(plays, container) {
  container.innerHTML = "";
  for (const play of plays) {
    const div = document.createElement("div");
    div.className = `card ${cardColorClass(play.card)}`;
    div.textContent = `P${play.player + 1}: ${play.card}`;
    container.appendChild(div);
  }
}

function syncTrackerInputsFromState() {
  for (let i = 0; i < 4; i++) {
    playerInputs[i].value = tracker.hands[i].join(" ");
  }
  kittyInput.value = tracker.kitty.join(" ");
}

function loadHands() {
  clearError();
  const hands = playerInputs.map(input => sortCards(parseCards(input.value)));
  const kitty = sortCards(parseCards(kittyInput.value));
  const validationError = validateFullDeal(hands, kitty);

  if (validationError) {
    setError(validationError);
    return false;
  }

  tracker.phase = "setup";
  tracker.hands = hands;
  tracker.kitty = kitty;
  tracker.dealer = Number(document.getElementById("dealerSelect").value);
  tracker.currentBidder = nextPlayer(tracker.dealer);
  tracker.bidsTaken = 0;
  tracker.passStreak = 0;
  tracker.passedPlayers = [];
  tracker.highBid = null;
  tracker.trump = null;
  tracker.currentPlayer = tracker.currentBidder;
  tracker.currentTrick = [];
  tracker.previousTrick = [];
  tracker.playedCards = [];
  tracker.buriedCards = [];
  tracker.selectedDiscards = [];
  tracker.teamTricks = [0, 0];
  tracker.trickNumber = 1;
  tracker.lastTrickMessage = "";
  tracker.moveInsights = [];
  tracker.history = [];
  document.getElementById("trackerBidLog").innerHTML = "";

  syncTrackerInputsFromState();
  renderTracker();
  return true;
}

function dealRandomHands() {
  const deck = shuffle(buildDeck());
  const hands = [[], [], [], []];
  for (let round = 0; round < FULL_HAND_SIZE; round++) {
    for (let player = 0; player < 4; player++) {
      hands[player].push(deck.pop());
    }
  }

  tracker.hands = hands.map(hand => sortCards(hand));
  tracker.kitty = sortCards(Array.from({ length: KITTY_SIZE }, () => deck.pop()));
  syncTrackerInputsFromState();
  loadHands();
}

function clearAll() {
  clearError();
  tracker.phase = "setup";
  tracker.hands = [[], [], [], []];
  tracker.kitty = [];
  tracker.currentTrick = [];
  tracker.previousTrick = [];
  tracker.playedCards = [];
  tracker.buriedCards = [];
  tracker.selectedDiscards = [];
  tracker.teamTricks = [0, 0];
  tracker.highBid = null;
  tracker.trump = null;
  tracker.passedPlayers = [];
  tracker.lastTrickMessage = "";
  tracker.moveInsights = [];
  tracker.history = [];
  document.getElementById("trackerBidLog").innerHTML = "";

  for (let i = 0; i < 4; i++) playerInputs[i].value = "";
  kittyInput.value = "";
  renderTracker();
}

function startTrackerBidding() {
  if (tracker.hands.flat().length !== 40 || tracker.kitty.length !== 3) {
    if (!loadHands()) return;
  }

  tracker.history = [];
  tracker.phase = "bidding";
  tracker.dealer = Number(document.getElementById("dealerSelect").value);
  tracker.currentBidder = nextPlayer(tracker.dealer);
  tracker.currentPlayer = tracker.currentBidder;
  tracker.bidsTaken = 0;
  tracker.passStreak = 0;
  tracker.passedPlayers = [];
  tracker.highBid = null;
  tracker.trump = null;
  tracker.currentTrick = [];
  tracker.previousTrick = [];
  tracker.playedCards = [];
  tracker.buriedCards = [];
  tracker.selectedDiscards = [];
  tracker.teamTricks = [0, 0];
  tracker.trickNumber = 1;
  tracker.lastTrickMessage = "";
  tracker.moveInsights = [];
  document.getElementById("trackerBidLog").innerHTML = "";
  renderTracker();
}

function updateTrackerBidControls(enabled) {
  document.getElementById("trackerPassBidBtn").disabled = !enabled;
  document.getElementById("trackerBidTricksSelect").disabled = !enabled;
  document.getElementById("trackerBidSuitSelect").disabled = !enabled;
  document.getElementById("trackerMakeBidBtn").disabled = !enabled;
}

function recordTrackerBid(pass) {
  if (tracker.phase !== "bidding") return;
  clearError();
  saveTrackerHistory();

  let entry;
  if (pass) {
    tracker.passStreak += 1;
    if (!tracker.passedPlayers.includes(tracker.currentBidder)) {
      tracker.passedPlayers.push(tracker.currentBidder);
    }
    entry = `${playerName(tracker.currentBidder)} passed`;
  } else {
    const bid = {
      player: tracker.currentBidder,
      tricks: Number(document.getElementById("trackerBidTricksSelect").value),
      suit: document.getElementById("trackerBidSuitSelect").value,
    };

    if (compareBids(bid, tracker.highBid) <= 0) {
      tracker.history.pop();
      setError(`That bid must be higher than ${bidText(tracker.highBid)}.`);
      return;
    }

    tracker.highBid = bid;
    tracker.passStreak = 0;
    entry = `${playerName(bid.player)} bid ${bid.tricks} ${suitName(bid.suit)}`;
  }

  tracker.bidsTaken += 1;
  const logItem = document.createElement("li");
  logItem.textContent = entry;
  document.getElementById("trackerBidLog").appendChild(logItem);

  if (shouldFinishTrackerAuction()) {
    finishTrackerBidding();
    return;
  }

  const nextBidder = nextActiveBidder(tracker.currentBidder);
  if (nextBidder === null) {
    finishTrackerBidding();
    return;
  }

  tracker.currentBidder = nextBidder;
  tracker.currentPlayer = tracker.currentBidder;
  renderTracker();
}

function finishTrackerBidding() {
  if (!tracker.highBid) {
    tracker.phase = "complete";
    tracker.lastTrickMessage = "Everyone passed. Deal another hand.";
    renderTracker();
    return;
  }

  tracker.trump = tracker.highBid.suit;
  tracker.currentPlayer = tracker.highBid.player;
  tracker.phase = "kitty";
  tracker.lastTrickMessage = "";
  renderTracker();
}

function pickupKitty() {
  if (tracker.phase !== "kitty" || !tracker.highBid) return;
  saveTrackerHistory();
  const bidder = tracker.highBid.player;
  tracker.hands[bidder] = sortCards([...tracker.hands[bidder], ...tracker.kitty], tracker.trump);
  tracker.kitty = [];
  tracker.selectedDiscards = recommendDiscards(tracker.hands[bidder], tracker.trump);
  tracker.phase = "discard";
  syncTrackerInputsFromState();
  renderTracker();
}

function toggleDiscard(card) {
  if (tracker.phase !== "discard") return;
  if (!tracker.selectedDiscards.includes(card) && tracker.selectedDiscards.length >= 3) {
    setError("Choose exactly 3 cards to discard. Unselect one before choosing another.");
    return;
  }

  clearError();
  tracker.selectedDiscards = tracker.selectedDiscards.includes(card)
    ? tracker.selectedDiscards.filter(selected => selected !== card)
    : [...tracker.selectedDiscards, card];
  renderTracker();
}

function confirmDiscard() {
  if (tracker.phase !== "discard" || !tracker.highBid) return;
  if (tracker.selectedDiscards.length !== 3) {
    setError("Select exactly 3 cards to discard.");
    return;
  }

  saveTrackerHistory();
  const bidder = tracker.highBid.player;
  tracker.buriedCards = [...tracker.selectedDiscards];
  tracker.hands[bidder] = tracker.hands[bidder].filter(card => !tracker.selectedDiscards.includes(card));
  tracker.selectedDiscards = [];
  tracker.phase = "play";
  tracker.currentPlayer = bidder;
  tracker.currentTrick = [];
  tracker.trickNumber = 1;
  tracker.lastTrickMessage = `${playerName(bidder)} leads trick 1.`;
  syncTrackerInputsFromState();
  renderTracker();
}

function playTrackerCard(player, card) {
  if (tracker.phase !== "play") return;
  clearError();

  if (player !== tracker.currentPlayer) {
    setError(`${playerName(tracker.currentPlayer)} is up. Click one of their cards.`);
    return;
  }

  const legal = legalMoves(tracker.hands[player], tracker.trump, tracker.currentTrick);
  if (!legal.includes(card)) {
    setError(`Illegal play. ${playerName(player)} must play: ${legal.join(" ")}`);
    return;
  }

  saveTrackerHistory();
  const moveInsight = describeMoveInsight(player, card, tracker.currentTrick.map(play => ({ ...play })), legal);
  tracker.hands[player] = tracker.hands[player].filter(handCard => handCard !== card);
  tracker.currentTrick.push({ player, card });
  tracker.moveInsights.unshift(moveInsight);
  tracker.moveInsights = tracker.moveInsights.slice(0, 20);
  tracker.lastTrickMessage = "";

  if (tracker.currentTrick.length === 4) {
    const winner = tracker.currentTrick[winningPlayIndex(tracker.currentTrick, tracker.trump)].player;
    tracker.teamTricks[teamIndex(winner)] += 1;
    tracker.previousTrick = tracker.currentTrick.map(play => ({ ...play }));
    tracker.playedCards.push(...tracker.currentTrick.map(play => play.card));
    tracker.currentPlayer = winner;
    tracker.lastTrickMessage = `${playerName(winner)} wins trick ${tracker.trickNumber}.`;
    if (tracker.trickNumber >= 10) {
      tracker.phase = "complete";
      const bidderTeam = teamIndex(tracker.highBid.player);
      const bidderTricks = tracker.teamTricks[bidderTeam];
      const madeContract = bidderTricks >= tracker.highBid.tricks;
      const bidderTeamName = bidderTeam === 0 ? "Team A" : "Team B";
      tracker.lastTrickMessage += ` Final: Team A ${tracker.teamTricks[0]}, Team B ${tracker.teamTricks[1]}. ${bidderTeamName} ${madeContract ? "made" : "missed"} ${tracker.highBid.tricks} ${suitName(tracker.highBid.suit)}.`;
    } else {
      tracker.trickNumber += 1;
      tracker.currentTrick = [];
      tracker.phase = "play";
      tracker.lastTrickMessage += ` ${playerName(winner)} leads trick ${tracker.trickNumber}.`;
    }
  } else {
    tracker.currentPlayer = nextPlayer(tracker.currentPlayer);
  }

  syncTrackerInputsFromState();
  renderTracker();
}

function renderTracker() {
  const trackerMode = document.getElementById("trackerMode");
  trackerMode.dataset.phase = tracker.phase;

  const phaseLabels = {
    setup: "Setup",
    bidding: "Bidding",
    kitty: "Pick Up Kitty",
    discard: "Discard",
    play: "Playing",
    complete: "Complete",
  };
  document.getElementById("trackerPhaseBadge").textContent = phaseLabels[tracker.phase] || "Setup";

  const contractText = tracker.highBid
    ? `${tracker.highBid.tricks} ${suitName(tracker.highBid.suit)}`
    : "No contract";
  const turnText = tracker.phase === "bidding"
    ? `${playerName(tracker.currentBidder)} bidding`
    : ["play", "discard", "kitty"].includes(tracker.phase)
      ? `${playerName(tracker.currentPlayer)} up`
      : phaseLabels[tracker.phase] || "Setup";
  document.getElementById("tableContract").textContent = contractText;
  document.getElementById("tableTurn").textContent = turnText;
  renderPlays(tracker.currentTrick.length ? tracker.currentTrick : tracker.previousTrick, document.getElementById("centerTrick"));
  document.getElementById("centerTrickResult").textContent = tracker.lastTrickMessage;

  for (let player = 0; player < 4; player++) {
    const seat = document.querySelector(`[data-player="${player}"]`);
    seat.classList.toggle("active-player", tracker.currentPlayer === player && !["setup", "complete"].includes(tracker.phase));
    document.getElementById(`p${player}Count`).textContent = tracker.hands[player].length;

    const canPlay = tracker.phase === "play" && tracker.currentPlayer === player;
    const canDiscard = tracker.phase === "discard" && tracker.highBid?.player === player;
    const legal = canPlay ? legalMoves(tracker.hands[player], tracker.trump, tracker.currentTrick) : [];
    renderHand(sortCards(tracker.hands[player], tracker.trump), playerHands[player], {
      legalCards: legal,
      selectedCards: canDiscard ? tracker.selectedDiscards : [],
      onCardClick: canDiscard ? card => toggleDiscard(card) : canPlay ? card => playTrackerCard(player, card) : null,
    });
  }

  renderHand(sortCards(tracker.kitty, tracker.trump), kittyHand);
  renderPlays(tracker.currentTrick, document.getElementById("currentTrick"));

  const bidding = tracker.phase === "bidding";
  updateTrackerBidControls(bidding);
  document.getElementById("pickupKittyBtn").disabled = tracker.phase !== "kitty";
  document.getElementById("confirmDiscardBtn").disabled = tracker.phase !== "discard";
  document.getElementById("undoTrackerBtn").disabled = tracker.history.length === 0;
  document.getElementById("trackerTeamAScore").textContent = tracker.teamTricks[0];
  document.getElementById("trackerTeamBScore").textContent = tracker.teamTricks[1];

  if (tracker.phase === "setup") {
    document.getElementById("trackerBidStatus").textContent = "Load hands, choose the dealer, then start bidding.";
    document.getElementById("trackerGameStatus").textContent = "Click Start Bidding when the deal is ready.";
  } else if (tracker.phase === "bidding") {
    const recommendation = recommendBid(tracker.hands[tracker.currentBidder], tracker.highBid, tracker.currentBidder);
    const outText = tracker.passedPlayers.length
      ? ` Out: ${tracker.passedPlayers.map(playerName).join(", ")}.`
      : "";
    document.getElementById("trackerBidStatus").textContent =
      `${playerName(tracker.currentBidder)} to bid. Current high bid: ${bidText(tracker.highBid)}.${outText} ${recommendation.text}`;
    if (recommendation.action === "bid") {
      document.getElementById("trackerBidTricksSelect").value = String(recommendation.bid.tricks);
      document.getElementById("trackerBidSuitSelect").value = recommendation.bid.suit;
    }
    document.getElementById("trackerGameStatus").textContent = "Record each pass or bid clockwise around the table.";
  } else if (tracker.phase === "kitty") {
    document.getElementById("trackerBidStatus").textContent =
      `Winning bid: ${bidText(tracker.highBid)}. Trump is ${suitName(tracker.trump)}.`;
    document.getElementById("trackerGameStatus").textContent =
      `${playerName(tracker.highBid.player)} won the bid and should pick up the kitty.`;
  } else if (tracker.phase === "discard") {
    document.getElementById("trackerGameStatus").textContent =
      `${playerName(tracker.highBid.player)} must discard exactly 3 cards before play.`;
  } else if (tracker.phase === "play") {
    document.getElementById("trackerGameStatus").textContent =
      `Trick ${tracker.trickNumber}. ${playerName(tracker.currentPlayer)} to play. Click a highlighted legal card.`;
  } else {
    document.getElementById("trackerGameStatus").textContent = "Hand complete. Deal or clear to start again.";
  }

  const discardText = tracker.phase === "discard"
    ? `Selected discard: ${tracker.selectedDiscards.join(" ") || "none"}`
    : tracker.buriedCards.length
      ? `Buried cards: ${tracker.buriedCards.join(" ")}`
      : "";
  document.getElementById("discardStatus").textContent = discardText;

  const trickResult = document.getElementById("trackerTrickResult");
  if (tracker.currentTrick.length === 4 && tracker.trump) {
    const winner = tracker.currentTrick[winningPlayIndex(tracker.currentTrick, tracker.trump)].player;
    trickResult.textContent = `${playerName(winner)} is winning this completed trick.`;
  } else {
    trickResult.textContent = tracker.lastTrickMessage || (tracker.currentTrick.length ? `${4 - tracker.currentTrick.length} play(s) left.` : "");
  }

  renderTrackerCounts();
  renderTrackerRecommendation();
  renderMoveInsights();
}

function switchMode(mode) {
  const trackerMode = mode === "tracker";
  document.getElementById("trackerMode").classList.toggle("active", trackerMode);
  document.getElementById("advisorMode").classList.toggle("active", !trackerMode);
  document.getElementById("trackerModeBtn").classList.toggle("active", trackerMode);
  document.getElementById("advisorModeBtn").classList.toggle("active", !trackerMode);
  clearError();
}

function updateBidControls(enabled) {
  document.getElementById("passBidBtn").disabled = !enabled;
  document.getElementById("bidTricksSelect").disabled = !enabled;
  document.getElementById("bidSuitSelect").disabled = !enabled;
  document.getElementById("makeBidBtn").disabled = !enabled;
}

function startAdvisor() {
  clearError();
  const hand = parseCards(document.getElementById("yourHandInput").value);
  if (hand.length !== FULL_HAND_SIZE) {
    setError(`Your dealt hand needs exactly ${FULL_HAND_SIZE} cards.`);
    return;
  }

  const cardError = validateCardSet(hand);
  if (cardError) {
    setError(cardError);
    return;
  }

  advisor.active = true;
  advisor.you = Number(document.getElementById("youSelect").value);
  advisor.dealer = Number(document.getElementById("advisorDealerSelect").value);
  advisor.currentBidder = nextPlayer(advisor.dealer);
  advisor.biddingComplete = false;
  advisor.passStreak = 0;
  advisor.bidsTaken = 0;
  advisor.highBid = null;
  advisor.hand = sortCards(hand);
  advisor.kitty = [];
  advisor.trump = null;
  advisor.currentPlayer = advisor.currentBidder;
  advisor.currentTrick = [];
  advisor.playedCards = [];
  advisor.teamTricks = [0, 0];
  advisor.trickNumber = 1;
  advisor.knownCards = new Set(hand);

  document.getElementById("bidLog").innerHTML = "";
  document.getElementById("advisorKittyInput").value = "";
  document.getElementById("playedCardInput").value = "";
  document.getElementById("trickResult").textContent = "";
  document.getElementById("discardRecommendation").textContent = "";

  updateBidControls(true);
  document.getElementById("loadKittyBtn").disabled = true;
  document.getElementById("applyDiscardBtn").disabled = true;
  document.getElementById("recordPlayBtn").disabled = true;
  document.getElementById("playedCardInput").disabled = true;
  renderAdvisor();
}

function resetAdvisor() {
  advisor.active = false;
  advisor.hand = [];
  advisor.kitty = [];
  advisor.currentTrick = [];
  advisor.playedCards = [];
  advisor.knownCards = new Set();
  document.getElementById("yourHandInput").value = "";
  document.getElementById("advisorKittyInput").value = "";
  document.getElementById("bidLog").innerHTML = "";
  document.getElementById("bidStatus").textContent = "Start a hand to begin bidding.";
  document.getElementById("bidRecommendation").textContent = "";
  document.getElementById("kittyStatus").textContent = "Only needed if you win the bid.";
  document.getElementById("playStatus").textContent = "Finish bidding to start play.";
  document.getElementById("discardRecommendation").textContent = "";
  document.getElementById("playRecommendation").textContent = "";
  document.getElementById("trickResult").textContent = "";
  updateBidControls(false);
  document.getElementById("loadKittyBtn").disabled = true;
  document.getElementById("applyDiscardBtn").disabled = true;
  document.getElementById("recordPlayBtn").disabled = true;
  document.getElementById("playedCardInput").disabled = true;
  renderAdvisor();
}

function recordBid(pass) {
  if (!advisor.active || advisor.biddingComplete) return;
  clearError();

  let entry;
  if (pass) {
    advisor.passStreak += 1;
    entry = `${playerName(advisor.currentBidder)} passed`;
  } else {
    const bid = {
      player: advisor.currentBidder,
      tricks: Number(document.getElementById("bidTricksSelect").value),
      suit: document.getElementById("bidSuitSelect").value,
    };

    if (compareBids(bid, advisor.highBid) <= 0) {
      setError(`That bid must be higher than ${bidText(advisor.highBid)}.`);
      return;
    }

    advisor.highBid = bid;
    advisor.passStreak = 0;
    entry = `${playerName(bid.player)} bid ${bid.tricks} ${suitName(bid.suit)}`;
  }

  advisor.bidsTaken += 1;
  const logItem = document.createElement("li");
  logItem.textContent = entry;
  document.getElementById("bidLog").appendChild(logItem);

  if ((!advisor.highBid && advisor.bidsTaken >= 4) || (advisor.highBid && advisor.passStreak >= 3)) {
    finishBidding();
    return;
  }

  advisor.currentBidder = nextPlayer(advisor.currentBidder);
  renderAdvisor();
}

function finishBidding() {
  advisor.biddingComplete = true;
  updateBidControls(false);

  if (!advisor.highBid) {
    document.getElementById("bidStatus").textContent = "Everyone passed. Reset to start another hand.";
    document.getElementById("bidRecommendation").textContent = "";
    return;
  }

  advisor.trump = advisor.highBid.suit;
  advisor.currentPlayer = advisor.highBid.player;
  document.getElementById("loadKittyBtn").disabled = advisor.highBid.player !== advisor.you;

  if (advisor.highBid.player === advisor.you) {
    document.getElementById("kittyStatus").textContent = "You won the bid. Enter the 3-card kitty to get a discard recommendation.";
    document.getElementById("playStatus").textContent = "Load the kitty and discard before recording play.";
  } else {
    document.getElementById("kittyStatus").textContent = `${playerName(advisor.highBid.player)} won the bid. You will not know the kitty.`;
    beginPlay();
  }

  renderAdvisor();
}

function loadAdvisorKitty() {
  clearError();
  if (!advisor.highBid || advisor.highBid.player !== advisor.you) {
    setError("Only enter the kitty when you won the bid.");
    return;
  }

  const kitty = parseCards(document.getElementById("advisorKittyInput").value);
  if (kitty.length !== KITTY_SIZE) {
    setError(`Kitty needs exactly ${KITTY_SIZE} cards.`);
    return;
  }

  const cardError = validateCardSet(kitty, { knownCards: advisor.knownCards });
  if (cardError) {
    setError(cardError);
    return;
  }

  advisor.kitty = kitty;
  advisor.hand = sortCards([...advisor.hand, ...kitty], advisor.trump);
  for (const card of kitty) advisor.knownCards.add(card);

  const discards = recommendDiscards(advisor.hand, advisor.trump);
  document.getElementById("discardRecommendation").textContent = `Recommended discard: ${discards.join(" ")}.`;
  document.getElementById("applyDiscardBtn").disabled = false;
  renderAdvisor();
}

function applyRecommendedDiscard() {
  if (!advisor.trump) return;
  const discards = recommendDiscards(advisor.hand, advisor.trump);
  advisor.hand = advisor.hand.filter(card => !discards.includes(card));
  document.getElementById("discardRecommendation").textContent = `Discarded ${discards.join(" ")}. Your hand is back to 10 cards.`;
  document.getElementById("applyDiscardBtn").disabled = true;
  beginPlay();
  renderAdvisor();
}

function beginPlay() {
  document.getElementById("recordPlayBtn").disabled = false;
  document.getElementById("playedCardInput").disabled = false;
  document.getElementById("playStatus").textContent =
    `Trick ${advisor.trickNumber}. ${playerName(advisor.currentPlayer)} leads. Trump is ${suitName(advisor.trump)}.`;
  renderAdvisor();
}

function recordPlay() {
  if (!advisor.active || !advisor.biddingComplete || !advisor.highBid) return;
  clearError();

  const card = normalizeToken(document.getElementById("playedCardInput").value);
  if (!isValidCard(card)) {
    setError(`Invalid card: ${card}`);
    return;
  }

  if (advisor.playedCards.includes(card) || advisor.currentTrick.some(play => play.card === card)) {
    setError(`That card has already been played: ${card}`);
    return;
  }

  if (advisor.knownCards.has(card) && !advisor.hand.includes(card)) {
    setError(`That card is already known somewhere else: ${card}`);
    return;
  }

  if (advisor.currentPlayer !== advisor.you && advisor.hand.includes(card)) {
    setError(`${playerName(advisor.currentPlayer)} cannot play ${card}; it is in your hand.`);
    return;
  }

  if (advisor.currentPlayer === advisor.you) {
    if (!advisor.hand.includes(card)) {
      setError(`That card is not in your current hand: ${card}`);
      return;
    }

    const legal = legalMoves(advisor.hand, advisor.trump, advisor.currentTrick);
    if (!legal.includes(card)) {
      setError(`Illegal play. Legal cards are: ${legal.join(" ")}`);
      return;
    }

    advisor.hand = advisor.hand.filter(handCard => handCard !== card);
  }

  advisor.currentTrick.push({ player: advisor.currentPlayer, card });
  advisor.knownCards.add(card);
  document.getElementById("playedCardInput").value = "";

  if (advisor.currentTrick.length === 4) {
    const winner = advisor.currentTrick[winningPlayIndex(advisor.currentTrick, advisor.trump)].player;
    advisor.teamTricks[teamIndex(winner)] += 1;
    advisor.playedCards.push(...advisor.currentTrick.map(play => play.card));
    document.getElementById("trickResult").textContent = `${playerName(winner)} wins trick ${advisor.trickNumber}.`;
    advisor.currentTrick = [];
    advisor.currentPlayer = winner;
    advisor.trickNumber += 1;
  } else {
    advisor.currentPlayer = nextPlayer(advisor.currentPlayer);
  }

  renderAdvisor();
}

function unseenCards() {
  const seen = new Set([...advisor.knownCards, ...advisor.playedCards]);
  return buildDeck().filter(card => !seen.has(card));
}

function renderAdvisor() {
  renderHand(sortCards(advisor.hand, advisor.trump), document.getElementById("advisorHand"));
  renderPlays(advisor.currentTrick, document.getElementById("advisorTrick"));
  renderHand(advisor.playedCards, document.getElementById("playedCards"));

  document.getElementById("teamAScore").textContent = advisor.teamTricks[0];
  document.getElementById("teamBScore").textContent = advisor.teamTricks[1];

  const counts = document.getElementById("advisorCounts");
  counts.innerHTML = "";
  for (const suit of VALID_SUITS) {
    const count = advisor.hand.filter(card => effectiveSuit(card, advisor.trump || suit) === suit).length;
    const div = document.createElement("div");
    div.textContent = `${suitName(suit)}: ${count}`;
    counts.appendChild(div);
  }

  const cardCounter = document.getElementById("cardCounter");
  cardCounter.innerHTML = "";
  for (const row of [
    `Known cards: ${advisor.knownCards.size}`,
    `Played cards: ${advisor.playedCards.length}`,
    `Unseen cards: ${unseenCards().length}`,
    `Current trick cards: ${advisor.currentTrick.length}`,
  ]) {
    const div = document.createElement("div");
    div.textContent = row;
    cardCounter.appendChild(div);
  }

  document.getElementById("unseenCards").textContent = unseenCards().join(" ");
  if (!advisor.active) return;

  if (!advisor.biddingComplete) {
    document.getElementById("bidStatus").textContent =
      `${playerName(advisor.currentBidder)} to bid. Current high bid: ${bidText(advisor.highBid)}.`;
    if (advisor.currentBidder === advisor.you) {
      const recommendation = recommendBid(advisor.hand, advisor.highBid, advisor.you);
      document.getElementById("bidRecommendation").textContent = recommendation.text;
      if (recommendation.action === "bid") {
        document.getElementById("bidTricksSelect").value = String(recommendation.bid.tricks);
        document.getElementById("bidSuitSelect").value = recommendation.bid.suit;
      }
    } else {
      document.getElementById("bidRecommendation").textContent =
        `Record whether ${playerName(advisor.currentBidder)} passes or bids.`;
    }
  }

  if (advisor.biddingComplete && advisor.highBid) {
    document.getElementById("bidStatus").textContent =
      `Winning bid: ${bidText(advisor.highBid)}. Trump is ${suitName(advisor.trump)}.`;

    if (advisor.currentPlayer === advisor.you && !document.getElementById("recordPlayBtn").disabled) {
      const recommendation = recommendPlayFromState(advisor.hand, advisor.trump, advisor.currentTrick, advisor.you, "You");
      document.getElementById("playRecommendation").textContent = recommendation
        ? `Recommended play: ${recommendation.card}. ${recommendation.reason}`
        : "No legal play is available.";
    } else if (!document.getElementById("recordPlayBtn").disabled) {
      document.getElementById("playRecommendation").textContent =
        `Record ${playerName(advisor.currentPlayer)}'s played card.`;
    }

    if (!document.getElementById("recordPlayBtn").disabled) {
      document.getElementById("playStatus").textContent =
        `Trick ${advisor.trickNumber}. ${playerName(advisor.currentPlayer)} to play.`;
    }
  }
}

function recommendFromTracker() {
  clearError();
  if (!tracker.trump || tracker.phase !== "play") {
    setError("Table Mode needs to be in the play phase before a move can be recommended.");
    return;
  }

  const player = tracker.currentPlayer;
  const recommendation = recommendPlayFromState(
    tracker.hands[player],
    tracker.trump,
    tracker.currentTrick,
    player,
    playerName(player),
    trackerRecommendationContext(),
  );

  document.getElementById("playStatus").textContent =
    `Table state: trick ${tracker.trickNumber}, ${playerName(player)} to play, trump ${suitName(tracker.trump)}.`;
  document.getElementById("playRecommendation").textContent = recommendation
    ? `Best current move: ${recommendation.card}. ${recommendation.reason} Legal: ${recommendation.legal.join(" ")}`
    : "No legal move is available from the table state.";
  renderHand(sortCards(tracker.hands[player], tracker.trump), document.getElementById("advisorHand"), {
    legalCards: recommendation?.legal || [],
  });
  renderPlays(tracker.currentTrick, document.getElementById("advisorTrick"));
  switchMode("advisor");
}

document.getElementById("trackerModeBtn").addEventListener("click", () => switchMode("tracker"));
document.getElementById("advisorModeBtn").addEventListener("click", () => switchMode("advisor"));

document.getElementById("loadBtn").addEventListener("click", loadHands);
document.getElementById("dealBtn").addEventListener("click", dealRandomHands);
document.getElementById("startTrackerBtn").addEventListener("click", startTrackerBidding);
document.getElementById("clearBtn").addEventListener("click", clearAll);
document.getElementById("trackerPassBidBtn").addEventListener("click", () => recordTrackerBid(true));
document.getElementById("trackerMakeBidBtn").addEventListener("click", () => recordTrackerBid(false));
document.getElementById("pickupKittyBtn").addEventListener("click", pickupKitty);
document.getElementById("confirmDiscardBtn").addEventListener("click", confirmDiscard);
document.getElementById("undoTrackerBtn").addEventListener("click", undoTrackerAction);
document.getElementById("trackerFocusPlayerSelect").addEventListener("change", renderTracker);

document.getElementById("startAdvisorBtn").addEventListener("click", startAdvisor);
document.getElementById("resetAdvisorBtn").addEventListener("click", resetAdvisor);
document.getElementById("passBidBtn").addEventListener("click", () => recordBid(true));
document.getElementById("makeBidBtn").addEventListener("click", () => recordBid(false));
document.getElementById("loadKittyBtn").addEventListener("click", loadAdvisorKitty);
document.getElementById("applyDiscardBtn").addEventListener("click", applyRecommendedDiscard);
document.getElementById("recordPlayBtn").addEventListener("click", recordPlay);
document.getElementById("importTrackerBtn").addEventListener("click", recommendFromTracker);

dealRandomHands();
resetAdvisor();
