// functions/src/notifications.ts
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

// Michael : Réplication de la logique de grammaire du frontend pour l'Oracle
const getSpeciesGrammar = (species: string) => {
    const s = (species || 'poisson').toLowerCase();
    const isFeminine = ['perche', 'truite', 'carpe'].includes(s);
    return {
        article: isFeminine ? 'une' : 'un',
        v: isFeminine ? 'validée' : 'validé'
    };
};

// Michael : Tes phrases cultes (identiques à constants/feedPhrases.ts)
const SARDONIC_PHRASES = {
    skunk: [
        "{avatar} a fait tremper ses leurres pour rien sur ce spot. Pathétique.",
        "Statistique : 100% de bredouille pour {avatar} on ce spot.",
        "Bredouille magistrale de {avatar}. L'Oracle est déçu.",
        "Oracle Info : Le stock de poissons sur le spot est intact après le passage de {avatar}."
    ],
    catch: [
        "{avatar} a humilié {article} {species} de {size}cm sur ce spot.",
        "{avatar} a braqué le spot : {article} {species} de {size}cm au sec.",
        "{avatar} valide {article} {species} de {size}cm. Le spot est en PLS.",
        "Propre. Net. Sans bavure. {avatar} sort {article} {species} de {size}cm."
    ],
    fail: [
        "{avatar} a encore ferré dans le vide. Classique sur ce spot.",
        "Raté magistral. {avatar} devrait vérifier ses hameçons.",
        "Un poisson a dit 'Non' à {avatar} de manière catégorique.",
        "Le spot rigole encore du ferrage de {avatar}."
    ]
};

export const notifyNewSession = onDocumentCreated("sessions/{sessionId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const s = snapshot.data();
    const sessionId = event.params.sessionId;
    const authorId = s.userId;
    const avatarName = s.userPseudo || "Mika";
    
    // 1. Récupération de l'avatar URL depuis le profil utilisateur
    const userDoc = await admin.firestore().collection("users").doc(authorId).get();
    const userData = userDoc.data();
    const avatarUrl = userData?.avatarUrl || null;

    // 2. Génération du texte sardonique (Logique miroir du FeedView)
    let notificationText = "";
    const seed = sessionId.charCodeAt(sessionId.length - 1);

    if (s.catches && s.catches.length > 0) {
        const c = s.catches[0]; 
        const g = getSpeciesGrammar(c.species);
        const phrase = SARDONIC_PHRASES.catch[seed % SARDONIC_PHRASES.catch.length];
        notificationText = phrase
            .replace('{avatar}', avatarName)
            .replace('{species}', c.species)
            .replace('{article}', g.article)
            .replace('{status}', g.v)
            .replace('{size}', c.size.toString());
    } else if (s.misses && s.misses.length > 0) {
        const phrase = SARDONIC_PHRASES.fail[seed % SARDONIC_PHRASES.fail.length];
        notificationText = phrase.replace('{avatar}', avatarName);
    } else {
        const phrase = SARDONIC_PHRASES.skunk[seed % SARDONIC_PHRASES.skunk.length];
        notificationText = phrase.replace('{avatar}', avatarName);
    }

    try {
        // 3. Cibles : tous ceux qui ont activé les notifs (Auteur inclus selon ton souhait)
        const usersSnapshot = await admin.firestore()
            .collection("users")
            .where("notificationsEnabled", "==", true)
            .get();

        const tokens: string[] = [];
        const tokenOwners: string[] = []; // Michael : Pour savoir à qui appartient quel token dans les logs

        usersSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.fcmToken) {
                tokens.push(data.fcmToken);
                tokenOwners.push(data.pseudo || doc.id);
            }
        });

        console.log(`[Diagnostic Notif] ${tokens.length} token(s) trouvé(s) pour cette session.`);

        if (tokens.length === 0) {
            console.log("⚠️ Aucun token valide trouvé. Fin de la fonction.");
            return;
        }

        // 4. Envoi avec Image (Avatar) - Capture de la réponse pour analyse
        const batchResponse = await admin.messaging().sendEachForMulticast({
            tokens: tokens,
            notification: {
                title: "🚨 ÉVÉNEMENT ORACLE",
                body: notificationText,
            },
            data: {
                sessionId: sessionId,
                type: "NEW_SESSION"
            },
            android: {
                priority: "high",
                notification: {
                    imageUrl: avatarUrl || undefined,
                    icon: "stock_ticker_update",
                    color: "#f59e0b"
                }
            },
            apns: {
                payload: {
                    aps: {
                        mutableContent: true,
                        contentAvailable: true,
                        sound: "default"
                    }
                },
                fcmOptions: {
                    imageUrl: avatarUrl || undefined
                }
            }
        });
        
        // 5. Analyse détaillée des résultats de l'envoi
        console.log(`🚀 Résultat Global : ${batchResponse.successCount} succès, ${batchResponse.failureCount} échecs.`);
        
        batchResponse.responses.forEach((resp, idx) => {
            const owner = tokenOwners[idx];
            if (resp.success) {
                console.log(`✅ Push livré à FCM pour [${owner}] (Token: ${tokens[idx].substring(0, 10)}...)`);
            } else {
                console.error(`❌ Erreur Push pour [${owner}]:`, resp.error);
                // Michael : Si l'erreur est 'messaging/registration-token-not-registered', le token est obsolète.
            }
        });
        
    } catch (error) {
        console.error("🔥 Erreur Critique Push Michael :", error);
    }
});