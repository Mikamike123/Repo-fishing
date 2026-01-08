// components/layout/AppLayout.tsx - Version 10.6.0 (Tactile Navigation & Clean UI)
import React, { useState } from 'react';
import { Home, ScrollText, PlusCircle, Bot, MapPin, Menu, User, X, Anchor, ChevronRight, Moon, Sun, WifiOff, Sparkles, PartyPopper } from 'lucide-react';
import MagicScanButton from '../MagicScanButton';

/**
 * Michael : Mini-composant interne pour gérer les avatars du layout de manière résiliente
 */
const LayoutAvatar = ({ url, size = "w-10 h-10", iconSize = 24 }: { url?: string, size?: string, iconSize?: number }) => {
    const [error, setError] = useState(false);
    return (
        <div className={`${size} rounded-full overflow-hidden border-2 border-transparent flex items-center justify-center bg-stone-100/10 shrink-0`}>
            {!url || error ? (
                <User size={iconSize} className="text-stone-400" />
            ) : (
                <img 
                    src={url} 
                    alt="Avatar" 
                    className="w-full h-full object-cover" 
                    onError={() => setError(true)}
                />
            )}
        </div>
    );
};

export const AppLayout = ({ engine, children }: { engine: any, children: React.ReactNode }) => {
    const { isActuallyNight, triggerHaptic, setIsMenuOpen, userProfile, isOnline, navigateFromMenu, isMenuOpen, currentView, setCurrentView, handleMagicDiscovery, arsenalData, currentUserId } = engine;

    return (
        <div className={`min-h-screen transition-colors duration-700 ${isActuallyNight ? 'bg-[#1c1917] text-stone-300' : 'bg-[#FAF9F6] text-stone-600'} pb-32 relative`}>
            {userProfile?.pendingLevelUp && (
                <LevelUpModal engine={engine} level={userProfile.levelReached || 1} onClose={() => engine.handleConsumeLevelUp(false)} onConfirm={() => engine.handleConsumeLevelUp(true)} />
            )}

            <header className={`sticky top-0 z-30 ${isActuallyNight ? 'bg-[#292524]/90 border-stone-800' : 'bg-white/90 border-stone-200'} backdrop-blur-lg border-b px-5 pt-[calc(env(safe-area-inset-top)+14px)] pb-5 flex items-center justify-between shadow-sm`}>
                <div className="flex items-center gap-3">
                    {/* Michael : Bouton Menu Tactile */}
                    <button onClick={() => { triggerHaptic([10]); setIsMenuOpen(true); }} className={`p-2 transition-all oracle-btn-press ${isActuallyNight ? 'text-stone-400 hover:text-amber-400' : 'text-stone-500 hover:text-stone-800'}`}>
                        <Menu size={28} strokeWidth={2.5} />
                    </button>
                    <div className="w-10 h-10 flex items-center justify-center overflow-hidden"><img src="/logo192.png" alt="Logo" className="w-full h-full object-contain rounded-xl" /></div>
                    <span className={`font-black text-xl tracking-tighter uppercase italic ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>Oracle<span className="text-amber-500"> Fish</span></span>
                    {!isOnline && <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full animate-pulse"><WifiOff size={16} strokeWidth={3} /><span className="text-[12px] font-black uppercase">Offline</span></div>}
                </div>
                
                {/* Michael : Bouton Profil Tactile */}
                <button onClick={() => engine.setCurrentView('profile')} className={`rounded-full border-2 transition-all oracle-btn-press ${isActuallyNight ? 'border-stone-700' : 'border-stone-200'}`}>
                    <LayoutAvatar url={userProfile?.avatarUrl} />
                </button>
            </header>

            <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t ${isActuallyNight ? 'bg-[#292524]/95 border-stone-800' : 'bg-white/95 border-stone-200'} backdrop-blur-md pb-[env(safe-area-inset-bottom,12px)] shadow-lg`}> 
                <div className="mx-auto grid grid-cols-6 max-w-lg items-center py-4 px-1">
                    <NavBtn engine={engine} view="dashboard" icon={<Home size={26}/>} label="Live" color="text-amber-600" />
                    <NavBtn engine={engine} view="history" icon={<ScrollText size={26}/>} label="Journal" color="text-amber-600" />
                    <NavBtn engine={engine} view="session" icon={<PlusCircle size={26} strokeWidth={3}/>} label="Session" color={isActuallyNight ? 'text-stone-100' : 'text-stone-900'} />
                    
                    {/* Michael : Baguette Magique (Libellé Wand supprimé pour le minimalisme) */}
                    <div className="flex flex-col items-center justify-center transition-all oracle-btn-press">
                        <MagicScanButton userPseudo={userProfile?.pseudo || "Michael"} lureTypes={arsenalData.lureTypes} colors={arsenalData.colors} onDiscoveryComplete={handleMagicDiscovery} userId={currentUserId} />
                    </div>

                    <NavBtn engine={engine} view="coach" icon={<Bot size={26}/>} label="Coach" color="text-emerald-600" />
                    <NavBtn engine={engine} view="locations" icon={<MapPin size={26}/>} label="Secteurs" color="text-indigo-600" />
                </div>
            </nav>

            <main className="w-full max-w-[1400px] mx-auto px-4 transition-all">{children}</main>

            {isMenuOpen && <SideMenu engine={engine} />}
        </div>
    );
};

