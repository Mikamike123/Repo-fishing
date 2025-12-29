/**
 * Collection de messages sardoniques pour la suppression de données.
 * Parce que supprimer une prise, c'est un peu comme rater un ferrage : ça fait mal, mais c'est mérité.
 */

export const CATCH_DELETION_MESSAGES = [
  "Poof ! Ce fish vient officiellement de redevenir une branche dans ta mémoire.",
  "Retour à l'eau (numérique). De toute façon, personne n'aurait cru à cette photo mal cadrée.",
  "Suppression en cours... Ton honneur est sauf, mon vieux. Personne ne saura pour ce sifflet.",
  "L'IA Gemini commençait de toute façon à se moquer de la taille de cette prise. Bon débarras.",
  "C'est ce qu'on appelle le 'Catch and Release' version base de données. Très écologique.",
  "Erreur de mesure ou simple mensonge ? Peu importe, c'est effacé.",
  "Tu supprimes cette prise ? Sage décision, mon vieux. Ton rang de 'Pro' était en péril.",
  "Adieu, pauvre bête. Elle aura passé plus de temps dans la base de données que dans ton épuisette.",
  "On efface les preuves ? Attention, le Big Data des pêcheurs te regarde.",
  "Une prise de moins. Ton graphique de statistiques va faire une dépression, comme toi au bord de l'eau."
];

export const MISS_DELETION_MESSAGES = [
  "Supprimer un raté ne fera pas revenir ce fish, mais ça soulage, n'est-ce pas ?",
  "Effacement du dossier 'Dignité perdue'. On repart sur de bonnes bases.",
  "C'est ça, mon gars. Efface ce décroché. Dans 10 minutes, tu pourras jurer qu'il n'a jamais eu lieu.",
  "Hop ! Ce 'monstre' imaginaire vient de disparaître. La réalité est parfois plus douce sans archives.",
  "On ne dit plus 'j'ai coupé', on dit 'j'ai supprimé l'entrée'. C'est plus propre.",
  "Même Gemini ne pouvait rien faire pour ce ferrage dans le vide. On oublie tout.",
  "Le journal est à nouveau vierge de tes fautes techniques. Pour combien de temps ?",
  "Raté supprimé. Il ne manque plus qu'à supprimer la déception dans tes yeux.",
  "On efface la trace de ce suivi ? Tu as raison, c'est trop cruel de s'en souvenir.",
  "Libéré de ce souvenir traumatisant. Ton setup te remercie de ne plus lui rejeter la faute."
];

/**
 * Récupère un message aléatoire selon le type de suppression
 */
export const getRandomDeletionMessage = (type: 'catch' | 'miss'): string => {
  const messages = type === 'catch' ? CATCH_DELETION_MESSAGES : MISS_DELETION_MESSAGES;
  return messages[Math.floor(Math.random() * messages.length)];
};