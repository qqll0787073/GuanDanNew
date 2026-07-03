import { Card, Suit, PlayAction } from '../types';

// Standard values from low to high (except level card which is adjusted dynamically)
export const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

/**
 * Generates two full decks of poker cards (including 4 jokers total)
 */
export function generateDecks(levelCard: string = '2'): Card[] {
  const cards: Card[] = [];
  let idCounter = 1;

  // Add 2 decks of standard cards
  for (const deck of [1, 2] as const) {
    // Standard cards
    for (const suit of SUITS) {
      for (const value of CARD_VALUES) {
        const isLevelCard = value === levelCard;
        const isWild = suit === 'hearts' && value === levelCard; // Red Heart level card is Wild ("Feng Ren Pei")

        // Calculate a base rank for initial sorting
        let rank = CARD_VALUES.indexOf(value) + 2; // 2 -> 2, A -> 14
        if (isLevelCard) {
          rank = 15; // Level card ranks higher than A (rank 14) but below black joker
        }

        cards.push({
          id: `${suit}-${value}-${deck}-${idCounter++}`,
          suit,
          value,
          rank,
          isLevelCard,
          isWild,
          deck,
        });
      }
    }

    // Jokers
    // Black Joker (rank 16)
    cards.push({
      id: `joker-black-${deck}-${idCounter++}`,
      suit: 'jokers',
      value: 'black_joker',
      rank: 16,
      isLevelCard: false,
      isWild: false,
      deck,
    });

    // Red Joker (rank 17)
    cards.push({
      id: `joker-red-${deck}-${idCounter++}`,
      suit: 'jokers',
      value: 'red_joker',
      rank: 17,
      isLevelCard: false,
      isWild: false,
      deck,
    });
  }

  return cards;
}

/**
 * Shuffles cards using Fisher-Yates algorithm
 */
export function shuffleCards(cards: Card[]): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Adjusts ranks of cards dynamically depending on the current active level card
 */
export function adjustRanksForLevel(cards: Card[], levelCard: string): Card[] {
  return cards.map(card => {
    const isLevelCard = card.value === levelCard;
    const isWild = card.suit === 'hearts' && card.value === levelCard;

    let rank = CARD_VALUES.indexOf(card.value) + 2;
    if (card.value === 'black_joker') rank = 16;
    else if (card.value === 'red_joker') rank = 17;
    else if (isLevelCard) rank = 15; // Level card is ranked just below black joker

    return {
      ...card,
      rank,
      isLevelCard,
      isWild,
    };
  });
}

/**
 * Sorts hand cards by specified strategy
 */
export function sortCards(cards: Card[], strategy: 'rank' | 'suit' | 'combo', levelCard: string = '2'): Card[] {
  const adjusted = adjustRanksForLevel(cards, levelCard);

  if (strategy === 'rank') {
    // Sort high to low
    return adjusted.sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      // If ranks are equal, sort by suit order
      const suitOrder = { jokers: 4, hearts: 3, spades: 2, diamonds: 1, clubs: 0 };
      return suitOrder[b.suit] - suitOrder[a.suit];
    });
  }

  if (strategy === 'suit') {
    return adjusted.sort((a, b) => {
      const suitOrder = { jokers: 4, hearts: 3, spades: 2, diamonds: 1, clubs: 0 };
      if (a.suit !== b.suit) return suitOrder[b.suit] - suitOrder[a.suit];
      return b.rank - a.rank;
    });
  }

  if (strategy === 'combo') {
    // Group duplicates together (bombs, triples, pairs, singles)
    const counts: { [key: string]: number } = {};
    adjusted.forEach(c => {
      counts[c.value] = (counts[c.value] || 0) + 1;
    });

    return [...adjusted].sort((a, b) => {
      const countA = counts[a.value];
      const countB = counts[b.value];

      // Primary: higher duplicate group counts first (e.g. 4-of-a-kind before 3-of-a-kind)
      if (countA !== countB) return countB - countA;
      // Secondary: higher rank first
      if (b.rank !== a.rank) return b.rank - a.rank;
      // Tertiary: suit
      const suitOrder = { jokers: 4, hearts: 3, spades: 2, diamonds: 1, clubs: 0 };
      return suitOrder[b.suit] - suitOrder[a.suit];
    });
  }

  return adjusted;
}

