// components/CoachView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Loader, CornerDownLeft } from 'lucide-react';
import { chatHistoryCollection, clearChatHistory } from '../lib/firebase';
import { onSnapshot, query, orderBy } from 'firebase/firestore'; 
import { askFishingCoach } from '../lib/ai-service'; 
import { Session, AppData } from '../types'; 
import { generateFishingNarrative } from '../lib/fishingNarrativeService'; 

// Michael : Rendu propre du Markdown (Gras et Puces)
const formatMessage = (text: string) => {
    return text.split('\n').map((line, i) => {
        let content = line;
        const isBullet = content.trim().startsWith('* ') || content.trim().startsWith('- ');
        if (isBullet) content = content.trim().substring(2);

        const parts = content.split(/(\*\*.*?\*\*)/g);
        const renderedLine = parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="font-extrabold text-stone-900">{part.slice(2, -2)}</strong>;
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

interface CoachViewProps {
    sessions: Session[];
    arsenalData: AppData;
    liveSnapshot: any; 
}

const CoachView: React.FC<CoachViewProps> = ({ sessions, arsenalData, liveSnapshot }) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<any[]>([]);
    const [isCoachTyping, setIsCoachTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- Michael : RÉINITIALISATION DE LA MÉMOIRE ---
    useEffect(() => {
        const resetAndLoad = async () => {
            await clearChatHistory(); 
        };
        resetAndLoad();
    }, []); 

    useEffect(() => {
        const q = query(chatHistoryCollection, orderBy('timestamp', 'asc')); 
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            }));

            // Michael : Accueil dynamique utilisant le userName du profil
            setMessages(fetched.length ? fetched : [{ 
                id: 'init', 
                content: `Salut **${liveSnapshot?.userName || 'Pêcheur'}** ! Je suis branché sur le secteur **${liveSnapshot?.locationName || 'en cours...'}**. Prêt pour l'analyse ?`, 
                role: 'model', 
                timestamp: new Date() 
            }]);
        });
        return () => unsubscribe();
    // Michael : On réagit si le nom du secteur OU le pseudo change
    }, [liveSnapshot?.locationName, liveSnapshot?.userName]); 

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isCoachTyping) return;
        const msg = input;
        setInput('');
        setIsCoachTyping(true);
        try {
            // 1. Génération du narratif PASSÉ (RAG)
            const narrative = generateFishingNarrative(sessions, arsenalData);

            // 2. Préparation du contexte LIVE enrichi
            const liveText = `
                CONTEXTE ENVIRONNEMENTAL COMPLET :
                - Secteur : ${liveSnapshot?.locationName}
                - Température Air : ${liveSnapshot?.env?.weather?.temperature}°C
                - Ciel : ${liveSnapshot?.env?.weather?.clouds}% de nuages
                - Vent : ${liveSnapshot?.env?.weather?.windSpeed} km/h (Direction : ${liveSnapshot?.env?.weather?.windDirection}°)
                - Pression : ${liveSnapshot?.env?.weather?.pressure} hPa
                - Hydrologie : Eau à ${liveSnapshot?.env?.hydro?.waterTemp?.toFixed(1)}°C, Débit ${liveSnapshot?.env?.hydro?.flowLagged} m3/s, Turbidité ${liveSnapshot?.env?.hydro?.turbidityIdx}
                - BioScores : Sandre ${liveSnapshot?.scores?.sandre?.toFixed(0)}, Perche ${liveSnapshot?.scores?.perche?.toFixed(0)}, Brochet ${liveSnapshot?.scores?.brochet?.toFixed(0)}
            `;

            // 3. Appel de l'IA (Michael: signature avec 5 arguments : msg, loc, past, live, userName)
            await askFishingCoach(
                msg, 
                { lat: 48.8912, lng: 2.1932 }, 
                narrative, 
                liveText, 
                liveSnapshot?.userName || "Pêcheur"
            );
        } finally {
            setIsCoachTyping(false);
        }
    };

    return (
        <div className="flex flex-col h-full max-h-[calc(100vh-140px)] animate-in fade-in duration-500">
            <h2 className="text-2xl font-black text-stone-800 mb-6 flex items-center gap-3 tracking-tighter uppercase italic">
                 <Bot size={28} className="text-emerald-500"/> Coach Oracle
            </h2>
            
            <div className="flex-grow overflow-y-auto space-y-4 p-4 bg-stone-50 rounded-[2rem] border border-stone-100 mb-4 shadow-inner">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-sm shadow-sm ${
                            msg.role === 'user' ? 'bg-amber-600 text-white rounded-br-none' : 'bg-white text-stone-700 rounded-tl-none border border-stone-100'
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
                    className="w-full p-5 pr-16 bg-white border border-stone-200 rounded-2xl shadow-xl focus:ring-2 focus:ring-emerald-500/20 outline-none disabled:opacity-50"
                />
                <button type="submit" disabled={!input.trim() || isCoachTyping} className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-emerald-500 text-white rounded-xl shadow-lg transition-transform active:scale-95 disabled:bg-stone-300">
                    {isCoachTyping ? <Loader className="animate-spin" size={20} /> : <Send size={20} />}
                </button>
            </form>
            <div className="text-[10px] text-stone-400 mt-2 flex items-center gap-1.5 ml-2 font-bold uppercase tracking-widest">
                <CornerDownLeft size={10} /> Oracle branché sur {liveSnapshot?.locationName || 'le secteur'}
            </div>
        </div>
    );
};

export default CoachView;