import { onCall, HttpsError } from "firebase-functions/v2/https";
import { VertexAI } from "@google-cloud/vertexai";

// Initialisation Vertex AI - Correction pour Gemini 3
const vertexAI = new VertexAI({ project: 'mysupstack', location: 'us-central1' });

const SPECIES_LIST = ['Sandre', 'Brochet', 'Perche', 'Silure', 'Chevesne', 'Black-Bass', 'Aspe', 'Truite', 'Bar'];

export const analyzeCatchImage = onCall({ 
    region: "europe-west1", 
    memory: "1GiB",
    maxInstances: 5 
}, async (request) => {
  
 // if (!request.auth) {
 //   throw new HttpsError("unauthenticated", "Michael, l'Oracle ne répond qu'aux membres authentifiés.");
 // }

  const { image, userPseudo, referentials } = request.data;

  if (!image) {
    throw new HttpsError("invalid-argument", "L'image est absente de la requête.");
  }

  // Instructions système optimisées pour les capacités spatiales de Gemini 3
  const systemInstructionContent = `
    Tu es "Oracle Vision 3.0", l'expert IA de ${userPseudo}, expert en biométrie halieutique.
    
    TA MISSION : Analyser la photo pour extraire des données structurées avec une précision chirurgicale.
    
    CAPACITÉS SPATIALES : 
    - Utilise tes capacités de raisonnement spatial pour comparer la taille du poisson aux objets de référence.
    - RÉFÉRENCE A : Main humaine (largeur paume ~9cm).
    - RÉFÉRENCE B : Leurre visible (consulte la liste des tailles ci-dessous).
    - RÉFÉRENCE C : Pied ou chaussure si visible (~28cm).

    MAPPING RÉFÉRENTIELS :
    - Espèces : ${SPECIES_LIST.join(', ')}.
    - Types de leurres : ${JSON.stringify(referentials.lureTypes)}
    - Couleurs : ${JSON.stringify(referentials.colors)}

    RÉPONDRE UNIQUEMENT EN JSON :
    {
      "species": "Nom",
      "size": nombre (cm),
      "lureTypeId": "ID_MAPPÉ",
      "lureColorId": "ID_MAPPÉ",
      "enthusiastic_message": "Bravo Michael !...",
      "confidence_score": 0.98
    }
  `;

  // PASSAGE À GEMINI 2.5 FLASH
  const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.5-flash', 
    systemInstruction: {
      role: 'system',
      parts: [{ text: systemInstructionContent }]
    },
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  try {
    const apiRequest = {
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: "image/jpeg", data: image } }],
        }
      ],
    };

    const result = await model.generateContent(apiRequest);
    const responseText = result.response.candidates?.[0].content.parts[0].text;

    if (!responseText) throw new Error("Réponse vide de Gemini 3");

    return JSON.parse(responseText);

  } catch (error: any) {
    console.error("Erreur Oracle Vision 3.0:", error);
    throw new HttpsError("internal", "L'Oracle Vision 3.0 rencontre un problème technique.");
  }
});