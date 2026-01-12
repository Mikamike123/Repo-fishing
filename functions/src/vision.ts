// functions/src/vision.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { VertexAI } from "@google-cloud/vertexai";
import { z } from "zod";

const SPECIES_LIST = ['Sandre', 'Brochet', 'Perche', 'Silure', 'Chevesne', 'Black-Bass', 'Aspe', 'Truite', 'Bar'];

// --- SCHÉMAS DE VALIDATION ---
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

// Michael : Schéma assoupli pour éviter les crashs de parsing
const MagicScanOutputSchema = z.object({
  species: z.string(),
  // On accepte les nombres décimaux et on transforme en entier
  size: z.number().positive().transform(val => Math.round(val)),
  lureTypeId: z.string().nullable().optional(),
  lureColorId: z.string().nullable().optional(),
  enthusiastic_message: z.string(),
  confidence_score: z.number().min(0).max(1)
});

/**
 * ORACLE VISION 3.0 - Multi-User Edition
 */
export const analyzeCatchImage = onCall({ 
    region: "europe-west1", 
    memory: "1GiB",
    maxInstances: 5 
}, async (request) => {
  
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "L'accès à l'Oracle Vision nécessite une session active.");
  }

  const validatedInput = MagicScanInputSchema.safeParse(request.data);
  
  if (!validatedInput.success) {
    throw new HttpsError("invalid-argument", "Les données fournies au Magic Scan sont malformées.");
  }

  const { image, userPseudo, referentials } = validatedInput.data;
  const vertexAI = new VertexAI({ project: 'mysupstack', location: 'us-central1' });

  const cleanImage = image.includes(",") ? image.split(",")[1] : image;

  const systemInstructionContent = `
    Tu es "Oracle Vision 3.0", l'expert IA de ${userPseudo}.
    
    TA MISSION : Analyser la photo pour extraire des données biométriques.
    
    CAPACITÉS SPATIALES : 
    - RÉFÉRENCE A : Main humaine (~9cm).
    - RÉFÉRENCE B : Leurre visible.
    - RÉFÉRENCE C : Pied ou chaussure (~28-30cm).
    - Sois précis à +/- 2cm.

    MAPPING RÉFÉRENTIELS (IMPORTANT) :
    - Espèces : ${SPECIES_LIST.join(', ')}.
    - Types de leurres : ${JSON.stringify(referentials.lureTypes)}
    - Couleurs : ${JSON.stringify(referentials.colors)}
    
    CONSIGNE : Si un élément (leurre ou couleur) n'est pas identifiable ou absent du référentiel, renvoie null pour l'ID correspondant.

    FORMAT DE RÉPONSE : JSON EXCLUSIF.
    {
      "species": "Nom de l'espèce",
      "size": nombre (cm),
      "lureTypeId": "ID_MAPPÉ" ou null,
      "lureColorId": "ID_MAPPÉ" ou null,
      "enthusiastic_message": "Message court et enthousiaste pour ${userPseudo}.",
      "confidence_score": 0.0 à 1.0
    }
  `;

  const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
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
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: "image/jpeg", data: cleanImage } }],
        }
      ],
    });

    const responseText = result.response.candidates?.[0].content.parts[0].text;
    if (!responseText) throw new Error("Réponse vide de Gemini");

    // Michael : On log pour le debug en cas de doute
    console.log(`[Oracle Vision] Réponse brute pour ${userPseudo}:`, responseText);

    const parsedData = JSON.parse(responseText);
    const validatedOutput = MagicScanOutputSchema.safeParse(parsedData);
    
    if (!validatedOutput.success) {
        console.error("Détails erreur validation:", validatedOutput.error.format());
        throw new Error("L'IA a produit des données non conformes.");
    }

    return validatedOutput.data;

  } catch (error: any) {
    console.error("Erreur Oracle Vision 3.0:", error);
    // On renvoie une erreur compréhensible au front
    throw new HttpsError("internal", error.message || "L'Oracle Vision rencontre un problème.");
  }
});