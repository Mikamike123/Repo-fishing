// functions/src/coach.ts - Version 14.4.0 (Biological Depth & Clarification)
import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const MODEL_NAME = "gemini-2.0-flash"; 
const CONTEXT_READ_LIMIT = 15;

const CoachInputSchema = z.object({
    userMessage: z.string().min(1),
    narrativeContext: z.string(),
    liveContext: z.string(),
    userName: z.string(),
    strategicContext: z.string()
});

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
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "L'Oracle ne parle pas aux inconnus.");
    }

    const validation = CoachInputSchema.safeParse(request.data);
    if (!validation.success) {
        throw new HttpsError("invalid-argument", "Le Coach a besoin de données valides.");
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
        const apiKey = GEMINI_API_KEY.value().trim(); 
        const genAI = new GoogleGenerativeAI(apiKey);
        
        await saveMessage(userId, "user", userMessage);
        const history = await loadChatHistory(userId);

        const instructionStyle = `
            RÈGLES D'EXPRESSION ET DE TACTIQUE :
            1. ÉLOQUENCE ARGUMENTÉE : Analyse profonde d'au moins 120 mots. Explique chaque conseil.
            2. FORMAT DES DATES : INTERDICTION STRICTE du format ISO (YYYY-MM-DD). Convertis systématiquement en format littéraire (ex: "le 3 novembre 2024").
            3. GESTION DE L'INCERTITUDE : Si une question de ${userName} est techniquement ambiguë (ex: choix de fluoro sans précision du montage), NE SUPPOSE PAS. Pose une question de clarification pour affiner ton conseil.
            4. STRUCTURE DE RÉPONSE :
               - ANALYSE TACTIQUE : Conseils directs sur le poste, l'animation et le leurre.
               - LE COIN PÉDAGO : Uniquement focalisé sur l'HYDRO-BIOLOGIE (ex: impact de la température sur le métabolisme, vision du poisson selon les NTU, besoins en O2). Ne répète pas les conseils tactiques ici.
            5. INTERDICTION ABSOLUE : Pas de JSON. Pas d'objets structurés {}.
        `;

        const systemInstruction = `
            Tu es le "Coach Oracle", le binôme expert et scientifique de ${userName}.
            ${instructionStyle}
            TON : Expert, complice, pédagogue mais jamais redondant.
            
            DONNÉES TEMPS RÉEL : ${liveContext}
            HISTORIQUE DU PÊCHEUR : ${narrativeContext}
            KPI PERFORMANCE : ${strategicContext}
        `;

        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            systemInstruction: systemInstruction
        });

        const result = await model.generateContent({
            contents: [...history, { role: "user", parts: [{ text: userMessage }] }],
            generationConfig: {
                temperature: 0.75,
                topP: 0.95,
            },
        });

        const aiResponse = result.response.text().trim() || `L'analyse est trouble pour ${userName}...`;
        await saveMessage(userId, "model", aiResponse);

        return { text: aiResponse };

    } catch (error: any) {
        console.error("❌ ERREUR CLOUD FUNCTION ORACLE :", error);
        throw new HttpsError("internal", "L'Oracle est momentanément indisponible.");
    }
});