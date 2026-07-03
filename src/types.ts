export type UserRole = 'player' | 'admin';

export type UserStatus = 'Pending' | 'Approved' | 'Rejected' | 'Suspended';

export interface User {
  id: string;
  fullName: string;
  displayName: string;
  email: string;
  password?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  preferredLanguage: 'en' | 'zh';
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface Room {
  id: number;
  nameEn: string;
  nameZh: string;
  maxPlayers: number;
  currentPlayerCount: number;
  status: 'Waiting' | 'Playing' | 'Full';
  isVoiceActive: boolean;
  isVideoActive: boolean;
  players: string[]; // List of user IDs currently in the room
  seatedPlayers?: { id: string; displayName: string; seat: 0 | 1 | 2 | 3; team: 'A' | 'B'; isBot: boolean }[];
}

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'jokers';

export interface Card {
  id: string; // unique ID for card (e.g., 'hearts-A-1', 'joker-red-1')
  suit: Suit;
  value: string; // '2', '3', ..., '10', 'J', 'Q', 'K', 'A', 'red_joker', 'black_joker'
  rank: number; // For sorting and comparison: 2 to 15 (2=2, J=11, Q=12, K=13, A=14, black=16, red=17, adjusted for level card)
  isLevelCard: boolean;
  isWild: boolean; // "Feng Ren Pei" (逢人配), typically Heart level card
  deck: 1 | 2; // Two decks of poker are used
}

export interface PlayAction {
  id: string;
  playerId: string;
  playerName: string;
  team: 'A' | 'B';
  cards: Card[];
  cardType: string;
  timestamp: string;
  isPass: boolean;
}

export interface Team {
  name: string;
  playerIds: string[]; // 2 players
}

export interface GameState {
  id: string;
  roomId: number;
  status: 'lobby' | 'playing' | 'ended';
  scoringMode: 'manual' | 'auto';
  currentLevel: string; // e.g. "2" to "A" (the card that is currently the level card)
  levelCardValue: string; // e.g. "2", "3", "J", etc.
  players: {
    id: string;
    displayName: string;
    seat: 0 | 1 | 2 | 3; // 0: South (user), 1: East (bot), 2: North (partner bot), 3: West (bot)
    team: 'A' | 'B'; // South & North are Team A, East & West are Team B
    cards: Card[];
    hasFinished: boolean;
    finishOrder?: number; // 1, 2, 3, 4
  }[];
  teamA: Team; // Player 0 & Player 2
  teamB: Team; // Player 1 & Player 3
  activePlayerIndex: number; // 0, 1, 2, 3
  lastPlay: PlayAction | null; // Leading play of the current trick
  history: PlayAction[]; // History of played cards in the current round
  scores: {
    teamAScore: number; // Current accumulated level/score index (e.g., 2=0, 3=1, etc. or direct numeric score)
    teamBScore: number;
    teamALevel: string; // Current level character ("2" ... "A")
    teamBLevel: string;
  };
  winnerTeam?: 'A' | 'B';
}

export interface ScoreRecord {
  id: string;
  gameId: string;
  roomName: string;
  date: string;
  teamAName: string;
  teamBName: string;
  teamAScoreChange: number;
  teamBScoreChange: number;
  teamAFinalLevel: string;
  teamBFinalLevel: string;
  winningTeam: 'A' | 'B';
  scoringMode: 'manual' | 'auto';
  notes?: string;
}
