// components/ProfileView.tsx - Version 9.6 (Strategic Foldable Logic)
import React, { useState, useMemo, useRef } from 'react';
import { 
    User, Camera, Calendar, Fish, 
    AlertOctagon, Anchor, PieChart, 
    ChevronUp, ChevronDown, Trophy, Flame, LogOut, Info, Target // Michael : Ajout de Target pour le header
} from 'lucide-react';
import { Session, UserProfile, AppData } from '../types';
import { doc, updateDoc } from 'firebase/firestore'; 
import { db } from '../lib/firebase';
import { buildUserHistory } from '../lib/gamification';

// IMPORTS MODULAIRES
import { RecordsGrid } from './RecordsGrid';
import StrategicIntelligence from './StrategicIntelligence';

interface ProfileViewProps {
  userProfile: UserProfile;
  sessions: Session[];
  arsenalData: AppData;
  onUpdateProfile: (newProfile: UserProfile) => void;
  onLogout: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ userProfile, sessions, arsenalData, onUpdateProfile, onLogout }) => {
  const [expandedYear, setExpandedYear] = useState<number | null>(new Date().getFullYear());
  const [showDonutYear, setShowDonutYear] = useState<number | null>(null);
  const [showStrategic, setShowStrategic] = useState(true); // Michael : État pour le plier/déplier
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. FILTRAGE ÉTANCHE PAR UTILISATEUR ---
  const userSessions = useMemo(() => {
    const targetId = userProfile.id;
    if (!targetId) {
        console.warn("ProfileView: userProfile.id est manquant. Vérifiez App.tsx.");
        return [];
    }
    return sessions.filter(s => s.userId === targetId);
  }, [sessions, userProfile.id]);

  // Calcul de l'historique Gamifié (Oracle Season)
  const historyStats = useMemo(() => {
    return buildUserHistory(userSessions);
  }, [userSessions]);

  // --- 2. LOGIQUE D'AGRÉGATION ANNUELLE ---
  const statsByYear = useMemo(() => {
    const stats: Record<number, any> = {};
    userSessions.forEach(session => {
      const year = new Date(session.date).getFullYear();
      if (!stats[year]) {
        stats[year] = { sessions: [], sessionsCount: 0, catchesCount: 0, missesCount: 0, speciesBreakdown: {} };
      }
      stats[year].sessions.push(session);
      stats[year].sessionsCount += 1;
      stats[year].catchesCount += (session.catches?.length || 0);
      stats[year].missesCount += (session.misses?.length || 0);
      session.catches?.forEach(c => {
        stats[year].speciesBreakdown[c.species] = (stats[year].speciesBreakdown[c.species] || 0) + 1;
      });
    });
    return Object.entries(stats).sort(([a], [b]) => Number(b) - Number(a)).map(([year, data]) => ({ year: Number(year), ...data }));
  }, [userSessions]);

  // --- 3. HELPERS GRAPHIQUES ---
  const getConicGradient = (breakdown: Record<string, number>, total: number) => {
    if (total === 0) return 'conic-gradient(#e5e7eb 0deg 360deg)';
    let currentDeg = 0;
    const colors: any = { 'Brochet': '#a8a29e', 'Sandre': '#fbbf24', 'Perche': '#34d399', 'Silure': '#64748b' };
    const segments = Object.entries(breakdown).map(([sp, count]) => {
      const deg = ((count as number) / total) * 360;
      const res = `${colors[sp] || '#cbd5e1'} ${currentDeg}deg ${currentDeg + deg}deg`;
      currentDeg += deg;
      return res;
    });
    return `conic-gradient(${segments.join(', ')})`;
  };

  const getSpeciesColor = (species: string) => {
    const colors: Record<string, string> = { 'Brochet': 'bg-stone-400', 'Sandre': 'bg-amber-400', 'Perche': 'bg-emerald-400' };
    return colors[species] || 'bg-blue-300';
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || file.size > 2 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64 = reader.result as string;
          try {
              await updateDoc(doc(db, "users", userProfile.id), { avatarBase64: base64 });
              onUpdateProfile({ ...userProfile, avatarBase64: base64 });
          } catch (e) { console.error(e); }
      };
      reader.readAsDataURL(file);
  };

  return (
    <div className="pb-24 animate-in fade-in duration-300 space-y-8 px-4">
      
      {/* HEADER PROFIL */}
      <div className="flex flex-col items-center pt-8 relative">
        <button 
            onClick={onLogout}
            className="absolute top-4 right-0 p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all active:scale-95 flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest shadow-sm border border-red-100"
        >
            <LogOut size={14} /> Déconnexion
        </button>

        <div className="relative w-32 h-32 bg-white rounded-full mb-6 border-[6px] border-white shadow-2xl overflow-hidden group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          {userProfile.avatarBase64 ? <img src={userProfile.avatarBase64} className="w-full h-full object-cover" alt="Profile" /> : <User size={56} className="m-auto mt-8 text-stone-200" />}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera size={28} className="text-white" /></div>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        
        <h1 className="text-4xl font-black text-stone-800 tracking-tighter uppercase italic mb-8">{userProfile.pseudo}</h1>
      </div>

      {/* 🏆 HALL OF FAME GLOBAL */}
      <div className="bg-[#FFFDF9] rounded-[3rem] p-10 border-2 border-amber-100 shadow-xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-200/20 rounded-full blur-3xl"></div>
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-amber-900 tracking-tighter uppercase leading-none">Hall of Fame Oracle</h2>
          <div className="h-1 w-12 bg-amber-400 mx-auto mt-3 rounded-full"></div>
          <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-[0.3em] mt-3">Tes exploits légendaires</p>
        </div>
        
        {userSessions.length > 0 ? (
            <RecordsGrid sessions={userSessions} title="Records de tous les temps" isGold={true} />
        ) : (
            <div className="text-center p-6 bg-amber-50/50 rounded-2xl border border-amber-100">
                <Info className="mx-auto text-amber-400 mb-2" size={24} />
                <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Aucune session enregistrée pour cet ID</p>
            </div>
        )}
      </div>

      {/* MICHAEL : INTELLIGENCE STRATÉGIQUE (Version Rétractable) */}
      {userSessions.length > 0 && (
        <div className={`bg-white rounded-[2.5rem] border transition-all duration-500 ${showStrategic ? 'shadow-xl border-emerald-100' : 'shadow-sm border-stone-100'}`}>
            <button 
                onClick={() => setShowStrategic(!showStrategic)} 
                className="w-full flex justify-between items-center p-8 outline-none"
            >
                <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl transition-all ${showStrategic ? 'bg-emerald-500 text-white shadow-lg scale-110' : 'bg-stone-50 text-stone-300'}`}>
                        <Target size={28} />
                    </div>
                    <div className="text-left">
                        <h2 className="text-3xl font-black text-stone-800 tracking-tighter uppercase leading-none">Intelligence Stratégique</h2>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Analyse prédictive de vos patterns</p>
                    </div>
                </div>
                <ChevronDown className={`transition-transform duration-300 ${showStrategic ? 'rotate-180' : ''} text-stone-300`} />
            </button>

            {showStrategic && (
                <div className="px-8 pb-10 animate-in fade-in slide-in-from-top-4 duration-500">
                    <StrategicIntelligence 
                        sessions={userSessions} 
                        userId={userProfile.id} 
                        arsenal={arsenalData} 
                        hideHeader={true} // Michael : On cache le header interne car on utilise le nôtre au-dessus
                    />
                </div>
            )}
        </div>
      )}

      {/* STATS ANNUELLES */}
      <div className="space-y-6">
        {statsByYear.length > 0 ? (
            statsByYear.map((stat) => {
                const isOpen = expandedYear === stat.year;
                const isDonutOpen = showDonutYear === stat.year;
                const yearGamified = historyStats[stat.year];

                return (
                    <div key={stat.year} className={`bg-white rounded-[2.5rem] border transition-all duration-500 ${isOpen ? 'shadow-xl border-amber-200' : 'shadow-sm border-stone-100'}`}>
                    <button onClick={() => setExpandedYear(isOpen ? null : stat.year)} className="w-full flex justify-between items-center p-8 outline-none">
                        <div className="flex items-center gap-5">
                        <div className={`p-4 rounded-2xl transition-all ${isOpen ? 'bg-amber-500 text-white shadow-lg scale-110' : 'bg-stone-50 text-stone-300'}`}><Calendar size={28} /></div>
                        <div className="text-left">
                            <span className="block text-4xl font-black text-stone-800 tracking-tighter">{stat.year}</span>
                            <div className="flex items-center space-x-2 mt-1">
                                {yearGamified && (
                                    <>
                                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center border border-amber-200">
                                            <Trophy size={10} className="mr-1" /> NIV {yearGamified.levelReached}
                                        </span>
                                        <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-1">
                                            {yearGamified.xpTotal.toLocaleString()} XP
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        </div>
                        <ChevronDown className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} text-stone-300`} />
                    </button>

                    {isOpen && (
                        <div className="px-8 pb-10 space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
                        {yearGamified && yearGamified.weeksWithStreak > 0 && (
                            <div className="flex items-center justify-center space-x-2 bg-emerald-50 py-2 rounded-xl border border-emerald-100">
                                <Flame size={16} className="text-emerald-500" />
                                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                                    {yearGamified.weeksWithStreak} Semaines validées (Objectif Tenue)
                                </span>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-4">
                            <StatBox label="Sorties" value={stat.sessionsCount} icon={<Anchor size={20}/>} theme="stone" />
                            <StatBox label="Prises" value={stat.catchesCount} icon={<Fish size={20}/>} theme="amber" />
                            <StatBox label="Ratés" value={stat.missesCount} icon={<AlertOctagon size={20}/>} theme="rose" />
                        </div>

                        <div className="bg-stone-50/50 rounded-[2rem] p-5 border border-stone-100">
                            <button onClick={() => setShowDonutYear(isDonutOpen ? null : stat.year)} className="w-full flex items-center justify-between text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] px-2">
                                <span className="flex items-center gap-2"><PieChart size={16} className="text-amber-500" /> Répartition par Espèce</span>
                                {isDonutOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {isDonutOpen && (
                                <div className="pt-8 flex flex-col items-center animate-in zoom-in duration-300">
                                    <div className="relative w-44 h-44 mb-8">
                                        <div className="w-full h-full rounded-full transition-all duration-700" style={{ background: getConicGradient(stat.speciesBreakdown, stat.catchesCount) }}></div>
                                        <div className="absolute inset-0 m-auto w-28 h-28 bg-white rounded-full shadow-inner flex flex-col items-center justify-center">
                                            <span className="text-4xl font-black text-stone-800 tracking-tighter">{stat.catchesCount}</span>
                                            <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Total</span>
                                        </div>
                                    </div>
                                    <div className="w-full grid grid-cols-2 gap-3">
                                        {Object.entries(stat.speciesBreakdown).sort(([,a]: any, [,b]: any) => b - a).map(([sp, count]: any) => (
                                            <div key={sp} className="bg-white p-3 rounded-xl border border-stone-100 flex justify-between items-center shadow-sm">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getSpeciesColor(sp)}`}></div>
                                                    <span className="text-xs font-bold text-stone-600 uppercase truncate">{sp}</span>
                                                </div>
                                                <span className="text-sm font-black text-stone-800">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <RecordsGrid sessions={stat.sessions} title={`Records de l'année ${stat.year}`} />
                        </div>
                    )}
                    </div>
                );
            })
        ) : (
            <div className="text-center py-20 bg-stone-50 rounded-[3rem] border border-dashed border-stone-200">
                <Info className="mx-auto text-stone-300 mb-4" size={48} />
                <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Aucune archive disponible</p>
            </div>
        )}
      </div>
    </div>
  );
};

const StatBox = ({ label, value, icon, theme }: any) => {
    const themes: any = {
        stone: "bg-stone-50 border-stone-100 text-stone-700 icon-stone-300",
        amber: "bg-amber-50 border-amber-100 text-amber-800 icon-amber-400",
        rose: "bg-rose-50 border-rose-100 text-rose-800 icon-rose-400"
    };
    const t = themes[theme] || themes.stone;
    return (
        <div className={`${t.split(' icon-')[0]} p-5 rounded-[2rem] border flex flex-col items-center shadow-sm`}>
            <div className={`${t.split(' icon-')[1]} mb-2 p-2 rounded-full bg-white shadow-sm`}>{icon}</div>
            <span className="text-3xl font-black tracking-tighter">{value}</span>
            <span className="text-[9px] font-black uppercase opacity-60 tracking-widest mt-1">{label}</span>
        </div>
    );
};

export default ProfileView;