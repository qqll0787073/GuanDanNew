import React, { useState } from 'react';
import { User, Room, ScoreRecord, UserStatus } from '../types';
import { getTranslation } from '../i18n';
import { supabase } from '../lib/supabase';
import { 
  Users, CheckCircle, XCircle, AlertCircle, ShieldAlert, Search, RefreshCw, Key, Database, Activity, LayoutDashboard, Settings, Video, FileText, Ban, Power, Trash2, ArrowRight
} from 'lucide-react';

type AdminProfile = {
  role: string | null;
  status: string | null;
};

type CreateAdminResult = {
  success: boolean;
  error?: string;
};

interface AdminPortalProps {
  language: 'en' | 'zh';
  users: User[];
  rooms: Room[];
  scoresHistory: ScoreRecord[];
  onApproveUser: (userId: string) => void;
  onRejectUser: (userId: string) => void;
  onSuspendUser: (userId: string) => void;
  onReactivateUser: (userId: string) => void;
  onResetPassword: (userId: string) => void;
  roomsStatusUpdate: (updatedRooms: Room[], roomId?: number) => void;
  onCreateAdmin?: (adminData: { name: string; email: string; password?: string }) => Promise<CreateAdminResult>;
  onAdminLoginSuccess?: () => Promise<void>;
  adminUsersError?: string | null;
  onLogout?: () => void;
}