function checkStraight(ranks: number[], wildCount: number): number | null {
  const unique = Array.from(new Set(ranks));
  if (unique.length !== ranks.length) return null;
  if (ranks.length === 0) return null;

  let wildsNeeded = 0;
  for (let i = 0; i < ranks.length - 1; i++) {
    const diff = ranks[i+1] - ranks[i];
    if (diff <= 0) return null;
    wildsNeeded += (diff - 1);
  }

  if (wildsNeeded <= wildCount) {
    const minRank = ranks[0];
    const maxRank = ranks[ranks.length - 1];
    const targetMax = Math.max(minRank + 4, maxRank);
    const targetMin = targetMax - 4;
    if (ranks.every(r => r >= targetMin && r <= targetMax) && targetMax <= 14 && targetMin >= 1) {
      return targetMax;
    }
  }
  return null;
}

function checkConsecutivePairs(ranks: number[], wildCount: number): number | null {
  const freq: { [key: number]: number } = {};
  ranks.forEach(r => freq[r] = (freq[r] || 0) + 1);

  const uniqueRanks = Object.keys(freq).map(Number).sort((a, b) => a - b);
  if (uniqueRanks.length === 0) return null;
  if (uniqueRanks.length > 3) return null;
  if (uniqueRanks.some(r => freq[r] > 2)) return null;

  const minRank = uniqueRanks[0];
  const maxRank = uniqueRanks[uniqueRanks.length - 1];
  if (maxRank - minRank > 2) return null;

  const targetMax = Math.max(minRank + 2, maxRank);
  const targetMin = targetMax - 2;
  if (targetMax > 14 || targetMin < 1) return null;

  if (!uniqueRanks.every(r => r >= targetMin && r <= targetMax)) return null;

  let wildsNeeded = 0;
  for (let r = targetMin; r <= targetMax; r++) {
    const count = freq[r] || 0;
    wildsNeeded += (2 - count);
  }

  if (wildsNeeded <= wildCount) {
    return targetMax;
  }
  return null;
}

function checkConsecutiveTriples(ranks: number[], wildCount: number): number | null {
  const freq: { [key: number]: number } = {};
  ranks.forEach(r => freq[r] = (freq[r] || 0) + 1);

  const uniqueRanks = Object.keys(freq).map(Number).sort((a, b) => a - b);
  if (uniqueRanks.length === 0) return null;
  if (uniqueRanks.length > 2) return null;
  if (uniqueRanks.some(r => freq[r] > 3)) return null;

  const minRank = uniqueRanks[0];
  const maxRank = uniqueRanks[uniqueRanks.length - 1];
  if (maxRank - minRank > 1) return null;

  const targetMax = Math.max(minRank + 1, maxRank);
  const targetMin = targetMax - 1;
  if (targetMax > 14 || targetMin < 1) return null;

  if (!uniqueRanks.every(r => r >= targetMin && r <= targetMax)) return null;

  let wildsNeeded = 0;
  for (let r = targetMin; r <= targetMax; r++) {
    const count = freq[r] || 0;
    wildsNeeded += (3 - count);
  }

  if (wildsNeeded <= wildCount) {
    return targetMax;
  }
  return null;
}

/**
 * Evaluates a played card collection and returns its combination type and strength
 */
export interface CardCombo {
  type: 'single' | 'pair' | 'triple' | 'full_house' | 'straight' | 'consecutive_pairs' | 'consecutive_triples' | 'bomb' | 'royal_bomb' | 'invalid';
  strength: number; // For comparing within the same type
  cardCount: number;
  label: string; // Printable english label
  labelZh: string; // Printable chinese label
}

