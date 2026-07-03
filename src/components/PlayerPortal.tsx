import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Room, Card, PlayAction, GameState, ScoreRecord, Suit 
} from '../types';
import { getTranslation } from '../i18n';
import { 
  generateDecks, shuffleCards, sortCards, canBeat, analyzeCombination, makeBotMove, calculateGameScore, getNextLevel, adjustRanksForLevel 
} from '../utils/guandanEngine';
import { 
  User as UserIcon, LogOut, Video, VideoOff, Mic, MicOff, Users, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Shield, RefreshCw, Layers, SortAsc, HelpCircle, Eye, ChevronRight, Edit2, Play, Circle, Trophy, History, Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// 24 Solar Terms english and chinese pairs
export const SOLAR_TERMS = [
  { nameEn: "Start of Spring", nameZh: "立春" },
  { nameEn: "Rain Water", nameZh: "雨水" },
  { nameEn: "Awakening of Insects", nameZh: "惊蛰" },
  { nameEn: "Spring Equinox", nameZh: "春分" },
  { nameEn: "Clear and Bright", nameZh: "清明" },
  { nameEn: "Grain Rain", nameZh: "谷雨" },
  { nameEn: "Start of Summer", nameZh: "立夏" },
  { nameEn: "Grain Buds", nameZh: "小满" },
  { nameEn: "Grain in Ear", nameZh: "芒种" },
  { nameEn: "Summer Solstice", nameZh: "夏至" },
  { nameEn: "Minor Heat", nameZh: "小暑" },
  { nameEn: "Major Heat", nameZh: "大暑" },
  { nameEn: "Start of Autumn", nameZh: "立秋" },
  { nameEn: "End of Heat", nameZh: "处暑" },
  { nameEn: "White Dew", nameZh: "白露" },
  { nameEn: "Autumn Equinox", nameZh: "秋分" },
  { nameEn: "Cold Dew", nameZh: "寒露" },
  { nameEn: "Frost Descent", nameZh: "霜降" },
  { nameEn: "Start of Winter", nameZh: "立冬" },
  { nameEn: "Minor Snow", nameZh: "小雪" },
  { nameEn: "Major Snow", nameZh: "大雪" },
  { nameEn: "Winter Solstice", nameZh: "冬至" },
  { nameEn: "Minor Cold", nameZh: "小寒" },
  { nameEn: "Major Cold", nameZh: "大寒" }
];

export const SCOREBOARD_LEVELS = [
  { key: '2', display: '2' },
  { key: '3', display: '3' },
  { key: '4', display: '4' },
  { key: '5', display: '5' },
  { key: '6', display: '6' },
  { key: '7', display: '7' },
  { key: '8', display: '8' },
  { key: '9', display: '9' },
  { key: '10', display: '10' },
  { key: 'J', display: 'J' },
  { key: 'Q', display: 'Q' },
  { key: 'K', display: 'K' },
  { key: 'A1', display: 'A₁' },
  { key: 'A2', display: 'A₂' },
  { key: 'A3', display: 'A₃' },
  { key: '🏆', display: '🏆' },
];

export const SCOREBOARD_SEQUENCE = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A1', 'A2', 'A3', '🏆'];

export function advanceScoreboardLevel(currentLevel: string, advanceBy: number): string {
  let level = currentLevel;
  if (level === 'A') level = 'A1';
  
  const currentIndex = SCOREBOARD_SEQUENCE.indexOf(level);
  if (currentIndex === -1) return '2';
  
  const nextIndex = Math.min(currentIndex + advanceBy, SCOREBOARD_SEQUENCE.length - 1);
  return SCOREBOARD_SEQUENCE[nextIndex];
}

export interface TributeItem {
  giverSeat: number;
  receiverSeat: number;
  givenCard?: Card;
  returnedCard?: Card;
  status: 'pending_tribute' | 'pending_return' | 'completed';
}

export interface TributeState {
  isActive: boolean;
  isResisted: boolean;
  resistedReason?: string;
  items: TributeItem[];
  startingPlayerIndex: number;
}

interface PlayerPortalProps {
  language: 'en' | 'zh';
  setLanguage: (lang: 'en' | 'zh') => void;
  users: User[];
  onRegister: (newUser: Omit<User, 'id' | 'role' | 'status' | 'createdAt'>) => Promise<User | null>;
  onLogin: (email: string, pass: string) => User | null | Promise<User | null>;
  currentUser: User | null;
  setCurrentUser: (u: User | null) => void;
  rooms: Room[];
  updateRooms: (rooms: Room[], roomId?: number) => void;
  onRecordGame: (record: ScoreRecord) => void;
  scoresHistory: ScoreRecord[];
}

export default function PlayerPortal({
  language,
  setLanguage,
  users,
  onRegister,
  onLogin,
  currentUser,
  setCurrentUser,
  rooms,
  updateRooms,
  onRecordGame,
  scoresHistory,
}: PlayerPortalProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Registration state
  const [regFullName, setRegFullName] = useState('');
  const [regNickname, setRegNickname] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLanguage, setRegLanguage] = useState<'en' | 'zh'>(language);
  const [regInvitationCode, setRegInvitationCode] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);
  const [authError, setAuthError] = useState('');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Navigation and play state
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedCards, setSelectedCards] = useState<{ [id: string]: boolean }>({});
  const [sortStrategy, setSortStrategy] = useState<'rank' | 'suit' | 'combo'>('rank');
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [cardRows, setCardRows] = useState<{ [cardId: string]: 1 | 2 }>({});
  const [seatedPlayers, setSeatedPlayers] = useState<{ id: string; displayName: string; seat: 0 | 1 | 2 | 3; team: 'A' | 'B'; isBot: boolean }[]>([]);
  const lastLocalSeatedPlayersUpdateRef = useRef<number>(0);
  const updateSeatedPlayersLocally = (newSeated: typeof seatedPlayers | ((prev: typeof seatedPlayers) => typeof seatedPlayers)) => {
    lastLocalSeatedPlayersUpdateRef.current = Date.now();
    setSeatedPlayers(newSeated);
  };
  const [autoWaitActive, setAutoWaitActive] = useState(false);
  const [loungeMode, setLoungeMode] = useState<'choose' | 'wait' | 'select_seat' | null>(null);

  // Interactive panels
  const [showHistory, setShowHistory] = useState(false);
  const [showRules, setShowRules] = useState(false);
  
  // Custom Team Names
  const [teamAName, setTeamAName] = useState('Dragon Team（龙队）');
  const [teamBName, setTeamBName] = useState('Tiger Team（虎队）');
  const [isEditingTeams, setIsEditingTeams] = useState(false);

  // WebRTC Simulation State
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Activate and control the WebRTC webcam and microphone
  useEffect(() => {
    if (camActive) {
      navigator.mediaDevices.getUserMedia({ 
        video: { width: 160, height: 120 }, 
        audio: true 
      })
      .then(stream => {
        setLocalStream(stream);
        // Ensure standard audio state matches micActive immediately
        stream.getAudioTracks().forEach(track => {
          track.enabled = micActive;
        });
      })
      .catch(err => {
        console.warn("Could not start local video stream:", err);
      });
    } else {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
    }
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [camActive]);

  // Synchronize stream target reference when rendering or changing stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, camActive]);

  // Handle live toggle for microphone
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = micActive;
      });
    }
  }, [micActive, localStream]);

  // Scoring details
  const [scoringMode, setScoringMode] = useState<'manual' | 'auto'>('auto');
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [manualWinner, setManualWinner] = useState<'A' | 'B'>('A');
  const [manualAdvance, setManualAdvance] = useState(1);
  const [manualNotes, setManualNotes] = useState('');
  const [lastFinisherSeat, setLastFinisherSeat] = useState<number | null>(null);
  const [lastWinnerSeat, setLastWinnerSeat] = useState<number | null>(null);
  const [lastOrderedSeats, setLastOrderedSeats] = useState<number[] | null>(null);
  const [tribute, setTribute] = useState<TributeState | null>(null);

  const t = (key: string) => getTranslation(key, language);

  // Register Handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName || !regNickname || !regEmail || !regPassword) {
      setAuthError(language === 'en' ? 'Please fill in all required fields.' : '请填写所有必填字段。');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setAuthError(language === 'en' ? 'Passwords do not match.' : '两次输入的密码不一致。');
      return;
    }
    setAuthError('');
    try {
      const result = await onRegister({
        fullName: regFullName,
        displayName: regNickname,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        preferredLanguage: regLanguage,
      });
      if (result) {
        setRegSuccess(true);
        setAuthError('');
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(language === 'en' ? 'Registration failed.' : '注册失败，请稍后重试。');
    }
  };

  // Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const user = await onLogin(loginEmail, loginPassword);
      if (!user) {
        setAuthError(language === 'en' ? 'Invalid credentials or account suspended.' : '无效的凭证或账号已被停用。');
        return;
      }
      if (user.status === 'Pending') {
        setAuthError(t('approvalNotice'));
        return;
      }
      if (user.status === 'Suspended' || user.status === 'Rejected') {
        setAuthError(language === 'en' ? 'Your account is disabled/rejected.' : '您的账号已被禁用或拒绝。');
        return;
      }
      setCurrentUser(user);
      setLanguage(user.preferredLanguage);
    } catch (err) {
      console.error(err);
      setAuthError(language === 'en' ? 'Server error. Please try again.' : '服务器错误，请稍后重试。');
    }
  };

  // Join Room
  const handleJoinRoom = (roomId: number) => {
    if (!currentUser) return;
    
    // Update seats and room status in the global state
    const targetRoom = rooms.find(r => r.id === roomId);
    if (!targetRoom) return;

    if (targetRoom.currentPlayerCount >= 4) {
      alert(language === 'en' ? 'This room is full.' : '房间已满。');
      return;
    }

    // Set Room Info and transition to room view
    setSelectedRoomId(roomId);
    setAutoWaitActive(false);

    const existingSeated = targetRoom.seatedPlayers || [];

    if (existingSeated.length === 0) {
      // 第一个进入掼蛋室的在南 (First player enters and sits at South / Seat 0)
      const firstSeated = [
        { id: currentUser.id, displayName: currentUser.displayName, seat: 0 as const, team: 'A' as const, isBot: false }
      ];
      updateSeatedPlayersLocally(firstSeated);
      setLoungeMode('choose');

      // Update global room lists to reflect player joining
      const updatedRooms = rooms.map(r => {
        if (r.id === roomId) {
          return {
            ...r,
            currentPlayerCount: 1,
            players: [currentUser.id],
            seatedPlayers: firstSeated,
            status: 'Waiting' as const,
          };
        }
        return r;
      });
      updateRooms(updatedRooms, roomId);
    } else {
      // 后来进入的玩家有选择位置的页面 (Subsequent players get seat selection first)
      updateSeatedPlayersLocally(existingSeated);
      setLoungeMode('select_seat');
    }
  };

  // Leave Room
  const handleLeaveRoom = () => {
    if (!selectedRoomId) return;
    const targetRoom = rooms.find(r => r.id === selectedRoomId);
    const nextSeated = (targetRoom?.seatedPlayers || seatedPlayers).filter(p => p.id !== currentUser.id);
    const updatedRooms = rooms.map(r => {
      if (r.id === selectedRoomId) {
        return {
          ...r,
          currentPlayerCount: nextSeated.length,
          players: nextSeated.map(p => p.id),
          seatedPlayers: nextSeated,
          status: 'Waiting' as const,
        };
      }
      return r;
    });
    updateRooms(updatedRooms, selectedRoomId);
    setSelectedRoomId(null);
    setLoungeMode(null);
    setGame(null);
    setSelectedCards({});
    setShowHistory(false);
  };

  // Admin Reset Room
  const handleResetRoom = (roomId: number) => {
    const updatedRooms = rooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          currentPlayerCount: 0,
          players: [],
          seatedPlayers: [],
          status: 'Waiting' as const,
        };
      }
      return r;
    });
    updateRooms(updatedRooms, roomId);
    
    // If current user is in this room, redirect them back to lobby
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
      setLoungeMode(null);
      setGame(null);
      setSelectedCards({});
      setShowHistory(false);
    }
  };

  // Start / Init game
  const initGame = (roomId: number, customPlayers?: { id: string; displayName: string; seat: 0 | 1 | 2 | 3; team: 'A' | 'B'; isBot: boolean }[]) => {
    const levelCard = '2'; // Starting level card is always 2
    const allCards = generateDecks(levelCard);
    const shuffled = shuffleCards(allCards);

    // Deal 27 cards to each of the 4 players
    const hand0 = shuffled.slice(0, 27);
    const hand1 = shuffled.slice(27, 54);
    const hand2 = shuffled.slice(54, 81);
    const hand3 = shuffled.slice(81, 108);

    const defaultPlayers = [
      { id: currentUser?.id || 'player-1', displayName: currentUser?.displayName || 'Player', seat: 0 as const, team: 'A' as const, isBot: false },
      { id: 'bot-1', displayName: language === 'en' ? 'AlphaBot' : '智多星电脑', seat: 1 as const, team: 'B' as const, isBot: true },
      { id: 'bot-2', displayName: language === 'en' ? 'OmegaBot (Partner)' : '大将军对家', seat: 2 as const, team: 'A' as const, isBot: true },
      { id: 'bot-3', displayName: language === 'en' ? 'SigmaBot' : '无双刀电脑', seat: 3 as const, team: 'B' as const, isBot: true },
    ];

    const finalPlayersDef = customPlayers && customPlayers.length === 4 ? customPlayers : defaultPlayers;

    // First round of dealing: player who gets Hearts 2 starts
    let startingPlayerIndex = 0;
    const firstHearts2Idx = shuffled.findIndex(c => c.suit === 'hearts' && c.value === '2');
    if (firstHearts2Idx !== -1) {
      startingPlayerIndex = Math.floor(firstHearts2Idx / 27);
    }

    const initialGame: GameState = {
      id: `game-${Date.now()}`,
      roomId,
      status: 'playing',
      scoringMode: 'auto',
      currentLevel: '2',
      levelCardValue: '2',
      players: finalPlayersDef.map((p, idx) => {
        const hand = idx === 0 ? hand0 : idx === 1 ? hand1 : idx === 2 ? hand2 : hand3;
        return {
          id: p.id,
          displayName: p.displayName,
          seat: p.seat,
          team: p.team,
          cards: sortCards(hand, 'rank', levelCard),
          hasFinished: false
        };
      }),
      teamA: { name: teamAName, playerIds: [finalPlayersDef[0].id, finalPlayersDef[2].id] },
      teamB: { name: teamBName, playerIds: [finalPlayersDef[1].id, finalPlayersDef[3].id] },
      activePlayerIndex: startingPlayerIndex, // Player with first Hearts 2 starts
      lastPlay: null,
      history: [],
      scores: {
        teamAScore: 0,
        teamBScore: 0,
        teamALevel: '2',
        teamBLevel: '2',
      }
    };
    setGame(initialGame);
    setSelectedCards({});
    setLastFinisherSeat(null);
    setLastWinnerSeat(null);
    setLastOrderedSeats(null);
    setTribute(null);
  };

  // Simulate online players joining the room lounge over time
  useEffect(() => {
    if (!autoWaitActive || !selectedRoomId || game) return;

    const timer = setInterval(() => {
      updateSeatedPlayersLocally(prev => {
        if (prev.length >= 4) {
          setAutoWaitActive(false);
          return prev;
        }

        // Find the first empty seat
        const occupiedSeats = new Set(prev.map(p => p.seat));
        let nextSeat: 1 | 2 | 3 = 1;
        for (const s of [2, 1, 3] as const) {
          if (!occupiedSeats.has(s)) {
            nextSeat = s;
            break;
          }
        }

        const candidateNamesZh = ['大将军对家', '无双刀电脑', '智多星电脑', '对攻大师', '牌坛老手', '清风徐来', '掼蛋至尊', '江南皮皮虾'];
        const candidateNamesEn = ['AlphaBot', 'OmegaBot (Partner)', 'SigmaBot', 'PokerPro', 'GuandanKing', 'CardMaster'];
        const names = language === 'zh' ? candidateNamesZh : candidateNamesEn;
        
        const existingNames = new Set(prev.map(p => p.displayName));
        const availableName = names.find(n => !existingNames.has(n)) || `Player-${Math.floor(Math.random() * 1000)}`;

        const newPlayer = {
          id: `player-sim-${Date.now()}`,
          displayName: availableName,
          seat: nextSeat,
          team: nextSeat === 2 ? ('A' as const) : ('B' as const),
          isBot: false
        };

        return [...prev, newPlayer].sort((a, b) => a.seat - b.seat);
      });
    }, 2500);

    return () => clearInterval(timer);
  }, [autoWaitActive, selectedRoomId, game, language]);

  // Synchronize local seatedPlayers state with global targetRoom's seatedPlayers
  useEffect(() => {
    if (!selectedRoomId || game) return;
    const targetRoom = rooms.find(r => r.id === selectedRoomId);
    if (!targetRoom) return;

    // Guard to prevent overwriting local seat selections while they are propagating to the server
    if (Date.now() - lastLocalSeatedPlayersUpdateRef.current < 2000) {
      return;
    }

    if (targetRoom.seatedPlayers) {
      const localStr = JSON.stringify(seatedPlayers);
      const serverStr = JSON.stringify(targetRoom.seatedPlayers);
      if (localStr !== serverStr) {
        setSeatedPlayers(targetRoom.seatedPlayers);
      }
    }
  }, [rooms, selectedRoomId, game, seatedPlayers]);



  // Automatically trigger next round deal when the previous round's last finisher is a bot
  useEffect(() => {
    if (game && game.status === 'lobby' && lastFinisherSeat !== null && lastFinisherSeat !== 0) {
      const timer = setTimeout(() => {
        handleNextRoundDeal();
      }, 4000); // 4 seconds delay so human can see results
      return () => clearTimeout(timer);
    }
  }, [game?.status, lastFinisherSeat]);

  // If the room gets reset by an admin, redirect back to lobby
  useEffect(() => {
    if (!selectedRoomId) return;
    const targetRoom = rooms.find(r => r.id === selectedRoomId);
    if (targetRoom && targetRoom.currentPlayerCount === 0 && targetRoom.players.length === 0) {
      if (game || (seatedPlayers.length > 1) || loungeMode === 'wait') {
        setSelectedRoomId(null);
        setLoungeMode(null);
        setGame(null);
        setSelectedCards({});
        setShowHistory(false);
      }
    }
  }, [rooms, selectedRoomId, game, seatedPlayers, loungeMode]);

  // Seating management actions
  const handleSeatPlayer = (seat: 0 | 1 | 2 | 3, displayName: string, isBot: boolean) => {
    updateSeatedPlayersLocally(prev => {
      const filtered = prev.filter(p => p.seat !== seat);
      const newPlayer = {
        id: isBot ? `bot-${seat}-${Date.now()}` : `friend-${seat}-${Date.now()}`,
        displayName: displayName || (isBot ? (language === 'zh' ? '电脑机器人' : 'Bot') : (language === 'zh' ? '好友玩家' : 'Friend')),
        seat,
        team: (seat === 0 || seat === 2) ? ('A' as const) : ('B' as const),
        isBot
      };
      return [...filtered, newPlayer].sort((a, b) => a.seat - b.seat);
    });
  };

  const handleKickPlayer = (seat: 0 | 1 | 2 | 3) => {
    const finalSeated = seatedPlayers.filter(p => p.seat !== seat);
    updateSeatedPlayersLocally(finalSeated);
    
    const updatedRooms = rooms.map(r => {
      if (r.id === selectedRoomId) {
        return {
          ...r,
          currentPlayerCount: finalSeated.length,
          players: finalSeated.map(p => p.id),
          seatedPlayers: finalSeated,
          status: finalSeated.length >= 4 ? ('Full' as const) : ('Waiting' as const),
        };
      }
      return r;
    });
    updateRooms(updatedRooms, selectedRoomId);
  };

  const handleFillAllBots = () => {
    const occupiedSeats = new Set(seatedPlayers.map(p => p.seat));
    const next = [...seatedPlayers];
    
    const botNames = {
      1: language === 'zh' ? '智多星电脑' : 'AlphaBot',
      2: language === 'zh' ? '大将军对家' : 'OmegaBot (Partner)',
      3: language === 'zh' ? '无双刀电脑' : 'SigmaBot'
    };

    ([1, 2, 3] as const).forEach(seat => {
      if (!occupiedSeats.has(seat)) {
        next.push({
          id: `bot-${seat}-${Date.now()}`,
          displayName: botNames[seat],
          seat,
          team: seat === 2 ? ('A' as const) : ('B' as const),
          isBot: true
        });
      }
    });

    const finalSeated = next.sort((a, b) => a.seat - b.seat);
    updateSeatedPlayersLocally(finalSeated);

    const updatedRooms = rooms.map(r => {
      if (r.id === selectedRoomId) {
        return {
          ...r,
          currentPlayerCount: finalSeated.length,
          players: finalSeated.map(p => p.id),
          seatedPlayers: finalSeated,
          status: finalSeated.length >= 4 ? ('Full' as const) : ('Waiting' as const),
        };
      }
      return r;
    });
    updateRooms(updatedRooms, selectedRoomId);
  };

  // Find current trick's plays for each player
  const currentTrickActions = React.useMemo(() => {
    if (!game) return [];
    const actions: PlayAction[] = [];
    let passCount = 0;
    for (let i = 0; i < game.history.length; i++) {
      const act = game.history[i];
      if (act.isPass) {
        passCount++;
      } else {
        passCount = 0;
      }
      if (passCount >= 3) {
        break;
      }
      actions.push(act);
    }
    return actions;
  }, [game?.history]);

  const getPlayerCurrentTrickPlay = (seatIndex: number) => {
    if (!game) return null;
    const player = game.players[seatIndex];
    return currentTrickActions.find(act => act.playerId === player.id);
  };

  // Insert space between cards by adding a special spacer card
  const handleAddSpacer = () => {
    if (!game) return;
    const spacerId = `spacer-${Date.now()}-${Math.random()}`;
    const newSpacerCard: Card = {
      id: spacerId,
      suit: 'clubs',
      value: 'spacer',
      rank: -1,
      isLevelCard: false,
      isWild: false,
      deck: 1
    };
    setCardRows(prev => ({
      ...prev,
      [spacerId]: 1
    }));
    setGame(prev => {
      if (!prev) return null;
      const updatedPlayers = prev.players.map((p, idx) => {
        if (idx === 0) {
          return { ...p, cards: [...p.cards, newSpacerCard] };
        }
        return p;
      });
      return { ...prev, players: updatedPlayers };
    });
  };

  // Synchronize cardRows state when game player cards change
  useEffect(() => {
    if (!game) {
      setCardRows({});
      return;
    }
    const myCards = game.players[0].cards;
    if (myCards.length === 0) return;

    setCardRows(prev => {
      let changed = false;
      const nextRows = { ...prev };
      
      // Remove any old/played cards from state
      const activeIds = new Set(myCards.map(c => c.id));
      for (const id in nextRows) {
        if (!activeIds.has(id)) {
          delete nextRows[id];
          changed = true;
        }
      }

      // Add missing cards (defaulting to split 50/50 initially)
      const midPoint = Math.ceil(myCards.length / 2);
      myCards.forEach((c, idx) => {
        if (!nextRows[c.id]) {
          nextRows[c.id] = idx < midPoint ? 1 : 2;
          changed = true;
        }
      });

      return changed ? nextRows : prev;
    });
  }, [game?.players[0]?.cards]);

  // Re-deal cards
  const handleRedeal = () => {
    if (selectedRoomId) {
      initGame(selectedRoomId, seatedPlayers);
    }
  };

  // Select a bot card to return
  const selectBotReturnCard = (hand: Card[], levelCard: string): Card => {
    // Cards between 2 and 10 and not level card
    const eligible = hand.filter(c => 
      ['2', '3', '4', '5', '6', '7', '8', '9', '10'].includes(c.value) && 
      c.value !== levelCard && 
      c.suit !== 'jokers'
    );
    if (eligible.length > 0) {
      const sorted = [...eligible].sort((a, b) => a.rank - b.rank);
      return sorted[0];
    }
    const fallbackEligible = hand.filter(c => c.value !== levelCard && c.suit !== 'jokers');
    if (fallbackEligible.length > 0) {
      const sorted = [...fallbackEligible].sort((a, b) => a.rank - b.rank);
      return sorted[0];
    }
    const sorted = [...hand].sort((a, b) => a.rank - b.rank);
    return sorted[0];
  };

  // Deal next round of cards
  const handleNextRoundDeal = () => {
    if (!game) return;

    const nextLevel = game.currentLevel;
    const allCards = generateDecks(nextLevel);
    const shuffled = shuffleCards(allCards);

    // Deal 27 cards to each of the 4 players
    let hand0 = shuffled.slice(0, 27);
    let hand1 = shuffled.slice(27, 54);
    let hand2 = shuffled.slice(54, 81);
    let hand3 = shuffled.slice(81, 108);

    let isResisted = false;
    let resistedReason = "";
    let tributeItems: TributeItem[] = [];
    let startingPlayerIndex = lastWinnerSeat !== null ? lastWinnerSeat : 0;

    // Check if we have previous round's finished order
    if (lastOrderedSeats && lastOrderedSeats.length === 4) {
      const t1 = lastOrderedSeats[0]; // 1st
      const t2 = lastOrderedSeats[1]; // 2nd
      const t3 = lastOrderedSeats[2]; // 3rd
      const t4 = lastOrderedSeats[3]; // 4th

      // Team A is seats 0,2; Team B is seats 1,3
      const isDoubleDown = (t1 % 2) === (t2 % 2);

      // Check for Anti-tribute (抗贡)
      if (isDoubleDown) {
        const hand3rd = t3 === 0 ? hand0 : t3 === 1 ? hand1 : t3 === 2 ? hand2 : hand3;
        const hand4th = t4 === 0 ? hand0 : t4 === 1 ? hand1 : t4 === 2 ? hand2 : hand3;

        const redJokers3rd = hand3rd.filter(c => c.value === 'red_joker').length;
        const redJokers4th = hand4th.filter(c => c.value === 'red_joker').length;

        if (redJokers3rd + redJokers4th >= 2) {
          isResisted = true;
          resistedReason = language === 'zh'
            ? `抗贡触发：输家队伍手中共有 ${redJokers3rd + redJokers4th} 张大王（双大王），本局免除进贡！`
            : `Anti-tribute triggered: Losing team has ${redJokers3rd + redJokers4th} Red Jokers, tribute is waived!`;
        }
      } else {
        const hand4th = t4 === 0 ? hand0 : t4 === 1 ? hand1 : t4 === 2 ? hand2 : hand3;
        const redJokers4th = hand4th.filter(c => c.value === 'red_joker').length;

        if (redJokers4th >= 2) {
          isResisted = true;
          resistedReason = language === 'zh'
            ? `抗贡触发：末家（下游）手中持有 2 张大王，本局免除进贡！`
            : `Anti-tribute triggered: Downstream player has 2 Red Jokers, tribute is waived!`;
        }
      }

      if (isResisted) {
        startingPlayerIndex = t1; // 1st finisher starts playing directly
        setTribute({
          isActive: true,
          isResisted: true,
          resistedReason,
          items: [],
          startingPlayerIndex
        });
      } else {
        // Build tribute items
        // Create mutable hand lists
        let tempHands = [ [...hand0], [...hand1], [...hand2], [...hand3] ];

        if (isDoubleDown) {
          // Double Down: t4 pays to t1, t3 pays to t2
          const hand3rd = tempHands[t3];
          const hand4th = tempHands[t4];

          const adjusted3rd = adjustRanksForLevel(hand3rd, nextLevel).sort((a, b) => b.rank - a.rank || b.suit.localeCompare(a.suit));
          const adjusted4th = adjustRanksForLevel(hand4th, nextLevel).sort((a, b) => b.rank - a.rank || b.suit.localeCompare(a.suit));

          // Exclude Hearts Level Card (Feng Ren Pei / Wild card)
          const eligible3rd = adjusted3rd.filter(c => !(c.suit === 'hearts' && c.value === nextLevel));
          const eligible4th = adjusted4th.filter(c => !(c.suit === 'hearts' && c.value === nextLevel));

          const card3rd = eligible3rd[0];
          const card4th = eligible4th[0];

          tributeItems = [
            {
              giverSeat: t4,
              receiverSeat: t1,
              givenCard: card4th,
              status: 'pending_tribute'
            },
            {
              giverSeat: t3,
              receiverSeat: t2,
              givenCard: card3rd,
              status: 'pending_tribute'
            }
          ];
        } else {
          // Single Down: t4 pays to t1
          const hand4th = tempHands[t4];
          const adjusted4th = adjustRanksForLevel(hand4th, nextLevel).sort((a, b) => b.rank - a.rank || b.suit.localeCompare(a.suit));
          const eligible4th = adjusted4th.filter(c => !(c.suit === 'hearts' && c.value === nextLevel));
          const card4th = eligible4th[0];

          tributeItems = [
            {
              giverSeat: t4,
              receiverSeat: t1,
              givenCard: card4th,
              status: 'pending_tribute'
            }
          ];
        }

        // Execute givers' tribute card transfers from givers' hands to receivers' hands
        tributeItems.forEach(item => {
          const giverHand = tempHands[item.giverSeat];
          const receiverHand = tempHands[item.receiverSeat];

          const idx = giverHand.findIndex(c => c.id === item.givenCard?.id);
          if (idx !== -1) {
            const [card] = giverHand.splice(idx, 1);
            receiverHand.push(card);
          }
        });

        // Execute bot receivers' return transfers back to givers' hands
        tributeItems.forEach(item => {
          if (item.receiverSeat !== 0) {
            // Bot receiver auto-returns a small card
            const receiverHand = tempHands[item.receiverSeat];
            const returnedCard = selectBotReturnCard(receiverHand, nextLevel);
            item.returnedCard = returnedCard;
            item.status = 'completed';

            const giverHand = tempHands[item.giverSeat];
            const idx = receiverHand.findIndex(c => c.id === returnedCard.id);
            if (idx !== -1) {
              const [card] = receiverHand.splice(idx, 1);
              giverHand.push(card);
            }
          } else {
            // Human receiver: pending manual return
            item.status = 'pending_return';
          }
        });

        // Determine startingPlayerIndex: Giver of the larger tribute card starts the game
        if (isDoubleDown) {
          const card3rd = tributeItems[1].givenCard;
          const card4th = tributeItems[0].givenCard;
          if (card3rd && card4th) {
            if (card3rd.rank > card4th.rank) {
              startingPlayerIndex = t3;
            } else if (card4th.rank > card3rd.rank) {
              startingPlayerIndex = t4;
            } else {
              startingPlayerIndex = t4;
            }
          }
        } else {
          startingPlayerIndex = t4;
        }

        // Assign back to the hands
        hand0 = tempHands[0];
        hand1 = tempHands[1];
        hand2 = tempHands[2];
        hand3 = tempHands[3];

        setTribute({
          isActive: true,
          isResisted: false,
          items: tributeItems,
          startingPlayerIndex
        });
      }
    } else {
      // First round or fallback: no tribute
      setTribute(null);
      // Fallback first hearts 2
      const firstHearts2Idx = shuffled.findIndex(c => c.suit === 'hearts' && c.value === '2');
      if (firstHearts2Idx !== -1) {
        startingPlayerIndex = Math.floor(firstHearts2Idx / 27);
      }
    }

    setGame(prev => {
      if (!prev) return null;
      return {
        ...prev,
        status: 'playing',
        players: prev.players.map((p, idx) => {
          const hand = idx === 0 ? hand0 : idx === 1 ? hand1 : idx === 2 ? hand2 : hand3;
          return {
            ...p,
            cards: sortCards(hand, 'rank', nextLevel),
            hasFinished: false,
            finishOrder: undefined
          };
        }),
        activePlayerIndex: (tributeItems.length > 0 && tributeItems.some(it => it.status !== 'completed') && !isResisted) ? -1 : startingPlayerIndex,
        lastPlay: null,
        history: []
      };
    });

    setSelectedCards({});
  };

  // Sort current player cards
  const handleSort = (strategy: 'rank' | 'suit' | 'combo') => {
    if (!game) return;
    setSortStrategy(strategy);
    const levelCard = game.currentLevel;
    setCardRows({});

    setGame(prev => {
      if (!prev) return null;
      const updatedPlayers = prev.players.map(p => {
        if (p.seat === 0) {
          const realCardsOnly = p.cards.filter(c => c.value !== 'spacer');
          const spacersOnly = p.cards.filter(c => c.value === 'spacer');
          const sortedReal = sortCards(realCardsOnly, strategy, levelCard);
          return {
            ...p,
            cards: [...sortedReal, ...spacersOnly]
          };
        }
        return p;
      });
      return { ...prev, players: updatedPlayers };
    });
  };

  const isEligibleReturnCard = (card: Card, levelCard: string): boolean => {
    return ['2', '3', '4', '5', '6', '7', '8', '9', '10'].includes(card.value) && 
           card.value !== levelCard && 
           card.suit !== 'jokers';
  };

  // Card Selection toggle
  const toggleSelectCard = (cardId: string) => {
    if (tribute && tribute.isActive) {
      // Check if human needs to return a card
      const humanReturnItem = tribute.items.find(it => it.receiverSeat === 0 && it.status === 'pending_return');
      if (!humanReturnItem) return;

      const card = game?.players[0].cards.find(c => c.id === cardId);
      if (!card || !isEligibleReturnCard(card, game!.currentLevel)) {
        return;
      }

      setSelectedCards(prev => {
        const selected = prev[cardId];
        return selected ? {} : { [cardId]: true };
      });
      return;
    }

    setSelectedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  // Human player returns tribute card
  const handleReturnTribute = () => {
    if (!game || !tribute || !tribute.isActive) return;

    const pendingItemIndex = tribute.items.findIndex(item => item.receiverSeat === 0 && item.status === 'pending_return');
    if (pendingItemIndex === -1) return;

    const item = tribute.items[pendingItemIndex];

    const selectedIds = Object.keys(selectedCards).filter(id => selectedCards[id]);
    if (selectedIds.length !== 1) return;

    const selectedCardId = selectedIds[0];
    const player0 = game.players[0];
    const selectedCard = player0.cards.find(c => c.id === selectedCardId);
    if (!selectedCard) return;

    // Remove from human's hand, add to giver's hand
    setGame(prev => {
      if (!prev) return null;

      const levelCard = prev.currentLevel;

      const updatedPlayers = prev.players.map(p => {
        if (p.seat === 0) {
          return {
            ...p,
            cards: p.cards.filter(c => c.id !== selectedCardId)
          };
        }
        if (p.seat === item.giverSeat) {
          const newCards = [...p.cards, selectedCard];
          return {
            ...p,
            cards: sortCards(newCards, 'rank', levelCard)
          };
        }
        return p;
      });

      return {
        ...prev,
        players: updatedPlayers
      };
    });

    // Update tribute item status
    setTribute(prev => {
      if (!prev) return null;
      const updatedItems = prev.items.map((it, idx) => {
        if (idx === pendingItemIndex) {
          return {
            ...it,
            returnedCard: selectedCard,
            status: 'completed' as const
          };
        }
        return it;
      });

      return {
        ...prev,
        items: updatedItems
      };
    });

    setSelectedCards({});
  };

  // Start match playing phase after tribute/anti-tribute ends
  const handleStartAfterTribute = () => {
    if (!game || !tribute) return;

    setGame(prev => {
      if (!prev) return null;
      return {
        ...prev,
        activePlayerIndex: tribute.startingPlayerIndex,
        lastPlay: null,
        history: []
      };
    });

    setTribute(null);
  };

  // Drag and Drop card reordering
  const handleCardDrop = (draggedId: string, targetId: string) => {
    if (!game) return;
    const cards = [...game.players[0].cards];
    const dragIdx = cards.findIndex(c => c.id === draggedId);
    const dropIdx = cards.findIndex(c => c.id === targetId);
    if (dragIdx !== -1 && dropIdx !== -1 && dragIdx !== dropIdx) {
      const [draggedCard] = cards.splice(dragIdx, 1);
      cards.splice(dropIdx, 0, draggedCard);

      // Update row assignment to match target card's row
      setCardRows(prev => {
        const targetRow = prev[targetId] || 1;
        if (prev[draggedId] !== targetRow) {
          return {
            ...prev,
            [draggedId]: targetRow
          };
        }
        return prev;
      });

      setGame(prev => {
        if (!prev) return null;
        const updatedPlayers = prev.players.map((p, idx) => {
          if (idx === 0) {
            return { ...p, cards };
          }
          return p;
        });
        return { ...prev, players: updatedPlayers };
      });
    }
  };

  const handleCardDropToRow = (draggedId: string, rowNum: 1 | 2) => {
    if (!game) return;

    // 1. Update the row assignment state
    setCardRows(prev => ({
      ...prev,
      [draggedId]: rowNum
    }));

    // 2. Adjust position in master cards list
    const cards = [...game.players[0].cards];
    const dragIdx = cards.findIndex(c => c.id === draggedId);
    if (dragIdx !== -1) {
      const [draggedCard] = cards.splice(dragIdx, 1);
      
      const getRow = (id: string) => {
        if (id === draggedId) return rowNum;
        return cardRows[id] || 1;
      };

      const rowCardIndices = cards
        .map((c, idx) => ({ id: c.id, idx }))
        .filter(item => getRow(item.id) === rowNum);

      if (rowCardIndices.length > 0) {
        const lastIdxOfRow = rowCardIndices[rowCardIndices.length - 1].idx;
        cards.splice(lastIdxOfRow + 1, 0, draggedCard);
      } else {
        if (rowNum === 1) {
          cards.unshift(draggedCard);
        } else {
          cards.push(draggedCard);
        }
      }

      setGame(prev => {
        if (!prev) return null;
        const updatedPlayers = prev.players.map((p, idx) => {
          if (idx === 0) {
            return { ...p, cards };
          }
          return p;
        });
        return { ...prev, players: updatedPlayers };
      });
    }
  };

  const handleMoveSelectedLeft = () => {
    if (!game) return;
    const cards = [...game.players[0].cards];
    const row1Cards = cards.filter(c => (cardRows[c.id] || 1) === 1);
    const row2Cards = cards.filter(c => (cardRows[c.id] || 1) === 2);

    // Shift selected left in row1
    for (let i = 1; i < row1Cards.length; i++) {
      if (selectedCards[row1Cards[i].id] && !selectedCards[row1Cards[i - 1].id]) {
        const temp = row1Cards[i];
        row1Cards[i] = row1Cards[i - 1];
        row1Cards[i - 1] = temp;
      }
    }

    // Shift selected left in row2
    for (let i = 1; i < row2Cards.length; i++) {
      if (selectedCards[row2Cards[i].id] && !selectedCards[row2Cards[i - 1].id]) {
        const temp = row2Cards[i];
        row2Cards[i] = row2Cards[i - 1];
        row2Cards[i - 1] = temp;
      }
    }

    const newCards = [...row1Cards, ...row2Cards];
    setGame(prev => {
      if (!prev) return null;
      const updatedPlayers = prev.players.map((p, idx) => idx === 0 ? { ...p, cards: newCards } : p);
      return { ...prev, players: updatedPlayers };
    });
  };

  const handleMoveSelectedRight = () => {
    if (!game) return;
    const cards = [...game.players[0].cards];
    const row1Cards = cards.filter(c => (cardRows[c.id] || 1) === 1);
    const row2Cards = cards.filter(c => (cardRows[c.id] || 1) === 2);

    // Shift selected right in row1
    for (let i = row1Cards.length - 2; i >= 0; i--) {
      if (selectedCards[row1Cards[i].id] && !selectedCards[row1Cards[i + 1].id]) {
        const temp = row1Cards[i];
        row1Cards[i] = row1Cards[i + 1];
        row1Cards[i + 1] = temp;
      }
    }

    // Shift selected right in row2
    for (let i = row2Cards.length - 2; i >= 0; i--) {
      if (selectedCards[row2Cards[i].id] && !selectedCards[row2Cards[i + 1].id]) {
        const temp = row2Cards[i];
        row2Cards[i] = row2Cards[i + 1];
        row2Cards[i + 1] = temp;
      }
    }

    const newCards = [...row1Cards, ...row2Cards];
    setGame(prev => {
      if (!prev) return null;
      const updatedPlayers = prev.players.map((p, idx) => idx === 0 ? { ...p, cards: newCards } : p);
      return { ...prev, players: updatedPlayers };
    });
  };

  const handleMoveSelectedToUpperRow = () => {
    if (!game) return;
    const cards = [...game.players[0].cards];
    const row1Cards = cards.filter(c => (cardRows[c.id] || 1) === 1);
    const row2Cards = cards.filter(c => (cardRows[c.id] || 1) === 2);

    // Find selected cards in row 2
    const toMove = row2Cards.filter(c => selectedCards[c.id]);
    if (toMove.length === 0) return;

    // Remove from row 2
    const remainingRow2 = row2Cards.filter(c => !selectedCards[c.id]);
    // Add to row 1 (at the end)
    const newRow1 = [...row1Cards, ...toMove];

    // Update cardRows state for moved cards
    setCardRows(prev => {
      const next = { ...prev };
      toMove.forEach(c => {
        next[c.id] = 1;
      });
      return next;
    });

    const newCards = [...newRow1, ...remainingRow2];
    setGame(prev => {
      if (!prev) return null;
      const updatedPlayers = prev.players.map((p, idx) => idx === 0 ? { ...p, cards: newCards } : p);
      return { ...prev, players: updatedPlayers };
    });
  };

  const handleMoveSelectedToLowerRow = () => {
    if (!game) return;
    const cards = [...game.players[0].cards];
    const row1Cards = cards.filter(c => (cardRows[c.id] || 1) === 1);
    const row2Cards = cards.filter(c => (cardRows[c.id] || 1) === 2);

    // Find selected cards in row 1
    const toMove = row1Cards.filter(c => selectedCards[c.id]);
    if (toMove.length === 0) return;

    // Remove from row 1
    const remainingRow1 = row1Cards.filter(c => !selectedCards[c.id]);
    // Add to row 2 (at the beginning)
    const newRow2 = [...toMove, ...row2Cards];

    // Update cardRows state for moved cards
    setCardRows(prev => {
      const next = { ...prev };
      toMove.forEach(c => {
        next[c.id] = 2;
      });
      return next;
    });

    const newCards = [...remainingRow1, ...newRow2];
    setGame(prev => {
      if (!prev) return null;
      const updatedPlayers = prev.players.map((p, idx) => idx === 0 ? { ...p, cards: newCards } : p);
      return { ...prev, players: updatedPlayers };
    });
  };

  // Player action: Play selected cards
  const handlePlaySelected = () => {
    if (!game || game.activePlayerIndex !== 0) return;

    const myHand = game.players[0].cards;
    const playList = myHand.filter(c => selectedCards[c.id] && c.value !== 'spacer');

    if (playList.length === 0) {
      alert(t('mustPlayValid'));
      return;
    }

    // Validate play combo
    const combo = analyzeCombination(playList, game.currentLevel);
    if (combo.type === 'invalid') {
      alert(t('invalidPlay'));
      return;
    }

    // Check if it beats the previous play
    if (game.lastPlay && !canBeat(playList, game.lastPlay, game.currentLevel)) {
      alert(t('invalidPlay'));
      return;
    }

    // Execute Play!
    executePlay(0, playList, combo.label, combo.labelZh, false);
  };

  // Player action: Pass / Check
  const handlePass = () => {
    if (!game || game.activePlayerIndex !== 0) return;
    if (!game.lastPlay) {
      alert(language === 'en' ? "You must lead a play, you cannot pass!" : "首出不能过牌！");
      return;
    }

    executePlay(0, [], 'Pass', '不要', true);
  };

  // Execute a play (could be human or bot)
  const executePlay = (
    seatIndex: number, 
    cardsPlayed: Card[], 
    typeEn: string, 
    typeZh: string, 
    isPass: boolean
  ) => {
    setGame(prev => {
      if (!prev) return null;

      const player = prev.players[seatIndex];

      // Filter hand
      let nextCards = player.cards.filter(c => !cardsPlayed.some(cp => cp.id === c.id));
      const hasRealCardsLeft = nextCards.some(c => c.value !== 'spacer');
      if (!hasRealCardsLeft) {
        nextCards = []; // if only spacers are left, clear them to treat it as empty
      }
      const hasFinishedNow = nextCards.length === 0 && !player.hasFinished;

      // Track finish order
      const currentFinishersCount = prev.players.filter(p => {
        if (p.hasFinished) return true;
        if (p.seat === seatIndex) return nextCards.length === 0;
        return p.cards.filter(c => c.value !== 'spacer').length === 0;
      }).length;

      // Create log
      const playAction: PlayAction = {
        id: `play-${Date.now()}-${seatIndex}`,
        playerId: player.id,
        playerName: player.displayName,
        team: player.team,
        cards: cardsPlayed,
        cardType: language === 'en' ? typeEn : typeZh,
        timestamp: new Date().toLocaleTimeString(),
        isPass,
      };

      // Update history and last play
      const updatedHistory = [playAction, ...prev.history];

      // Update player hand & stats
      const updatedPlayers = prev.players.map(p => {
        if (p.seat === seatIndex) {
          return {
            ...p,
            cards: nextCards,
            hasFinished: nextCards.length === 0 ? true : p.hasFinished,
            finishOrder: hasFinishedNow ? currentFinishersCount : p.finishOrder,
          };
        }
        return p;
      });

      // Check if Game Completed (All players on a team have finished, or only one player remains with cards)
      const finishedPlayers = updatedPlayers.filter(p => p.hasFinished);
      const isTeamAFinished = (updatedPlayers.find(p => p.seat === 0)?.hasFinished) && (updatedPlayers.find(p => p.seat === 2)?.hasFinished);
      const isTeamBFinished = (updatedPlayers.find(p => p.seat === 1)?.hasFinished) && (updatedPlayers.find(p => p.seat === 3)?.hasFinished);
      const gameFinished = finishedPlayers.length >= 3 || isTeamAFinished || isTeamBFinished;

      let gameStatus = prev.status;
      if (gameFinished) {
        gameStatus = 'ended';
      }

      // Determine next active player and handle trick clearing & "接风" (Jiefeng) rule
      let nextSeatIndex = (seatIndex + 1) % 4;
      let nextLastPlay = prev.lastPlay;
      if (!isPass) {
        nextLastPlay = playAction;
      }

      if (!gameFinished) {
        let foundNextPlayer = false;
        let safetyCounter = 0;

        while (!foundNextPlayer && safetyCounter < 10) {
          safetyCounter++;

          if (nextLastPlay) {
            const ownerPlayer = updatedPlayers.find(p => p.id === nextLastPlay?.playerId);
            const ownerSeat = ownerPlayer ? ownerPlayer.seat : -1;

            if (nextSeatIndex === ownerSeat) {
              // Trick completed! Everyone else passed.
              nextLastPlay = null; // Clear active trick

              if (ownerPlayer && !ownerPlayer.hasFinished) {
                foundNextPlayer = true;
              } else {
                // Owner finished -> "接风" (Jiefeng)! Owner's partner leads
                const partnerSeat = (ownerSeat + 2) % 4;
                const partnerPlayer = updatedPlayers[partnerSeat];

                if (!partnerPlayer.hasFinished) {
                  nextSeatIndex = partnerSeat;
                  foundNextPlayer = true;
                } else {
                  // Partner also finished, find next active player
                  let checkSeat = (partnerSeat + 1) % 4;
                  while (updatedPlayers[checkSeat].hasFinished && checkSeat !== partnerSeat) {
                    checkSeat = (checkSeat + 1) % 4;
                  }
                  nextSeatIndex = checkSeat;
                  foundNextPlayer = true;
                }
              }
              break;
            }
          }

          if (updatedPlayers[nextSeatIndex].hasFinished) {
            nextSeatIndex = (nextSeatIndex + 1) % 4;
          } else {
            foundNextPlayer = true;
          }
        }
      } else {
        // Fallback or end of game
        nextSeatIndex = (seatIndex + 1) % 4;
      }

      return {
        ...prev,
        players: updatedPlayers,
        activePlayerIndex: nextSeatIndex,
        lastPlay: nextLastPlay,
        history: updatedHistory,
        status: gameStatus,
      };
    });

    // Reset selected cards for human
    if (seatIndex === 0) {
      setSelectedCards({});
    }
  };

  // Bot Turn Simulator Loop
  useEffect(() => {
    if (!game || game.status !== 'playing' || game.activePlayerIndex < 0 || game.activePlayerIndex >= 4 || game.activePlayerIndex === 0) return;

    // Trigger bot play after a realistic short delay
    const timer = setTimeout(() => {
      const activeSeat = game.activePlayerIndex;
      if (activeSeat < 0 || activeSeat >= 4) return;
      const bot = game.players[activeSeat];
      if (!bot) return;

      // If the bot has already finished, skip their turn instantly
      if (bot.hasFinished) {
        setGame(prev => {
          if (!prev) return null;
          return {
            ...prev,
            activePlayerIndex: (activeSeat + 1) % 4
          };
        });
        return;
      }

      // Compute Bot Action
      const botMove = makeBotMove(bot.cards, game.lastPlay, game.currentLevel);

      if (botMove.isPass) {
        executePlay(activeSeat, [], 'Pass', '不要', true);
      } else {
        const combo = analyzeCombination(botMove.playCards, game.currentLevel);
        executePlay(activeSeat, botMove.playCards, combo.label, combo.labelZh, false);
      }

    }, 1200);

    return () => clearTimeout(timer);
  }, [game?.activePlayerIndex, game?.status]);

  // Automatically skip finished players' turns & handle "接风" (Wind Catching) rule
  useEffect(() => {
    if (!game || game.status !== 'playing') return;

    const activeSeat = game.activePlayerIndex;
    if (activeSeat < 0 || activeSeat >= 4) return;
    const activePlayer = game.players[activeSeat];
    if (!activePlayer) return;
    
    if (activePlayer.hasFinished) {
      setGame(prev => {
        if (!prev) return null;
        
        let nextSeat = (activeSeat + 1) % 4;
        let nextLastPlay = prev.lastPlay;

        // "接风" (Wind Catching) Rule:
        // If a player has finished and the lead is returned to them (i.e., lastPlay was theirs and everyone else passed,
        // which means lastPlay.playerId === activePlayer.id), then their partner gets the lead!
        if (prev.lastPlay && prev.lastPlay.playerId === activePlayer.id) {
          // Clear lastPlay (ends the trick)
          nextLastPlay = null;
          // Partner of active player leads!
          const partnerSeat = (activeSeat + 2) % 4;
          nextSeat = partnerSeat;
        } else {
          // Otherwise, normal skip. If the next seat is the owner of lastPlay, clear trick.
          if (nextLastPlay && nextLastPlay.playerId === prev.players[nextSeat].id) {
            nextLastPlay = null;
          }
        }

        return {
          ...prev,
          activePlayerIndex: nextSeat,
          lastPlay: nextLastPlay
        };
      });
    }
  }, [game?.activePlayerIndex, game?.status, game?.lastPlay]);

  // Handle automatic scoring on game end
  useEffect(() => {
    if (game && game.status === 'ended' && game.scoringMode === 'auto' && !showScoringModal) {
      // Find completion order of players
      const orderedPlayers = [...game.players]
        .filter(p => p.hasFinished)
        .sort((a, b) => (a.finishOrder || 0) - (b.finishOrder || 0))
        .map(p => p.seat.toString() as '0' | '1' | '2' | '3');

      // Add remaining player to the end
      game.players.forEach(p => {
        if (!p.hasFinished) {
          orderedPlayers.push(p.seat.toString() as '0' | '1' | '2' | '3');
        }
      });

      const scoreResult = calculateGameScore(orderedPlayers);
      
      // Update levels in state and show scoring confirmation modal
      setManualWinner(scoreResult.winningTeam);
      setManualAdvance(scoreResult.levelAdvance);
      setManualNotes(language === 'en' ? scoreResult.scoreText : scoreResult.scoreTextZh);
      setShowScoringModal(true);
    }
  }, [game?.status]);

  // Confirm and save score sheet
  const handleConfirmScore = () => {
    if (!game) return;

    // Determine completion order to find winner and last finisher
    const orderedPlayers = [...game.players]
      .filter(p => p.hasFinished)
      .sort((a, b) => (a.finishOrder || 0) - (b.finishOrder || 0))
      .map(p => p.seat);

    game.players.forEach(p => {
      if (!p.hasFinished) {
        orderedPlayers.push(p.seat);
      }
    });

    const winnerSeat = orderedPlayers[0] !== undefined ? orderedPlayers[0] : 0;
    const finisherSeat = orderedPlayers[3] !== undefined ? orderedPlayers[3] : 3;

    setLastWinnerSeat(winnerSeat);
    setLastFinisherSeat(finisherSeat);
    setLastOrderedSeats(orderedPlayers);

    const nextLevelValue = getNextLevel(game.currentLevel, manualAdvance);

    const scoreRecord: ScoreRecord = {
      id: `score-${Date.now()}`,
      gameId: game.id,
      roomName: language === 'en' 
        ? `${SOLAR_TERMS[selectedRoomId! - 1].nameEn}` 
        : `${SOLAR_TERMS[selectedRoomId! - 1].nameZh}`,
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
      teamAName: teamAName,
      teamBName: teamBName,
      teamAScoreChange: manualWinner === 'A' ? manualAdvance : 0,
      teamBScoreChange: manualWinner === 'B' ? manualAdvance : 0,
      teamAFinalLevel: manualWinner === 'A' ? nextLevelValue : (game.scores?.teamALevel || game.currentLevel),
      teamBFinalLevel: manualWinner === 'B' ? nextLevelValue : (game.scores?.teamBLevel || game.currentLevel),
      winningTeam: manualWinner,
      scoringMode: scoringMode,
      notes: manualNotes,
    };

    onRecordGame(scoreRecord);
    setShowScoringModal(false);

    // Update game to ended lobby state with updated scoreboard values
    setGame(prev => {
      if (!prev) return null;

      const prevA = prev.scores?.teamALevel || '2';
      const prevB = prev.scores?.teamBLevel || '2';

      let nextLevelA = manualWinner === 'A' ? advanceScoreboardLevel(prevA, manualAdvance) : prevA;
      let nextLevelB = manualWinner === 'B' ? advanceScoreboardLevel(prevB, manualAdvance) : prevB;

      let teamAScoreAdd = 0;
      let teamBScoreAdd = 0;

      if (nextLevelA === '🏆') {
        teamAScoreAdd = 1;
        nextLevelA = '2';
        nextLevelB = '2';
      } else if (nextLevelB === '🏆') {
        teamBScoreAdd = 1;
        nextLevelA = '2';
        nextLevelB = '2';
      }

      // Map level value for the active deck generator (e.g. if A1, A2, A3, level card is 'A')
      const activeLevelValue = nextLevelA.startsWith('A') ? 'A' : nextLevelA;

      return {
        ...prev,
        currentLevel: activeLevelValue,
        status: 'lobby',
        scores: {
          teamAScore: (prev.scores?.teamAScore || 0) + teamAScoreAdd,
          teamBScore: (prev.scores?.teamBScore || 0) + teamBScoreAdd,
          teamALevel: nextLevelA,
          teamBLevel: nextLevelB,
        }
      };
    });
  };

  // Color generator for Card suits
  const getSuitColor = (suit: Suit) => {
    if (suit === 'hearts' || suit === 'diamonds') return 'text-red-600';
    if (suit === 'spades' || suit === 'clubs') return 'text-slate-900';
    return 'text-amber-600'; // Jokers
  };

  // Render suit icons
  const renderSuitIcon = (suit: Suit, val: string) => {
    if (suit === 'hearts') return '♥️';
    if (suit === 'diamonds') return '♦️';
    if (suit === 'spades') return '♠️';
    if (suit === 'clubs') return '♣️';
    if (val === 'red_joker') return '🃏🟥';
    return '🃏⬛';
  };

  const renderPlayerHandCard = (card: Card, cards: Card[], globalIdx: number) => {
    const isSel = !!selectedCards[card.id];
    const isDragged = draggedCardId === card.id;
    const isDragOver = dragOverCardId === card.id;

    if (card.value === 'spacer') {
      return (
        <motion.div
          key={card.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', card.id);
            setDraggedCardId(card.id);
          }}
          onDragEnd={() => {
            setDraggedCardId(null);
            setDragOverCardId(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragOverCardId !== card.id) {
              setDragOverCardId(card.id);
            }
          }}
          onDragLeave={() => {
            if (dragOverCardId === card.id) {
              setDragOverCardId(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId) {
              handleCardDrop(draggedId, card.id);
            }
            setDragOverCardId(null);
          }}
          onClick={() => toggleSelectCard(card.id)}
          className={`w-12 h-18 sm:w-14 sm:h-22 bg-slate-900/60 rounded-xl border-2 border-dashed flex flex-col items-center justify-between p-1 cursor-pointer relative group transition-all duration-200 ${isSel ? '-translate-y-4 ring-2 ring-emerald-500 shadow-emerald-500/20 border-emerald-500' : 'border-slate-700/60'} ${isDragged ? 'opacity-40' : ''} ${isDragOver ? 'border-emerald-400 scale-105' : ''}`}
          style={{ zIndex: globalIdx }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="w-full flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setGame(prev => {
                  if (!prev) return null;
                  const updatedPlayers = prev.players.map((p, idx) => {
                    if (idx === 0) {
                      return { ...p, cards: p.cards.filter(c => c.id !== card.id) };
                    }
                    return p;
                  });
                  return { ...prev, players: updatedPlayers };
                });
              }}
              className="text-slate-400 hover:text-red-400 p-0.5 rounded transition absolute top-0.5 right-0.5 z-10"
              title={language === 'zh' ? '删除空格' : 'Remove gap'}
            >
              <span className="text-[10px] font-bold">✕</span>
            </button>
          </div>
          <div className="text-center text-[10px] sm:text-xs text-slate-500 font-mono select-none font-bold">
            {language === 'zh' ? '空格' : 'GAP'}
          </div>
          <div></div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key={card.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', card.id);
          setDraggedCardId(card.id);
        }}
        onDragEnd={() => {
          setDraggedCardId(null);
          setDragOverCardId(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (dragOverCardId !== card.id) {
            setDragOverCardId(card.id);
          }
        }}
        onDragLeave={() => {
          if (dragOverCardId === card.id) {
            setDragOverCardId(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData('text/plain');
          if (draggedId) {
            handleCardDrop(draggedId, card.id);
          }
          setDragOverCardId(null);
        }}
        onClick={() => toggleSelectCard(card.id)}
        className={(() => {
          let extra = '';
          if (tribute && tribute.isActive) {
            const humanReturnItem = tribute.items.find(it => it.receiverSeat === 0 && it.status === 'pending_return');
            if (humanReturnItem) {
              const eligible = isEligibleReturnCard(card, game?.currentLevel || '2');
              if (eligible) {
                extra = "ring-2 ring-amber-400 border-amber-400 shadow-amber-400/25";
              } else {
                extra = "opacity-25 grayscale pointer-events-none";
              }
            } else {
              extra = "opacity-25 grayscale pointer-events-none";
            }
          } else {
            extra = isSel ? '-translate-y-4 ring-2 ring-emerald-500 shadow-emerald-500/20' : 'hover:-translate-y-2';
          }
          return `w-12 h-18 sm:w-14 sm:h-22 bg-white rounded-xl border border-slate-200 shadow-md flex flex-col justify-between p-1.5 cursor-pointer select-none transition-all duration-200 ${extra} ${isDragged ? 'opacity-40' : ''} ${isDragOver ? 'border-emerald-400 scale-105' : ''}`;
        })()}
        style={{ zIndex: globalIdx }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Top rank value and suit */}
        <div className="flex flex-col items-start leading-none">
          <span className={`text-[11px] sm:text-xs font-black ${getSuitColor(card.suit)}`}>
            {card.value === 'red_joker' ? 'RJ' : card.value === 'black_joker' ? 'BJ' : card.value}
          </span>
          <span className="text-[9px] sm:text-[10px] mt-0.5">
            {card.suit !== 'jokers' && renderSuitIcon(card.suit, card.value)}
          </span>
        </div>

        {/* Center decorative suit / status icon */}
        <div className="text-center">
          {card.isWild ? (
            <span className="text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded-full font-bold uppercase leading-none">WILD</span>
          ) : card.isLevelCard ? (
            <span className="text-[8px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full font-bold uppercase leading-none font-sans">LEVEL</span>
          ) : (
            <span className="text-[14px] sm:text-[16px] opacity-70">
              {renderSuitIcon(card.suit, card.value)}
            </span>
          )}
        </div>

        {/* Bottom reversed rank */}
        <div className="flex items-end justify-end leading-none rotate-180">
          <span className={`text-[11px] sm:text-xs font-black ${getSuitColor(card.suit)}`}>
            {card.value === 'red_joker' ? 'RJ' : card.value === 'black_joker' ? 'BJ' : card.value}
          </span>
        </div>
      </motion.div>
    );
  };

  const renderSelectionSeatButton = (seatIndex: 0 | 1 | 2 | 3) => {
    const occupiedPlayer = seatedPlayers.find(p => p.seat === seatIndex);

    if (occupiedPlayer) {
      return (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl w-36 text-center shadow-md relative min-h-[100px] flex flex-col justify-center items-center">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-1">
            <span className="text-xs">👤</span>
          </div>
          <span className="text-xs font-bold text-slate-300 block truncate w-full">{occupiedPlayer.displayName}</span>
          <span className="text-[8px] font-mono text-slate-500 uppercase block mt-0.5">
            {occupiedPlayer.isBot ? (language === 'zh' ? '电脑机器人' : 'AI Bot') : (language === 'zh' ? '玩家已占' : 'Occupied')}
          </span>
        </div>
      );
    }

    return (
      <button
        onClick={() => {
          const newPlayer = {
            id: currentUser.id,
            displayName: currentUser.displayName,
            seat: seatIndex,
            team: (seatIndex === 0 || seatIndex === 2) ? ('A' as const) : ('B' as const),
            isBot: false,
          };
          const nextSeated = [...seatedPlayers, newPlayer].sort((a, b) => a.seat - b.seat);
          updateSeatedPlayersLocally(nextSeated);
          setLoungeMode('wait');

          // Update global room lists
          const updatedRooms = rooms.map(r => {
            if (r.id === selectedRoomId) {
              return {
                ...r,
                currentPlayerCount: nextSeated.length,
                players: nextSeated.map(p => p.id),
                seatedPlayers: nextSeated,
                status: nextSeated.length >= 4 ? ('Full' as const) : ('Waiting' as const),
              };
            }
            return r;
          });
          updateRooms(updatedRooms, selectedRoomId);
        }}
        className="border border-dashed border-teal-500/20 bg-teal-500/5 hover:bg-teal-500/10 hover:border-teal-500/50 p-4 rounded-2xl w-36 text-center flex flex-col items-center justify-center min-h-[100px] cursor-pointer transition group shadow-inner"
      >
        <span className="text-xs font-bold text-teal-400 group-hover:scale-105 transition-transform">
          {language === 'zh' ? '👉 点此入座' : '👉 Sit Here'}
        </span>
        <span className="text-[8px] font-mono text-teal-500/60 uppercase mt-1">
          {language === 'zh' ? '空置位置' : 'EMPTY SEAT'}
        </span>
      </button>
    );
  };

  const renderLoungeSeat = (player: typeof seatedPlayers[number] | undefined, seatIndex: 1 | 2 | 3) => {
    if (!player) {
      return (
        <div className="border border-dashed border-slate-800 bg-slate-950/40 p-4 rounded-2xl w-36 text-center flex flex-col items-center justify-center min-h-[110px] space-y-2">
          <span className="text-[10px] text-slate-600 italic font-mono uppercase tracking-wider">{language === 'zh' ? '等待玩家...' : 'Waiting...'}</span>
          <button
            onClick={() => {
              const botNames = {
                1: language === 'zh' ? '智多星电脑' : 'AlphaBot',
                2: language === 'zh' ? '大将军对家' : 'OmegaBot (Partner)',
                3: language === 'zh' ? '无双刀电脑' : 'SigmaBot'
              };
              const next = seatedPlayers.filter(p => p.seat !== seatIndex);
              next.push({
                id: `bot-${seatIndex}-${Date.now()}`,
                displayName: botNames[seatIndex],
                seat: seatIndex,
                team: seatIndex === 2 ? ('A' as const) : ('B' as const),
                isBot: true
              });
              const finalSeated = next.sort((a, b) => a.seat - b.seat);
              updateSeatedPlayersLocally(finalSeated);

              const updatedRooms = rooms.map(r => {
                if (r.id === selectedRoomId) {
                  return {
                    ...r,
                    currentPlayerCount: finalSeated.length,
                    players: finalSeated.map(p => p.id),
                    seatedPlayers: finalSeated,
                    status: finalSeated.length >= 4 ? ('Full' as const) : ('Waiting' as const),
                  };
                }
                return r;
              });
              updateRooms(updatedRooms, selectedRoomId);
            }}
            className="text-[9px] font-bold text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20 hover:bg-teal-500/25 transition uppercase"
          >
            + {language === 'zh' ? '电脑' : 'Bot'}
          </button>
        </div>
      );
    }

    return (
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl w-36 text-center shadow-lg relative min-h-[110px] flex flex-col justify-between">
        {/* Kick button */}
        <button
          onClick={() => handleKickPlayer(seatIndex)}
          className="absolute top-1.5 right-1.5 text-slate-500 hover:text-red-400 transition"
          title={language === 'zh' ? '踢出座位' : 'Kick player'}
        >
          <span className="text-xs">✕</span>
        </button>
        <div>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
              {player.isBot ? '🤖' : 'P'}
            </span>
          </div>
          <span className="text-xs font-bold text-slate-200 block truncate">{player.displayName}</span>
          <span className="text-[8px] font-mono text-slate-500 block uppercase mt-0.5">
            {player.isBot ? (language === 'zh' ? '电脑机器人' : 'AI Bot') : (language === 'zh' ? '在线玩家' : 'Online Player')}
          </span>
        </div>
      </div>
    );
  };

  const renderPlayerVideo = (seatIndex: number) => {
    // If the room doesn't support video or if game doesn't exist, return null
    if (!game) return null;

    const player = game.players[seatIndex];
    if (!player) return null;

    const isSelf = seatIndex === 0;
    const isVoiceOn = micActive;
    const isVideoOn = camActive;

    // Simulated talking if bot is active player in play state
    const isTalking = !isSelf && game.activePlayerIndex === seatIndex && game.status === 'playing';

    return (
      <div className="relative w-36 h-24 bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden shadow-md flex items-center justify-center group">
        {isSelf ? (
          // Real User Camera Feed
          isVideoOn ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover rounded-2xl"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-600">
              <VideoOff className="w-6 h-6 mb-1 text-red-500/50" />
              <span className="text-[9px] font-mono tracking-wider">CAMERA MUTED</span>
            </div>
          )
        ) : (
          // Simulated Bot Video Feed
          isVideoOn ? (
            <div className="relative w-full h-full flex items-center justify-center bg-slate-900/60 overflow-hidden">
              {/* Nice camera styling/scanlines */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none z-10"></div>
              
              {/* Bot Avatar or dynamic representation */}
              <div className="relative z-10 flex flex-col items-center space-y-1.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all duration-300 ${isTalking ? 'bg-teal-500/20 border-teal-400 scale-105 shadow-lg shadow-teal-500/20' : 'bg-slate-850 border-slate-700'}`}>
                  <span className="text-xs font-black text-slate-300 font-mono">
                    {seatIndex === 1 ? 'P2' : seatIndex === 2 ? 'P3' : 'P4'}
                  </span>
                </div>
                {/* Simulated active speech bars */}
                {isTalking && (
                  <div className="flex items-center space-x-0.5 h-3">
                    <span className="w-0.5 h-1.5 bg-teal-400 rounded animate-[pulse_0.8s_infinite]"></span>
                    <span className="w-0.5 h-2.5 bg-teal-400 rounded animate-[pulse_0.5s_infinite_0.1s]"></span>
                    <span className="w-0.5 h-1.5 bg-teal-400 rounded animate-[pulse_0.7s_infinite_0.2s]"></span>
                  </div>
                )}
              </div>

              {/* Grid scanning background */}
              <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(18,185,129,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(18,185,129,0.15)_1px,transparent_1px)] bg-[size:8px_8px] pointer-events-none"></div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-600">
              <VideoOff className="w-6 h-6 mb-1 text-slate-700" />
              <span className="text-[9px] font-mono tracking-wider text-slate-700">OFFLINE</span>
            </div>
          )
        )}

        {/* Video Overlays (REC indicator, Name, Mic badge) */}
        {isVideoOn && (
          <>
            {/* Blinking REC indicator */}
            <div className="absolute top-2 left-2 flex items-center space-x-1 bg-slate-950/60 px-1.5 py-0.5 rounded-full text-[8px] font-mono tracking-tight font-bold text-white z-20 border border-slate-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              <span>LIVE</span>
            </div>

            {/* Mic Overlay badge */}
            <div className="absolute bottom-2 right-2 z-20">
              {isSelf ? (
                isVoiceOn ? (
                  <span className="bg-emerald-500/25 border border-emerald-500/40 p-1 rounded-lg text-emerald-400 block">
                    <Mic className="w-3 h-3" />
                  </span>
                ) : (
                  <span className="bg-red-500/25 border border-red-500/40 p-1 rounded-lg text-red-400 block">
                    <MicOff className="w-3 h-3" />
                  </span>
                )
              ) : (
                // Bot mic indicator: active when talking, muted when not
                isVoiceOn ? (
                  <span className={`p-1 rounded-lg border transition-colors block ${isTalking ? 'bg-teal-500/25 border-teal-400 text-teal-400' : 'bg-slate-850/60 border-slate-800 text-slate-500'}`}>
                    <Mic className="w-3 h-3" />
                  </span>
                ) : (
                  <span className="bg-red-500/25 border border-red-500/40 p-1 rounded-lg text-red-400 block">
                    <MicOff className="w-3 h-3" />
                  </span>
                )
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderTrickPlayBox = (seatIndex: number) => {
    if (!game) return null;
    const act = getPlayerCurrentTrickPlay(seatIndex);
    const isTheirTurn = game.activePlayerIndex === seatIndex;
    const player = game.players[seatIndex];

    if (player.hasFinished) {
      return (
        <div className="w-32 py-2 px-3 bg-slate-900/40 border border-slate-800 rounded-xl text-center flex flex-col items-center justify-center h-14">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            {language === 'zh' ? `已出完 (#${player.finishOrder})` : `Finished (#${player.finishOrder})`}
          </span>
        </div>
      );
    }

    if (act) {
      return (
        <div className="bg-slate-900/95 border border-emerald-900/40 p-2 rounded-xl text-center shadow-lg min-w-[120px] h-14 flex flex-col justify-center">
          {act.isPass ? (
            <span className="text-xs font-black text-slate-500 italic uppercase">PASS</span>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">{act.cardType}</span>
              <div className="flex space-x-1 mt-1">
                {act.cards.map((c, i) => (
                  <span key={i} className={`text-[10px] font-black px-1.5 py-0.5 bg-white rounded shadow ${getSuitColor(c.suit)}`}>
                    {c.value === 'red_joker' ? 'RJ' : c.value === 'black_joker' ? 'BJ' : c.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (isTheirTurn) {
      return (
        <div className="w-32 py-2 px-3 bg-teal-500/10 border border-teal-500/30 rounded-xl text-center flex flex-col items-center justify-center h-14 animate-pulse">
          <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest">
            {language === 'zh' ? '思考中...' : 'Thinking...'}
          </span>
        </div>
      );
    }

    return (
      <div className="w-32 py-2 px-3 border border-dashed border-slate-800 rounded-xl text-center flex flex-col items-center justify-center h-14 opacity-50">
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
          {language === 'zh' ? '等待出牌' : 'Waiting...'}
        </span>
      </div>
    );
  };

  const renderScoreboard = () => {
    if (!game) return null;

    const redLevel = game.scores?.teamALevel || '2';
    const blueLevel = game.scores?.teamBLevel || '2';

    const redIdx = SCOREBOARD_SEQUENCE.indexOf(redLevel);
    const blueIdx = SCOREBOARD_SEQUENCE.indexOf(blueLevel);

    const renderTeamGrid = (team: 'A' | 'B', currentIdx: number) => {
      const isRed = team === 'A';
      const activeColor = isRed ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20 font-black scale-105' : 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20 font-black scale-105';
      const pastColor = isRed ? 'bg-red-500/10 text-red-400 border-red-500/20 font-bold' : 'bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold';
      const futureColor = 'bg-slate-950 text-slate-500 border-slate-850 hover:bg-slate-900/40 transition duration-150';

      const renderCell = (levelKey: string, display: string, seqIdx: number) => {
        const isActive = seqIdx === currentIdx;
        const isPast = seqIdx < currentIdx;
        let cellClass = futureColor;

        if (isActive) {
          cellClass = activeColor;
        } else if (isPast) {
          cellClass = pastColor;
        }

        return (
          <div 
            key={levelKey} 
            className={`h-8 flex items-center justify-center text-[10px] md:text-xs border rounded-lg ${cellClass}`}
            title={`${isRed ? teamAName : teamBName}: ${display}`}
          >
            {display}
          </div>
        );
      };

      const firstRow = SCOREBOARD_LEVELS.slice(0, 8);
      const secondRow = SCOREBOARD_LEVELS.slice(8, 16);

      return (
        <div className="flex-1 space-y-1.5 max-w-sm md:max-w-md">
          {/* Row 1 */}
          <div className="grid grid-cols-8 gap-1.5">
            {firstRow.map((item, idx) => renderCell(item.key, item.display, idx))}
          </div>
          {/* Row 2 */}
          <div className="grid grid-cols-8 gap-1.5">
            {secondRow.map((item, idx) => renderCell(item.key, item.display, idx + 8))}
          </div>
        </div>
      );
    };

    const displayRedLevel = redLevel.startsWith('A') ? (redLevel === 'A' ? 'A' : redLevel.replace('A', 'A_')) : redLevel;
    const displayBlueLevel = blueLevel.startsWith('A') ? (blueLevel === 'A' ? 'A' : blueLevel.replace('A', 'A_')) : blueLevel;

    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-850">
          <div className="flex items-center space-x-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-300">
              {language === 'zh' ? '比赛大局计分板' : 'MATCH SCOREBOARD'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {language === 'zh' ? '率先通过A级并夺冠（🏆）即可获胜' : 'First to clear level A and win (🏆) wins the match'}
          </span>
        </div>

        {/* Content row */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Red Team Area */}
          <div className="flex items-center space-x-4 w-full lg:w-auto flex-1 justify-end">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-black text-red-400 block truncate max-w-[120px]">{teamAName}</span>
              <span className="text-[9px] font-mono text-slate-500 block">Team A</span>
            </div>
            {renderTeamGrid('A', redIdx)}
            <div className="w-12 h-12 md:w-14 md:h-14 bg-red-600 rounded-xl flex items-center justify-center border-2 border-red-500 shadow-md shadow-red-600/30 flex-shrink-0 text-white font-black text-xl md:text-2xl">
              {displayRedLevel}
            </div>
          </div>

          {/* Center Total Score */}
          <div className="flex flex-col items-center justify-center flex-shrink-0 bg-slate-950/40 border border-slate-850 px-4 py-2.5 rounded-xl min-w-[100px]">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
              {language === 'zh' ? '总比分' : 'TOTAL MATCHES'}
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-black text-red-500">{game.scores?.teamAScore || 0}</span>
              <span className="text-xs font-black text-slate-600">:</span>
              <span className="text-lg font-black text-blue-500">{game.scores?.teamBScore || 0}</span>
            </div>
          </div>

          {/* Blue Team Area */}
          <div className="flex items-center space-x-4 w-full lg:w-auto flex-1 justify-start">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-600 rounded-xl flex items-center justify-center border-2 border-blue-500 shadow-md shadow-blue-600/30 flex-shrink-0 text-white font-black text-xl md:text-2xl">
              {displayBlueLevel}
            </div>
            {renderTeamGrid('B', blueIdx)}
            <div className="text-left hidden sm:block">
              <span className="text-xs font-black text-blue-400 block truncate max-w-[120px]">{teamBName}</span>
              <span className="text-[9px] font-mono text-slate-500 block">Team B</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* HEADER BAR */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-2 rounded-xl shadow-lg">
            <span className="text-xl font-bold text-slate-950">掼</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">{t('title')}</h1>
            <p className="text-xs text-slate-400 font-mono hidden md:block">{t('subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Rules trigger */}
          <button 
            onClick={() => setShowRules(!showRules)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title={t('rulesTitle')}
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Bilingual Toggle */}
          <div className="flex bg-slate-800 p-1 rounded-lg text-xs font-mono">
            <button
              onClick={() => setLanguage('zh')}
              className={`px-2 py-1 rounded transition ${language === 'zh' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              中文
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 rounded transition ${language === 'en' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              EN
            </button>
          </div>

          {currentUser && (
            <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <UserIcon className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-slate-200">{currentUser.displayName}</span>
              <button 
                onClick={() => setCurrentUser(null)}
                className="text-slate-400 hover:text-red-400 transition ml-1"
                title={t('leaveLobby')}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* NOT AUTHENTICATED STATE */}
      {!currentUser && (
        <div className="max-w-md mx-auto py-16 px-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                {authMode === 'login' ? t('playerLogin') : t('registerTitle')}
              </h2>
              <p className="text-sm text-slate-400 mt-2">
                {authMode === 'login' ? t('dontHaveAccount') : t('alreadyHaveAccount')}{' '}
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setAuthError('');
                    setRegSuccess(false);
                  }}
                  className="text-emerald-400 hover:underline font-semibold"
                >
                  {authMode === 'login' ? t('applyNow') : t('loginNow')}
                </button>
              </p>
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-sm mb-6 font-medium">
                {authError}
              </div>
            )}

            {regSuccess && authMode === 'register' && (
              <div className="bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 p-4 rounded-xl text-sm mb-6 font-medium leading-relaxed">
                {new Date().getTime() < new Date(2026, 6, 26).getTime() ? (
                  language === 'zh' 
                    ? "🎉 注册成功！2026年7月26日前，新注册玩家无需管理员审核，您可以直接点击上方的“立即登录”进行登录。"
                    : "🎉 Registration successful! Before July 26, 2026, new players do not require admin approval. You can click 'Login Now' above to log in directly."
                ) : (
                  t('approvalNotice')
                )}
              </div>
            )}

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">{t('email')}</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="player@guandan.com"
                    className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl focus:border-emerald-500 focus:outline-none text-white placeholder-slate-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">{t('password')}</label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl focus:border-emerald-500 focus:outline-none text-white placeholder-slate-600 transition"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg hover:shadow-emerald-500/10 transition duration-300 flex items-center justify-center space-x-2"
                >
                  <span>{t('loginNow')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t('fullName')} *</label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t('nickname')} *</label>
                  <input
                    type="text"
                    required
                    value={regNickname}
                    onChange={(e) => setRegNickname(e.target.value)}
                    placeholder="GuanDanMaster"
                    className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t('email')} *</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t('phone')}</label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+123456789"
                    className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none text-white text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t('password')} *</label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t('confirmPassword')} *</label>
                    <input
                      type="password"
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none text-white text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t('preferredLanguage')}</label>
                  <select
                    value={regLanguage}
                    onChange={(e) => setRegLanguage(e.target.value as 'en' | 'zh')}
                    className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none text-white text-sm"
                  >
                    <option value="zh">中文 (Chinese)</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t('invitationCode')}</label>
                  <input
                    type="text"
                    value={regInvitationCode}
                    onChange={(e) => setRegInvitationCode(e.target.value)}
                    placeholder="GD-2026"
                    className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none text-white text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-3.5 rounded-xl transition shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>{t('submitApplication')}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* PLAYER IS LOGGED IN - SHOW LOBBY OR GAME ROOM */}
      {currentUser && (
        <main className="max-w-7xl mx-auto px-4 py-8">
          
          {/* LOBBY VIEW (NO SELECTED ROOM) */}
          {!selectedRoomId ? (
            <div className="space-y-8">
              
              {/* Welcome banner */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-800 rounded-3xl p-8 relative overflow-hidden shadow-xl">
                <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="max-w-2xl relative z-10">
                  <span className="text-xs font-bold text-emerald-400 font-mono tracking-widest uppercase bg-emerald-500/10 px-3 py-1 rounded-full">{t('welcome')}</span>
                  <h2 className="text-3xl font-extrabold text-white tracking-tight mt-3">{currentUser.displayName}</h2>
                  <p className="text-slate-300 mt-2 text-sm leading-relaxed">{t('lobbyDesc')}</p>
                </div>
              </div>

              {/* Lobby grid */}
              <div>
                <h3 className="text-xl font-bold text-white mb-4 tracking-tight flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <span>{t('lobbyTitle')}</span>
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {rooms.map((room) => {
                    const statusText = room.currentPlayerCount >= 4 ? t('gameInProgress') : t('waitingPlayers');
                    const statusColor = room.currentPlayerCount >= 4 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

                    return (
                      <div 
                        key={room.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 hover:shadow-xl transition flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-slate-500">#{room.id.toString().padStart(2, '0')}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                              {statusText}
                            </span>
                          </div>
                          <h4 className="text-lg font-bold text-white mt-2.5">
                            {language === 'en' ? room.nameEn : room.nameZh}
                          </h4>
                          <div className="mt-4 space-y-2 text-sm text-slate-400">
                            <div className="flex items-center justify-between">
                              <span>{t('playersInRoom')}</span>
                              <span className="font-mono font-bold text-slate-200">{room.currentPlayerCount} / 4</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span>{t('voiceChat')} / {t('videoChat')}</span>
                              <span className="font-medium text-emerald-400 flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
                                {t('active')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-slate-800 space-y-2">
                          <button
                            onClick={() => handleJoinRoom(room.id)}
                            disabled={room.currentPlayerCount >= 4}
                            className={`w-full py-2.5 rounded-xl font-bold text-xs tracking-wide uppercase transition ${room.currentPlayerCount >= 4 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/5'}`}
                          >
                            {room.currentPlayerCount >= 4 ? t('gameInProgress') : t('joinRoom')}
                          </button>
                          {currentUser && currentUser.role === 'admin' && (
                            <button
                              onClick={() => handleResetRoom(room.id)}
                              className="w-full py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/20 text-red-400 text-[10px] font-bold uppercase transition flex items-center justify-center space-x-1"
                            >
                              <span>{language === 'zh' ? '管理员重置房间' : 'Admin Reset Room'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : !game ? (
            
            /* LOUNGE SCREEN */
            <div className="space-y-6">
              {loungeMode === 'select_seat' ? (
                <div className="max-w-4xl mx-auto space-y-8">
                  {/* Back button */}
                  <button
                    onClick={handleLeaveRoom}
                    className="text-xs font-mono font-bold text-slate-400 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl hover:text-white hover:border-slate-700 transition flex items-center space-x-1"
                  >
                    <span>← {language === 'zh' ? '返回大厅' : 'Back to Lobby'}</span>
                  </button>

                  <div className="text-center space-y-3">
                    <span className="text-[10px] font-bold text-teal-400 font-mono tracking-widest uppercase px-2.5 py-1 bg-teal-500/10 rounded-full border border-teal-500/20">
                      {language === 'zh' ? '选择座位' : 'SEAT SELECTION'}
                    </span>
                    <h2 className="text-3xl font-black text-white tracking-tight">
                      {language === 'zh' ? '选择您的游戏席位' : 'Choose Your Playing Seat'}
                    </h2>
                    <p className="text-sm text-slate-400 max-w-lg mx-auto">
                      {language === 'zh' 
                        ? '请在下方示意图中选择一个空置的座位入座。首位进入的玩家默认在南座，您可以选择与盟友同组（北座）或作为对手加入（东、西座）。' 
                        : 'Please choose an empty seat from the diagram below. The first player sits at South, you can join your partner at North or play as an opponent at East or West.'}
                    </p>
                  </div>

                  {/* Seat Selection Diagram */}
                  <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-850 rounded-3xl p-10 shadow-xl text-center relative overflow-hidden max-w-2xl mx-auto">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.03)_0%,transparent_70%)] pointer-events-none"></div>

                    <div className="grid grid-cols-3 gap-6 py-6 items-center">
                      {/* NORTH - Seat 2 */}
                      <div></div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase mb-1">{language === 'zh' ? '北座 (盟友)' : 'North (Partner)'}</span>
                        {renderSelectionSeatButton(2)}
                      </div>
                      <div></div>

                      {/* WEST (Seat 3) and EAST (Seat 1) */}
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase mb-1">{language === 'zh' ? '西座 (对手)' : 'West (Opponent)'}</span>
                        {renderSelectionSeatButton(3)}
                      </div>
                      
                      <div className="flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-teal-500/30 bg-teal-500/5 flex items-center justify-center font-bold text-teal-400/80 text-sm font-mono tracking-wider">
                          GD
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase mb-1">{language === 'zh' ? '东座 (对手)' : 'East (Opponent)'}</span>
                        {renderSelectionSeatButton(1)}
                      </div>

                      {/* SOUTH - Seat 0 */}
                      <div></div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase mb-1">{language === 'zh' ? '南座 (自己)' : 'South (Me)'}</span>
                        {renderSelectionSeatButton(0)}
                      </div>
                      <div></div>
                    </div>
                  </div>
                </div>
              ) : loungeMode === 'choose' ? (
                <div className="max-w-4xl mx-auto space-y-8">
                  {/* Back button */}
                  <button
                    onClick={handleLeaveRoom}
                    className="text-xs font-mono font-bold text-slate-400 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl hover:text-white hover:border-slate-700 transition flex items-center space-x-1"
                  >
                    <span>← {language === 'zh' ? '返回大厅' : 'Back to Lobby'}</span>
                  </button>

                  <div className="text-center space-y-3">
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      {language === 'zh' ? '准备进入掼蛋桌' : 'Prepare for Guandan Table'}
                    </h2>
                    <p className="text-sm text-slate-400 max-w-lg mx-auto">
                      {language === 'zh' 
                        ? '请选择您想要的游戏模式。您可以直接与电脑机器人打牌，也可以在大厅中等待其他玩家或好友加入。' 
                        : 'Please select your preferred game mode. You can play directly with AI bots, or wait for other players to join.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    {/* Option 1: Direct Play with Bots */}
                    <motion.div
                      whileHover={{ y: -4, scale: 1.01 }}
                      onClick={() => {
                        const botNames = {
                          1: language === 'zh' ? '智多星电脑' : 'AlphaBot',
                          2: language === 'zh' ? '大将军对家' : 'OmegaBot (Partner)',
                          3: language === 'zh' ? '无双刀电脑' : 'SigmaBot'
                        };
                        const finalPlayers = [
                          { id: currentUser.id, displayName: currentUser.displayName, seat: 0 as const, team: 'A' as const, isBot: false },
                          { id: 'bot-1', displayName: botNames[1], seat: 1 as const, team: 'B' as const, isBot: true },
                          { id: 'bot-2', displayName: botNames[2], seat: 2 as const, team: 'A' as const, isBot: true },
                          { id: 'bot-3', displayName: botNames[3], seat: 3 as const, team: 'B' as const, isBot: true }
                        ];
                        updateSeatedPlayersLocally(finalPlayers);
                        initGame(selectedRoomId, finalPlayers);
                      }}
                      className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-850 rounded-3xl p-8 cursor-pointer hover:border-emerald-500/50 transition-all flex flex-col justify-between h-[300px] text-left group shadow-xl"
                    >
                      <div className="space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                          <Cpu className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                            {language === 'zh' ? '直接与电脑对战' : 'Play Directly with AI'}
                          </h3>
                          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                            {language === 'zh' 
                              ? '立即开始！系统将为您自动匹配三位智能电脑机器人（一位盟友、两位对手），让您无需等待即可畅快掼蛋。' 
                              : 'Start instantly! The system will seat 3 smart AI bots (1 partner, 2 opponents) so you can enjoy playing without any wait.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 group-hover:underline">
                        <span>{language === 'zh' ? '直接开局' : 'Start Playing'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </motion.div>

                    {/* Option 2: Wait for Players */}
                    <motion.div
                      whileHover={{ y: -4, scale: 1.01 }}
                      onClick={() => {
                        setLoungeMode('wait');
                        setAutoWaitActive(false);
                      }}
                      className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-850 rounded-3xl p-8 cursor-pointer hover:border-teal-500/50 transition-all flex flex-col justify-between h-[300px] text-left group shadow-xl"
                    >
                      <div className="space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/20 group-hover:bg-teal-500/20 transition-colors">
                          <Users className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white group-hover:text-teal-400 transition-colors">
                            {language === 'zh' ? '等待其他玩家加入' : 'Wait for Other Players'}
                          </h3>
                          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                            {language === 'zh' 
                              ? '进入等待室。该房间在首页大厅中仍可见，其他在线玩家可以随时加入您的房间，共同组队约局玩牌。' 
                              : 'Enter the waiting lounge. This room remains open and visible in the lobby for other players to join and team up with you.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 text-xs font-bold text-teal-400 group-hover:underline">
                        <span>{language === 'zh' ? '进入等待室' : 'Enter Waiting Room'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </motion.div>
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-8">
                  {/* Header and Back/Leave buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl shadow-lg">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleLeaveRoom}
                        className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition"
                      >
                        ← {language === 'zh' ? '退出掼蛋室' : 'Exit Room'}
                      </button>
                      <div className="h-5 w-px bg-slate-800"></div>
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          {language === 'en' 
                            ? SOLAR_TERMS[selectedRoomId - 1].nameEn 
                            : SOLAR_TERMS[selectedRoomId - 1].nameZh} - {language === 'zh' ? '等待室' : 'Lobby'}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono">
                          {language === 'zh' ? `当前座位人数: ` : `Seated: `}
                          <span className="text-teal-400 font-bold">{seatedPlayers.length} / 4</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleFillAllBots}
                        disabled={seatedPlayers.length >= 4}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-bold rounded-xl transition border border-slate-700 flex items-center space-x-1"
                      >
                        <span>🤖 {language === 'zh' ? '一键加满电脑' : 'Fill with Bots'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Seating Layout Map */}
                  <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 shadow-xl text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.04)_0%,transparent_70%)] pointer-events-none"></div>

                    <span className="text-[10px] font-bold text-slate-500 font-mono tracking-widest uppercase mb-6 block">
                      {language === 'zh' ? '· 掼蛋座位示意图 ·' : '· GUANDAN SEATING CHART ·'}
                    </span>

                    {/* 4 seats layout in a circle/cross */}
                    <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto py-6">
                      {/* Row 1: NORTH (Partner - Seat 2) */}
                      <div></div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase mb-1">{language === 'zh' ? '北座 (对家)' : 'North (Partner)'}</span>
                        {(() => {
                          const player = seatedPlayers.find(p => p.seat === 2);
                          return renderLoungeSeat(player, 2);
                        })()}
                      </div>
                      <div></div>

                      {/* Row 2: WEST (Opponent - Seat 3) and EAST (Opponent - Seat 1) */}
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase mb-1">{language === 'zh' ? '西座 (对手)' : 'West (Opponent)'}</span>
                        {(() => {
                          const player = seatedPlayers.find(p => p.seat === 3);
                          return renderLoungeSeat(player, 3);
                        })()}
                      </div>
                      <div className="flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full border border-teal-500/20 bg-teal-500/5 flex items-center justify-center font-bold text-teal-400 animate-pulse text-xs font-mono">
                          GD
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase mb-1">{language === 'zh' ? '东座 (对手)' : 'East (Opponent)'}</span>
                        {(() => {
                          const player = seatedPlayers.find(p => p.seat === 1);
                          return renderLoungeSeat(player, 1);
                        })()}
                      </div>

                      {/* Row 3: SOUTH (Me - Seat 0) */}
                      <div></div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase mb-1">{language === 'zh' ? '南座 (自己)' : 'South (Me)'}</span>
                        <div className="bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-2xl w-36 text-center shadow-lg relative">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 mx-auto flex items-center justify-center mb-2">
                            <span className="text-emerald-400 font-extrabold text-xs">ME</span>
                          </div>
                          <span className="text-xs font-bold text-emerald-400 block truncate">{currentUser.displayName}</span>
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full mt-1.5 inline-block uppercase">Host</span>
                        </div>
                      </div>
                      <div></div>
                    </div>

                    {/* Actions below chart */}
                    <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-xs text-slate-400 max-w-md text-left leading-relaxed">
                        💡 <strong className="text-teal-400">{language === 'zh' ? '游戏规则: ' : 'Info: '}</strong>
                        {language === 'zh' 
                          ? '当所有4个座位都坐满玩家或电脑时，开始游戏按钮将激活。您可以点击空位上的添加电脑按钮，或者等待模拟玩家陆续加入。' 
                          : 'The start game button activates when all 4 seats are full. You can manually fill spots with AI bots or wait for simulate players.'}
                      </p>
                      
                      <button
                        disabled={seatedPlayers.length < 4}
                        onClick={() => {
                          setAutoWaitActive(false);
                          initGame(selectedRoomId, seatedPlayers);
                        }}
                        className={`px-8 py-3 rounded-xl font-black text-sm tracking-wide uppercase transition duration-300 ${seatedPlayers.length < 4 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/10'}`}
                      >
                        🚀 {language === 'zh' ? '开始游戏 (满4人)' : 'Start Game (Full)'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            
            /* ACTIVE GAME TABLE VIEW */
            <div className="space-y-6">
              
              {/* Back to lobby & status header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl shadow-lg">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleLeaveRoom}
                    className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition"
                  >
                    ← {t('backToHome')}
                  </button>
                  {currentUser && currentUser.role === 'admin' && (
                    <button
                      onClick={() => handleResetRoom(selectedRoomId!)}
                      className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition"
                    >
                      ⚠️ {language === 'zh' ? '管理员重置' : 'Admin Reset'}
                    </button>
                  )}
                  <div className="h-5 w-px bg-slate-800"></div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {language === 'en' 
                        ? SOLAR_TERMS[selectedRoomId - 1].nameEn 
                        : SOLAR_TERMS[selectedRoomId - 1].nameZh}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      {t('currentLevel')}: <span className="text-amber-400 font-bold">{game?.currentLevel || '2'}</span>
                    </p>
                  </div>
                </div>

                {/* Team naming and actions */}
                <div className="flex flex-wrap items-center gap-3">
                  {isEditingTeams ? (
                    <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <input
                        type="text"
                        value={teamAName}
                        onChange={(e) => setRegFullName(e.target.value)} // reuse placeholder for input edit
                        placeholder="Team A"
                        className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={() => {
                          setTeamAName(regFullName || 'Team A');
                          setIsEditingTeams(false);
                          setRegFullName('');
                        }}
                        className="bg-emerald-500 text-slate-950 font-bold px-2.5 py-1 rounded text-[10px] uppercase"
                      >
                        {t('save')}
                      </button>
                      <button
                        onClick={() => setIsEditingTeams(false)}
                        className="text-slate-400 hover:text-white px-2 py-1 text-[10px]"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400">{t('teamName')}: <strong className="text-slate-200">{teamAName}</strong></span>
                      <button 
                        onClick={() => {
                          setRegFullName(teamAName);
                          setIsEditingTeams(true);
                        }}
                        className="p-1 text-slate-400 hover:text-white transition"
                        title={t('renameTeam')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleRedeal}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition border border-slate-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('dealCards')}</span>
                  </button>

                  {game && game.status === 'lobby' && (
                    <button
                      onClick={handleNextRoundDeal}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-xs font-extrabold rounded-xl transition border border-yellow-300 shadow-md shadow-yellow-400/20"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {lastFinisherSeat === 0 
                          ? (language === 'zh' ? '下一轮发牌' : 'Next Round Deal')
                          : (language === 'zh' ? `代【末家 ${game.players[lastFinisherSeat || 0].displayName}】发牌` : `Deal for 【${game.players[lastFinisherSeat || 0].displayName}】`)}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition border border-slate-700"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{t('roundHistory')}</span>
                  </button>
                </div>
              </div>

              {/* Match Scoreboard display */}
              {renderScoreboard()}

              {/* DUAL SCREEN: FELT POKER TABLE (LEFT) + PLAY HISTORY LOG (RIGHT) */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* INTERACTIVE POKER BOARD (SPAN 3) */}
                <div className="lg:col-span-3 bg-gradient-to-b from-emerald-950 to-slate-950 border border-emerald-900/30 rounded-3xl p-6 min-h-[580px] flex flex-col justify-between shadow-2xl relative overflow-hidden">
                  
                  {/* Table Felt Accent */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,transparent_70%)] pointer-events-none"></div>

                  {game && (
                    <>
                      {/* TOP SEAT (PARTNER - North) */}
                      <div className="flex flex-col items-center space-y-2">
                        {renderPlayerVideo(2)}
                        <div className="relative flex flex-col items-center bg-slate-900/80 border border-slate-800 p-3 rounded-2xl w-44 shadow-lg text-center">
                          {game.activePlayerIndex === 2 && (
                            <span className="absolute -top-1.5 px-2 py-0.5 bg-emerald-500 text-slate-950 text-[9px] font-black rounded-full uppercase tracking-wider animate-pulse">
                              TURN
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-200">{game.players[2].displayName}</span>
                          <span className="text-[10px] font-mono text-emerald-400 mt-0.5 uppercase tracking-wide">{t('partner')} (A)</span>
                          <span className="text-xs font-mono text-slate-400 mt-1">{game.players[2].cards.length} Cards</span>
                          {game.players[2].hasFinished && (
                            <span className="mt-1 bg-amber-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase">
                              #{game.players[2].finishOrder} Finished
                            </span>
                          )}
                        </div>

                        {/* Top Seat last played display */}
                        <div className="h-16 mt-3 flex items-center justify-center">
                          {renderTrickPlayBox(2)}
                        </div>
                      </div>

                      {/* MIDDLE SEATS (WEST & EAST) */}
                      <div className="flex items-center justify-between my-2">
                        
                        {/* WEST SEAT (Bot 3 - Team B) */}
                        <div className="flex flex-col items-center space-y-2">
                          {renderPlayerVideo(3)}
                          <div className="relative flex flex-col items-center bg-slate-900/80 border border-slate-800 p-3 rounded-2xl w-36 shadow-lg text-center">
                            {game.activePlayerIndex === 3 && (
                              <span className="absolute -top-1.5 px-2 py-0.5 bg-emerald-500 text-slate-950 text-[9px] font-black rounded-full uppercase tracking-wider animate-pulse">
                                TURN
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-200">{game.players[3].displayName}</span>
                            <span className="text-[10px] font-mono text-amber-500 mt-0.5 uppercase tracking-wide">{t('opponent')} (B)</span>
                            <span className="text-xs font-mono text-slate-400 mt-1">{game.players[3].cards.length} Cards</span>
                            {game.players[3].hasFinished && (
                              <span className="mt-1 bg-amber-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase">
                                #{game.players[3].finishOrder} Finished
                              </span>
                            )}
                          </div>

                          {/* West Seat last played display */}
                          <div className="h-16 mt-3 flex items-center justify-center">
                            {renderTrickPlayBox(3)}
                          </div>
                        </div>

                        {/* CENTER CHAT / STATUS PANEL */}
                        {game.status === 'lobby' ? (
                          <div className="flex flex-col items-center justify-center text-center max-w-sm px-6 py-6 bg-slate-900 border border-amber-500/20 rounded-2xl backdrop-blur-sm shadow-xl space-y-4">
                            <div className="bg-amber-500/10 text-amber-400 p-3 rounded-full border border-amber-500/20">
                              <Trophy className="w-6 h-6 animate-bounce text-amber-400" />
                            </div>
                            <div>
                              <span className="text-xs font-black text-amber-400 tracking-wider uppercase block">
                                {language === 'zh' ? '本局已结束，待下一轮发牌' : 'ROUND ENDED, WAITING DEAL'}
                              </span>
                              <span className="text-[11px] text-slate-300 mt-2 block leading-relaxed">
                                {lastFinisherSeat === 0 ? (
                                  language === 'zh' ? (
                                    <>上一轮末家是你，<strong className="text-amber-400">请点击“下一轮发牌”</strong>操作发牌！</>
                                  ) : (
                                    <>You are the last finisher. <strong className="text-amber-400">Please click "Next Round Deal"</strong>!</>
                                  )
                                ) : (
                                  language === 'zh' ? (
                                    <>上一轮末家是【{game.players[lastFinisherSeat || 0].displayName}】，<strong className="text-emerald-400">正在发牌...</strong></>
                                  ) : (
                                    <>The last finisher is 【{game.players[lastFinisherSeat || 0].displayName}】. <strong className="text-emerald-400">AI is dealing...</strong></>
                                  )
                                )}
                              </span>
                            </div>
                            <button
                              onClick={handleNextRoundDeal}
                              className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs transition border border-yellow-300 shadow-md shadow-yellow-400/20 w-full"
                            >
                              🚀 {lastFinisherSeat === 0 
                                ? (language === 'zh' ? '下一轮发牌' : 'Next Round Deal')
                                : (language === 'zh' ? `代【${game.players[lastFinisherSeat || 0].displayName}】发牌` : `Deal for 【${game.players[lastFinisherSeat || 0].displayName}】`)}
                            </button>
                          </div>
                        ) : tribute && tribute.isActive ? (
                          <div className="flex flex-col items-center justify-center text-center w-[340px] px-5 py-5 bg-slate-950 border-2 border-amber-500/50 rounded-2xl shadow-2xl shadow-amber-500/5 space-y-3.5 relative overflow-hidden">
                            <div className="absolute -right-8 -top-8 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
                            
                            <div className="flex items-center space-x-1.5 text-amber-400 font-black">
                              <Trophy className="w-4 h-4 text-amber-400" />
                              <span className="text-xs uppercase tracking-widest">{language === 'zh' ? '掼蛋·进贡阶段' : 'GUANDAN · TRIBUTE PHASE'}</span>
                            </div>

                            {tribute.isResisted ? (
                              <div className="space-y-3 w-full">
                                <div className="text-[11px] text-red-400 font-bold bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                                  🛡️ {tribute.resistedReason}
                                </div>
                                <p className="text-[10px] text-slate-400 leading-normal">
                                  {language === 'zh' ? '输家满足抗贡条件，本局无需进贡，直接开打！' : 'Losers resisted tribute! Starting the round directly.'}
                                </p>
                                <button
                                  onClick={handleStartAfterTribute}
                                  className="w-full py-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs transition border border-yellow-300 shadow-md shadow-yellow-400/20"
                                >
                                  {language === 'zh' ? '开始本局游戏' : 'Start Playing'}
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-3.5 w-full">
                                <div className="space-y-2 text-left max-h-[140px] overflow-y-auto pr-1">
                                  {tribute.items.map((item, idx) => {
                                    const giverName = game.players[item.giverSeat].displayName;
                                    const receiverName = game.players[item.receiverSeat].displayName;
                                    const givenCardText = item.givenCard ? `${renderSuitIcon(item.givenCard.suit, item.givenCard.value)}${item.givenCard.value === 'red_joker' ? '大王' : item.givenCard.value === 'black_joker' ? '小王' : item.givenCard.value}` : '';
                                    const returnedCardText = item.returnedCard ? `${renderSuitIcon(item.returnedCard.suit, item.returnedCard.value)}${item.returnedCard.value}` : '';

                                    return (
                                      <div key={idx} className="bg-slate-900/60 border border-slate-850 p-2 rounded-xl text-[10px] leading-relaxed space-y-1">
                                        <div className="flex justify-between font-black text-slate-300">
                                          <span>{giverName} ➔ {receiverName}</span>
                                          <span className="text-amber-400">{language === 'zh' ? '进贡' : 'Tribute'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                                          <span>{language === 'zh' ? `进献大牌: ` : `Gave card: `} <strong className="text-red-400 font-black">{givenCardText}</strong></span>
                                          <span>
                                            {item.status === 'pending_return' ? (
                                              item.receiverSeat === 0 ? (
                                                <span className="text-amber-400 animate-pulse font-black">● {language === 'zh' ? '等待你还贡' : 'Waiting for you to return'}</span>
                                              ) : (
                                                <span className="text-slate-500">● {language === 'zh' ? '等待还贡...' : 'Waiting to return...'}</span>
                                              )
                                            ) : (
                                              <span>{language === 'zh' ? '已回赠: ' : 'Returned: '} <strong className="text-emerald-400 font-black">{returnedCardText}</strong></span>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {tribute.items.some(it => it.receiverSeat === 0 && it.status === 'pending_return') ? (
                                  <div className="bg-amber-500/5 border border-amber-500/20 p-2.5 rounded-xl space-y-2">
                                    <span className="text-[10px] font-black text-amber-400 block">
                                      🎁 {language === 'zh' ? '还贡说明: 回赠一张 2~10 的小牌' : 'Return Tribute: select a card from 2 to 10'}
                                    </span>
                                    <p className="text-[9px] text-slate-400 leading-snug">
                                      {language === 'zh' ? '请在下方手牌中选择一张有黄色光圈的低数值小牌（不能是级牌），然后点击下方按钮还贡！' : 'Please select an eligible card highlighted below and click return.'}
                                    </p>
                                    <button
                                      onClick={handleReturnTribute}
                                      disabled={!Object.keys(selectedCards).some(id => selectedCards[id])}
                                      className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-amber-500 text-slate-950 font-black rounded-lg text-[10px] transition shadow-md shadow-amber-500/10"
                                    >
                                      {language === 'zh' ? '确认回赠选中卡牌' : 'Confirm & Return Tribute Card'}
                                    </button>
                                  </div>
                                ) : tribute.items.every(it => it.status === 'completed') ? (
                                  <div className="space-y-2">
                                    <div className="text-[10px] text-emerald-400 font-black bg-emerald-500/10 py-1.5 px-3 rounded-xl border border-emerald-500/25">
                                      ✨ {language === 'zh' ? '进还贡已经全部完毕！' : 'Tribute phase completed!'}
                                    </div>
                                    <button
                                      onClick={handleStartAfterTribute}
                                      className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs transition border border-emerald-400 shadow-md shadow-emerald-500/20"
                                    >
                                      {language === 'zh' ? '进还贡完成，开始对局 🚀' : 'Start Round 🚀'}
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-slate-500 animate-pulse py-2">
                                    {language === 'zh' ? '对家或对手正在操作中...' : 'Waiting for bots to respond...'}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center max-w-sm px-6 py-4 bg-slate-900/40 border border-slate-800/40 rounded-2xl backdrop-blur-sm shadow-xl">
                            <span className="text-xs font-bold text-emerald-400 font-mono tracking-widest uppercase mb-1.5">WEBRTC LIVE COMM</span>
                            
                            {/* Live Video Indicator */}
                            <div className="flex items-center justify-center space-x-3 mb-3">
                              <div className="relative">
                                <span className="absolute top-0 right-0 flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl flex items-center justify-center">
                                  {camActive ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4 text-red-400" />}
                                </div>
                              </div>
                              <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl flex items-center justify-center">
                                {micActive ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-red-400" />}
                              </div>
                            </div>

                            <span className="text-[10px] text-slate-500 font-mono leading-relaxed mb-4">
                              {t('connectionStatus')}: <strong className="text-emerald-400 font-bold uppercase">{t('connected')} (4/4)</strong>
                            </span>

                            <div className="flex space-x-2">
                              <button
                                onClick={() => setMicActive(!micActive)}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${micActive ? 'bg-slate-950 border-slate-800 hover:bg-slate-900 text-slate-300' : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'}`}
                              >
                                {micActive ? t('micOn') : t('micOff')}
                              </button>
                              <button
                                onClick={() => setCamActive(!camActive)}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${camActive ? 'bg-slate-950 border-slate-800 hover:bg-slate-900 text-slate-300' : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'}`}
                              >
                                {camActive ? t('camOn') : t('camOff')}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* EAST SEAT (Bot 1 - Team B) */}
                        <div className="flex flex-col items-center space-y-2">
                          {renderPlayerVideo(1)}
                          <div className="relative flex flex-col items-center bg-slate-900/80 border border-slate-800 p-3 rounded-2xl w-36 shadow-lg text-center">
                            {game.activePlayerIndex === 1 && (
                              <span className="absolute -top-1.5 px-2 py-0.5 bg-emerald-500 text-slate-950 text-[9px] font-black rounded-full uppercase tracking-wider animate-pulse">
                                TURN
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-200">{game.players[1].displayName}</span>
                            <span className="text-[10px] font-mono text-amber-500 mt-0.5 uppercase tracking-wide">{t('opponent')} (B)</span>
                            <span className="text-xs font-mono text-slate-400 mt-1">{game.players[1].cards.length} Cards</span>
                            {game.players[1].hasFinished && (
                              <span className="mt-1 bg-amber-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase">
                                #{game.players[1].finishOrder} Finished
                              </span>
                            )}
                          </div>

                          {/* East Seat last played display */}
                          <div className="h-16 mt-3 flex items-center justify-center">
                            {renderTrickPlayBox(1)}
                          </div>
                        </div>

                      </div>

                      {/* BOTTOM SEAT (YOU - South) */}
                      <div className="flex flex-col items-center space-y-2">
                        {/* Human last played display */}
                        <div className="h-16 mb-2 flex items-center justify-center">
                          {renderTrickPlayBox(0)}
                        </div>

                        {/* South User camera feed right above controls bar */}
                        {renderPlayerVideo(0)}

                        {/* Player Seat status and cards controls */}
                        <div className="relative flex items-center justify-between bg-slate-900 border border-slate-850 px-6 py-4 rounded-2xl w-full max-w-2xl shadow-xl">
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                                <span className="text-base font-bold text-emerald-400">P1</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-200 block">{game.players[0].displayName}</span>
                              <span className="text-[10px] font-semibold text-slate-500 uppercase font-mono">{t('teamAName')}</span>
                            </div>
                          </div>

                          {/* Control actions */}
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleSort('rank')}
                              className={`p-2 rounded-lg border text-xs font-bold font-mono transition ${sortStrategy === 'rank' ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                              title={t('sortByRank')}
                            >
                              <SortAsc className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSort('suit')}
                              className={`p-2 rounded-lg border text-xs font-bold font-mono transition ${sortStrategy === 'suit' ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                              title={t('sortBySuit')}
                            >
                              <Layers className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSort('combo')}
                              className={`p-2 rounded-lg border text-xs font-bold font-mono transition ${sortStrategy === 'combo' ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                              title={t('sortByCombo')}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>

                            <div className="w-px h-6 bg-slate-800"></div>

                            <button
                              onClick={handleAddSpacer}
                              className="px-3 py-2 rounded-lg border border-emerald-900/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 text-xs font-bold transition flex items-center space-x-1"
                              title={language === 'zh' ? '插入空格' : 'Insert Gap'}
                            >
                              <span>+ {language === 'zh' ? '空格' : 'GAP'}</span>
                            </button>

                            <div className="w-px h-6 bg-slate-800"></div>

                            {/* Reordering/Adjustment helper buttons */}
                            <button
                              onClick={handleMoveSelectedLeft}
                              disabled={!Object.values(selectedCards).some(Boolean)}
                              className="p-2 rounded-lg border bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                              title={language === 'zh' ? '选中的牌向左平移' : 'Move selected cards left'}
                            >
                              <ArrowLeft className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleMoveSelectedRight}
                              disabled={!Object.values(selectedCards).some(Boolean)}
                              className="p-2 rounded-lg border bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                              title={language === 'zh' ? '选中的牌向右平移' : 'Move selected cards right'}
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleMoveSelectedToUpperRow}
                              disabled={!Object.values(selectedCards).some(Boolean)}
                              className="p-2 rounded-lg border bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                              title={language === 'zh' ? '选中的牌移至上行' : 'Move selected cards to top row'}
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleMoveSelectedToLowerRow}
                              disabled={!Object.values(selectedCards).some(Boolean)}
                              className="p-2 rounded-lg border bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                              title={language === 'zh' ? '选中的牌移至下行' : 'Move selected cards to bottom row'}
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>

                            <div className="w-px h-6 bg-slate-800"></div>

                            <button
                              onClick={handlePass}
                              disabled={game.activePlayerIndex !== 0}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition uppercase ${game.activePlayerIndex === 0 ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700' : 'bg-slate-950 text-slate-700 border-transparent cursor-not-allowed'}`}
                            >
                              {t('pass')}
                            </button>

                            <button
                              onClick={handlePlaySelected}
                              disabled={game.activePlayerIndex !== 0}
                              className={`px-5 py-2 rounded-xl text-xs font-extrabold transition uppercase ${game.activePlayerIndex === 0 ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/10' : 'bg-slate-950 text-slate-700 border-transparent cursor-not-allowed'}`}
                            >
                              {t('playSelected')}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* ACTIVE HAND DISPLAY AREA */}
                      <div className="mt-6 flex flex-col items-center w-full">
                        <span className="text-[10px] font-bold text-slate-500 font-mono tracking-widest uppercase mb-3 text-center px-4">
                          {t('yourHand')} ({game.players[0].cards.length} / 27) {language === 'zh' ? '· 每行允许任意数量的牌 · 允许任意拖拽排序或使用平移按钮' : '· Any number of cards per row · Drag cards to reorder or use shift buttons'}
                        </span>

                        <div className="w-full overflow-x-auto pb-4 px-4 flex flex-col items-center space-y-4">
                          {(() => {
                            const cards = game.players[0].cards;
                            const row1Cards = cards.filter(c => (cardRows[c.id] || 1) === 1);
                            const row2Cards = cards.filter(c => (cardRows[c.id] || 1) === 2);

                            return (
                              <>
                                {/* Row 1 */}
                                <div 
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const draggedId = e.dataTransfer.getData('text/plain');
                                    if (draggedId) {
                                      handleCardDropToRow(draggedId, 1);
                                    }
                                  }}
                                  className="flex -space-x-4 sm:-space-x-5 min-w-max py-2 px-6 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800/60 min-h-[110px] sm:min-h-[130px] items-center justify-center transition-colors hover:bg-slate-900/60"
                                >
                                  {row1Cards.length === 0 ? (
                                    <span className="text-xs text-slate-600 font-mono italic px-8">{language === 'zh' ? '拖拽卡牌至此行 (允许任意数量)' : 'Drag cards here (Any number)'}</span>
                                  ) : (
                                    row1Cards.map((card) => {
                                      const globalIdx = cards.findIndex(c => c.id === card.id);
                                      return renderPlayerHandCard(card, cards, globalIdx);
                                    })
                                  )}
                                </div>

                                {/* Row 2 */}
                                <div 
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const draggedId = e.dataTransfer.getData('text/plain');
                                    if (draggedId) {
                                      handleCardDropToRow(draggedId, 2);
                                    }
                                  }}
                                  className="flex -space-x-4 sm:-space-x-5 min-w-max py-2 px-6 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800/60 min-h-[110px] sm:min-h-[130px] items-center justify-center transition-colors hover:bg-slate-900/60"
                                >
                                  {row2Cards.length === 0 ? (
                                    <span className="text-xs text-slate-600 font-mono italic px-8">{language === 'zh' ? '拖拽卡牌至此行 (允许任意数量)' : 'Drag cards here (Any number)'}</span>
                                  ) : (
                                    row2Cards.map((card) => {
                                      const globalIdx = cards.findIndex(c => c.id === card.id);
                                      return renderPlayerHandCard(card, cards, globalIdx);
                                    })
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                    </>
                  )}
                </div>

                {/* GAME TRICK LOG / PLAY HISTORY SIDEBAR (SPAN 1) */}
                <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col justify-between max-h-[580px]">
                  <div>
                    <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
                      <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                        <History className="text-emerald-400 w-4 h-4" />
                        <span>{t('historyTitle')}</span>
                      </h4>
                    </div>

                    {/* Chronological list */}
                    <div className="overflow-y-auto max-h-[360px] pr-1 mt-4 space-y-3.5">
                      {game && game.history.length > 0 ? (
                        game.history.map((log) => {
                          const isMe = log.playerId === currentUser?.id;
                          const actionBg = log.isPass 
                            ? 'bg-slate-950 text-slate-500' 
                            : log.team === 'A' 
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/20';

                          return (
                            <div 
                              key={log.id} 
                              className={`p-3 rounded-xl border border-slate-850/60 ${actionBg}`}
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-extrabold text-slate-200">
                                  {log.playerName} {isMe && `(${t('partner')})`}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">{log.timestamp}</span>
                              </div>
                              <div className="mt-2 flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{log.cardType}</span>
                                {!log.isPass && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {log.cards.map((c, i) => (
                                      <span key={i} className={`text-xs font-black px-1.5 py-0.5 bg-white rounded shadow-sm ${getSuitColor(c.suit)}`}>
                                        {c.value === 'red_joker' ? 'RJ' : c.value === 'black_joker' ? 'BJ' : c.value}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-500 text-center py-12 italic">{t('noHistory')}</p>
                      )}
                    </div>
                  </div>

                  {/* Manual scoring trigger (dispute resolution) */}
                  <div className="pt-4 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setScoringMode('manual');
                        setShowScoringModal(true);
                      }}
                      className="w-full py-2 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800/80 rounded-xl text-xs font-bold tracking-wide uppercase transition"
                    >
                      ⚠️ {t('scoringTitle')} (Manual / Dispute)
                    </button>
                  </div>
                </div>

              </div>

              {/* SAVED SCORES HISTORIC BOARD FOR THE ROOM */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h4 className="text-base font-bold text-white tracking-tight flex items-center space-x-2 mb-4">
                  <Trophy className="w-5 h-5 text-emerald-400" />
                  <span>{t('scoresHistory')}</span>
                </h4>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">{t('roomName')}</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">{teamAName}</th>
                        <th className="px-4 py-3">{teamBName}</th>
                        <th className="px-4 py-3">Winner</th>
                        <th className="px-4 py-3">{t('scoringMode')}</th>
                        <th className="px-4 py-3">{t('notes')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {(() => {
                        const currentRoomZh = selectedRoomId ? SOLAR_TERMS[selectedRoomId - 1].nameZh : '';
                        const currentRoomEn = selectedRoomId ? SOLAR_TERMS[selectedRoomId - 1].nameEn : '';
                        const filteredHistory = scoresHistory
                          .filter(record => record.roomName === currentRoomZh || record.roomName === currentRoomEn || record.roomName.includes(currentRoomZh) || record.roomName.includes(currentRoomEn))
                          .slice(0, 3);

                        return filteredHistory.length > 0 ? (
                          filteredHistory.map((record) => (
                            <tr key={record.id} className="hover:bg-slate-800/50 transition font-mono text-xs">
                              <td className="px-4 py-3 font-semibold text-slate-200">{record.roomName}</td>
                              <td className="px-4 py-3 text-slate-500">{record.date}</td>
                              <td className="px-4 py-3">
                                <span className="text-emerald-400 font-bold">+{record.teamAScoreChange}</span>
                                <span className="text-slate-500 text-[10px] ml-1">({record.teamAFinalLevel})</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-emerald-400 font-bold">+{record.teamBScoreChange}</span>
                                <span className="text-slate-500 text-[10px] ml-1">({record.teamBFinalLevel})</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${record.winningTeam === 'A' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                  Team {record.winningTeam}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[10px] uppercase font-bold text-slate-500">{record.scoringMode}</td>
                              <td className="px-4 py-3 text-slate-400 italic max-w-xs truncate">{record.notes || '-'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">No games recorded yet for this room.</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </main>
      )}

      {/* RULES PANEL DRAWER OVERLAY */}
      <AnimatePresence>
        {showRules && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-end">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-full max-w-md bg-slate-900 border-l border-slate-800 p-6 h-full overflow-y-auto shadow-2xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <HelpCircle className="w-5 h-5 text-emerald-400" />
                    <span>{t('rulesTitle')}</span>
                  </h3>
                  <button 
                    onClick={() => setShowRules(false)}
                    className="text-slate-400 hover:text-white font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
                  <p>{t('rulesDesc')}</p>
                  
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <h4 className="font-bold text-white">🏆 Level Cards & Wilds (逢人配):</h4>
                    <p className="text-xs text-slate-400">
                      The game progresses rank by rank (2 up to Ace). The active rank is the **Level Card**. 
                      The **Red Heart Level Card** is wild and can substitute for any card except jokers to complete hands.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-white">💥 Combinations & Bombs Order:</h4>
                    <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-400">
                      <li><strong>Single</strong>, <strong>Pair</strong>, <strong>Triple</strong></li>
                      <li><strong>Full House (3+2)</strong>: 3 of same rank + pair</li>
                      <li><strong>Straight (5 Cards)</strong>: e.g. 5-6-7-8-9 of any suit</li>
                      <li><strong>Consecutive Pairs (木板)</strong>: 3 consecutive pairs</li>
                      <li><strong>Consecutive Triples (钢板)</strong>: 2 consecutive triples</li>
                      <li><strong>Bomb (4+ Cards)</strong>: Beats all standard combos. More cards = stronger bomb.</li>
                      <li><strong>Straight Flush (同花顺)</strong>: 5 consecutive suit cards. Beats 5-card bomb.</li>
                      <li><strong>Four Jokers Ultimate Bomb (天王炸)</strong>: Beats everything.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowRules(false)}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition uppercase mt-8 text-xs tracking-wide"
              >
                Got It
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SCORING SHEET MODAL DIALOG */}
      <AnimatePresence>
        {showScoringModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

              <h3 className="text-xl font-bold text-white mb-2 flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-emerald-400" />
                <span>{t('scoringTitle')}</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mb-6">
                {t('scoringMode')}: <strong className="text-emerald-400 uppercase font-black">{scoringMode === 'auto' ? t('autoScoring') : t('manualScoring')}</strong>
              </p>

              <div className="space-y-4">
                {/* Winner select */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">{t('winnerTeamSelect')}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setManualWinner('A')}
                      className={`py-3.5 rounded-xl font-bold text-xs uppercase transition border ${manualWinner === 'A' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                    >
                      {teamAName} (Team A)
                    </button>
                    <button
                      onClick={() => setManualWinner('B')}
                      className={`py-3.5 rounded-xl font-bold text-xs uppercase transition border ${manualWinner === 'B' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                    >
                      {teamBName} (Team B)
                    </button>
                  </div>
                </div>

                {/* Score change index slider/picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">{t('scoreChange')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((val) => (
                      <button
                        key={val}
                        onClick={() => setManualAdvance(val)}
                        className={`py-2.5 rounded-xl text-xs font-mono font-bold transition border ${manualAdvance === val ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                      >
                        +{val} {val === 3 ? 'Levels (双上)' : 'Levels'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">{t('notes')}</label>
                  <textarea
                    rows={3}
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="Enter additional remarks or dispute summaries..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-emerald-500 focus:outline-none placeholder-slate-600 font-mono"
                  ></textarea>
                </div>
              </div>

              {/* Confirm submit buttons */}
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => setShowScoringModal(false)}
                  className="w-1/2 py-3 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 rounded-xl text-xs font-bold uppercase transition"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleConfirmScore}
                  className="w-1/2 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs uppercase shadow-lg shadow-emerald-500/5 transition"
                >
                  {t('confirmScore')}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
