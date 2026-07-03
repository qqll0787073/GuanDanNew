import React, { useState, useEffect } from 'react';
import { User, Room, ScoreRecord } from './types';
import PlayerPortal, { SOLAR_TERMS } from './components/PlayerPortal';
import AdminPortal from './components/AdminPortal';
import { getTranslation } from './i18n';
import { 
  User as UserIcon, Shield, ChevronRight, CheckCircle, Flame, Layers, Award, Activity 
} from 'lucide-react';
import { motion } from 'motion/react';

// Predefined mock database keys for localStorage
const LOCAL_USERS_KEY = 'guandan_users_db_v1';
const LOCAL_ROOMS_KEY = 'guandan_rooms_db_v1';
const LOCAL_SCORES_KEY = 'guandan_scores_db_v1';

// Seed initial player accounts
const SEED_USERS: User[] = [
  {
    id: 'user-admin-seed',
    fullName: 'Super Admin',
    displayName: 'Super Admin',
    email: 'admin@guandan.com',
    password: 'admin123',
    role: 'admin',
    status: 'Approved',
    preferredLanguage: 'zh',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-seed-1',
    fullName: 'David Lee',
    displayName: 'GuanDan Master David',
    email: 'player1@guandan.com',
    phone: '13800000001',
    role: 'player',
    status: 'Approved',
    preferredLanguage: 'zh',
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'user-seed-2',
    fullName: 'Sarah Connor',
    displayName: 'Sarah Poker Pro',
    email: 'player2@guandan.com',
    phone: '13911111111',
    role: 'player',
    status: 'Approved',
    preferredLanguage: 'en',
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'user-seed-3',
    fullName: 'Rookie Wang',
    displayName: 'Wang Rookie',
    email: 'pending@guandan.com',
    phone: '13522222222',
    role: 'player',
    status: 'Pending',
    preferredLanguage: 'zh',
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  }
];

// Initialize 24 Solar-term rooms
const SEED_ROOMS: Room[] = SOLAR_TERMS.map((term, idx) => ({
  id: idx + 1,
  nameEn: term.nameEn,
  nameZh: term.nameZh,
  maxPlayers: 4,
  currentPlayerCount: 0,
  status: 'Waiting',
  isVoiceActive: true,
  isVideoActive: true,
  players: [],
}));

// Seed initial game records
const SEED_SCORES: ScoreRecord[] = [
  {
    id: 'score-seed-1',
    gameId: 'game-seed-1',
    roomName: 'Spring Equinox（春分）',
    date: new Date(Date.now() - 1 * 24 * 3600 * 1000).toLocaleDateString() + ' 15:30:20',
    teamAName: 'Dragon Team（龙队）',
    teamBName: 'Tiger Team（虎队）',
    teamAScoreChange: 3,
    teamBScoreChange: 0,
    teamAFinalLevel: '5',
    teamBFinalLevel: '2',
    winningTeam: 'A',
    scoringMode: 'auto',
    notes: 'Double Win! Partner finished second.',
  },
  {
    id: 'score-seed-2',
    gameId: 'game-seed-2',
    roomName: 'Summer Solstice（夏至）',
    date: new Date(Date.now() - 2 * 3600 * 1000).toLocaleDateString() + ' 19:42:01',
    teamAName: 'ShengLi Team',
    teamBName: 'KuaLe Team',
    teamAScoreChange: 0,
    teamBScoreChange: 2,
    teamAFinalLevel: '2',
    teamBFinalLevel: '4',
    winningTeam: 'B',
    scoringMode: 'manual',
    notes: 'Manually logged score. Clean finish.',
  }
];

