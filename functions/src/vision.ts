// functions/src/vision.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { VertexAI } from "@google-cloud/vertexai";
import { z } from "zod"; // Import de Zod pour la validation

// Initialisation Vertex AI
const vertexAI = new VertexAI({ project: 'mysupstack', location: 'us-central1' });

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
  
  // 1. VALIDATION DU PAYLOAD D'ENTRÉE
  const validatedInput = MagicScanInputSchema.safeParse(request.data);
  
  if (!validatedInput.success) {
    console.error("Erreur de validation payload entrée:", validatedInput.error);
    throw new HttpsError("invalid-argument", "Les données fournies au Magic Scan sont malformées.");
  }

  const { image, userPseudo, referentials } = validatedInput.data;

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
    IMPORTANT : 
    - NE PAS utiliser de blocs de code Markdown (\`\`\`json).
    - Assure-toi que toutes les clés sont entre doubles guillemets.
    - Ton message enthousiaste doit se trouver exclusivement dans le champ "enthusiastic_message".

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
      temperature: 0.2, // Michael : on remonte un poil pour avoir un message moins robotique
      maxOutputTokens: 1000, // Michael : On augmente pour ne pas couper le message enthousiaste
    },
  });

  try {
    const apiRequest = {
      contents: [
        {
          role: 'user',
          parts: [
            // Michael : On passe en image/webp pour matcher la compression client
            { inlineData: { mimeType: "image/webp", data: cleanImage } },
            // Michael : On ajoute cet ancrage textuel pour forcer le JSON tout en gardant l'enthousiasme
            { text: "Analyse cette prise de pêche. Sois précis et n'oublie pas ton message enthousiaste dans le JSON." }
          ],
        }
      ],
    };

    const result = await model.generateContent(apiRequest);
    const responseText = result.response.candidates?.[0].content.parts[0].text;

    if (!responseText) throw new Error("Réponse vide de Gemini");

    /**
     * Michael : NETTOYAGE DE SÉCURITÉ DU JSON
     * On extrait uniquement ce qui est entre la première '{' et la dernière '}'
     */
    const firstBrace = responseText.indexOf('{');
    const lastBrace = responseText.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
        // Michael : On logue ce que l'IA a vraiment dit pour pouvoir débugger au bord de l'eau
        console.error("Réponse brute de l'IA (Sans JSON):", responseText);
        throw new Error("Format JSON introuvable dans la réponse de l'IA.");
    }

    const cleanedResponse = responseText.substring(firstBrace, lastBrace + 1);
    const jsonResponse = JSON.parse(cleanedResponse);
    
    // 2. VALIDATION DE LA RÉPONSE DE L'IA (Anti-Hallucination)
    const validatedOutput = MagicScanOutputSchema.safeParse(jsonResponse);
    
    if (!validatedOutput.success) {
        console.error("Gemini a produit un JSON invalide par rapport au schéma:", validatedOutput.error);
        throw new Error("L'IA a produit des données non conformes.");
    }

    // Log de succès pour console Firebase (Michael)
    console.log(`[Oracle Vision] Prise analysée pour ${userPseudo}: ${validatedOutput.data.species} (${validatedOutput.data.size}cm)`);
    
    return validatedOutput.data;

  } catch (error: any) {
    console.error("Erreur Oracle Vision 3.0:", error);
    const errorMessage = error instanceof SyntaxError ? "Erreur de syntaxe JSON IA" : error.message;
    throw new HttpsError("internal", `L'Oracle Vision 3.0 rencontre un problème technique : ${errorMessage}`);
  }
});