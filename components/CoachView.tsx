// components/CoachView.tsx - Version 4.8.21 (Soft Night Ops & UI Sync)
import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Loader, CornerDownLeft } from 'lucide-react';
// Michael : Import des nouvelles fonctions dynamiques
import { getChatHistoryCollection, clearChatHistory } from '../lib/firebase';
import { onSnapshot, query, orderBy } from 'firebase/firestore'; 
import { askFishingCoach } from '../lib/ai-service'; 
import { Session, AppData } from '../types'; 
import { generateFishingNarrative } from '../lib/fishingNarrativeService'; 
import { calculateDeepKPIs } from '../lib/analytics-service'; 

interface CoachViewProps {
    sessions: Session[];
    arsenalData: AppData;
    liveSnapshot: any; 
    currentUserId: string;
    userPseudo: string;
    isActuallyNight?: boolean; // Michael : Nouveau pour Night Ops
}

const CoachView: React.FC<CoachViewProps> = ({ 
    sessions, arsenalData, liveSnapshot, currentUserId, userPseudo, isActuallyNight
}) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<any[]>([]);
    const [isCoachTyping, setIsCoachTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Michael : Rendu propre du Markdown (Gras et Puces) - Adapté au thème
    const formatMessage = (text: string) => {
        return text.split('\n').map((line, i) => {
            let content = line;
            const isBullet = content.trim().startsWith('* ') || content.trim().startsWith('- ');
            if (isBullet) content = content.trim().substring(2);

            const parts = content.split(/(\*\*.*?\*\*)/g);
            const renderedLine = parts.map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                        <strong key={j} className={`font-extrabold ${isActuallyNight ? 'text-amber-400' : 'text-stone-900'}`}>
                            {part.slice(2, -2)}
                        </strong>
                    );
                }
                return part;
            });

            return (
                <div key={i} className={`${isBullet ? 'flex gap-2 ml-2' : 'mb-1'}`}>
                    {isBullet && <span className="text-emerald-500">•</span>}
                    <span>{renderedLine}</span>
                </div>
            );
        });
    };

    // --- Michael : RÉINITIALISATION DE LA MÉMOIRE AVEC USER_ID ---
    useEffect(() => {
        const resetAndLoad = async () => {
            if (!currentUserId) return;
            await clearChatHistory(currentUserId); 
        };
        resetAndLoad();
    }, [currentUserId]); 

    // --- Michael : SYNCHRONISATION DU CHAT DYNAMIQUE ---
    useEffect(() => {
        if (!currentUserId) return;

        const chatCol = getChatHistoryCollection(currentUserId);
        const q = query(chatCol, orderBy('timestamp', 'asc')); 
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            }));

            setMessages(fetched.length ? fetched : [{ 
                id: 'init', 
                content: `Salut **${userPseudo || 'Pêcheur'}** ! Je suis branché sur ton secteur **${liveSnapshot?.locationName || 'en cours...'}**. Prêt pour l'analyse ?`, 
                role: 'model', 
                timestamp: new Date() 
            }]);
        });
        return () => unsubscribe();
    }, [liveSnapshot?.locationName, userPseudo, currentUserId]); 

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isCoachTyping) return;
        const msg = input;
        setInput('');
        setIsCoachTyping(true);
        try {
            const userSessions = sessions.filter(s => s.userId === currentUserId);
            const narrative = generateFishingNarrative(userSessions, arsenalData);
            const insights = calculateDeepKPIs(sessions, currentUserId, arsenalData);
            const env = liveSnapshot?.env;
            const liveText = `
                --- SITUATION LIVE (PRÉSENT) ---
                LIEU: ${liveSnapshot?.locationName || 'Inconnu'}
                
                ATMOSPHÈRE: Air ${env?.weather?.temperature?.toFixed(1)}°C, Pres. ${env?.weather?.pressure}hPa, Vent ${env?.weather?.windSpeed}km/h (${env?.weather?.windDirection}°), Nuages ${env?.weather?.clouds}%, Précip. ${env?.weather?.precip || 0}mm (Code: ${env?.weather?.conditionCode})
                
                HYDROLOGIE: Eau ${env?.hydro?.waterTemp?.toFixed(1) || 'N/A'}°C, Courant ${env?.hydro?.flowRaw || 0}%, Turb. ${env?.hydro?.turbidityIdx?.toFixed(2) || 'N/A'} (NTU: ${env?.hydro?.turbidityNTU || 'N/A'}), O2 ${env?.hydro?.dissolvedOxygen || 'N/A'}mg/L, Vagues ${env?.hydro?.waveHeight || 'N/A'}cm
                
                CONTEXTE: Tendance ${env?.metadata?.flowStatus || 'Stable'}, Morpho ${env?.metadata?.morphologyType || 'Inconnue'}
                
                BIOSCORES: Sandre ${liveSnapshot?.scores?.sandre?.toFixed(0) || '0'}, Perche ${liveSnapshot?.scores?.perche?.toFixed(0) || '0'}, Brochet ${liveSnapshot?.scores?.brochet?.toFixed(0) || '0'}${liveSnapshot?.scores?.blackbass ? `, Bass ${liveSnapshot?.scores?.blackbass.toFixed(0)}` : ''}
            `;

            const locationCoords = liveSnapshot?.coordinates || { lat: 48.8566, lng: 2.3522 }; 

            await askFishingCoach(
                msg, 
                locationCoords, 
                narrative, 
                liveText, 
                userPseudo, 
                insights,
                currentUserId 
            );
        } finally {
            setIsCoachTyping(false);
        }
    };

    // Michael : Styles pour mode Soft Night
    const containerBg = isActuallyNight ? 'bg-[#1c1917] border-stone-800 shadow-none' : 'bg-stone-50 border-stone-100 shadow-inner';
    const coachBubble = isActuallyNight ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white text-stone-700 border-stone-100';
    const inputBg = isActuallyNight ? 'bg-[#292524] border-stone-800 text-stone-100' : 'bg-white border-stone-200 text-stone-900';

    return (
        <div className="flex flex-col h-full max-h-[calc(100vh-160px)] animate-in fade-in duration-500">
            <h2 className={`text-2xl font-black mb-6 flex items-center gap-3 tracking-tighter uppercase italic transition-colors ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>
                 <Bot size={28} className="text-emerald-500"/> Coach Oracle
            </h2>
            
            <div className={`flex-grow overflow-y-auto space-y-4 p-4 rounded-[2rem] border mb-4 transition-colors duration-500 ${containerBg}`}>
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-sm shadow-sm transition-colors ${
                            msg.role === 'user' 
                                ? 'bg-amber-600 text-white rounded-br-none' 
                                : `rounded-tl-none border ${coachBubble}`
                        }`}>
                            {formatMessage(msg.content || msg.text || "")}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="relative">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="On analyse le spot ?"
                    disabled={isCoachTyping}
                    className={`w-full p-5 pr-16 rounded-2xl shadow-xl focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:opacity-50 transition-all ${inputBg}`}
                />
                <button type="submit" disabled={!input.trim() || isCoachTyping} className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-emerald-500 text-white rounded-xl shadow-lg transition-transform active:scale-95 disabled:bg-stone-300">
                    {isCoachTyping ? <Loader className="animate-spin" size={20} /> : <Send size={20} />}
                </button>
            </form>
            <div className="text-[10px] text-stone-400 mt-2 flex items-center gap-1.5 ml-2 font-bold uppercase tracking-widest opacity-60">
                <CornerDownLeft size={10} /> Ton Oracle est branché sur {liveSnapshot?.locationName || 'le secteur'}
            </div>
        </div>
    );
};

export default CoachView;