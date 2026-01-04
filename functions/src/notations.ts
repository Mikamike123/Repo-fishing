import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { Session, YearlySnapshot, Catch } from "./types";

/**
 * Michael : Moteur de calcul d'XP d'élite (Synchronisé sur gamification.ts)
 * Calcule l'XP théorique d'une session donnée.
 */
const calculateDetailedSessionXP = (s: Session): number => {
    let xp = 40; // SESSION_BASE
    if (s.envSnapshot) xp += 20; // SNAPSHOT_FULL
    if (s.notes && s.notes.length > 50) xp += 15; // NOTE_BONUS
    if (s.misses && s.misses.length > 0) xp += 15; // MISS_BONUS

    const speciesRules: Record<string, { base: number; perCm: number; maille: number }> = {
        'Perche': { base: 30, perCm: 4, maille: 20 },
        'Sandre': { base: 60, perCm: 8, maille: 50 },
        'Brochet': { base: 80, perCm: 12, maille: 60 },
        'Black-Bass': { base: 50, perCm: 10, maille: 30 },
        'Silure': { base: 100, perCm: 2, maille: 100 }
    };

    s.catches.forEach((c: Catch) => {
        const rule = speciesRules[c.species] || { base: 10, perCm: 0, maille: 0 };
        xp += rule.base;
        
        const sizeDelta = Math.max(0, c.size - rule.maille);
        xp += sizeDelta * rule.perCm;

        if (c.species === 'Brochet') {
            if (c.size >= 100) xp += 800; 
            else if (c.size > 90) xp += 400;
            else if (c.size > 70) xp += 200;
        }
        if (c.species === 'Sandre' && c.size > 80) xp += 300;
        if (c.species === 'Perche' && c.size > 45) xp += 150;
    });

    return Math.floor(xp);
};

export const updateFishermanRank = onDocumentWritten({
    document: "sessions/{sessionId}",
    region: "europe-west1"
}, async (event) => {
    const db = admin.firestore();
    const sessionId = event.params.sessionId;

    const afterData = event.data?.after.exists ? event.data.after.data() as Session : null;
    const beforeData = event.data?.before.exists ? event.data.before.data() as Session : null;

    // Détermination de l'action : Création, Suppression ou Mise à jour
    const isDeletion = !event.data?.after.exists;
    const activeData = isDeletion ? beforeData : afterData;

    if (!activeData) return; // Sécurité si l'événement est mal formé

    // RÉPARATION DATE (Extraction de l'année concernée)
    const dateRaw = (activeData as any).date;
    const sessionDate = dateRaw?.toDate ? dateRaw.toDate() : new Date(dateRaw);
    const sessionYear = sessionDate.getFullYear();

    if (isNaN(sessionYear)) {
        logger.error(`Impossible de déterminer l'année pour la session ${sessionId}.`);
        return;
    }

    const userId = activeData.userId;

    // CALCUL DU DELTA XP
    const totalXpSession = isDeletion ? 0 : calculateDetailedSessionXP(afterData!);
    const previousXpSession = beforeData ? calculateDetailedSessionXP(beforeData) : 0;
    const totalXpToAdd = totalXpSession - previousXpSession;

    // CALCUL DU DELTA CAPTURES
    const catchDelta = (afterData?.catchCount || 0) - (beforeData?.catchCount || 0);

    // Arrêt si aucune donnée impactant les statistiques n'a bougé
    if (totalXpToAdd === 0 && catchDelta === 0 && !isDeletion && !!beforeData) return;

    const userRef = db.collection("users").doc(userId);
    const yearlyRef = userRef.collection("stats_annuelles").doc(sessionYear.toString());

    try {
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const yearlyDoc = await transaction.get(yearlyRef);

            if (!userDoc.exists) throw new Error(`Utilisateur ${userId} introuvable.`);

            const userData = userDoc.data() as any;
            const currentTotalXP = Math.max(0, (userData.xpTotal || 0) + totalXpToAdd);
            
            const oldLevel = userData.levelReached || 1;
            const newLevel = Math.floor(currentTotalXP / 1000) + 1;
            const hasLeveledUp = newLevel > oldLevel;

            // 1. MISE À JOUR PROFIL UTILISATEUR
            transaction.update(userRef, {
                xpTotal: currentTotalXP,
                lastXpGain: totalXpToAdd,
                lastXpYear: sessionYear, // [AJOUT] Michael : Marquage de l'année du gain
                levelReached: newLevel,
                pendingLevelUp: hasLeveledUp,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. MISE À JOUR STATS ANNUELLES
            if (!yearlyDoc.exists && !isDeletion) {
                const newYearly: YearlySnapshot = {
                    year: sessionYear,
                    sessionCount: 1,
                    fishCount: afterData?.catchCount || 0,
                    xpTotal: totalXpSession,
                    levelReached: newLevel,
                    weeksWithStreak: 0
                };
                transaction.set(yearlyRef, newYearly);
            } else if (yearlyDoc.exists) {
                let sessionIncrement = 0;
                if (!beforeData) sessionIncrement = 1;
                else if (isDeletion) sessionIncrement = -1;

                transaction.update(yearlyRef, {
                    sessionCount: admin.firestore.FieldValue.increment(sessionIncrement),
                    fishCount: admin.firestore.FieldValue.increment(catchDelta),
                    xpTotal: admin.firestore.FieldValue.increment(totalXpToAdd),
                    levelReached: newLevel
                });
            }
        });

        if (isDeletion) {
            logger.info(`[CLEANUP SUCCESS] Session ${sessionId} retirée. XP: ${totalXpToAdd}`);
        } else {
            logger.info(`[GAMIFICATION SUCCESS] Michael: +${totalXpToAdd} XP sur session ${sessionId}`);
        }

    } catch (error) {
        logger.error(`Erreur transaction XP pour session ${sessionId}`, error);
    }
});