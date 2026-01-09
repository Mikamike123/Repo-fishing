import { onCall, HttpsError } from "firebase-functions/v2/https";
import { VertexAI } from "@google-cloud/vertexai";
import { z } from "zod"; // Import de Zod pour la validation

const SPECIES_LIST = ['Sandre', 'Brochet', 'Perche', 'Silure', 'Chevesne', 'Black-Bass', 'Aspe', 'Truite', 'Bar'];

// --- SCHÉMAS DE VALIDATION ZOD ---

// Validation des données entrantes (Michael -> Firebase)
const MagicScanInputSchema = z.object({
  image: z.string().min(1, "L'image est absente."),
  userPseudo: z.string().min(1),
  referentials: z.object({
    lureTypes: z.array(z.object({
      id: z.string(),
      label: z.string()
    })),
    colors: z.array(z.object({
      id: z.string(),
      label: z.string()
    }))
  })
});

// Validation des données sortantes (Gemini -> Michael)
const MagicScanOutputSchema = z.object({
  species: z.string(),
  size: z.number().int().positive(),
  lureTypeId: z.string(),
  lureColorId: z.string(),
  enthusiastic_message: z.string(),
  confidence_score: z.number().min(0).max(1)
});

/**
 * ORACLE VISION 3.0 - Analyse de prise par IA (One-Click Logging)
 */
export const analyzeCatchImage = onCall({ 
    region: "europe-west1", 
    memory: "1GiB",
    maxInstances: 5 
}, async (request) => {
  
  // 0. SÉCURITÉ : Vérification de l'authentification Michael
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "L'accès à l'Oracle Vision nécessite une session active.");
  }

  // 1. VALIDATION DU PAYLOAD D'ENTRÉE
  const validatedInput = MagicScanInputSchema.safeParse(request.data);
  
  if (!validatedInput.success) {
    console.error("Erreur de validation payload entrée:", validatedInput.error);
    throw new HttpsError("invalid-argument", "Les données fournies au Magic Scan sont malformées.");
  }

  const { image, userPseudo, referentials } = validatedInput.data;

  // Michael : Initialisation Vertex AI déplacée à l'intérieur pour sécuriser le déploiement
  const vertexAI = new VertexAI({ project: 'mysupstack', location: 'us-central1' });

  /**
   * NETTOYAGE IMAGE
   */
  const cleanImage = image.includes(",") ? image.split(",")[1] : image;

  const systemInstructionContent = `
    Tu es "Oracle Vision 3.0", l'expert IA de ${userPseudo}, expert en biométrie halieutique.
    
    TA MISSION : Analyser la photo pour extraire des données structurées avec une précision chirurgicale.
    
    CAPACITÉS SPATIALES & ESTIMATION : 
    - Utilise tes capacités de raisonnement spatial pour comparer la taille du poisson aux objets de référence.
    - RÉFÉRENCE A : Main humaine (largeur paume moyenne ~9cm).
    - RÉFÉRENCE B : Leurre visible (consulte la liste des types fournis pour le contexte).
    - RÉFÉRENCE C : Pied ou chaussure si visible (~28cm-30cm).
    - Sois précis à +/- 2cm.

    MAPPING RÉFÉRENTIELS (CRITIQUE) :
    - Espèces : ${SPECIES_LIST.join(', ')}.
    - Types de leurres : ${JSON.stringify(referentials.lureTypes)}
    - Couleurs : ${JSON.stringify(referentials.colors)}
    
    CONSIGNE MAPPING : Tu dois impérativement mapper le leurre et la couleur aux IDs fournis ci-dessus. 
    Si tu as un doute, choisis l'ID dont le label est le plus sémantiquement proche.

    FORMAT DE RÉPONSE : Tu dois répondre EXCLUSIVEMENT avec un objet JSON valide.
    {
      "species": "Nom de l'espèce (ex: Sandre)",
      "size": nombre entier (cm),
      "lureTypeId": "ID_MAPPÉ",
      "lureColorId": "ID_MAPPÉ",
      "enthusiastic_message": "Message court et enthousiaste pour Michael.",
      "confidence_score": 0.0 à 1.0
    }
  `;

  const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.5-flash', 
    systemInstruction: {
      role: 'system',
      parts: [{ text: systemInstructionContent }]
    },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1, 
    },
  });

  try {
    const apiRequest = {
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: "image/jpeg", data: cleanImage } }],
        }
      ],
    };

    const result = await model.generateContent(apiRequest);
    const responseText = result.response.candidates?.[0].content.parts[0].text;

    if (!responseText) throw new Error("Réponse vide de Gemini");

    const jsonResponse = JSON.parse(responseText);
    
    // 2. VALIDATION DE LA RÉPONSE DE L'IA (Anti-Hallucination)
    const validatedOutput = MagicScanOutputSchema.safeParse(jsonResponse);
    
    if (!validatedOutput.success) {
        console.error("Gemini a produit un JSON invalide:", validatedOutput.error);
        throw new Error("L'IA a produit des données non conformes.");
    }

    // Log de succès pour console Firebase (Michael)
    console.log(`[Oracle Vision] Prise analysée pour ${userPseudo}: ${validatedOutput.data.species} (${validatedOutput.data.size}cm)`);
    
    return validatedOutput.data;

  } catch (error: any) {
    console.error("Erreur Oracle Vision 3.0:", error);
    throw new HttpsError("internal", "L'Oracle Vision 3.0 rencontre un problème technique de traitement.");
  }
});