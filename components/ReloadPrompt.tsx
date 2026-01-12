// components/ReloadPrompt.tsx - Version 1.1.1 (Type-Safe Edition)
import React from 'react';
// @ts-ignore : Module virtuel généré par vite-plugin-pwa
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Zap, ShieldCheck } from 'lucide-react';

interface ReloadPromptProps {
    isActuallyNight?: boolean;
}

const ReloadPrompt: React.FC<ReloadPromptProps> = ({ isActuallyNight }) => {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r: ServiceWorkerRegistration | undefined) {
            console.log('⚓ Oracle Antenne : Service Worker OK');
        },
        onRegisterError(error: any) {
            console.error('🔥 Oracle Antenne : Erreur SW', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    if (!offlineReady && !needRefresh) return null;

    const bgColor = isActuallyNight ? 'bg-[#1c1917]/95 border-stone-800' : 'bg-white/95 border-amber-500/20';
    const textColor = isActuallyNight ? 'text-stone-100' : 'text-stone-800';
    const subTextColor = isActuallyNight ? 'text-stone-400' : 'text-stone-500';

    return (
        <div className="fixed bottom-24 left-4 right-4 z-[250] animate-in slide-in-from-bottom-10 duration-700">
            <div className={`${bgColor} backdrop-blur-xl border-2 rounded-[2.5rem] p-6 shadow-2xl flex flex-col gap-5 max-w-md mx-auto transition-colors duration-500`}>
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl shadow-lg ${needRefresh ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>
                        {needRefresh ? <RefreshCw className="animate-spin" size={24} /> : <ShieldCheck size={24} />}
                    </div>
                    
                    <div className="flex-1">
                        <h3 className={`text-sm font-black uppercase tracking-tighter italic ${textColor}`}>
                            {needRefresh ? "Mise à jour Oracle" : "Système Paré"}
                        </h3>
                        <p className={`text-[10px] font-bold uppercase tracking-widest leading-relaxed mt-1 ${subTextColor}`}>
                            {needRefresh 
                                ? "Mika, de nouveaux capteurs sont disponibles. Séb et toi devez synchroniser l'antenne." 
                                : "L'Oracle est prêt pour une utilisation hors-ligne."}
                        </p>
                    </div>

                    <button onClick={close} className="p-1 opacity-40 hover:opacity-100 transition-opacity outline-none">
                        <X size={20} className={isActuallyNight ? 'text-white' : 'text-stone-900'} />
                    </button>
                </div>

                {needRefresh && (
                    <button
                        onClick={() => updateServiceWorker(true)}
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                            isActuallyNight 
                            ? 'bg-amber-500 text-white hover:bg-amber-600' 
                            : 'bg-stone-900 text-white hover:bg-black'
                        }`}
                    >
                        <Zap size={16} /> Synchroniser maintenant
                    </button>
                )}
            </div>
        </div>
    );
};

export default ReloadPrompt;