export function analyzeCombination(cards: Card[], levelCard: string = '2'): CardCombo {
  const len = cards.length;
  if (len === 0) {
    return { type: 'invalid', strength: 0, cardCount: 0, label: 'Invalid', labelZh: '无效牌型' };
  }

  // Adjust ranks
  const adjusted = adjustRanksForLevel(cards, levelCard);
  // Sort cards high to low
  adjusted.sort((a, b) => b.rank - a.rank);

  // Wild Card details ("Feng Ren Pei" - Red Hearts Level Card)
  const wildCount = adjusted.filter(c => c.isWild).length;
  const nonWilds = adjusted.filter(c => !c.isWild);

  // Helper to extract values
  const uniqueValues = Array.from(new Set(adjusted.map(c => c.value)));

  // Ultimate Bomb: Four Jokers (天王炸)
  if (len === 4 && adjusted.every(c => c.suit === 'jokers')) {
    return { type: 'royal_bomb', strength: 999, cardCount: 4, label: 'Four Jokers Ultimate Bomb', labelZh: '四大天王炸弹' };
  }

  // Check Bombs (4 or more of same rank, wild card can substitute standard cards)
  if (len >= 4) {
    // If all non-wild cards have the same value (and there is at least one non-wild, or all are wild which is impossible because only one hearts level card exists per deck, max 2 total)
    const nonWildValues = Array.from(new Set(nonWilds.map(c => c.value)));
    if (nonWildValues.length === 1 || (nonWildValues.length === 0 && wildCount > 0)) {
      const value = nonWildValues[0] || levelCard;
      let baseRank = CARD_VALUES.indexOf(value) + 2;
      if (value === levelCard) baseRank = 15;

      // Strength is based on card count first, then rank
      const strength = len * 100 + baseRank;
      return { 
        type: 'bomb', 
        strength, 
        cardCount: len, 
        label: `${len}-Card Bomb`, 
        labelZh: `${len}张炸弹` 
      };
    }

    // Straight Flush Check (5 cards, consecutive ranks, same suit, wild card can match suit and rank)
    if (len === 5) {
      const suits = Array.from(new Set(nonWilds.map(c => c.suit)));
      // Same suit (excluding wild cards which can morph)
      if (suits.length === 1 && suits[0] !== 'jokers') {
        const nonWildRanks = nonWilds.map(c => {
          let r = CARD_VALUES.indexOf(c.value) + 2;
          if (c.value === levelCard) r = CARD_VALUES.indexOf(levelCard) + 2;
          return r;
        }).sort((a, b) => a - b);

        let maxRank: number | null = checkStraight(nonWildRanks, wildCount);
        if (maxRank === null && nonWildRanks.includes(14)) {
          const alternativeRanks = nonWildRanks.map(r => r === 14 ? 1 : r).sort((a, b) => a - b);
          maxRank = checkStraight(alternativeRanks, wildCount);
        }

        if (maxRank !== null) {
          return { 
            type: 'bomb', 
            strength: 550 + maxRank, // Higher than 5-card bomb (500+) but lower than 6-card bomb (600+)
            cardCount: 5, 
            label: 'Straight Flush', 
            labelZh: '同花顺炸弹' 
          };
        }
      }
    }
  }

  // Single Card
  if (len === 1) {
    return { type: 'single', strength: adjusted[0].rank, cardCount: 1, label: 'Single', labelZh: '单张' };
  }

  // Pair
  if (len === 2) {
    if (uniqueValues.length === 1 || wildCount === 1) {
      const mainCard = nonWilds[0] || adjusted[0];
      return { type: 'pair', strength: mainCard.rank, cardCount: 2, label: 'Pair', labelZh: '对子' };
    }
  }

  // Triple
  if (len === 3) {
    const nonWildUnique = Array.from(new Set(nonWilds.map(c => c.value)));
    if (nonWildUnique.length === 1 || (nonWildUnique.length === 0 && wildCount > 0)) {
      const mainCard = nonWilds[0] || adjusted[0];
      return { type: 'triple', strength: mainCard.rank, cardCount: 3, label: 'Triple', labelZh: '三张' };
    }
  }

  // Full House (三带二: 3 of same + 2 of same)
  if (len === 5) {
    // Collect frequencies
    const freq: { [key: string]: number } = {};
    adjusted.forEach(c => {
      if (!c.isWild) freq[c.value] = (freq[c.value] || 0) + 1;
    });

    const freqKeys = Object.keys(freq);
    if (freqKeys.length <= 2) {
      // Check if we can form 3 of A and 2 of B using wildcards
      let possible = false;
      let mainRank = 0;

      if (freqKeys.length === 1) {
        // e.g. 4 of kind, can easily be 3+2
        possible = true;
        mainRank = CARD_VALUES.indexOf(freqKeys[0]) + 2;
      } else if (freqKeys.length === 2) {
        const count1 = freq[freqKeys[0]];
        const count2 = freq[freqKeys[1]];

        // Case 1: Key 0 is the triple, Key 1 is the pair
        if (count1 + wildCount >= 3 && count2 + (wildCount - Math.max(0, 3 - count1)) >= 2) {
          possible = true;
          mainRank = Math.max(CARD_VALUES.indexOf(freqKeys[0]) + 2, mainRank);
        }
        // Case 2: Key 1 is the triple, Key 0 is the pair
        if (count2 + wildCount >= 3 && count1 + (wildCount - Math.max(0, 3 - count2)) >= 2) {
          possible = true;
          mainRank = Math.max(CARD_VALUES.indexOf(freqKeys[1]) + 2, mainRank);
        }
      } else if (freqKeys.length === 0 && wildCount === 5) {
        possible = true;
        mainRank = 15; // Wildcards only
      }

      if (possible) {
        return { type: 'full_house', strength: mainRank, cardCount: 5, label: 'Full House (3+2)', labelZh: '三带二' };
      }
    }
  }

  // Straight (顺子): 5 consecutive single cards (jokers cannot be part of straights, wild card can substitute)
  if (len === 5) {
    const valuesWithoutJokers = adjusted.filter(c => c.suit !== 'jokers');
    if (valuesWithoutJokers.length === 5) {
      const nonWildRanks = nonWilds
        .map(c => {
          let r = CARD_VALUES.indexOf(c.value) + 2;
          if (c.value === levelCard) r = CARD_VALUES.indexOf(levelCard) + 2;
          return r;
        })
        .sort((a, b) => a - b);

      let maxRank: number | null = checkStraight(nonWildRanks, wildCount);
      if (maxRank === null && nonWildRanks.includes(14)) {
        const alternativeRanks = nonWildRanks.map(r => r === 14 ? 1 : r).sort((a, b) => a - b);
        maxRank = checkStraight(alternativeRanks, wildCount);
      }

      if (maxRank !== null) {
        return { type: 'straight', strength: maxRank, cardCount: 5, label: 'Straight (5 Cards)', labelZh: '五张顺子' };
      }
    }
  }

  // Consecutive Pairs (木板/双顺): 3 consecutive pairs (e.g. 44 55 66) = 6 cards
  if (len === 6) {
    const nonWildRanks = nonWilds
      .filter(c => c.suit !== 'jokers')
      .map(c => {
        let r = CARD_VALUES.indexOf(c.value) + 2;
        if (c.value === levelCard) r = CARD_VALUES.indexOf(levelCard) + 2;
        return r;
      })
      .sort((a, b) => a - b);

    let maxRank: number | null = checkConsecutivePairs(nonWildRanks, wildCount);
    if (maxRank === null && nonWildRanks.includes(14)) {
      const alternativeRanks = nonWildRanks.map(r => r === 14 ? 1 : r).sort((a, b) => a - b);
      maxRank = checkConsecutivePairs(alternativeRanks, wildCount);
    }

    if (maxRank !== null) {
      return { type: 'consecutive_pairs', strength: maxRank, cardCount: 6, label: 'Consecutive Pairs', labelZh: '双顺 (木板)' };
    }
  }

  // Consecutive Triples (钢板/三顺): 2 consecutive triples (e.g. 555 666) = 6 cards
  if (len === 6) {
    const nonWildRanks = nonWilds
      .filter(c => c.suit !== 'jokers')
      .map(c => {
        let r = CARD_VALUES.indexOf(c.value) + 2;
        if (c.value === levelCard) r = CARD_VALUES.indexOf(levelCard) + 2;
        return r;
      })
      .sort((a, b) => a - b);

    let maxRank: number | null = checkConsecutiveTriples(nonWildRanks, wildCount);
    if (maxRank === null && nonWildRanks.includes(14)) {
      const alternativeRanks = nonWildRanks.map(r => r === 14 ? 1 : r).sort((a, b) => a - b);
      maxRank = checkConsecutiveTriples(alternativeRanks, wildCount);
    }

    if (maxRank !== null) {
      return { type: 'consecutive_triples', strength: maxRank, cardCount: 6, label: 'Consecutive Triples', labelZh: '三顺 (钢板)' };
    }
  }

  return { type: 'invalid', strength: 0, cardCount: 0, label: 'Invalid Combo', labelZh: '无效牌型' };
}

