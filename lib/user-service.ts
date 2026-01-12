// lib/user-service.ts
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { UserProfile } from "../types";

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as UserProfile;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Erreur récupération profil:", error);
    return null;
  }
};

export const createUserProfile = async (userId: string, pseudo: string): Promise<UserProfile> => {
  const newProfile = {
    pseudo,
    createdAt: serverTimestamp()
  };
  
  await setDoc(doc(db, "users", userId), newProfile);
  return { id: userId, pseudo, createdAt: new Date() } as UserProfile; // Retour optimiste
};

export const updateUserPseudo = async (userId: string, pseudo: string): Promise<void> => {
  const docRef = doc(db, "users", userId);
  await updateDoc(docRef, { pseudo });
};

/**
 * Michael : Nouvelle fonction pour ancrer Seb (ou n'importe qui) sur la carte du monde.
 * Cette fonction met à jour le point d'ancrage par défaut de l'utilisateur.
 */
export const updateUserAnchor = async (userId: string, anchor: { lat: number; lng: number }): Promise<void> => {
  try {
    const docRef = doc(db, "users", userId);
    await updateDoc(docRef, { homeAnchor: anchor });
  } catch (error) {
    console.error("Erreur mise à jour point d'ancrage:", error);
    throw error;
  }
};