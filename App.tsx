// App.tsx
import React, { useState } from 'react';
import { User, Mail, Lock, Chrome } from 'lucide-react';
import { useAppEngine } from './hooks/useAppEngine';
import { AppLayout } from './components/layout/AppLayout';
import { ViewRouter } from './components/layout/ViewRouter';

const App: React.FC = () => {
    const engine = useAppEngine();
    const [showEmailLogin, setShowEmailLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            // Michael : On suppose que handleEmailLogin sera ajouté à ton hook useAppEngine
            await engine.handleEmailLogin(email, password);
        } catch (err: any) {
            setError("Erreur d'authentification. Vérifie tes accès.");
        }
    };

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
                    
                    {!showEmailLogin ? (
                        <div className="space-y-4">
                            <button 
                                onClick={engine.handleLogin} 
                                className="w-full py-5 bg-stone-800 hover:bg-stone-900 text-white rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 text-lg"
                            >
                                <Chrome size={24} /> Connexion Google
                            </button>
                            
                            <button 
                                onClick={() => setShowEmailLogin(true)} 
                                className="w-full py-4 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-3"
                            >
                                <Mail size={20} /> Utiliser un Email
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleEmailSubmit} className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                                <input 
                                    type="email" 
                                    placeholder="Email" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:border-amber-500 transition-colors"
                                    required
                                />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                                <input 
                                    type="password" 
                                    placeholder="Mot de passe" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:border-amber-500 transition-colors"
                                    required
                                />
                            </div>
                            
                            {error && <p className="text-red-500 text-xs font-bold uppercase">{error}</p>}
                            
                            <button 
                                type="submit" 
                                className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black shadow-lg transition-all active:scale-95"
                            >
                                Se connecter / S'inscrire
                            </button>
                            
                            <button 
                                type="button"
                                onClick={() => setShowEmailLogin(false)} 
                                className="text-stone-400 text-xs font-bold uppercase tracking-widest mt-2"
                            >
                                Retour
                            </button>
                        </form>
                    )}
                    
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