/**
 * Checks if played hand can beat the previous lead hand
 */
export function canBeat(play: Card[], lead: PlayAction | null, levelCard: string = '2'): boolean {
  const playCombo = analyzeCombination(play, levelCard);
  if (playCombo.type === 'invalid') return false;

  // If there is no previous leading play, any valid combo can be played
  if (!lead || lead.isPass) return true;

  const leadCombo = analyzeCombination(lead.cards, levelCard);
  if (leadCombo.type === 'invalid') return true; // Safety

  // ROYAL BOMB beats EVERYTHING
  if (playCombo.type === 'royal_bomb') {
    return leadCombo.type !== 'royal_bomb';
  }
  if (leadCombo.type === 'royal_bomb') {
    return false;
  }

  // BOMBS beat all standard combinations
  const playIsBomb = playCombo.type === 'bomb';
  const leadIsBomb = leadCombo.type === 'bomb';

  if (playIsBomb && !leadIsBomb) return true;
  if (!playIsBomb && leadIsBomb) return false;

  if (playIsBomb && leadIsBomb) {
    // Both are bombs: compare strength directly
    // Strength scales by card count first, then rank. Straight flush (strength 550+) is calibrated correctly.
    return playCombo.strength > leadCombo.strength;
  }

  // Standard combinations: must match type and card count
  if (playCombo.type !== leadCombo.type || playCombo.cardCount !== leadCombo.cardCount) {
    return false;
  }

  // Compare strength within same type and count
  return playCombo.strength > leadCombo.strength;
}