export default function AdminPortal({
  language,
  users,
  rooms,
  scoresHistory,
  onApproveUser,
  onRejectUser,
  onSuspendUser,
  onReactivateUser,
  onResetPassword,
  roomsStatusUpdate,
  onCreateAdmin,
  onAdminLoginSuccess,
  adminUsersError,
  onLogout,
}: AdminPortalProps) {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const [activeTab, setActiveTab] = useState<'approvals' | 'players' | 'rooms' | 'records' | 'admins'>('approvals');

  // Derive administrators list dynamically from global users
  const adminsList = users
    .filter(u => u.role === 'admin')
    .map(u => ({
      name: u.fullName,
      email: u.email,
      password: u.password,
      createdAt: u.createdAt,
    }));

  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [adminFormError, setAdminFormError] = useState('');
  const [adminFormSuccess, setAdminFormSuccess] = useState('');
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFormError('');
    setAdminFormSuccess('');

    const emailLower = newAdminEmail.trim().toLowerCase();
    if (users.some(u => u.email.toLowerCase() === emailLower)) {
      setAdminFormError(language === 'zh' ? '该邮箱已被注册' : 'This email is already registered.');
      return;
    }

    if (!onCreateAdmin) {
      setAdminFormError('Admin creation is not available.');
      return;
    }

    setIsCreatingAdmin(true);
    try {
      const result = await onCreateAdmin({
        name: newAdminName.trim(),
        email: emailLower,
        password: newAdminPass,
      });

      if (!result.success) {
        setAdminFormError(result.error || 'Failed to create administrator.');
        return;
      }
    } catch (err) {
      console.error('Create administrator failed:', err);
      setAdminFormError(err instanceof Error ? err.message : 'Failed to create administrator.');
      return;
    } finally {
      setIsCreatingAdmin(false);
    }

    setNewAdminName('');
    setNewAdminEmail('');
    setNewAdminPass('');
    setAdminFormSuccess(language === 'zh' ? '管理员创建成功！' : 'Administrator created successfully!');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    roomId: number | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    roomId: null,
  });

  const handleResetRoom = (roomId: number) => {
    const updatedRooms = rooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          currentPlayerCount: 0,
          players: [],
          status: 'Waiting' as const,
        };
      }
      return r;
    });
    roomsStatusUpdate(updatedRooms, roomId);
  };

  const t = (key: string) => getTranslation(key, language);

  // Admin login through Supabase Auth and public profiles
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');

    const email = adminEmail.trim().toLowerCase();
    if (!email || !adminPassword) {
      setAdminError('Please enter admin email and password.');
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: adminPassword,
      });

      if (authError || !authData.user) {
        if (authError) console.error('Supabase admin login failed:', authError);
        setAdminError('Invalid admin credentials.');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', authData.user.id)
        .single<AdminProfile>();

      if (profileError || !profile) {
        if (profileError) console.error('Failed to load Supabase admin profile:', profileError);
        await supabase.auth.signOut();
        setAdminError('Admin profile was not found.');
        return;
      }

      if (profile.role !== 'admin' || profile.status !== 'approved') {
        await supabase.auth.signOut();
        setAdminError('This account is not an approved administrator.');
        return;
      }

      if (onAdminLoginSuccess) {
        await onAdminLoginSuccess();
      }

      setIsAdminLoggedIn(true);
      setAdminPassword('');
    } catch (err) {
      console.error('Supabase admin login failed:', err);
      setAdminError('Admin login failed. Please try again.');
    }
  };

  // Helper counters
  const pendingCount = users.filter(u => u.status === 'Pending').length;
  const approvedCount = users.filter(u => u.status === 'Approved').length;
  const activeRoomsCount = rooms.filter(r => r.currentPlayerCount > 0).length;

  // Filter players list
  const filteredPlayers = users.filter(p => {
    const matchesSearch = p.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-teal-500 selection:text-slate-950">
      
      {/* ADMIN PORTAL LOGIN */}
      {!isAdminLoggedIn ? (
        <div className="max-w-md mx-auto py-24 px-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="text-center mb-8">
              <div className="inline-flex bg-teal-500/10 border border-teal-500/20 p-3 rounded-full mb-3 text-teal-400">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">{t('adminLogin')}</h2>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'en' ? 'Protected Administrator Portal' : '受保护的管理员控制通道'}
              </p>
            </div>

            {adminError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs mb-6 font-semibold">
                {adminError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('email')}</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@guandan.com"
                  className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl focus:border-teal-500 focus:outline-none text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('password')}</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl focus:border-teal-500 focus:outline-none text-white text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold py-3 rounded-xl shadow-lg hover:shadow-teal-500/10 transition flex items-center justify-center space-x-2 text-sm uppercase tracking-wider"
              >
                <span>{t('adminLogin')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      ) : (

        /* ADMIN CONTENT */
        <div className="flex flex-col lg:flex-row min-h-screen">
          
          {/* SIDEBAR NAVIGATION */}
          <aside className="w-full lg:w-64 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between">
            <div className="p-6">
              <div className="flex items-center space-x-2.5 mb-8">
                <div className="bg-teal-500/10 border border-teal-500/30 p-2 rounded-xl text-teal-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white leading-none">GuanDan Admin</h3>
                  <span className="text-[10px] text-slate-500 font-mono">v1.0.0 (Bilingual)</span>
                </div>
              </div>

              <nav className="space-y-1.5">
                <button
                  onClick={() => setActiveTab('approvals')}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${activeTab === 'approvals' ? 'bg-teal-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{t('playersApp')}</span>
                  {pendingCount > 0 && (
                    <span className={`ml-auto px-1.5 py-0.5 text-[9px] rounded-full font-bold ${activeTab === 'approvals' ? 'bg-slate-950 text-white' : 'bg-teal-500/20 text-teal-400'}`}>
                      {pendingCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('players')}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${activeTab === 'players' ? 'bg-teal-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                >
                  <Users className="w-4 h-4" />
                  <span>{t('playerList')}</span>
                </button>

                <button
                  onClick={() => setActiveTab('rooms')}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${activeTab === 'rooms' ? 'bg-teal-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                >
                  <Activity className="w-4 h-4" />
                  <span>{t('roomList')}</span>
                </button>

                <button
                  onClick={() => setActiveTab('records')}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${activeTab === 'records' ? 'bg-teal-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                >
                  <FileText className="w-4 h-4" />
                  <span>{t('gameRecords')}</span>
                </button>

                <button
                  onClick={() => setActiveTab('admins')}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${activeTab === 'admins' ? 'bg-teal-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                >
                  <Key className="w-4 h-4" />
                  <span>{language === 'zh' ? '管理员管理' : 'Admins Management'}</span>
                </button>
              </nav>
            </div>

            <div className="p-6 border-t border-slate-800">
              <button
                onClick={() => {
                  setIsAdminLoggedIn(false);
                  supabase.auth.signOut().catch(err => console.error('Supabase admin sign out failed:', err));
                  if (onLogout) onLogout();
                }}
                className="w-full py-2 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-red-400 transition text-xs font-bold rounded-xl border border-slate-800"
              >
                {t('adminLogout')}
              </button>
            </div>
          </aside>

          {/* MAIN WORKSPACE CONTENT */}
          <main className="flex-1 p-6 lg:p-8 space-y-6">
            
            {/* WORKSPACE HEADER */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">{t('adminDashboard')}</h2>
                <p className="text-xs text-slate-500 mt-1">Review registrations, manage active terms rooms, resolve dispute sheets.</p>
              </div>
            </div>

            {adminUsersError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm font-semibold">
                {adminUsersError}
              </div>
            )}

            {/* METRICS COUNTER BOARD */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-4">
                <div className="p-3 bg-teal-500/15 rounded-xl text-teal-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('playerList')}</span>
                  <p className="text-lg font-black text-slate-200 mt-0.5">{users.length}</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-4">
                <div className="p-3 bg-yellow-500/15 rounded-xl text-yellow-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('Pending')}</span>
                  <p className="text-lg font-black text-slate-200 mt-0.5">{pendingCount}</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-4">
                <div className="p-3 bg-emerald-500/15 rounded-xl text-emerald-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('roomStatus')}</span>
                  <p className="text-lg font-black text-slate-200 mt-0.5">{activeRoomsCount} / 24</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-4">
                <div className="p-3 bg-purple-500/15 rounded-xl text-purple-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('gameRecords')}</span>
                  <p className="text-lg font-black text-slate-200 mt-0.5">{scoresHistory.length}</p>
                </div>
              </div>
            </div>

            {/* TAB CONTENT: 1. REGISTRATION APPROVALS */}
            {activeTab === 'approvals' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-base font-bold text-slate-200 mb-4">{t('playersApp')}</h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">{t('fullName')}</th>
                        <th className="px-4 py-3">{t('nickname')}</th>
                        <th className="px-4 py-3">{t('email')}</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Preferred Lang</th>
                        <th className="px-4 py-3">Registered Date</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {users.filter(u => u.status === 'Pending').length > 0 ? (
                        users.filter(u => u.status === 'Pending').map((p) => (
                          <tr key={p.id} className="hover:bg-slate-800/30 transition text-xs font-mono">
                            <td className="px-4 py-3 font-semibold text-slate-200">{p.fullName}</td>
                            <td className="px-4 py-3 text-teal-400">{p.displayName}</td>
                            <td className="px-4 py-3 text-slate-300">{p.email}</td>
                            <td className="px-4 py-3 text-slate-500">{p.phone || '-'}</td>
                            <td className="px-4 py-3 uppercase text-[10px] font-bold text-slate-400">{p.preferredLanguage}</td>
                            <td className="px-4 py-3 text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                onClick={() => onApproveUser(p.id)}
                                className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-[10px] uppercase transition"
                              >
                                {t('approve')}
                              </button>
                              <button
                                onClick={() => onRejectUser(p.id)}
                                className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-lg text-[10px] uppercase border border-red-500/20 transition"
                              >
                                {t('reject')}
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">{t('noPending')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 2. PLAYER ACCOUNT DIRECTORY */}
            {activeTab === 'players' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="text-base font-bold text-slate-200">{t('playerList')}</h3>
                  
                  {/* Search box */}
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder={t('searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 pl-9 pr-4 py-2 rounded-xl text-xs focus:border-teal-500 focus:outline-none placeholder-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">{t('fullName')}</th>
                        <th className="px-4 py-3">{t('nickname')}</th>
                        <th className="px-4 py-3">{t('email')}</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Lang</th>
                        <th className="px-4 py-3 text-right">Operations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredPlayers.length > 0 ? (
                        filteredPlayers.map((p) => {
                          const statusBg = p.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : p.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20';
                          return (
                            <tr key={p.id} className="hover:bg-slate-800/30 transition text-xs font-mono">
                              <td className="px-4 py-3 font-semibold text-slate-200">{p.fullName}</td>
                              <td className="px-4 py-3 text-teal-400">{p.displayName}</td>
                              <td className="px-4 py-3 text-slate-300">{p.email}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusBg}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 uppercase text-[10px] font-bold text-slate-500">{p.preferredLanguage}</td>
                              <td className="px-4 py-3 text-right space-x-2">
                                <button
                                  onClick={() => onResetPassword(p.id)}
                                  className="p-1.5 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition inline-flex items-center"
                                  title="Reset Password"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>
                                {p.status === 'Approved' ? (
                                  <button
                                    onClick={() => onSuspendUser(p.id)}
                                    className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold border border-red-500/20 rounded-lg text-[10px] uppercase transition"
                                  >
                                    {t('suspend')}
                                  </button>
                                ) : (
                                  p.status === 'Suspended' && (
                                    <button
                                      onClick={() => onReactivateUser(p.id)}
                                      className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/20 rounded-lg text-[10px] uppercase transition"
                                    >
                                      {t('reactivate')}
                                    </button>
                                  )
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">{t('noPlayers')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 3. ROOM LOBBY MONITOR */}
            {activeTab === 'rooms' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-200">{t('roomList')}</h3>
                  <span className="text-xs text-slate-400">
                    {language === 'zh' ? '💡 提示: 右键点击任意房间可以 "reset to 空闲"' : '💡 Tip: Right-click any room to "reset to 空闲"'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {rooms.map((r) => {
                    const hasPlayers = r.currentPlayerCount > 0;
                    const statusText = r.currentPlayerCount >= 4 ? t('playing') : hasPlayers ? t('waiting') : t('empty');
                    const statusColor = r.currentPlayerCount >= 4 ? 'bg-purple-500/15 text-purple-400 border-purple-500/20' : hasPlayers ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' : 'bg-slate-950 text-slate-500 border-slate-850';

                    return (
                      <div 
                        key={r.id} 
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            roomId: r.id
                          });
                        }}
                        className="bg-slate-950 border border-slate-850 p-4.5 rounded-xl hover:border-slate-800 transition space-y-3 cursor-context-menu select-none relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-600">ID #{r.id.toString().padStart(2, '0')}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                            {statusText}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-slate-200">
                            {language === 'en' ? r.nameEn : r.nameZh}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">Seated Players: <strong className="text-slate-300 font-mono">{r.currentPlayerCount} / 4</strong></p>
                        </div>

                        <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>WebRTC Mute Link:</span>
                          <span className="text-emerald-400 font-bold uppercase">SECURED</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT: 4. HISTORIC GAME RECORDS */}
            {activeTab === 'records' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-slate-200">{t('gameRecords')}</h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">{t('roomName')}</th>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Team A Score Change</th>
                        <th className="px-4 py-3">Team B Score Change</th>
                        <th className="px-4 py-3">Winner</th>
                        <th className="px-4 py-3">Mode</th>
                        <th className="px-4 py-3">{t('notes')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {scoresHistory.length > 0 ? (
                        scoresHistory.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-800/30 transition text-xs font-mono">
                            <td className="px-4 py-3 font-semibold text-slate-200">{rec.roomName}</td>
                            <td className="px-4 py-3 text-slate-500">{rec.date}</td>
                            <td className="px-4 py-3 text-emerald-400">
                              +{rec.teamAScoreChange} <span className="text-slate-500 text-[10px]">({rec.teamAFinalLevel})</span>
                            </td>
                            <td className="px-4 py-3 text-emerald-400">
                              +{rec.teamBScoreChange} <span className="text-slate-500 text-[10px]">({rec.teamBFinalLevel})</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${rec.winningTeam === 'A' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                Team {rec.winningTeam}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[9px] uppercase font-bold text-slate-500">{rec.scoringMode}</td>
                            <td className="px-4 py-3 text-slate-400 italic max-w-xs truncate">{rec.notes || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">{t('noRecords')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 5. ADMINISTRATORS MANAGEMENT */}
            {activeTab === 'admins' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                {/* Add Admin Form */}
                <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-base font-bold text-slate-200">
                    {language === 'zh' ? '添加新管理员' : 'Add New Administrator'}
                  </h3>
                  
                  {adminFormError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-xl">
                      {adminFormError}
                    </div>
                  )}
                  {adminFormSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-2 rounded-xl">
                      {adminFormSuccess}
                    </div>
                  )}

                  <form onSubmit={handleAddAdmin} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        {language === 'zh' ? '管理员姓名' : 'Full Name'}
                      </label>
                      <input
                        type="text"
                        required
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 transition"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        {language === 'zh' ? '邮箱地址' : 'Email Address'}
                      </label>
                      <input
                        type="email"
                        required
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 transition"
                        placeholder="newadmin@guandan.com"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        {language === 'zh' ? '管理登录密码' : 'Password'}
                      </label>
                      <input
                        type="password"
                        required
                        value={newAdminPass}
                        onChange={(e) => setNewAdminPass(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 transition"
                        placeholder="••••••••"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isCreatingAdmin}
                      className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-teal-500/5 hover:shadow-teal-500/10"
                    >
                      {language === 'zh' ? '确认创建管理员' : 'Create Administrator'}
                    </button>
                  </form>
                </div>

                {/* Admins list */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-base font-bold text-slate-200">
                    {language === 'zh' ? '当前管理员列表' : 'Administrator List'}
                  </h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                      <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">{language === 'zh' ? '姓名' : 'Name'}</th>
                          <th className="px-4 py-3">{language === 'zh' ? '账号邮箱' : 'Email'}</th>
                          <th className="px-4 py-3">{language === 'zh' ? '创建时间' : 'Created At'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {adminsList.map((a) => (
                          <tr key={a.email} className="hover:bg-slate-800/30 transition text-xs font-mono">
                            <td className="px-4 py-3 font-semibold text-slate-200">{a.name}</td>
                            <td className="px-4 py-3 text-slate-300">{a.email}</td>
                            <td className="px-4 py-3 text-slate-500">{new Date(a.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </main>
        </div>
      )}

      {/* Floating Right-Click Context Menu for Room Reset */}
      {contextMenu.visible && (
        <>
          <div 
            className="fixed inset-0 z-50 cursor-default bg-transparent"
            onClick={() => setContextMenu({ visible: false, x: 0, y: 0, roomId: null })}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ visible: false, x: 0, y: 0, roomId: null });
            }}
          />
          <div 
            className="fixed bg-slate-900 border border-slate-800 rounded-xl py-1 w-48 shadow-2xl z-50 text-left overflow-hidden border-red-500/20"
            style={{ 
              top: `${contextMenu.y}px`, 
              left: `${contextMenu.x}px` 
            }}
          >
            <button
              onClick={() => {
                if (contextMenu.roomId !== null) {
                  handleResetRoom(contextMenu.roomId);
                }
                setContextMenu({ visible: false, x: 0, y: 0, roomId: null });
              }}
              className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center space-x-2 transition"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span>{language === 'zh' ? 'reset to 空闲' : 'reset to 空闲'}</span>
            </button>
          </div>
        </>
      )}

    </div>
  );
}
