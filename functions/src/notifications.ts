// functions/src/notifications.ts - Version 12.4.0 (Deep Link & Variety Edition)
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

const getSpeciesGrammar = (species: string) => {
    const s = (species || 'poisson').toLowerCase();
    const isFeminine = ['perche', 'truite', 'carpe'].includes(s);
    return {
        article: isFeminine ? 'une' : 'un',
        def: isFeminine ? 'la' : 'le',
        v: isFeminine ? 'validée' : 'validé'
    };
};

const SARDONIC_PHRASES = {
    skunk: [
        "{avatar} a fait tremper ses leurres pour rien sur ce spot. Pathétique.",
        "{avatar} est revenu du spot avec un grand sourire et zéro poisson.",
        "{avatar} a sauvé les poissons du spot en ne les attrapant pas.",
        "Statistique : 100% de bredouille pour {avatar} sur ce spot.",
        "Bredouille magistrale de {avatar}. L'Oracle est déçu.",
        "{avatar} a validé une session 'Contemplation de la nature'. Zéro prise.",
        "Le spot a gagné, {avatar} a perdu. Encore.",
        "{avatar} a tenté de pêcher. Le spot a poliment décliné l'invitation.",
        "L'Oracle suggère à {avatar} de changer de passion. Ou de spot.",
        "{avatar} est rentré bredouille. Le spot reste invaincu.",
        "Une masterclass de discrétion pour {avatar} : aucun poisson n'a été dérangé.",
        "Le vent, la lune, le courant... {avatar} a déjà préparé ses excuses.",
        "{avatar} a officiellement nourri les poissons du spot sans contrepartie.",
        "Le silence des agneaux ? Non, le silence des leurres de {avatar}.",
        "Zéro. Nada. Nothing. {avatar} est en harmonie avec le vide.",
        "Le spot : 1. {avatar} : 0. La routine s'installe.",
        "{avatar} a fait une belle balade. Ah, il pêchait ? Pardon.",
        "Les poissons du spot remercient {avatar} for ce moment de calme.",
        "Un grand moment de solitude pour {avatar} au bord de l'eau.",
        "Oracle Info : Le stock de poissons sur le spot est intact après le passage de {avatar}."
    ],
    catch: [
        "{avatar} a humilié {article} {species} de {size}cm sur ce spot.",
        "Enfin ! {avatar} sort {article} {species} de {size}cm.",
        "{avatar} a braqué le spot : {article} {species} de {size}cm au sec.",
        "{article} {species} de {size}cm a eu le malheur de croiser {avatar}.",
        "{avatar} confirme sa chance insolente : {article} {species} de {size}cm.",
        "{avatar} s'énerve : {species} de {size}cm {status} sur ce spot.",
        "{avatar} valide {article} {species} de {size}cm. Le spot est en PLS.",
        "Miracle au bord de l'eau : {avatar} attrape {article} {species} de {size}cm.",
        "Le spot a fini par céder : {article} {species} de {size}cm pour {avatar}.",
        "{avatar} punit le spot avec {article} {species} de {size}cm.",
        "{species} de {size}cm... {avatar} commence à comprendre le métier.",
        "Alerte Prise : {avatar} vient de sécher {article} {species} de {size}cm.",
        "{avatar} fait grimper le score avec {article} {species} de {size}cm.",
        "Hold-up de {avatar} : {article} {species} de {size}cm sorti de nulle part.",
        "Le spot était généreux, {avatar} a pris {article} {species} de {size}cm.",
        "{avatar} fait parler la poudre : {species} de {size}cm.",
        "L'Oracle valide (à contrecoeur) ce {species} de {size}cm pour {avatar}.",
        "{avatar} a trouvé la faille : {article} {species} de {size}cm.",
        "Le compteur s'affole : {species} de {size}cm pour {avatar}.",
        "Propre. Net. Sans bavure. {avatar} sort {article} {species} de {size}cm."
    ],
    fail: [
        "{avatar} a encore ferré dans le vide. Classique sur ce spot.",
        "'C'était un monstre !', jure {avatar} après ce raté monumental.",
        "{avatar} a offert une séance de piercing gratuite à un poisson.",
        "Touche manquée pour {avatar}. Les mains tremblent ?",
        "Décroché ! {avatar} va encore nous raconter des histoires.",
        "Raté magistral. {avatar} devrait vérifier ses hameçons.",
        "Un poisson a dit 'Non' à {avatar} de manière catégorique.",
        "{avatar} a confondu ferrage et gymnastique douce.",
        "{avatar} a été plus lent que le courant. Raté.",
        "Le poisson a testé le leurre de {avatar} et l'a recraché par pitié.",
        "Vibration suspecte, ferrage inutile. {avatar} est au top.",
        "{avatar} vient de rater le poisson de sa vie. Comme d'habitude.",
        "Une touche ? Non, juste les rêves de {avatar} qui s'envolent.",
        "{avatar} a ferré les nuages au-dessus du spot.",
        "La décroche de trop pour {avatar}. Le mental s'effrite.",
        "Le poisson a gagné son duel psychologique contre {avatar}.",
        "Tentative de ferrage non homologuée par l'Oracle pour {avatar}.",
        "{avatar} a failli faire un poisson. Mais non.",
        "Le spot rigole encore du ferrage de {avatar}.",
        "Touche, espoir, déception. Le triptyque habituel de {avatar}."
    ]
};