/**
 * Advanced bot move decision maker.
 * Analyzes bot hand and makes an optimal play or passes.
 */
export function makeBotMove(
  botCards: Card[], 
  leadAction: PlayAction | null, 
  levelCard: string = '2'
): { playCards: Card[]; isPass: boolean } {
  const adjusted = adjustRanksForLevel(botCards, levelCard);
  // Sort high to low
  adjusted.sort((a, b) => b.rank - a.rank);

  // If bot is leading the trick (no active previous play)
  if (!leadAction || leadAction.isPass) {
    // Bot plays its lowest card to lead
    const lowest = adjusted[adjusted.length - 1];
    
    // Check if we have a pair of that lowest card value
    const matchingPair = adjusted.filter(c => c.value === lowest.value);
    if (matchingPair.length >= 2) {
      return { playCards: matchingPair.slice(0, 2), isPass: false };
    }
    
    return { playCards: [lowest], isPass: false };
  }

  // Bot needs to beat leadAction
  const leadCombo = analyzeCombination(leadAction.cards, levelCard);
  if (leadCombo.type === 'invalid') {
    return { playCards: [adjusted[adjusted.length - 1]], isPass: false };
  }

  // 1. Try to find a matching single/pair/triple/etc. that is higher
  if (leadCombo.type === 'single') {
    // Find all single cards higher than lead's strength, and pick the lowest one of those to conserve high cards
    const candidates = adjusted.filter(c => c.rank > leadCombo.strength);
    if (candidates.length > 0) {
      // Pick the lowest candidate
      const pick = candidates[candidates.length - 1];
      return { playCards: [pick], isPass: false };
    }
  } else if (leadCombo.type === 'pair') {
    // Find a pair that is higher
    // Group cards by value
    const groups: { [key: string]: Card[] } = {};
    adjusted.forEach(c => {
      groups[c.value] = groups[c.value] || [];
      groups[c.value].push(c);
    });

    const pairs = Object.values(groups).filter(g => g.length >= 2);
    const validPairs = pairs.filter(p => {
      // Create a temporary pair
      const tempCombo = analyzeCombination(p.slice(0, 2), levelCard);
      return tempCombo.type === 'pair' && tempCombo.strength > leadCombo.strength;
    });

    if (validPairs.length > 0) {
      // Sort by rank ascending to pick lowest beating pair
      validPairs.sort((a, b) => a[0].rank - b[0].rank);
      return { playCards: validPairs[0].slice(0, 2), isPass: false };
    }
  } else if (leadCombo.type === 'triple') {
    // Find matching triple
    const groups: { [key: string]: Card[] } = {};
    adjusted.forEach(c => {
      groups[c.value] = groups[c.value] || [];
      groups[c.value].push(c);
    });

    const triples = Object.values(groups).filter(g => g.length >= 3);
    const validTriples = triples.filter(t => {
      const tempCombo = analyzeCombination(t.slice(0, 3), levelCard);
      return tempCombo.type === 'triple' && tempCombo.strength > leadCombo.strength;
    });

    if (validTriples.length > 0) {
      validTriples.sort((a, b) => a[0].rank - b[0].rank);
      return { playCards: validTriples[0].slice(0, 3), isPass: false };
    }
  }

  // 2. Aggression logic: 15% chance to drop a bomb to secure the trick if lead is high (strength > 10)
  if (leadCombo.strength > 10 || leadCombo.type === 'bomb') {
    if (Math.random() < 0.25) {
      // Look for a bomb
      const groups: { [key: string]: Card[] } = {};
      adjusted.forEach(c => {
        groups[c.value] = groups[c.value] || [];
        groups[c.value].push(c);
      });

      const bombs = Object.values(groups).filter(g => g.length >= 4);
      const validBombs = bombs.filter(b => {
        return canBeat(b, leadAction, levelCard);
      });

      if (validBombs.length > 0) {
        // Sort lowest bomb first
        validBombs.sort((a, b) => a.length - b.length || a[0].rank - b[0].rank);
        return { playCards: validBombs[0], isPass: false };
      }
    }
  }

  // Default: pass
  return { playCards: [], isPass: true };
}

