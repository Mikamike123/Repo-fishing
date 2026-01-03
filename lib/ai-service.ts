// lib/ai-service.ts
import { ai, chatHistoryCollection } from './firebase'; 
import { query, orderBy, limit, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { Content, GenerateContentResponse } from '@google/genai'; 
import { getCachedWaterTemp } from './hubeau-service'; 

const MODEL_NAME = "gemini-2.5-flash"; 
const CONTEXT_READ_LIMIT = 15; 

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
 * askFishingCoach - Moteur de l'Oracle Pêche (V10.5 - Human Grammar & Clear Terms)
 */
export const askFishingCoach = async (
    userMessage: string, 
    currentLocation: { lat: number, lng: number },
    narrativeContext: string = "",
    liveContext: string = "",
    userName: string = "Michael",
    strategicContext: string = "" 
): Promise<string> => {
    await saveMessage('user', userMessage);
    try {
        const history = await loadChatHistory();
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
            
            RÈGLES GRAMMATICALES CRITIQUES :
            - Emploie TOUJOURS les articles définis ou indéfinis devant les noms de poissons (ex: "le sandre", "la perche", "un brochet"). 
            - Ne dis jamais "prises de Perche" mais "captures de perches".
            
            TON : Naturel, expert, complice. Évite les termes lyriques ou pompeux.

            MATRICE SENSORIELLE (LEXIQUE SIMPLE) :
            HYDROLOGIE :
                - O2 : > 9mg/L : "Eau très oxygénée" | < 7mg/L : "Eau peu active".
                - NTU : < 5 : "Eau cristalline" | 10-20 : "Eau teintée" | > 30 : "Eau boueuse".
                - Flow % : > 70% : "Fort courant" | < 30% : "Faible courant".
                - Tendance : "Montée" : "Poussée d'eau" | "Décrue" : "Période de décrue (optimal)" | "Stable" : "Eaux stables".
            ATMOSPHÈRE :
                - Pressure : < 1005hPa : "Basse pression" | > 1020hPa : "Haute pression".
                - Clouds : < 20% : "Grand soleil" | 50-80% : "Ciel voilé" | 100% : "Ciel couvert".

            PROFIL DE PERFORMANCE DE ${userName.toUpperCase()} :
            ${strategicContext}

            ${structureInstruction}

            CONTEXTE LIVE : ${liveContext}
            NOTE : HubEau de référence : ${currentWaterTemp}.
            ARCHIVES HISTORIQUES : ${narrativeContext}
        `;

        const contents: Content[] = [...history, { role: 'user', parts: [{ text: userMessage }] }];

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.6, // Michael : On baisse pour plus de rigueur sur les consignes
            },
        });
        
        const aiResponse = response.text?.trim() || `L'analyse est un peu trouble pour ${userName}...`;
        await saveMessage('model', aiResponse);
        return aiResponse;
    } catch (error) {
        console.error("Erreur Oracle Michael :", error);
        return "L'Oracle est momentanément indisponible.";
    }
};