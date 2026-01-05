// components/ProfileView.tsx - Version 9.9 (Soft Night Ops & Full Tutoiement)
import React, { useState, useMemo, useRef } from 'react';
import { 
    User, Camera, Calendar, Fish, 
    AlertOctagon, Anchor, PieChart, 
    ChevronUp, ChevronDown, Trophy, Flame, LogOut, Info, Target,
    Moon, Sun, Settings 
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
  themeMode: 'light' | 'night' | 'auto';
  isActuallyNight?: boolean; // Michael : Reçoit l'état visuel réel depuis App.tsx
}

const ProfileView: React.FC<ProfileViewProps> = ({ 
    userProfile, sessions, arsenalData, onUpdateProfile, onLogout, themeMode, isActuallyNight 
}) => {
  const [expandedYear, setExpandedYear] = useState<number | null>(new Date().getFullYear());
  const [showDonutYear, setShowDonutYear] = useState<number | null>(null);
  const [showStrategic, setShowStrategic] = useState(true); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. FILTRAGE ÉTANCHE PAR UTILISATEUR ---
  const userSessions = useMemo(() => {
    const targetId = userProfile.id;
    if (!targetId) return [];
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

  // Michael : Changement de thème avec sauvegarde Firestore
  const handleThemeChange = async (mode: 'light' | 'night' | 'auto') => {
      try {
          const userDocRef = doc(db, "users", userProfile.id);
          await updateDoc(userDocRef, { themePreference: mode });
          onUpdateProfile({ ...userProfile, themePreference: mode } as UserProfile);
      } catch (e) {
          console.error("Erreur thématique :", e);
      }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
          const img = new Image();
          img.src = reader.result as string;
          img.onload = async () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 300; 
              const scaleSize = MAX_WIDTH / img.width;
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scaleSize;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
              const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
              
              try {
                  const userDocRef = doc(db, "users", userProfile.id);
                  await updateDoc(userDocRef, { avatarBase64: compressedBase64 });
                  onUpdateProfile({ ...userProfile, avatarBase64: compressedBase64 });
              } catch (e) { 
                  alert("Erreur lors de l'envoi de ta photo.");
              }
          };
      };
      reader.readAsDataURL(file);
  };

  // Michael : Couleurs des cartes adaptatives
  const cardClass = isActuallyNight 
    ? "bg-[#292524] border-stone-800 shadow-none" 
    : "bg-white border-stone-100 shadow-sm";

  return (
    <div className="pb-24 animate-in fade-in duration-300 space-y-8 px-4">
      
      {/* HEADER PROFIL */}
      <div className="flex flex-col items-center pt-8 relative text-center">
        <button 
            onClick={onLogout}
            className={`absolute top-4 right-0 p-3 rounded-2xl transition-all active:scale-95 flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest border ${
                isActuallyNight ? 'bg-stone-900 border-stone-800 text-stone-400' : 'bg-red-50 border-red-100 text-red-500'
            }`}
        >
            <LogOut size={14} /> Déconnexion
        </button>

        <div className={`relative w-32 h-32 rounded-full mb-6 border-[6px] shadow-2xl overflow-hidden group cursor-pointer ${isActuallyNight ? 'border-stone-800 bg-stone-800' : 'border-white bg-white'}`} onClick={() => fileInputRef.current?.click()}>
          {userProfile.avatarBase64 ? <img src={userProfile.avatarBase64} className="w-full h-full object-cover" alt="Profile" /> : <User size={56} className="m-auto mt-8 text-stone-200" />}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera size={28} className="text-white" /></div>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        
        <h1 className={`text-4xl font-black tracking-tighter uppercase italic mb-8 ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>{userProfile.pseudo}</h1>
      </div>

      {/* MICHAEL : RÉGLAGES TACTIQUES (Night Ops) */}
      <div className={`rounded-[2.5rem] p-8 border space-y-6 transition-colors duration-500 ${cardClass}`}>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 flex items-center gap-2">
              <Settings size={14} className="text-amber-500" /> Ton setup visuel
          </h3>
          <div className="grid grid-cols-3 gap-2">
              <button 
                  onClick={() => handleThemeChange('light')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${themeMode === 'light' ? (isActuallyNight ? 'bg-amber-900/20 border-amber-500 text-amber-500' : 'bg-amber-50 border-amber-400 text-amber-900 shadow-md') : 'bg-stone-50/5 border-transparent text-stone-500'}`}
              >
                  <Sun size={20} />
                  <span className="text-[9px] font-black uppercase">Jour</span>
              </button>
              <button 
                  onClick={() => handleThemeChange('night')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${themeMode === 'night' ? (isActuallyNight ? 'bg-stone-900 border-amber-500 text-amber-500 shadow-lg' : 'bg-stone-900 border-stone-700 text-amber-400 shadow-md') : 'bg-stone-50/5 border-transparent text-stone-500'}`}
              >
                  <Moon size={20} />
                  <span className="text-[9px] font-black uppercase">Night Ops</span>
              </button>
              <button 
                  onClick={() => handleThemeChange('auto')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${themeMode === 'auto' ? (isActuallyNight ? 'bg-emerald-950 border-emerald-500 text-emerald-500' : 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-md') : 'bg-stone-50/5 border-transparent text-stone-500'}`}
              >
                  <div className="flex gap-0.5"><Sun size={12} /><Moon size={12} /></div>
                  <span className="text-[9px] font-black uppercase">Auto</span>
              </button>
          </div>
      </div>

      {/* 🏆 HALL OF FAME GLOBAL */}
      <div className={`rounded-[3rem] p-10 border-2 relative overflow-hidden ${isActuallyNight ? 'bg-[#1c1917] border-amber-900/30' : 'bg-[#FFFDF9] border-amber-100 shadow-xl'}`}>
        <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl ${isActuallyNight ? 'bg-amber-500/5' : 'bg-amber-200/20'}`}></div>
        <div className="text-center mb-10">
          <h2 className={`text-3xl font-black tracking-tighter uppercase leading-none ${isActuallyNight ? 'text-amber-500' : 'text-amber-900'}`}>Hall of Fame Oracle</h2>
          <div className="h-1 w-12 bg-amber-400 mx-auto mt-3 rounded-full"></div>
          <p className={`text-[10px] font-black uppercase tracking-[0.3em] mt-3 ${isActuallyNight ? 'text-stone-500' : 'text-amber-600/60'}`}>Tes exploits légendaires</p>
        </div>
        
        {userSessions.length > 0 ? (
            <RecordsGrid sessions={userSessions} title="Tes records de légende" isGold={true} isActuallyNight={isActuallyNight} />
        ) : (
            <div className={`text-center p-6 rounded-2xl border ${isActuallyNight ? 'bg-stone-900 border-stone-800 text-stone-500' : 'bg-amber-50/50 border-amber-100 text-amber-800'}`}>
                <Info className="mx-auto mb-2 opacity-50" size={24} />
                <p className="text-[10px] font-black uppercase tracking-widest">Aucune session enregistrée</p>
            </div>
        )}
      </div>

      {/* MICHAEL : INTELLIGENCE STRATÉGIQUE */}
      {userSessions.length > 0 && (
        <div className={`rounded-[2.5rem] border transition-all duration-500 ${showStrategic ? (isActuallyNight ? 'border-emerald-900/50 bg-[#292524]' : 'shadow-xl border-emerald-100 bg-white') : (isActuallyNight ? 'border-stone-800' : 'shadow-sm border-stone-100 bg-white')}`}>
            <button 
                onClick={() => setShowStrategic(!showStrategic)} 
                className="w-full flex justify-between items-center p-8 outline-none"
            >
                <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl transition-all ${showStrategic ? 'bg-emerald-500 text-white shadow-lg scale-110' : 'bg-stone-50/10 text-stone-500'}`}>
                        <Target size={28} />
                    </div>
                    <div className="text-left">
                        <h2 className={`text-3xl font-black tracking-tighter uppercase leading-none ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>Intelligence Stratégique</h2>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Analyse prédictive de tes patterns</p>
                    </div>
                </div>
                <ChevronDown className={`transition-transform duration-300 ${showStrategic ? 'rotate-180' : ''} text-stone-500`} />
            </button>

            {showStrategic && (
                <div className="px-8 pb-10 animate-in fade-in slide-in-from-top-4 duration-500">
                    <StrategicIntelligence 
                        sessions={userSessions} 
                        userId={userProfile.id} 
                        arsenal={arsenalData} 
                        hideHeader={true} 
                        isActuallyNight={isActuallyNight}
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
                    <div key={stat.year} className={`rounded-[2.5rem] border transition-all duration-500 ${isOpen ? (isActuallyNight ? 'border-amber-900/50 bg-[#292524]' : 'shadow-xl border-amber-200 bg-white') : (isActuallyNight ? 'border-stone-800 bg-[#292524]' : 'shadow-sm border-stone-100 bg-white')}`}>
                    <button onClick={() => setExpandedYear(isOpen ? null : stat.year)} className="w-full flex justify-between items-center p-8 outline-none">
                        <div className="flex items-center gap-5">
                        <div className={`p-4 rounded-2xl transition-all ${isOpen ? 'bg-amber-500 text-white shadow-lg scale-110' : 'bg-stone-50/10 text-stone-500'}`}><Calendar size={28} /></div>
                        <div className="text-left">
                            <span className={`block text-4xl font-black tracking-tighter ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>{stat.year}</span>
                            <div className="flex items-center space-x-2 mt-1">
                                {yearGamified && (
                                    <>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center border ${isActuallyNight ? 'bg-amber-900/20 border-amber-900/40 text-amber-500' : 'bg-amber-100 border-amber-200 text-amber-700'}`}>
                                            <Trophy size={10} className="mr-1" /> NIV {yearGamified.levelReached}
                                        </span>
                                        <span className="text-[10px] font-black uppercase text-stone-500 tracking-widest ml-1">
                                            {yearGamified.xpTotal.toLocaleString()} XP
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        </div>
                        <ChevronDown className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} text-stone-500`} />
                    </button>

                    {isOpen && (
                        <div className="px-8 pb-10 space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="grid grid-cols-3 gap-4">
                            <StatBox label="Sorties" value={stat.sessionsCount} icon={<Anchor size={20}/>} theme="stone" isActuallyNight={isActuallyNight} />
                            <StatBox label="Prises" value={stat.catchesCount} icon={<Fish size={20}/>} theme="amber" isActuallyNight={isActuallyNight} />
                            <StatBox label="Ratés" value={stat.missesCount} icon={<AlertOctagon size={20}/>} theme="rose" isActuallyNight={isActuallyNight} />
                        </div>

                        <div className={`rounded-[2rem] p-5 border ${isActuallyNight ? 'bg-stone-900/30 border-stone-800' : 'bg-stone-50/50 border-stone-100'}`}>
                            <button onClick={() => setShowDonutYear(isDonutOpen ? null : stat.year)} className="w-full flex items-center justify-between text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] px-2">
                                <span className="flex items-center gap-2"><PieChart size={16} className="text-amber-500" /> Ton mix d'espèces</span>
                                {isDonutOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {isDonutOpen && (
                                <div className="pt-8 flex flex-col items-center animate-in zoom-in duration-300">
                                    <div className="relative w-44 h-44 mb-8">
                                        <div className="w-full h-full rounded-full transition-all duration-700" style={{ background: getConicGradient(stat.speciesBreakdown, stat.catchesCount) }}></div>
                                        <div className={`absolute inset-0 m-auto w-28 h-28 rounded-full flex flex-col items-center justify-center ${isActuallyNight ? 'bg-stone-800 shadow-lg shadow-black/20' : 'bg-white shadow-inner'}`}>
                                            <span className={`text-4xl font-black tracking-tighter ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>{stat.catchesCount}</span>
                                            <span className="text-[8px] font-black text-stone-500 uppercase tracking-widest">Total</span>
                                        </div>
                                    </div>
                                    <div className="w-full grid grid-cols-2 gap-3">
                                        {Object.entries(stat.speciesBreakdown).sort(([,a]: any, [,b]: any) => b - a).map(([sp, count]: any) => (
                                            <div key={sp} className={`p-3 rounded-xl border flex justify-between items-center shadow-sm ${isActuallyNight ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-100'}`}>
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getSpeciesColor(sp)}`}></div>
                                                    <span className={`text-xs font-bold uppercase truncate ${isActuallyNight ? 'text-stone-300' : 'text-stone-600'}`}>{sp}</span>
                                                </div>
                                                <span className={`text-sm font-black ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <RecordsGrid sessions={stat.sessions} title={`Tes records ${stat.year}`} isActuallyNight={isActuallyNight} />
                        </div>
                    )}
                    </div>
                );
            })
        ) : (
            <div className={`text-center py-20 rounded-[3rem] border border-dashed ${isActuallyNight ? 'bg-stone-900/20 border-stone-800 text-stone-600' : 'bg-stone-50 border-stone-200 text-stone-400'}`}>
                <Info className="mx-auto mb-4 opacity-30" size={48} />
                <p className="font-bold uppercase tracking-widest text-xs">Aucune archive disponible</p>
            </div>
        )}
      </div>
    </div>
  );
};