/**
 * Automatical Scoring Calculator based on game results.
 * Standard Guandan scoring rules:
 * - If partners finish 1st and 2nd (Double Win/双上): Win team advances 3 levels.
 * - If partners finish 1st and 3rd: Win team advances 2 levels.
 * - If partners finish 1st and 4th: Win team advances 1 level.
 * - If the level reaches Ace ("A"), the winning team must win the round with first place to complete the game.
 */
export interface ScoreResult {
  winningTeam: 'A' | 'B';
  levelAdvance: number;
  isDoubleWin: boolean;
  scoreText: string;
  scoreTextZh: string;
}

export function calculateGameScore(finishOrder: ('0' | '1' | '2' | '3')[]): ScoreResult {
  // Map players to teams: '0' & '2' are Team A, '1' & '3' are Team B
  const getTeam = (pId: '0' | '1' | '2' | '3'): 'A' | 'B' => {
    return (pId === '0' || pId === '2') ? 'A' : 'B';
  };

  const firstFinisher = finishOrder[0];
  const winningTeam = getTeam(firstFinisher);

  // Find ranks of partners
  const isTeamAWin = winningTeam === 'A';
  const partnerId = isTeamAWin ? '2' : '3';
  const opponentsIds = isTeamAWin ? ['1', '3'] : ['0', '2'];

  const partnerRank = finishOrder.indexOf(partnerId as any) + 1; // 1-indexed rank (1 to 4)

  let levelAdvance = 0;
  let isDoubleWin = false;
  let scoreText = '';
  let scoreTextZh = '';

  if (partnerRank === 2) {
    // 1st and 2nd -> Double Win (双上)
    levelAdvance = 3;
    isDoubleWin = true;
    scoreText = `Double Win! Team ${winningTeam} finishes 1st and 2nd. Advancing 3 levels.`;
    scoreTextZh = `双上！队伍 ${winningTeam} 获得第一、第二名。级别上升 3 级。`;
  } else if (partnerRank === 3) {
    // 1st and 3rd -> Single Win
    levelAdvance = 2;
    scoreText = `Team ${winningTeam} finishes 1st and 3rd. Advancing 2 levels.`;
    scoreTextZh = `队伍 ${winningTeam} 获得第一、第三名。级别上升 2 级。`;
  } else {
    // 1st and 4th -> Single Win
    levelAdvance = 1;
    scoreText = `Team ${winningTeam} finishes 1st and 4th. Advancing 1 level.`;
    scoreTextZh = `队伍 ${winningTeam} 获得第一、第四名。级别上升 1 级。`;
  }

  return {
    winningTeam,
    levelAdvance,
    isDoubleWin,
    scoreText,
    scoreTextZh,
  };
}

/**
 * Returns next level card representation
 */
export function getNextLevel(currentLevel: string, advanceBy: number): string {
  const currentIndex = CARD_VALUES.indexOf(currentLevel);
  if (currentIndex === -1) return '2';
  
  const nextIndex = (currentIndex + advanceBy) % CARD_VALUES.length;
  return CARD_VALUES[nextIndex];
}
