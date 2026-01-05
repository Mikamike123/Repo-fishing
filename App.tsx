// App.tsx
import React from 'react';
import { User } from 'lucide-react';
import { useAppEngine } from './hooks/useAppEngine';
import { AppLayout } from './components/layout/AppLayout';
import { ViewRouter } from './components/layout/ViewRouter';

const App: React.FC = () => {
    const engine = useAppEngine();

    if (engine.authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#FDFBF7]">
                <div className="animate-spin text-amber-500 font-bold uppercase tracking-widest text-lg">Oracle Loading...</div>
            </div>
        );
    }

    if (!engine.user) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-[#FDFBF7] p-6 text-center animate-in fade-in duration-500">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-stone-100 max-w-sm w-full">
                    <div className="w-24 h-24 bg-stone-800 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 shadow-xl overflow-hidden p-4">
                        <img src="/logo192.png" alt="Oracle Fish" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-black text-stone-800 mb-2 tracking-tighter uppercase italic">Oracle<span className="text-amber-500"> Fish</span></h1>
                    <button onClick={engine.handleLogin} className="w-full py-5 bg-stone-800 hover:bg-stone-900 text-white rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 text-lg">
                        <User size={24} /> Connexion Google
                    </button>
                    <p className="mt-8 text-[11px] text-stone-300 uppercase font-black tracking-widest">Version Elite 5.0.0</p>
                </div>
            </div>
        );
    }

    return ( 
        <AppLayout engine={engine}>
            <ViewRouter engine={engine} />
        </AppLayout>
    );
};

export default App;