const StatBox = ({ label, value, icon, theme, isActuallyNight }: any) => {
    const themes: any = {
        stone: isActuallyNight ? "bg-stone-800 border-stone-700 text-stone-100 icon-stone-600" : "bg-stone-50 border-stone-100 text-stone-700 icon-stone-300",
        amber: isActuallyNight ? "bg-amber-900/10 border-amber-900/30 text-amber-500 icon-amber-800" : "bg-amber-50 border-amber-100 text-amber-800 icon-amber-400",
        rose: isActuallyNight ? "bg-rose-900/10 border-rose-900/30 text-rose-400 icon-rose-800" : "bg-rose-50 border-rose-100 text-rose-800 icon-rose-400"
    };
    const t = themes[theme] || themes.stone;
    return (
        <div className={`${t.split(' icon-')[0]} p-5 rounded-[2rem] border flex flex-col items-center shadow-sm`}>
            <div className={`mb-2 p-2 rounded-full shadow-sm ${isActuallyNight ? 'bg-stone-900' : 'bg-white'}`}>{icon}</div>
            <span className="text-3xl font-black tracking-tighter">{value}</span>
            <span className="text-[9px] font-black uppercase opacity-60 tracking-widest mt-1">{label}</span>
        </div>
    );
};

export default ProfileView;