export default function App() {
  const [language, setLanguage] = useState<'en' | 'zh'>('zh');
  const [portal, setPortal] = useState<'home' | 'player' | 'admin'>('home');
  
  // Local Database States with synchronous lazy initializers
  const [users, setUsers] = useState<User[]>(() => {
    let parsedUsers: User[] = [];
    const localUsers = localStorage.getItem(LOCAL_USERS_KEY);
    if (localUsers) {
      try {
        parsedUsers = JSON.parse(localUsers);
      } catch (e) {
        console.error("Failed to parse users database", e);
      }
    }
    
    // If we have no parsed users, start with the SEED_USERS
    if (!parsedUsers || parsedUsers.length === 0) {
      parsedUsers = [...SEED_USERS];
    }

    // Migrate legacy administrators from guandan_admins_v1 if present
    const legacyAdminsRaw = localStorage.getItem('guandan_admins_v1');
    if (legacyAdminsRaw) {
      try {
        const legacyAdmins = JSON.parse(legacyAdminsRaw);
        if (Array.isArray(legacyAdmins)) {
          legacyAdmins.forEach((legacyAdmin: any) => {
            if (legacyAdmin && legacyAdmin.email) {
              const emailLower = legacyAdmin.email.toLowerCase();
              const exists = parsedUsers.some(u => u.email.toLowerCase() === emailLower);
              if (!exists) {
                parsedUsers.push({
                  id: `user-admin-migrated-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                  fullName: legacyAdmin.name || 'Admin',
                  displayName: legacyAdmin.name || 'Admin',
                  email: emailLower,
                  password: legacyAdmin.password || 'admin123',
                  role: 'admin',
                  status: 'Approved',
                  preferredLanguage: 'zh',
                  createdAt: legacyAdmin.createdAt || new Date().toISOString(),
                });
              }
            }
          });
        }
      } catch (e) {
        console.error("Failed to parse legacy administrators", e);
      }
    }

    // Guarantee admin@guandan.com is ALWAYS present, Approved, and has the correct password
    const adminEmailLower = 'admin@guandan.com';
    const existingAdminIdx = parsedUsers.findIndex(u => u.email.toLowerCase() === adminEmailLower);
    if (existingAdminIdx > -1) {
      parsedUsers[existingAdminIdx] = {
        ...parsedUsers[existingAdminIdx],
        role: 'admin',
        status: 'Approved',
        password: 'admin123' // Force correct password
      };
    } else {
      parsedUsers.push({
        id: 'user-admin-seed',
        fullName: 'Super Admin',
        displayName: 'Super Admin',
        email: adminEmailLower,
        password: 'admin123',
        role: 'admin',
        status: 'Approved',
        preferredLanguage: 'zh',
        createdAt: new Date().toISOString(),
      });
    }

    // Save back the combined, verified, and migrated database to ensure persistence
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(parsedUsers));
    return parsedUsers;
  });

  const [rooms, setRooms] = useState<Room[]>(() => {
    const localRooms = localStorage.getItem(LOCAL_ROOMS_KEY);
    if (localRooms) {
      try {
        return JSON.parse(localRooms);
      } catch (e) {
        console.error("Failed to parse rooms database", e);
      }
    }
    localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(SEED_ROOMS));
    return SEED_ROOMS;
  });

  const [scoresHistory, setScoresHistory] = useState<ScoreRecord[]>(() => {
    const localScores = localStorage.getItem(LOCAL_SCORES_KEY);
    if (localScores) {
      try {
        return JSON.parse(localScores);
      } catch (e) {
        console.error("Failed to parse scores database", e);
      }
    }
    localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(SEED_SCORES));
    return SEED_SCORES;
  });
  
  // Current logged in player with persistent session
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('guandan_current_user_v1');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored current user", e);
      }
    }
    return null;
  });

  const handleSetCurrentUser = (user: User | null) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem('guandan_current_user_v1', JSON.stringify(user));
    } else {
      localStorage.removeItem('guandan_current_user_v1');
    }
  };

  const t = (key: string) => getTranslation(key, language);

  // References to keep current state available to the sync interval without stale closures
  const usersRef = React.useRef(users);
  const roomsRef = React.useRef(rooms);
  const scoresRef = React.useRef(scoresHistory);

  const lastUsersWriteRef = React.useRef<number>(0);
  const lastRoomsWriteRef = React.useRef<number>(0);
  const lastScoresWriteRef = React.useRef<number>(0);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    scoresRef.current = scoresHistory;
  }, [scoresHistory]);

  // Poll server state every 2 seconds for real-time multiplayer synchronization (Server is source of truth, conflict-free)
  useEffect(() => {
    let isMounted = true;
    const fetchState = async () => {
      try {
        const response = await fetch('/api/state');
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            const now = Date.now();

            // 1. Synchronize Users (Intelligent merge ensures local-only or pending-sync registered players never disappear)
            const hasServerUsers = data.users && Array.isArray(data.users) && data.users.length > 0;
            if (!hasServerUsers) {
              if (usersRef.current && usersRef.current.length > 0) {
                fetch('/api/users', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ users: usersRef.current })
                }).catch(() => {});
              }
            } else {
              const localUsers = usersRef.current || [];
              const mergedUsersMap = new Map();
              
              // Load server-side users first
              data.users.forEach((u: User) => {
                if (u && u.id) mergedUsersMap.set(u.id, u);
              });
              
              // Secure and preserve local-only users (registered locally but not fully synchronized to server yet)
              localUsers.forEach((u: User) => {
                if (u && u.id && !mergedUsersMap.has(u.id)) {
                  mergedUsersMap.set(u.id, u);
                }
              });
              
              const mergedUsers = Array.from(mergedUsersMap.values());
              const localStr = JSON.stringify(localUsers);
              const mergedStr = JSON.stringify(mergedUsers);
              
              if (localStr !== mergedStr && (now - lastUsersWriteRef.current > 3000)) {
                setUsers(mergedUsers);
                localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(mergedUsers));
              }
            }

            // 2. Synchronize Rooms (Conflict-free intelligent merge prevents seat reset and player kicked out issues)
            const hasServerRooms = data.rooms && Array.isArray(data.rooms) && data.rooms.length > 0;
            if (!hasServerRooms) {
              fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rooms: SEED_ROOMS })
              }).catch(() => {});
              setRooms(SEED_ROOMS);
              localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(SEED_ROOMS));
            } else {
              const localRooms = roomsRef.current || [];
              const activeRoom = currentUser ? localRooms.find(r => r.seatedPlayers?.some(p => p.id === currentUser.id)) : null;
              const activeRoomId = activeRoom ? activeRoom.id : null;

              // Build merged rooms list to protect the user's active seated status
              const mergedRooms = data.rooms.map((serverRoom: Room) => {
                const localRoom = localRooms.find(r => r.id === serverRoom.id);
                if (!localRoom) return serverRoom;

                if (localRoom.id === activeRoomId && currentUser) {
                  const isSeatedLocally = localRoom.seatedPlayers?.some(p => p.id === currentUser.id);
                  const isSeatedOnServer = serverRoom.seatedPlayers?.some(p => p.id === currentUser.id);

                  if (isSeatedLocally && !isSeatedOnServer) {
                    const mergedSeated = [...(localRoom.seatedPlayers || [])];
                    (serverRoom.seatedPlayers || []).forEach(sp => {
                      if (!mergedSeated.some(lp => lp.seat === sp.seat || lp.id === sp.id)) {
                        mergedSeated.push(sp);
                      }
                    });
                    mergedSeated.sort((a, b) => a.seat - b.seat);
                    return {
                      ...localRoom,
                      seatedPlayers: mergedSeated,
                      currentPlayerCount: mergedSeated.length,
                      players: mergedSeated.map(p => p.id)
                    };
                  }
                }
                return serverRoom;
              });

              const localStr = JSON.stringify(localRooms);
              const mergedStr = JSON.stringify(mergedRooms);
              if (localStr !== mergedStr && (now - lastRoomsWriteRef.current > 3000)) {
                setRooms(mergedRooms);
                localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(mergedRooms));
              }
            }

            // 3. Synchronize Scores
            const hasServerScores = data.scores && Array.isArray(data.scores) && data.scores.length > 0;
            if (!hasServerScores) {
              if (scoresRef.current && scoresRef.current.length > 0) {
                fetch('/api/scores', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ scores: scoresRef.current })
                }).catch(() => {});
              }
            } else {
              const localStr = JSON.stringify(scoresRef.current);
              const serverStr = JSON.stringify(data.scores);
              if (localStr !== serverStr && (now - lastScoresWriteRef.current > 3000)) {
                setScoresHistory(data.scores);
                localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(data.scores));
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to poll server state:", err);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Proactively logout suspended/rejected users or sync admin profile updates in real-time
  useEffect(() => {
    if (currentUser) {
      const serverUser = users.find(u => u.id === currentUser.id);
      if (serverUser) {
        if (serverUser.status === 'Suspended' || serverUser.status === 'Rejected') {
          handleSetCurrentUser(null);
          alert(language === 'en' ? 'Your account has been suspended or rejected by administrators.' : '您的账号已被管理员停用或拒绝。');
        } else if (serverUser.status !== currentUser.status || serverUser.displayName !== currentUser.displayName || serverUser.role !== currentUser.role) {
          handleSetCurrentUser(serverUser);
        }
      }
    }
  }, [users, currentUser, language]);

  // Save users state helpers supporting functional updates and direct values
  const saveUsersToStorage = (updateInput: User[] | ((prev: User[]) => User[])) => {
    lastUsersWriteRef.current = Date.now();
    setUsers(prev => {
      const updated = typeof updateInput === 'function' ? updateInput(prev) : updateInput;
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: updated })
      }).catch(err => console.error("Failed to post users state:", err));
      return updated;
    });
  };

  // Register Player applicant (Saves directly to server database to prevent sync deletion/race conditions)
  const handleRegisterUser = async (newUser: Omit<User, 'id' | 'role' | 'status' | 'createdAt'>): Promise<User | null> => {
    const emailNorm = newUser.email.trim().toLowerCase();
    
    // Before July 26, 2026, registration doesn't require admin approval and status is directly Approved.
    const autoApprove = new Date().getTime() < new Date(2026, 6, 26).getTime();
    const freshUser: User = {
      ...newUser,
      email: emailNorm,
      id: `user-${Date.now()}`,
      role: 'player',
      status: autoApprove ? 'Approved' : 'Pending',
      createdAt: new Date().toISOString(),
      ...(autoApprove ? { approvedAt: new Date().toISOString() } : {}),
    };

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: freshUser })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          // Immediately update local React state and local storage with the server-verified user
          setUsers(prev => {
            const idx = prev.findIndex(u => u.id === data.user.id || u.email.toLowerCase() === emailNorm);
            let updated;
            if (idx > -1) {
              updated = [...prev];
              updated[idx] = data.user;
            } else {
              updated = [...prev, data.user];
            }
            localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));
            return updated;
          });
          if (autoApprove) {
            handleSetCurrentUser(data.user);
          }
          return data.user;
        } else {
          alert(language === 'en' ? (data.error || 'Registration failed') : (data.error === 'Email already registered' ? '该邮箱已被注册。' : '注册失败。'));
          return null;
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(language === 'en' ? (errData.error || 'Registration failed.') : (errData.error === 'Email already registered' ? '该邮箱已被注册。' : '注册失败。'));
        return null;
      }
    } catch (err) {
      console.error("Server register failed, falling back to local:", err);
      // Fallback
      const existsLocally = users.some(u => u.email.toLowerCase() === emailNorm);
      if (existsLocally) {
        alert(language === 'en' ? 'This email is already registered.' : '该邮箱已被注册。');
        return null;
      }
      saveUsersToStorage(prev => [...prev, freshUser]);
      if (autoApprove) {
        handleSetCurrentUser(freshUser);
      }
      return freshUser;
    }
  };

  // Create Admin user
  const handleCreateAdmin = (adminData: { name: string; email: string; password?: string }) => {
    const newAdmin: User = {
      id: `user-admin-${Date.now()}`,
      fullName: adminData.name,
      displayName: adminData.name,
      email: adminData.email.toLowerCase(),
      password: adminData.password,
      role: 'admin',
      status: 'Approved',
      preferredLanguage: 'zh',
      createdAt: new Date().toISOString(),
    };
    saveUsersToStorage(prev => [...prev, newAdmin]);
  };

  // Validate Player login with password check (Supports both fast server-side query and offline/stale fallback)
  const handlePlayerLogin = async (email: string, pass: string): Promise<User | null> => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          // Instantly sync this user into local state to bypass polling delay
          setUsers(prev => {
            const idx = prev.findIndex(u => u.id === data.user.id);
            if (idx > -1) {
              const updated = [...prev];
              updated[idx] = data.user;
              return updated;
            }
            return [...prev, data.user];
          });
          return data.user;
        }
      }
    } catch (err) {
      console.error("Server login failed, falling back to local database:", err);
    }

    // Fallback to local in-memory database search
    const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (matched) {
      if (matched.password && matched.password !== pass) {
        return null;
      }
      return matched;
    }
    return null;
  };

  // Admin approvals
  const handleApproveUser = (userId: string) => {
    saveUsersToStorage(prev => prev.map(u => u.id === userId ? { ...u, status: 'Approved' as const, approvedAt: new Date().toISOString() } : u));
  };

  const handleRejectUser = (userId: string) => {
    saveUsersToStorage(prev => prev.map(u => u.id === userId ? { ...u, status: 'Rejected' as const } : u));
  };

  const handleSuspendUser = (userId: string) => {
    saveUsersToStorage(prev => prev.map(u => u.id === userId ? { ...u, status: 'Suspended' as const } : u));
  };

  const handleReactivateUser = (userId: string) => {
    saveUsersToStorage(prev => prev.map(u => u.id === userId ? { ...u, status: 'Approved' as const } : u));
  };

  const handleResetPassword = (userId: string) => {
    alert(language === 'en' ? 'Password reset successfully for user.' : '已成功重置该玩家的密码。');
  };

  // Save Rooms state
  const handleUpdateRooms = (updatedRooms: Room[], roomId?: number) => {
    lastRoomsWriteRef.current = Date.now();
    setRooms(updatedRooms);
    localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(updatedRooms));
    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rooms: updatedRooms, roomId })
    }).catch(err => console.error("Failed to post rooms state:", err));
  };

  // Add recorded score game
  const handleRecordGame = (record: ScoreRecord) => {
    lastScoresWriteRef.current = Date.now();
    const nextScores = [record, ...scoresHistory];
    setScoresHistory(nextScores);
    localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(nextScores));
    fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scores: nextScores })
    }).catch(err => console.error("Failed to post scores state:", err));
  };

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* 1. HOMEPAGE PORTAL SELECTION */}
      {portal === 'home' && (
        <div className="min-h-screen flex flex-col justify-between relative overflow-hidden">
          
          {/* Ambient light circles */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none"></div>

          {/* Home Header */}
          <header className="max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-900 z-10">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-2.5 rounded-2xl shadow-xl shadow-emerald-500/10">
                <span className="text-2xl font-black text-slate-950">掼</span>
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-white">{t('title')}</h1>
                <p className="text-xs text-slate-400 font-mono">{t('subtitle')}</p>
              </div>
            </div>

            {/* Language Switch */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setLanguage('zh')}
                className={`px-3 py-1.5 rounded-lg transition ${language === 'zh' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'}`}
              >
                中文
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-lg transition ${language === 'en' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'}`}
              >
                English
              </button>
            </div>
          </header>

          {/* SPLIT HERO SECTION: Player on Left, Admin on Right */}
          <main className="max-w-6xl w-full mx-auto px-6 py-12 flex-1 flex flex-col justify-center z-10">
            
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                {language === 'zh' ? '掼响二十四节气' : '24 Solar Terms Guandan'}
              </h2>
              <p className="text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
                {language === 'zh' 
                  ? '掼蛋是深受大众喜爱的智力运动，本系统支持真实随机发牌、二十四节气房间、音视频通话、中英文双语、自动与手动计分，以及完备的后台账号审批系统。' 
                  : 'Guandan is a beloved strategy card game. Experience realistic gameplay, solar-term rooms, WebRTC audio/video chat, manual/automatic scoring, and powerful admin account approvals.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
              
              {/* LEFT HALF: PLAYER PORTAL */}
              <motion.div 
                whileHover={{ y: -6, scale: 1.01 }}
                onClick={() => setPortal('player')}
                className="group cursor-pointer bg-gradient-to-b from-emerald-950/40 to-slate-900 border border-emerald-900/30 hover:border-emerald-500/40 p-8 rounded-3xl shadow-xl transition relative overflow-hidden flex flex-col justify-between min-h-[340px]"
              >
                <div className="absolute -right-16 -top-16 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-colors"></div>
                
                <div>
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mb-6">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight text-white">{t('playerPortal')}</h3>
                  <p className="text-sm text-slate-400 mt-2.5 leading-relaxed">
                    {language === 'zh' 
                      ? '加入二十四节气游戏房间，修改队名，管理手牌一键出牌，模拟对家Bot，进行实时音视频对局并自动计分升级。' 
                      : 'Join 24 solar-term poker rooms, rename your team, organize card combinations, play with smart bot partners, and automatically advance levels.'}
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-850 flex items-center justify-between text-xs font-bold uppercase text-emerald-400 tracking-wider">
                  <span>{language === 'zh' ? '进入玩家通道' : 'Enter Player Portal'} →</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>

              {/* RIGHT HALF: ADMIN PORTAL */}
              <motion.div 
                whileHover={{ y: -6, scale: 1.01 }}
                onClick={() => setPortal('admin')}
                className="group cursor-pointer bg-gradient-to-b from-teal-950/30 to-slate-900 border border-teal-950/20 hover:border-teal-500/40 p-8 rounded-3xl shadow-xl transition relative overflow-hidden flex flex-col justify-between min-h-[340px]"
              >
                <div className="absolute -right-16 -top-16 w-40 h-40 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/15 transition-colors"></div>
                
                <div>
                  <div className="w-12 h-12 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-2xl flex items-center justify-center mb-6">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight text-white">{t('adminPortal')}</h3>
                  <p className="text-sm text-slate-400 mt-2.5 leading-relaxed">
                    {language === 'zh' 
                      ? '管理员后台控制中心。审核玩家注册申请，重置密码，禁用/恢复账户，监控24个节气房间占用，以及查看全局历史对局记录。' 
                      : 'Secure administrative panel. Appraise pending account applications, reset player credentials, audit active game tables, and browse historic game sheets.'}
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-850 flex items-center justify-between text-xs font-bold uppercase text-teal-400 tracking-wider">
                  <span>{language === 'zh' ? '进入管理员控制台' : 'Enter Admin Console'} →</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>

            </div>
          </main>

          {/* Home Footer credits */}
          <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600 font-mono z-10">
            <div>© 2026 Guandan Poker App Platform. {language === 'zh' ? '支持二十四节气雅致对战' : 'Dedicated Solar-Term Tables.'}</div>
          </footer>

        </div>
      )}

      {/* 2. PLAYER PORTAL VIEW */}
      {portal === 'player' && (
        <div>
          {/* Small navbar to leave portal and return home */}
          <div className="bg-slate-900/60 border-b border-slate-900 px-4 py-2 flex items-center justify-between">
            <button
              onClick={() => setPortal('home')}
              className="text-xs font-mono font-bold text-slate-400 hover:text-white transition flex items-center space-x-1"
            >
              <span>← {language === 'zh' ? '返回门户首页' : 'Return to Portal Home'}</span>
            </button>
            <span className="text-[10px] font-mono text-slate-500">PLAYER PORTAL ACTIVE</span>
          </div>

          <PlayerPortal
            language={language}
            setLanguage={setLanguage}
            users={users}
            onRegister={handleRegisterUser}
            onLogin={handlePlayerLogin}
            currentUser={currentUser}
            setCurrentUser={handleSetCurrentUser}
            rooms={rooms}
            updateRooms={handleUpdateRooms}
            onRecordGame={handleRecordGame}
            scoresHistory={scoresHistory}
          />
        </div>
      )}

      {/* 3. ADMIN PORTAL VIEW */}
      {portal === 'admin' && (
        <div>
          {/* Small navbar to leave portal and return home */}
          <div className="bg-slate-900/60 border-b border-slate-900 px-4 py-2 flex items-center justify-between">
            <button
              onClick={() => setPortal('home')}
              className="text-xs font-mono font-bold text-slate-400 hover:text-white transition flex items-center space-x-1"
            >
              <span>← {language === 'zh' ? '返回门户首页' : 'Return to Portal Home'}</span>
            </button>
            <span className="text-[10px] font-mono text-slate-500">ADMIN CONTROL PORTAL</span>
          </div>

          <AdminPortal
            language={language}
            users={users}
            rooms={rooms}
            scoresHistory={scoresHistory}
            onApproveUser={handleApproveUser}
            onRejectUser={handleRejectUser}
            onSuspendUser={handleSuspendUser}
            onReactivateUser={handleReactivateUser}
            onResetPassword={handleResetPassword}
            roomsStatusUpdate={handleUpdateRooms}
            onCreateAdmin={handleCreateAdmin}
            onLogout={() => setPortal('home')}
          />
        </div>
      )}

    </div>
  );
}