export const notifyNewSession = onDocumentCreated("sessions/{sessionId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const s = snapshot.data();
    const sessionId = event.params.sessionId;
    const authorId = s.userId;
    const avatarName = s.userPseudo || "Mika";
    
    const userDoc = await admin.firestore().collection("users").doc(authorId).get();
    const userData = userDoc.data();
    const avatarUrl = userData?.avatarUrl || null;

    let notificationText = "";
    // Michael : Utilisation d'un seed basé sur l'ID pour varier les plaisirs
    const seed = sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

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
        const usersSnapshot = await admin.firestore()
            .collection("users")
            .where("notificationsEnabled", "==", true)
            .get();

        const tokens: string[] = [];
        const tokenOwners: string[] = []; 
        const userDocIds: string[] = [];

        usersSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.fcmToken) {
                tokens.push(data.fcmToken);
                tokenOwners.push(data.pseudo || doc.id);
                userDocIds.push(doc.id);
            }
        });

        if (tokens.length === 0) return;

        const batchResponse = await admin.messaging().sendEachForMulticast({
            tokens: tokens,
            notification: {
                title: "🚨 ÉVÉNEMENT ORACLE",
                body: notificationText,
            },
            data: {
                sessionId: sessionId,
                type: "NEW_SESSION",
                notification_title: "🚨 ÉVÉNEMENT ORACLE",
                notification_body: notificationText,
                notification_image: avatarUrl || ""
            },
            webpush: {
                headers: { Urgency: "high" },
                notification: {
                    title: "🚨 ÉVÉNEMENT ORACLE",
                    body: notificationText,
                    icon: "/logo192.png",
                    image: avatarUrl || undefined,
                    badge: "/logo192.png",
                    tag: "oracle-event",
                    renotify: true,
                    requireInteraction: true,
                }
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
                fcmOptions: { imageUrl: avatarUrl || undefined }
            }
        });
        
        const cleanupPromises: Promise<any>[] = [];
        batchResponse.responses.forEach((resp, idx) => {
            const owner = tokenOwners[idx];
            const userId = userDocIds[idx];
            if (resp.success) {
                console.log(`✅ Push livré pour [${owner}]`);
            } else {
                if (resp.error?.code === 'messaging/registration-token-not-registered' || 
                    resp.error?.code === 'messaging/invalid-registration-token') {
                    cleanupPromises.push(
                        admin.firestore().collection("users").doc(userId).update({
                            fcmToken: admin.firestore.FieldValue.delete(),
                            notificationsEnabled: false
                        })
                    );
                }
            }
        });

        if (cleanupPromises.length > 0) await Promise.all(cleanupPromises);
        
    } catch (error) {
        console.error("🔥 Erreur Critique Push Michael :", error);
    }
});