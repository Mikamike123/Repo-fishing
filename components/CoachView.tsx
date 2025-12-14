// components/CoachView.tsx

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, MessageSquare, Loader, CornerDownLeft, Fish } from 'lucide-react';
import { chatHistoryCollection } from '../lib/firebase';
import { 
    onSnapshot, query, orderBy, QuerySnapshot, DocumentData, 
    addDoc 
} from 'firebase/firestore'; 
import { askFishingCoach } from '../lib/ai-service'; // <<< CHANGEMENT : Import du service AI réel

// --- TYPES ---
// <<< CHANGEMENT : AJOUT DE L'EXPORT pour permettre l'importation dans lib/ai-service.ts
export interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'coach';
    timestamp: Date; 
}
// >>>

// État initial (Optionnel)
const INITIAL_MESSAGE: ChatMessage = {
    id: 'initial',
    text: "Bonjour ! Je suis l'Oracle Pêche. Mon rôle est d'analyser vos sessions et de vous donner des conseils basés sur l'historique de vos prises. Posez-moi une question !",
    sender: 'coach',
    timestamp: new Date(),
};

const CoachView: React.FC = () => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isCoachTyping, setIsCoachTyping] = useState(false); 
    const [error, setError] = useState<string | null>(null); // <<< NOUVEL ÉTAT pour l'affichage des erreurs
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- FIREBASE LISTENER (READ CHAT HISTORY) ---
    useEffect(() => {
        const q = query(chatHistoryCollection, orderBy('timestamp', 'asc')); 

        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const fetchedMessages: ChatMessage[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id, 
                    text: data.content || data.text || '', // Supporte 'content' (Firestore) ou 'text' (local)
                    sender: data.role || data.sender || 'coach', 
                    timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
                } as ChatMessage;
            });
            
            if (fetchedMessages.length === 0) {
                setMessages([INITIAL_MESSAGE]);
            } else {
                setMessages(fetchedMessages);
            }
        }, (error) => {
            console.error("Erreur de lecture de l'historique de chat Firestore:", error);
            setMessages([INITIAL_MESSAGE]);
            setError("Impossible de charger l'historique de chat.");
        });

        return () => unsubscribe();
    }, []); 

    // Défilement automatique vers le bas lors de l'ajout d'un nouveau message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- FIREBASE WRITER / AI CALL ---
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedInput = input.trim();
        if (!trimmedInput || isCoachTyping) return;
        
        // La sauvegarde du message utilisateur est maintenant gérée par askFishingCoach pour synchroniser la mémoire
        // Nous allons utiliser un ID bidon pour l'affichage immédiat dans le state local
        
        setInput(''); 
        setError(null);
        setIsCoachTyping(true);

        try {
            // NOTE: La fonction askFishingCoach s'occupe de:
            // 1. Sauvegarder le message utilisateur (dans Firestore)
            // 2. Appeler Gemini avec l'historique et le contexte
            // 3. Sauvegarder la réponse de Gemini (dans Firestore)
            
            // NOTE: La localisation est simulée ici (devrait venir d'un hook ou d'un service de géolocalisation)
            const simulatedLocation = { lat: 48.8912, lng: 2.1932 }; 
            
            const aiResponseText = await askFishingCoach(trimmedInput, simulatedLocation); 
            
            console.log("Réponse AI reçue:", aiResponseText);

        } catch (err) {
            // L'erreur ici est souvent le message d'erreur que askFishingCoach a renvoyé (clé API, etc.)
            let displayError = "Une erreur inconnue est survenue.";
            if (err instanceof Error) {
                displayError = err.message;
            }
            setError(displayError);
        } finally {
            setIsCoachTyping(false); 
        }
    };
    
    // --- COMPOSANT MESSAGE (Pour la lisibilité) ---
    const Message: React.FC<{ msg: ChatMessage }> = ({ msg }) => (
        <div className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2 rounded-xl text-sm shadow-md ${
                msg.sender === 'user' 
                ? 'bg-amber-600 text-white rounded-br-none' 
                : 'bg-white text-stone-700 rounded-tl-none border border-stone-100'
            }`}>
                {msg.sender === 'coach' && <Bot size={14} className="inline mr-2 text-emerald-500" />}
                {msg.text}
                <div className={`text-[9px] mt-1 opacity-50 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        </div>
    );


    return (
        <div className="flex flex-col h-full max-h-[calc(100vh-140px)]">
            <h2 className="text-2xl font-black text-stone-800 mb-6 flex items-center gap-3">
                 <Bot size={28} className="text-emerald-500"/> Coach Oracle
            </h2>
            
            {/* Affichage de l'erreur */}
            {error && (
                <div className="p-3 mb-4 bg-rose-100 text-rose-700 rounded-lg border border-rose-300 text-sm font-medium">
                    Attention: {error}
                </div>
            )}

            {/* Zone de conversation (scrollable) */}
            <div className="flex-grow overflow-y-auto space-y-4 p-4 bg-stone-50 rounded-xl border border-stone-100 mb-4 shadow-inner">
                {messages.map((msg, index) => (
                    <Message key={msg.id || index} msg={msg} />
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Zone de saisie */}
            <form onSubmit={handleSendMessage} className="relative">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isCoachTyping ? "Le coach réfléchit..." : "Demandez conseil à l'Oracle (Entrée pour envoyer)..."}
                    disabled={isCoachTyping}
                    className="w-full p-4 pr-16 bg-white border border-stone-200 rounded-xl shadow-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition disabled:bg-stone-100 disabled:text-stone-500"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || isCoachTyping}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition disabled:bg-stone-300 disabled:cursor-not-allowed"
                >
                    {isCoachTyping ? <Loader size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
            </form>
            <div className="text-[10px] text-stone-400 mt-2 flex items-center gap-1.5 ml-1">
                <CornerDownLeft size={10} /> Appuyez sur Entrée pour envoyer.
            </div>
        </div>
    );
};

export default CoachView;