const NavBtn = ({ engine, view, icon, label, color }: any) => (
    <button onClick={() => { engine.triggerHaptic([5]); engine.setCurrentView(view); }} className={`flex flex-col items-center gap-1.5 transition-all oracle-btn-press ${engine.currentView === view ? color : 'text-stone-500 font-black'}`}>
        {icon}<span className="text-[10px] uppercase tracking-tighter font-black">{label}</span>
    </button>
);

const SideMenu = ({ engine }: any) => (
    <>
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 animate-in fade-in" onClick={() => engine.setIsMenuOpen(false)} />
        <aside className={`fixed top-0 left-0 h-full w-4/5 max-w-xs z-[60] shadow-2xl p-8 animate-in slide-in-from-left flex flex-col pt-[env(safe-area-inset-top,24px)] ${engine.isActuallyNight ? 'bg-[#1c1917] text-stone-200 border-r border-stone-800' : 'bg-white text-stone-600'}`}>
            <div className="flex justify-between items-center mb-10">
                <span className="text-xs font-black text-stone-400 uppercase tracking-widest">Menu Principal</span>
                {/* Michael : Bouton de fermeture tactile */}
                <button onClick={() => engine.setIsMenuOpen(false)} className="p-3 text-stone-400 transition-all oracle-btn-press"><X size={28} /></button>
            </div>
            
            {/* Michael : Carte d'identité tactile dans le menu */}
            <div className={`flex items-center gap-4 mb-10 p-5 rounded-3xl border transition-all oracle-card-press ${engine.isActuallyNight ? 'bg-[#292524] border-stone-700' : 'bg-stone-50 border-stone-100'}`}>
                <LayoutAvatar url={engine.userProfile?.avatarUrl} size="w-16 h-16" iconSize={32} />
                <div>
                    <div className="font-black text-xl leading-none">{engine.userProfile?.pseudo}</div>
                    <div className="text-xs text-stone-400 font-bold mt-1.5 uppercase tracking-wide">Soldat du Quai</div>
                </div>
            </div>

            <nav className="space-y-3 flex-1">
                {/* Michael : Boutons de menu tactiles */}
                <button onClick={() => { engine.setCurrentView('arsenal'); engine.setIsMenuOpen(false); }} className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all font-black text-xl group oracle-btn-press ${engine.isActuallyNight ? 'hover:bg-stone-800 text-stone-300' : 'hover:bg-amber-50 text-stone-600'}`}>
                    <span className="flex items-center gap-4"><Anchor size={28} className="text-stone-400 group-hover:text-amber-500"/> Mon Arsenal</span>
                    <ChevronRight size={24} />
                </button>
                <button onClick={() => { engine.setCurrentView('profile'); engine.setIsMenuOpen(false); }} className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all font-black text-xl group oracle-btn-press ${engine.isActuallyNight ? 'hover:bg-stone-800 text-stone-300' : 'hover:bg-amber-50 text-stone-600'}`}>
                    <span className="flex items-center gap-4"><User size={28} className="text-stone-400 group-hover:text-amber-500"/> Ton Profil</span>
                    <ChevronRight size={24} />
                </button>
            </nav>

            <div className="flex items-center gap-3 p-5 opacity-40 text-[10px] font-black uppercase tracking-widest">{engine.isActuallyNight ? <Moon size={14} /> : <Sun size={14} />} {engine.isActuallyNight ? 'Mode Night Ops' : 'Mode Jour'}</div>
        </aside>
    </>
);

const LevelUpModal = ({ level, onClose, onConfirm, engine }: any) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" onClick={onClose} />
        {/* Michael : Carte de célébration tactile */}
        <div className={`relative bg-white rounded-[2.5rem] shadow-2xl border-4 border-amber-400 p-8 max-w-sm w-full text-center overflow-hidden animate-in zoom-in duration-500 transition-all oracle-card-press`}>
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20"><Sparkles className="absolute top-4 left-4 text-amber-500 animate-bounce" size={24} /></div>
            <div className="relative z-10">
                <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl rotate-6"><PartyPopper size={48} className="text-white" /></div>
                <h2 className="text-3xl font-black text-stone-800 mb-2 uppercase italic tracking-tighter">NIVEAU <span className="text-amber-500">{level}</span> !</h2>
                <div className="space-y-3 mt-8">
                    {/* Michael : Bouton de validation tactile */}
                    <button onClick={onConfirm} className="w-full py-5 bg-stone-800 text-white rounded-2xl font-black shadow-lg transition-all oracle-btn-press flex items-center justify-center gap-2 text-lg">VOIR TON RANG <ChevronRight size={18} /></button>
                    <button onClick={onClose} className="w-full py-3 text-stone-400 font-black text-sm uppercase tracking-widest transition-all oracle-btn-press">Plus tard</button>
                </div>
            </div>
        </div>
    </div>
);