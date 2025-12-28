// lib/ai-service.ts
import { ai, chatHistoryCollection } from './firebase'; 
import { query, orderBy, limit, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { Content, GenerateContentResponse } from '@google/genai'; 
import { getCachedWaterTemp } from './hubeau-service'; 

const MODEL_NAME = "gemini-2.5-flash"; 
const CONTEXT_READ_LIMIT = 15; 

// Michael : Chargement de l'historique conversationnel
const loadChatHistory = async (): Promise<Content[]> => {
    const q = query(chatHistoryCollection, orderBy('timestamp', 'asc'), limit(CONTEXT_READ_LIMIT));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => {
            const data = doc.data();
            const textContent = (data.content || '').toString(); 
            if (textContent.trim().length === 0) return null; 
            return {
                role: (data.role === 'model' ? 'model' : 'user') as 'user' | 'model',
                parts: [{ text: textContent }]
            } as Content;
        })
        .filter((content): content is Content => content !== null);
};

const saveMessage = async (role: 'user' | 'model', content: string) => {
    await addDoc(chatHistoryCollection, {
        role: role,
        content: content,
        timestamp: Timestamp.now()
    });
};

/**
 * askFishingCoach - Moteur de l'Oracle Pêche
 * Michael : Signature mise à jour à 5 arguments pour inclure le pseudo dynamique.
 */
export const askFishingCoach = async (
    userMessage: string, 
    currentLocation: { lat: number, lng: number },
    narrativeContext: string = "",
    liveContext: string = "",
    userName: string = "Michael" // Michael : 5ème argument ajouté pour corriger TS2554
): Promise<string> => {
    await saveMessage('user', userMessage);
    try {
        const history = await loadChatHistory();
        const currentWaterTempData = await getCachedWaterTemp();
        const currentWaterTemp = currentWaterTempData ? `${currentWaterTempData.temperature.toFixed(1)} °C` : 'Non disponible';

        // --- OPTION C : L'ANALYSTE MÉTÉO-TACTIQUE (VERSION PERSONNALISÉE) ---
        const systemInstruction = `
            Tu es le "Coach Oracle", l'expert tactique et le binôme de pêche de ${userName}. 
            
            TON TON : 
            - Agis comme un analyste météo-pêche professionnel (style "expert de terrain").
            - Interpelle ${userName} par son nom de temps en temps pour renforcer la complicité.
            - Ne sois pas une simple base de données : synthétise les infos de manière humaine.
            - Sois direct, amical, mais d'une précision chirurgicale sur les patterns.

            TES RÈGLES DE RÉPONSE (SYNTHÈSE & NUANCE) :
            1. L'OUVERTURE (SYNTHÈSE ENVIRONNEMENTALE) : Ne liste pas les chiffres un par un. Fais une phrase qui résume le "mood" global de la session (Air/Ciel/Vent/Pression). 
            2. ANALYSE HYDRO : Interprète le débit et la turbidité. Explique à ${userName} si les conditions sont "confortables" ou si le poisson risque d'être collé au fond.
            3. STRATÉGIE (LE CONSEIL) : Propose une approche basée sur le BioScore le plus haut et le matériel de son Arsenal.
            4. CORRÉLATION ARCHIVES (RAG) : Ne récite JAMAIS ses sessions passées sous forme de liste. Cite un fait passé uniquement s'il valide ou invalide ta théorie actuelle.
            5. CONCISION : Reste sous les 120 mots. Utilise impérativement le **gras** pour les leurres et techniques.

            CONTEXTE LIVE (SUR LE QUAI) :
            ${liveContext}
            Note : La température de l'eau HubEau (référence Seine) est de ${currentWaterTemp}.

            SOURCE DE VÉRITÉ / ARCHIVES DE ${userName.toUpperCase()} (LE PASSÉ) :
            ${narrativeContext}
        `;

        const contents: Content[] = [...history, { role: 'user', parts: [{ text: userMessage }] }];

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.65, 
            },
        });
        
        const aiResponse = response.text?.trim() || `Désolé ${userName}, mon analyse est floue.`;
        await saveMessage('model', aiResponse);
        return aiResponse;
    } catch (error) {
        console.error("Erreur Oracle Michael :", error);
        return "L'Oracle est momentanément indisponible suite à une erreur technique.";
    }
};