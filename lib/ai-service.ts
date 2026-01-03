// lib/ai-service.ts
import { ai, getChatHistoryCollection } from './firebase'; 
import { query, orderBy, limit, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { Content, GenerateContentResponse } from '@google/genai'; 
import { getCachedWaterTemp } from './hubeau-service'; 

const MODEL_NAME = "gemini-2.5-flash"; 
const CONTEXT_READ_LIMIT = 15; 

// Michael : loadChatHistory avec userId
const loadChatHistory = async (userId: string): Promise<Content[]> => {
    const chatCol = getChatHistoryCollection(userId); 
    const q = query(chatCol, orderBy('timestamp', 'asc'), limit(CONTEXT_READ_LIMIT));
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

// Michael : saveMessage avec userId
const saveMessage = async (userId: string, role: 'user' | 'model', content: string) => {
    try {
        const chatCol = getChatHistoryCollection(userId);
        await addDoc(chatCol, {
            role: role,
            content: content,
            timestamp: Timestamp.now()
        });
    } catch (error) {
        console.error("Erreur sauvegarde message Michael:", error);
    }
};

/**
 * askFishingCoach - Moteur de l'Oracle Pêche
 */
export const askFishingCoach = async (
    userMessage: string, 
    currentLocation: { lat: number, lng: number },
    narrativeContext: string = "",
    liveContext: string = "",
    userName: string = "Pêcheur", // MODIF MICHAEL : Valeur dynamique
    strategicContext: string = "",
    userId: string = "guest" 
): Promise<string> => {
    
    // --- LOGS DE DEBUG MICHAEL ---
    console.log("--- DEBUG ORACLE ---");
    console.log("Utilisateur:", userName, "ID:", userId);
    console.log("Message envoyé:", userMessage);

    saveMessage(userId, 'user', userMessage);
    
    try {
        const history = await loadChatHistory(userId);
        const isFirstInteraction = history.length === 0;
        
        const techKeywords = ['météo', 'eau', 'condition', 'température', 'vent', 'courant', 'pression', 'ntu', 'oxygène', 'o2', 'stats', 'kpi'];
        const wantsTechInfo = techKeywords.some(key => userMessage.toLowerCase().includes(key));

        const currentWaterTempData = await getCachedWaterTemp();
        const currentWaterTemp = currentWaterTempData ? `${currentWaterTempData.temperature.toFixed(1)} °C` : 'Non disponible';

        let structureInstruction = "";
        
        if (isFirstInteraction) {
            structureInstruction = `
                STRUCTURE OBLIGATOIRE (PREMIER MESSAGE) :
                1. NARRATIF (90 mots max) : Ton analyse de binôme, traduction sensorielle simple, espèce cible (BioScore) et combo **leurre/technique** en gras.
                2. LE COIN PÉDAGO : Bloc final avec les data brutes (Eau, O2, NTU, Flow %, Vagues cm, BioScore).`;
        } else if (wantsTechInfo) {
            structureInstruction = `
                MODE TECHNIQUE : Réponds sur l'environnement ou les statistiques de Michael.
                - Utilise le "PROFIL DE PERFORMANCE" pour prouver tes dires.
                - Reste concis (90 mots max).
                2. LE COIN PÉDAGO : Ajoute le bloc des data brutes du moment.`;
        } else {
            structureInstruction = `
                MODE TACTIQUE FLUIDE : 
                - Réponse courte (60 mots max).
                - Pas de chiffres bruts. Pas de section pédagogique.
                - Cite une archive de Michael uniquement si elle valide ton conseil.`;
        }

        const systemInstruction = `
            Tu es le "Coach Oracle", binôme de pêche expert de ${userName}.
            RÈGLES GRAMMATICALES CRITIQUES : Articles devant les poissons.
            TON : Naturel, expert, complice.
            ${structureInstruction}
            CONTEXTE LIVE : ${liveContext}
            NOTE : HubEau : ${currentWaterTemp}.
            ARCHIVES HISTORIQUES : ${narrativeContext}
        `;

        const contents: Content[] = [...history, { role: 'user', parts: [{ text: userMessage }] }];

        console.log("Appel Gemini API en cours..."); // LOG MICHAEL

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.6,
            },
        });
        
        const aiResponse = response.text?.trim() || `L'analyse est trouble pour ${userName}...`;
        
        console.log("Réponse IA reçue avec succès !"); // LOG MICHAEL
        saveMessage(userId, 'model', aiResponse);
        return aiResponse;

    } catch (error: any) {
        console.error("❌ ERREUR ORACLE MICHAEL :", error); // LOG D'ERREUR DÉTAILLÉ
        return "L'Oracle est momentanément indisponible.";
    }
};