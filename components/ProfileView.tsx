// components/ProfileView.tsx - Version 10.5.0 (Editable Pseudo & Multi-Case)
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
    User, Camera, Calendar, Fish, 
    AlertOctagon, Anchor, PieChart, 
    ChevronUp, ChevronDown, Trophy, Flame, LogOut, Info, Target,
    Moon, Sun, Settings, Waves, Compass, Edit2, Check, X
} from 'lucide-react';
import { Session, UserProfile, AppData } from '../types';
import { doc, updateDoc } from 'firebase/firestore'; 
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { buildUserHistory } from '../lib/gamification';

// IMPORTS MODULAIRES
import { RecordsGrid } from './RecordsGrid';
import StrategicIntelligence from './StrategicIntelligence';

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
    themeMode, isActuallyNight, isNewUser, onCreateProfile 
}) => {
  const [newPseudo, setNewPseudo] = useState('');
  const [isEditingPseudo, setIsEditingPseudo] = useState(false);
  const [editPseudoValue, setEditPseudoValue] = useState(userProfile?.pseudo || '');
  const [expandedYear, setExpandedYear] = useState<number | null>(new Date().getFullYear());
  const [showDonutYear, setShowDonutYear] = useState<number | null>(null);
  const [showStrategic, setShowStrategic] = useState(true); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- SONDE DE DIAGNOSTIC ORACLE (Michael v10.5) ---
  useEffect(() => {
    if (userProfile) {
      console.log(`%c 🛡️ ORACLE DIAGNOSTIC PROBE [${new Date().toLocaleTimeString()}] `, 'background: #1e293b; color: #fbbf24; font-weight: bold;');
      if (userProfile.avatarBase64?.startsWith('data:image')) console.warn("⚠️ ALERTE : Image Base64 détectée.");
    }
  }, [userProfile]);

  // Michael : Mise à jour du pseudo avec persistance
  const handleUpdatePseudo = async () => {
      if (!userProfile || editPseudoValue.trim().length < 3) return;
      try {
          const userDocRef = doc(db, "users", userProfile.id);
          await updateDoc(userDocRef, { pseudo: editPseudoValue });
          onUpdateProfile({ ...userProfile, pseudo: editPseudoValue });
          setIsEditingPseudo(false);
      } catch (e) {
          console.error("Erreur mise à jour pseudo :", e);
      }
  };

  // --- 1. ÉCRAN D'ONBOARDING (Multi-Case) ---
  if (isNewUser || !userProfile) {
      return (
          <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center px-10 overflow-y-auto animate-in fade-in duration-700 ${isActuallyNight ? 'bg-[#1c1917]' : 'bg-[#FAFAF9]'}`}>
              <div className="absolute top-[-10%] left-[-10%] w-80 h-80 bg-amber-500/10 rounded-full blur-[100px]" />
              <div className="w-full max-w-md space-y-12 relative z-10 py-10">
                  <div className="text-center space-y-6">
                      <div className="w-28 h-28 bg-gradient-to-br from-amber-400 to-amber-600 rounded-[3rem] mx-auto flex items-center justify-center shadow-2xl rotate-3 transition-transform">
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
                          {/* Michael : Retrait de 'uppercase' pour permettre la casse libre */}
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

                      <div className={`flex items-start gap-4 p-6 rounded-[2rem] border border-dashed ${isActuallyNight ? 'border-amber-900/30 bg-amber-950/10' : 'border-amber-200 bg-amber-50/50'}`}>
                        <div className="p-2 bg-amber-500 rounded-xl text-white mt-1"><Compass size={20} /></div>
                        <div className="space-y-1">
                          <h4 className="font-black uppercase text-[10px] tracking-widest text-amber-600">Configuration Requise</h4>
                          <p className={`text-[11px] font-bold leading-relaxed ${isActuallyNight ? 'text-stone-400' : 'text-stone-500'}`}>
                            Une fois ton profil activé, l'ajout d'un <span className="text-amber-600">secteur de pêche</span> est indispensable pour permettre à l'Oracle de synchroniser les indicateurs.
                          </p>
                        </div>
                      </div>
                      
                      <button disabled={newPseudo.length < 3} onClick={() => onCreateProfile?.(newPseudo)} className={`w-full p-8 rounded-[2.5rem] font-black uppercase tracking-[0.3em] transition-all active:scale-[0.97] text-sm shadow-2xl ${newPseudo.length >= 3 ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'}`}>
                          Activer mon profil
                      </button>
                      <button onClick={onLogout} className="w-full text-[10px] font-black uppercase text-stone-500 tracking-widest opacity-40">Annuler la session</button>
                  </div>
              </div>
          </div>
      );
  }

  // --- 2. LOGIQUE MÉTIER ---

  const userSessions = useMemo(() => {
    const targetId = userProfile.id;
    return sessions.filter(s => s.userId === targetId);
  }, [sessions, userProfile.id]);

  const historyStats = useMemo(() => buildUserHistory(userSessions), [userSessions]);

  const statsByYear = useMemo(() => {
    const stats: Record<number, any> = {};
    userSessions.forEach(session => {
      const year = new Date(session.date).getFullYear();
      if (!stats[year]) stats[year] = { sessions: [], sessionsCount: 0, catchesCount: 0, missesCount: 0, speciesBreakdown: {} };
      stats[year].sessions.push(session);
      stats[year].sessionsCount += 1;
      stats[year].catchesCount += (session.catches?.length || 0);
      stats[year].missesCount += (session.misses?.length || 0);
      session.catches?.forEach(c => { stats[year].speciesBreakdown[c.species] = (stats[year].speciesBreakdown[c.species] || 0) + 1; });
    });
    return Object.entries(stats).sort(([a], [b]) => Number(b) - Number(a)).map(([year, data]) => ({ year: Number(year), ...data }));
  }, [userSessions]);

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

  const handleThemeChange = async (mode: 'light' | 'night' | 'auto') => {
      try {
          const userDocRef = doc(db, "users", userProfile.id);
          await updateDoc(userDocRef, { themePreference: mode });
          onUpdateProfile({ ...userProfile, themePreference: mode } as UserProfile);
      } catch (e) { console.error("Erreur thématique :", e); }
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
              const MAX_WIDTH = 200; 
              const scaleSize = MAX_WIDTH / img.width;
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scaleSize;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
              const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
              try {
                  const storageRef = ref(storage, `avatars/${userProfile.id}.jpg`);
                  await uploadString(storageRef, compressedBase64, 'data_url');
                  const downloadURL = await getDownloadURL(storageRef);
                  const userDocRef = doc(db, "users", userProfile.id);
                  await updateDoc(userDocRef, { avatarBase64: downloadURL });
                  onUpdateProfile({ ...userProfile, avatarBase64: downloadURL });
              } catch (e) { console.error("Erreur upload :", e); }
          };
      };
      reader.readAsDataURL(file);
  };

  const cardClass = isActuallyNight ? "bg-[#292524] border-stone-800 shadow-none" : "bg-white border-stone-100 shadow-sm";

  return (
    <div className="pb-24 animate-in fade-in duration-300 space-y-8 px-4">
      {/* HEADER PROFIL */}
      <div className="flex flex-col items-center pt-8 relative text-center">
        <button onClick={onLogout} className={`absolute top-4 right-0 p-3 rounded-2xl transition-all active:scale-95 flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest border ${isActuallyNight ? 'bg-stone-900 border-stone-800 text-stone-400' : 'bg-red-50 border-red-100 text-red-500'}`}>
            <LogOut size={14} /> Déconnexion
        </button>

        <div className={`relative w-32 h-32 rounded-full mb-6 border-[6px] shadow-2xl overflow-hidden group cursor-pointer ${isActuallyNight ? 'border-stone-800 bg-stone-800' : 'border-white bg-white'}`} onClick={() => fileInputRef.current?.click()}>
          {userProfile.avatarBase64 ? <img src={userProfile.avatarBase64} className="w-full h-full object-cover" alt="Profile" /> : <User size={56} className="m-auto mt-8 text-stone-200" />}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera size={28} className="text-white" /></div>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        
        {/* Michael : Zone de pseudo éditable */}
        <div className="flex flex-col items-center gap-2">
            {isEditingPseudo ? (
                <div className="flex items-center gap-2 animate-in slide-in-from-bottom-2">
                    <input 
                        type="text"
                        value={editPseudoValue}
                        onChange={(e) => setEditPseudoValue(e.target.value)}
                        className={`text-3xl font-black tracking-tighter border-b-2 bg-transparent outline-none text-center ${isActuallyNight ? 'text-white border-amber-500' : 'text-stone-800 border-amber-500'}`}
                        autoFocus
                    />
                    <button onClick={handleUpdatePseudo} className="p-2 bg-emerald-500 text-white rounded-full shadow-lg"><Check size={18}/></button>
                    <button onClick={() => { setIsEditingPseudo(false); setEditPseudoValue(userProfile.pseudo); }} className="p-2 bg-stone-500 text-white rounded-full shadow-lg"><X size={18}/></button>
                </div>
            ) : (
                <div className="group flex items-center gap-3">
                    <h1 className={`text-4xl font-black tracking-tighter uppercase italic ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>{userProfile.pseudo}</h1>
                    <button onClick={() => setIsEditingPseudo(true)} className="p-2 rounded-full bg-stone-100/10 text-stone-400 opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={16}/></button>
                </div>
            )}
        </div>
      </div>

      {/* TACTICAL SETTINGS */}
      <div className={`rounded-[2.5rem] p-8 border space-y-6 transition-colors duration-500 ${cardClass}`}>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 flex items-center gap-2">
              <Settings size={14} className="text-amber-500" /> Setup Visuel
          </h3>
          <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleThemeChange('light')} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${themeMode === 'light' ? (isActuallyNight ? 'bg-amber-900/20 border-amber-500 text-amber-500' : 'bg-amber-50 border-amber-400 text-amber-900 shadow-md') : 'bg-stone-50/5 border-transparent text-stone-500'}`}><Sun size={20} /><span className="text-[9px] font-black uppercase">Jour</span></button>
              <button onClick={() => handleThemeChange('night')} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${themeMode === 'night' ? (isActuallyNight ? 'bg-stone-900 border-amber-500 text-amber-500 shadow-lg' : 'bg-stone-900 border-stone-700 text-amber-400 shadow-md') : 'bg-stone-50/5 border-transparent text-stone-500'}`}><Moon size={20} /><span className="text-[9px] font-black uppercase">Night Ops</span></button>
              <button onClick={() => handleThemeChange('auto')} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${themeMode === 'auto' ? (isActuallyNight ? 'bg-emerald-950 border-emerald-500 text-emerald-500' : 'bg-emerald-50 border-emerald-400 text-amber-900 shadow-md') : 'bg-stone-50/5 border-transparent text-stone-500'}`}><div className="flex gap-0.5"><Sun size={12} /><Moon size={12} /></div><span className="text-[9px] font-black uppercase">Auto</span></button>
          </div>
      </div>

      {/* HALL OF FAME */}
      <div className={`rounded-[3rem] p-10 border-2 relative overflow-hidden ${isActuallyNight ? 'bg-[#1c1917] border-amber-900/30' : 'bg-[#FFFDF9] border-amber-100 shadow-xl'}`}>
        <div className="text-center mb-10">
          <h2 className={`text-3xl font-black tracking-tighter uppercase leading-none ${isActuallyNight ? 'text-amber-500' : 'text-amber-900'}`}>Hall of Fame Oracle</h2>
          <div className="h-1 w-12 bg-amber-400 mx-auto mt-3 rounded-full"></div>
        </div>
        {userSessions.length > 0 ? <RecordsGrid sessions={userSessions} title="Records de légende" isGold={true} isActuallyNight={isActuallyNight} /> : <div className="text-center p-6 opacity-50 uppercase font-black text-[10px] tracking-widest">Aucune session</div>}
      </div>

      {/* INTELLIGENCE STRATÉGIQUE */}
      {userSessions.length > 0 && (
        <div className={`rounded-[2.5rem] border transition-all duration-500 ${showStrategic ? (isActuallyNight ? 'border-emerald-900/50 bg-[#292524]' : 'shadow-xl border-emerald-100 bg-white') : (isActuallyNight ? 'border-stone-800' : 'bg-white border-stone-100')}`}>
            <button onClick={() => setShowStrategic(!showStrategic)} className="w-full flex justify-between items-center p-8 outline-none">
                <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl ${showStrategic ? 'bg-emerald-500 text-white shadow-lg' : 'bg-stone-50/10 text-stone-500'}`}><Target size={28} /></div>
                    <div className="text-left">
                        <h2 className={`text-3xl font-black tracking-tighter uppercase leading-none ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>Intelligence</h2>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Analyse prédictive</p>
                    </div>
                </div>
                <ChevronDown className={`transition-transform ${showStrategic ? 'rotate-180' : ''}`} />
            </button>
            {showStrategic && <div className="px-8 pb-10"><StrategicIntelligence sessions={userSessions} userId={userProfile.id} arsenal={arsenalData} hideHeader={true} isActuallyNight={isActuallyNight} /></div>}
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
                    <ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
        }) : <div className="text-center py-20 opacity-30 font-black uppercase text-xs">Aucune archive</div>}
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
            <div className={`mb-2 p-2 rounded-full ${isActuallyNight ? 'bg-stone-900' : 'bg-white'}`}>{icon}</div>
            <span className="text-3xl font-black tracking-tighter">{value}</span>
            <span className="text-[9px] font-black uppercase opacity-60 tracking-widest mt-1">{label}</span>
        </div>
    );
};

export default ProfileView;