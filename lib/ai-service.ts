// lib/ai-service.ts

// Import sessionsCollection et getCachedWaterTemp
import { ai, chatHistoryCollection, sessionsCollection } from './firebase'; 
import { query, orderBy, limit, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { Session } from '../types'; 
import { GoogleGenAI, Content, GenerateContentResponse } from '@google/genai'; 
import { ChatMessage } from '../components/CoachView'; 
import { getCachedWaterTemp } from './hubeau-service'; // Import pour la température actuelle

// Constantes pour l'appel AI
const MODEL_NAME = "gemini-2.5-flash"; 
const CONTEXT_READ_LIMIT = 10; 

/**
 * Charge l'historique de discussion depuis Firestore (Mémoire conversationnelle).
 */
const loadChatHistory = async (): Promise<Content[]> => {
    const q = query(chatHistoryCollection, orderBy('timestamp', 'asc'), limit(CONTEXT_READ_LIMIT));
    const snapshot = await getDocs(q);

    return snapshot.docs
        .map(doc => {
            const data = doc.data();
            const textContent = (data.content || '').toString(); 
            
            // Filtre nécessaire contre l'erreur 400
            if (textContent.trim().length === 0) {
                return null; 
            }

            return {
                role: (data.role || 'user') as 'user' | 'model',
                parts: [{ text: textContent }]
            } as Content;
        })
        .filter((content): content is Content => content !== null);
};

/**
 * Sauvegarde un message (utilisateur ou IA) dans Firestore.
 */
const saveMessage = async (role: 'user' | 'model', content: string) => {
    await addDoc(chatHistoryCollection, {
        role: role,
        content: content,
        timestamp: Timestamp.now()
    });
};

/**
 * CHARGEMENT DES DONNÉES DE PÊCHE RÉELLES
 * Lit les 5 dernières sessions pour les inclure dans le prompt IA.
 */
const loadFishingContext = async (): Promise<Partial<Session>[]> => {
    // Lire les 5 sessions les plus récentes de la base réelle
    const q = query(sessionsCollection, orderBy('date', 'desc'), limit(5));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Sélection des champs pertinents pour l'analyse IA
        return {
            date: data.date ? data.date.toDate().toISOString().split('T')[0] : 'N/A',
            zone: data.zone,
            setup: data.setup,
            feelingScore: data.feelingScore,
            catchCount: data.catchCount,
            waterTemp: data.waterTemp ?? null, // <<< DONNÉE WATER TEMP RÉELLE
        } as Partial<Session>;
    });
};


export const askFishingCoach = async (userMessage: string, currentLocation: { lat: number, lng: number }) => {
    
    console.log("--- DÉBUT APPEL IA (askFishingCoach) ---");
    
    // 1. Sauvegarder d'abord le message utilisateur
    await saveMessage('user', userMessage);
    
    try {
        // 2. Charger la mémoire de discussion (chat history)
        const history = await loadChatHistory();
        
        // 3. Charger le contexte de pêche réel (5 dernières sessions)
        const fishingContext = await loadFishingContext();

        // 4. Charger la température de l'eau J-1 (pour le conseil immédiat)
        const currentWaterTempData = await getCachedWaterTemp();
        const currentWaterTemp = currentWaterTempData ? `${currentWaterTempData.temperature.toFixed(1)} °C (J-1)` : 'Non disponible';


        // 5. Préparer le prompt système, incluant la température actuelle et l'historique détaillé
        const systemInstruction = `
            Tu es le "Coach Oracle", un expert en pêche tactique. 
            TON RÔLE: Analyser les données fournies pour donner des conseils précis.
            
            CONTEXTE ACTUEL HYDROLOGIQUE: Température de l'eau : ${currentWaterTemp}.
            
            SON HISTORIQUE PERTINENT (5 dernières sessions) : ${JSON.stringify(fishingContext)}
            
            MISSION: Réponds à la question de l'utilisateur en te basant sur la température de l'eau actuelle et sur les setups/zones qui ont le mieux fonctionné ou échoué dans son historique. Réponse concise et amicale.
        `;

        // 6. Construire le contenu complet de la conversation
        const contents: Content[] = [...history, { role: 'user', parts: [{ text: userMessage }] }];

        // 7. Lancer l'appel à l'API Gemini
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
            },
        });
        
        const aiResponse = response.text?.trim();

        if (!aiResponse) {
             throw new Error("L'API n'a pas retourné de réponse textuelle.");
        }

        // 8. Sauvegarder la réponse de l'IA
        await saveMessage('model', aiResponse);

        return aiResponse;

    } catch (error) {
        console.error("Erreur détaillée lors de l'appel à l'IA:", error); 
        
        let errorMessage = "Une erreur inattendue est survenue lors de l'appel AI.";
        if (error instanceof Error) {
            if (error.message.includes('API_KEY_INVALID') || error.message.includes('billing')) {
                errorMessage = "Mon cerveau d'IA est déconnecté. Vérifiez votre clé API ou votre facturation Gemini.";
            }
        }
        
        await saveMessage('model', errorMessage); 
        throw new Error(errorMessage);
    }
};