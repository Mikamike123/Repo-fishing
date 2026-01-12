// functions/src/coach.ts
import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod"; // Michael : Import Zod pour la sécurisation MEP

// Michael : Accès sécurisé à la clé via Google Secret Manager
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const MODEL_NAME = "gemini-2.0-flash"; 
const CONTEXT_READ_LIMIT = 15;

// --- SCHÉMA DE VALIDATION Michael ---
const CoachInputSchema = z.object({
    userMessage: z.string().min(1),
    narrativeContext: z.string(),
    liveContext: z.string(),
    userName: z.string(),
    strategicContext: z.string()
});

/**
 * Charge l'historique depuis Firestore (côté Admin)
 */
async function loadChatHistory(userId: string) {
    const db = admin.firestore();
    const chatCol = db.collection("users").doc(userId).collection("coach_memoire");
    const snapshot = await chatCol.orderBy("timestamp", "asc").limit(CONTEXT_READ_LIMIT).get();

    return snapshot.docs
        .map(doc => {
            const data = doc.data();
            const textContent = (data.content || "").toString();
            if (textContent.trim().length === 0) return null;
            return {
                role: (data.role === "model" ? "model" : "user") as "user" | "model",
                parts: [{ text: textContent }]
            };
        })
        .filter((content): content is any => content !== null);
}

/**
 * Sauvegarde le message (côté Admin)
 */
async function saveMessage(userId: string, role: "user" | "model", content: string) {
    const db = admin.firestore();
    try {
        await db.collection("users").doc(userId).collection("coach_memoire").add({
            role,
            content,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Erreur sauvegarde message Oracle:", error);
    }
}

export const askFishingCoach = onCall({ 
    secrets: [GEMINI_API_KEY],
    region: "europe-west1",
    cors: true 
}, async (request: CallableRequest) => {
    // 1. Vérification de l'Auth
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "L'Oracle ne parle pas aux inconnus.");
    }

    // 2. VALIDATION Michael : Sécurisation du payload d'entrée
    const validation = CoachInputSchema.safeParse(request.data);
    if (!validation.success) {
        throw new HttpsError("invalid-argument", "Le Coach a besoin d'un message et de contexte pour répondre.");
    }

    const { 
        userMessage, 
        narrativeContext, 
        liveContext, 
        userName, 
        strategicContext 
    } = validation.data;
    const userId = request.auth.uid;

    try {
        // Michael : Initialisation via le SDK Officiel présent dans ton package.json
        const apiKey = GEMINI_API_KEY.value().trim(); 
        
        const genAI = new GoogleGenerativeAI(apiKey);
        // Sauvegarde du message utilisateur
        await saveMessage(userId, "user", userMessage);

        const history = await loadChatHistory(userId);
        const isFirstInteraction = history.length === 0;

        const techKeywords = ["météo", "eau", "condition", "température", "vent", "courant", "pression", "ntu", "oxygène", "stats", "kpi"];
        const wantsTechInfo = techKeywords.some(key => userMessage.toLowerCase().includes(key));

        // --- Construction des Instructions Système ---
        let structureInstruction = "";
        if (isFirstInteraction) {
            structureInstruction = `
                STRUCTURE OBLIGATOIRE (PREMIER MESSAGE) :
                1. NARRATIF (90 mots max) : Ton analyse de binôme, traduction sensorielle simple, espèce cible (BioScore) et combo **leurre/technique** en gras.
                2. LE COIN PÉDAGO : Bloc final avec les data brutes (Eau, O2, NTU, Flow %, Vagues cm, BioScore).`;
        } else if (wantsTechInfo) {
            structureInstruction = `
                MODE TECHNIQUE : Réponds sur l'environnement ou les statistiques de ${userName}.
                - Utilise le "PROFIL DE PERFORMANCE" pour prouver tes dires.
                - Reste concis (90 mots max).
                - LE COIN PÉDAGO : Ajoute le bloc des data brutes du moment.`;
        } else {
            structureInstruction = `
                MODE TACTIQUE FLUIDE : 
                - Réponse courte (60 mots max).
                - Pas de chiffres bruts. Pas de section pédagogique.
                - Cite une archive de ${userName} uniquement si elle valide ton conseil.`;
        }

        const systemInstruction = `
            Tu es le "Coach Oracle", binôme de pêche expert de ${userName}.
            RÈGLES GRAMMATICALES CRITIQUES : Articles devant les poissons.
            TON : Naturel, expert, complice.
            ${structureInstruction}
            CONTEXTE LIVE : ${liveContext}
            ARCHIVES HISTORIQUES : ${narrativeContext}
            KPI STRATÉGIQUES : ${strategicContext}
        `;

        // Michael : Utilisation du modèle avec instruction système
        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            systemInstruction: systemInstruction
        });

        // Génération du contenu avec historique
        const result = await model.generateContent({
            contents: [...history, { role: "user", parts: [{ text: userMessage }] }],
            generationConfig: {
                temperature: 0.65,
            },
        });

        const aiResponse = result.response.text().trim() || `L'analyse est trouble pour ${userName}...`;

        // Sauvegarde de la réponse modèle
        await saveMessage(userId, "model", aiResponse);

        return { text: aiResponse };

    } catch (error: any) {
        console.error("❌ ERREUR CLOUD FUNCTION ORACLE :", error);
        throw new HttpsError("internal", "L'Oracle est momentanément indisponible.");
    }
});