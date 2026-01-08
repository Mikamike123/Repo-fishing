// components/ProfileView.tsx - Version 10.7.0 (Data Dashboard Only)
import React, { useState, useMemo, useEffect } from 'react';
import { 
    User, Calendar, Fish, 
    AlertOctagon, Anchor, Target,
    Waves, ChevronDown
} from 'lucide-react';
import { Session, UserProfile, AppData } from '../types';
import { buildUserHistory } from '../lib/gamification';

// IMPORTS MODULAIRES
import { RecordsGrid } from './RecordsGrid';
import StrategicIntelligence from './StrategicIntelligence';
import { ProfileEditor } from './ProfileEditor'; // Michael : On importe le nouveau gardien

interface ProfileViewProps {
  userProfile: UserProfile | null;
  sessions: Session[];
  arsenalData: AppData;
  onUpdateProfile: (newProfile: UserProfile) => void;
  onLogout: () => void;
  themeMode: 'light' | 'night' | 'auto';
  isActuallyNight?: boolean;
  isNewUser?: boolean;
  onCreateProfile?: (pseudo: string) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ 
    userProfile, sessions, arsenalData, onUpdateProfile, onLogout, 
    themeMode, isActuallyNight = false, isNewUser, onCreateProfile 
}) => {
  const [newPseudo, setNewPseudo] = useState('');
  const [expandedYear, setExpandedYear] = useState<number | null>(new Date().getFullYear());
  const [showStrategic, setShowStrategic] = useState(true); 

  // --- SONDE DE DIAGNOSTIC ---
  useEffect(() => {
    if (userProfile) {
      console.log(`%c 🛡️ ORACLE DASHBOARD READY [${new Date().toLocaleTimeString()}] `, 'background: #064e3b; color: #34d399; font-weight: bold;');
    }
  }, [userProfile]);

  // --- LOGIQUE ONBOARDING (Michael : On garde ça ici car c'est un état global de la vue) ---
  if (isNewUser || !userProfile) {
      return (
          <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center px-10 overflow-y-auto animate-in fade-in duration-700 ${isActuallyNight ? 'bg-[#1c1917]' : 'bg-[#FAFAF9]'}`}>
              <div className="absolute top-[-10%] left-[-10%] w-80 h-80 bg-amber-500/10 rounded-full blur-[100px]" />
              <div className="w-full max-w-md space-y-12 relative z-10 py-10">
                  <div className="text-center space-y-6">
                      <div className="w-28 h-28 bg-gradient-to-br from-amber-400 to-amber-600 rounded-[3rem] mx-auto flex items-center justify-center shadow-2xl rotate-3">
                          <Waves size={56} className="text-white" />
                      </div>
                      <div className="space-y-2">
                          <h1 className={`text-6xl font-black tracking-tighter uppercase italic leading-[0.9] ${isActuallyNight ? 'text-white' : 'text-stone-900'}`}>
                              Oracle <br/> <span className="text-amber-500">Fishing</span>
                          </h1>
                          <p className="text-stone-500 font-bold uppercase tracking-[0.25em] text-[11px]">L'intelligence au service de l'eau</p>
                      </div>
                  </div>
                  <div className="space-y-8">
                      <div className={`p-10 rounded-[3.5rem] border-2 ${isActuallyNight ? 'bg-stone-900/50 border-stone-800' : 'bg-white border-stone-100 shadow-xl'}`}>
                          <div className="flex items-center gap-3 mb-6">
                            <User size={16} className="text-amber-500" />
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Identité Oracle</label>
                          </div>
                          <input 
                              type="text" 
                              value={newPseudo}
                              onChange={(e) => setNewPseudo(e.target.value)}
                              placeholder="Ton Pseudo..."
                              className={`w-full bg-transparent text-4xl font-black tracking-tighter border-b-4 focus:outline-none transition-colors ${
                                  isActuallyNight ? 'text-white border-stone-800 focus:border-amber-500' : 'text-stone-800 border-stone-100 focus:border-amber-500'
                              }`}
                          />
                      </div>
                      <button disabled={newPseudo.length < 3} onClick={() => onCreateProfile?.(newPseudo)} className={`w-full p-8 rounded-[2.5rem] font-black uppercase tracking-[0.3em] transition-all active:scale-[0.97] text-sm shadow-2xl ${newPseudo.length >= 3 ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'}`}>
                          Activer mon profil
                      </button>
                      <button onClick={onLogout} className="w-full text-[10px] font-black uppercase text-stone-500 tracking-widest opacity-40 text-center">Annuler</button>
                  </div>
              </div>
          </div>
      );
  }

  // --- CALCUL DES STATS ---
  const userSessions = useMemo(() => sessions.filter(s => s.userId === userProfile.id), [sessions, userProfile.id]);
  const historyStats = useMemo(() => buildUserHistory(userSessions), [userSessions]);

  const statsByYear = useMemo(() => {
    const stats: Record<number, any> = {};
    userSessions.forEach(session => {
      const year = new Date(session.date).getFullYear();
      if (!stats[year]) stats[year] = { sessions: [], sessionsCount: 0, catchesCount: 0, missesCount: 0 };
      stats[year].sessions.push(session);
      stats[year].sessionsCount += 1;
      stats[year].catchesCount += (session.catches?.length || 0);
      stats[year].missesCount += (session.misses?.length || 0);
    });
    return Object.entries(stats).sort(([a], [b]) => Number(b) - Number(a)).map(([year, data]) => ({ year: Number(year), ...data }));
  }, [userSessions]);

  return (
    <div className="pb-24 animate-in fade-in duration-300 space-y-8 px-4">
      {/* Michael : La zone d'édition est désormais déportée */}
      <ProfileEditor 
        userProfile={userProfile}
        onUpdateProfile={onUpdateProfile}
        onLogout={onLogout}
        themeMode={themeMode}
        isActuallyNight={isActuallyNight}
      />

      {/* HALL OF FAME */}
      <div className={`rounded-[3rem] p-10 border-2 relative overflow-hidden ${isActuallyNight ? 'bg-[#1c1917] border-amber-900/30' : 'bg-[#FFFDF9] border-amber-100 shadow-xl'}`}>
        <div className="text-center mb-10">
          <h2 className={`text-3xl font-black tracking-tighter uppercase leading-none ${isActuallyNight ? 'text-amber-500' : 'text-amber-900'}`}>Hall of Fame Oracle</h2>
          <div className="h-1 w-12 bg-amber-400 mx-auto mt-3 rounded-full"></div>
        </div>
        {userSessions.length > 0 ? <RecordsGrid sessions={userSessions} title="Records de légende" isGold={true} isActuallyNight={isActuallyNight} /> : <div className="text-center p-6 opacity-50 uppercase font-black text-[10px] tracking-widest text-stone-500">Aucune session</div>}
      </div>

      {/* INTELLIGENCE STRATÉGIQUE */}
      {userSessions.length > 0 && (
        <div className={`rounded-[2.5rem] border transition-all duration-500 ${showStrategic ? (isActuallyNight ? 'border-emerald-900/50 bg-[#292524]' : 'shadow-xl border-emerald-100 bg-white') : (isActuallyNight ? 'border-stone-800' : 'bg-white border-stone-100')}`}>
            <button onClick={() => setShowStrategic(!showStrategic)} className="w-full flex justify-between items-center p-8 outline-none focus:outline-none">
                <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl ${showStrategic ? 'bg-emerald-500 text-white shadow-lg' : 'bg-stone-50/10 text-stone-500'}`}><Target size={28} /></div>
                    <div className="text-left">
                        <h2 className={`text-3xl font-black tracking-tighter uppercase leading-none ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>Intelligence</h2>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Analyse prédictive</p>
                    </div>
                </div>
                <ChevronDown className={`transition-transform duration-300 ${showStrategic ? 'rotate-180' : ''}`} />
            </button>
            {showStrategic && <div className="px-8 pb-10 animate-in fade-in duration-500"><StrategicIntelligence sessions={userSessions} userId={userProfile.id} arsenal={arsenalData} hideHeader={true} isActuallyNight={isActuallyNight} /></div>}
        </div>
      )}

      {/* STATS ANNUELLES */}
      <div className="space-y-6">
        {statsByYear.length > 0 ? statsByYear.map((stat) => {
            const isOpen = expandedYear === stat.year;
            const yearGamified = historyStats[stat.year];
            return (
                <div key={stat.year} className={`rounded-[2.5rem] border transition-all ${isOpen ? (isActuallyNight ? 'border-amber-900/50 bg-[#292524]' : 'shadow-xl border-amber-200 bg-white') : (isActuallyNight ? 'border-stone-800 bg-[#292524]' : 'bg-white border-stone-100')}`}>
                <button onClick={() => setExpandedYear(isOpen ? null : stat.year)} className="w-full flex justify-between items-center p-8 outline-none">
                    <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl ${isOpen ? 'bg-amber-500 text-white' : 'bg-stone-50/10 text-stone-500'}`}><Calendar size={28} /></div>
                    <div className="text-left">
                        <span className={`block text-4xl font-black tracking-tighter ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>{stat.year}</span>
                        {yearGamified && <span className="text-[10px] font-bold text-amber-500 uppercase">Niv {yearGamified.levelReached} • {yearGamified.xpTotal.toLocaleString()} XP</span>}
                    </div>
                    </div>
                    <ChevronDown className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="px-8 pb-10 space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="grid grid-cols-3 gap-4">
                            <StatBox label="Sorties" value={stat.sessionsCount} icon={<Anchor size={20}/>} theme="stone" isActuallyNight={isActuallyNight} />
                            <StatBox label="Prises" value={stat.catchesCount} icon={<Fish size={20}/>} theme="amber" isActuallyNight={isActuallyNight} />
                            <StatBox label="Ratés" value={stat.missesCount} icon={<AlertOctagon size={20}/>} theme="rose" isActuallyNight={isActuallyNight} />
                        </div>
                        <RecordsGrid sessions={stat.sessions} title={`Records ${stat.year}`} isActuallyNight={isActuallyNight} />
                    </div>
                )}
                </div>
            );
        }) : <div className="text-center py-20 opacity-30 font-black uppercase text-xs text-stone-500 tracking-widest">Aucune archive</div>}
      </div>
    </div>
  );
};

const StatBox = ({ label, value, icon, theme, isActuallyNight }: any) => {
    const themes: any = {
        stone: isActuallyNight ? "bg-stone-800 border-stone-700 text-stone-100" : "bg-stone-50 border-stone-100 text-stone-700",
        amber: isActuallyNight ? "bg-amber-900/10 border-amber-900/30 text-amber-500" : "bg-amber-50 border-amber-100 text-amber-800",
        rose: isActuallyNight ? "bg-rose-900/10 border-rose-900/30 text-rose-400" : "bg-rose-50 border-rose-100 text-rose-800"
    };
    return (
        <div className={`${themes[theme]} p-5 rounded-[2rem] border flex flex-col items-center shadow-sm`}>
            <div className={`mb-2 p-2 rounded-full ${isActuallyNight ? 'bg-stone-900 text-stone-400' : 'bg-white text-stone-500'}`}>{icon}</div>
            <span className="text-3xl font-black tracking-tighter">{value}</span>
            <span className="text-[9px] font-black uppercase opacity-60 tracking-widest mt-1">{label}</span>
        </div>
    );
};

export default ProfileView;