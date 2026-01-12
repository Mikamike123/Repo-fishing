// components/ProfileEditor.tsx - Version 12.2.1 (Toggle Notification Hub)
import React, { useState, useRef } from 'react';
import { 
    User, Camera, Edit2, Check, X, LogOut, Sun, Moon, Settings, Bell, BellOff, ShieldCheck 
} from 'lucide-react';
import { UserProfile } from '../types';
import { doc, updateDoc } from 'firebase/firestore'; 
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage, messaging, getToken } from '../lib/firebase'; 

interface ProfileEditorProps {
    userProfile: UserProfile;
    onUpdateProfile: (newProfile: UserProfile) => void;
    onLogout: () => void;
    themeMode: 'light' | 'night' | 'auto';
    isActuallyNight: boolean;
}

const SmartAvatar: React.FC<{ url?: string; isActuallyNight?: boolean; onClick: () => void }> = ({ url, isActuallyNight, onClick }) => {
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    return (
        <div 
            className={`relative w-32 h-32 rounded-full mb-6 border-[6px] shadow-2xl overflow-hidden group cursor-pointer transition-all ${
                isActuallyNight ? 'border-stone-800 bg-stone-800' : 'border-white bg-white'
            }`} 
            onClick={onClick}
        >
            {loading && <div className="absolute inset-0 animate-pulse bg-stone-200 opacity-20" />}
            {!url || error ? (
                <div className="flex items-center justify-center w-full h-full bg-stone-100/10">
                    <User size={56} className="text-stone-400" />
                </div>
            ) : (
                <img 
                    src={url} 
                    className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`} 
                    alt="Profile" 
                    onLoad={() => setLoading(false)}
                    onError={() => { setError(true); setLoading(false); }}
                />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera size={28} className="text-white" />
            </div>
        </div>
    );
};

export const ProfileEditor: React.FC<ProfileEditorProps> = ({ 
    userProfile, onUpdateProfile, onLogout, themeMode, isActuallyNight 
}) => {
    const [isEditingPseudo, setIsEditingPseudo] = useState(false);
    const [editPseudoValue, setEditPseudoValue] = useState(userProfile.pseudo);
    const [notifLoading, setNotifLoading] = useState(false);
    const [notifError, setNotifError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const VAPID_KEY = "BJYwmMKojZdVWfnS64OCqOMzbmGRlZxnO_gwKgxuWp1Ip9vls42Ie_c9E_Gk-Qqkcvlpgc9KKUef6MC-RC23ms0";

    const handleUpdatePseudo = async () => {
        if (editPseudoValue.trim().length < 3) return;
        try {
            const userDocRef = doc(db, "users", userProfile.id);
            await updateDoc(userDocRef, { pseudo: editPseudoValue });
            onUpdateProfile({ ...userProfile, pseudo: editPseudoValue });
            setIsEditingPseudo(false);
        } catch (e) { console.error("Erreur pseudo Oracle :", e); }
    };

    const handleEnableNotifications = async () => {
        if (!messaging || !userProfile) return;
        
        setNotifLoading(true);
        setNotifError(null);

        try {
            // Michael : Gestion de la désactivation (Toggle OFF)
            if (userProfile.notificationsEnabled) {
                const userDocRef = doc(db, "users", userProfile.id);
                await updateDoc(userDocRef, { notificationsEnabled: false });
                onUpdateProfile({ ...userProfile, notificationsEnabled: false });
                setNotifLoading(false);
                return;
            }

            // Michael : Gestion de l'activation (Toggle ON)
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                const token = await getToken(messaging, { 
                    vapidKey: VAPID_KEY 
                });

                if (token) {
                    const userDocRef = doc(db, "users", userProfile.id);
                    const updateData = { 
                        fcmToken: token, 
                        notificationsEnabled: true,
                        lastTokenUpdate: new Date().toISOString()
                    };
                    await updateDoc(userDocRef, updateData);
                    onUpdateProfile({ ...userProfile, ...updateData } as UserProfile);
                    console.log("🚀 Oracle Push Enabled for Device");
                }
            } else {
                setNotifError("Permission refusée. Vérifie tes réglages système.");
            }
        } catch (err) {
            console.error("🔥 Erreur Push Michael :", err);
            setNotifError("Service indisponible. Vérifie ta connexion.");
        } finally {
            setNotifLoading(false);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.src = reader.result as string;
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                }

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.9);

                try {
                    const storageRef = ref(storage, `avatars/${userProfile.id}.jpg`);
                    await uploadString(storageRef, compressedBase64, 'data_url');
                    const downloadURL = await getDownloadURL(storageRef);
                    const userDocRef = doc(db, "users", userProfile.id);
                    await updateDoc(userDocRef, { avatarUrl: downloadURL });
                    onUpdateProfile({ ...userProfile, avatarUrl: downloadURL });
                } catch (e) { console.error("Erreur Storage Oracle :", e); }
            };
        };
        reader.readAsDataURL(file);
    };

    const handleThemeChange = async (mode: 'light' | 'night' | 'auto') => {
        try {
            const userDocRef = doc(db, "users", userProfile.id);
            await updateDoc(userDocRef, { themePreference: mode });
            onUpdateProfile({ ...userProfile, themePreference: mode } as UserProfile);
        } catch (e) { console.error("Erreur thématique :", e); }
    };

    const cardClass = isActuallyNight ? "bg-[#292524] border-stone-800 shadow-none" : "bg-white border-stone-100 shadow-sm";

    return (
        <div className="space-y-8">
            <div className="flex flex-col items-center pt-8 relative text-center">
                <button onClick={onLogout} className={`absolute top-4 right-0 p-3 rounded-2xl flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest border transition-all active:scale-95 ${isActuallyNight ? 'bg-stone-900 border-stone-800 text-stone-400' : 'bg-red-50 border-red-100 text-red-500'}`}>
                    <LogOut size={14} /> Déconnexion
                </button>

                <SmartAvatar 
                    url={userProfile.avatarUrl} 
                    isActuallyNight={isActuallyNight} 
                    onClick={() => fileInputRef.current?.click()} 
                />
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                
                <div className="flex flex-col items-center gap-2">
                    {isEditingPseudo ? (
                        <div className="flex items-center gap-2 animate-in slide-in-from-bottom-2">
                            <input 
                                type="text"
                                value={editPseudoValue}
                                onChange={(e) => setEditPseudoValue(e.target.value)}
                                className={`text-3xl font-black tracking-tighter border-b-2 bg-transparent outline-none text-center ${isActuallyNight ? 'text-white border-amber-500' : 'text-stone-800 border-amber-500'}`}
                                autoFocus
                            />
                            <button onClick={handleUpdatePseudo} className="p-2 bg-emerald-500 text-white rounded-full shadow-lg"><Check size={18}/></button>
                            <button onClick={() => { setIsEditingPseudo(false); setEditPseudoValue(userProfile.pseudo); }} className="p-2 bg-stone-500 text-white rounded-full shadow-lg"><X size={18}/></button>
                        </div>
                    ) : (
                        <div className="group flex items-center gap-3">
                            <h1 className={`text-4xl font-black tracking-tighter uppercase italic ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>{userProfile.pseudo}</h1>
                            <button onClick={() => setIsEditingPseudo(true)} className="p-2 rounded-full bg-stone-100/10 text-stone-400 opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={16}/></button>
                        </div>
                    )}
                </div>
            </div>

            <div className={`rounded-[2.5rem] p-8 border space-y-8 transition-colors duration-500 ${cardClass}`}>
                
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 flex items-center gap-2">
                            <Bell size={14} className="text-amber-500" /> Notifications Push
                        </h3>
                        {userProfile.notificationsEnabled && (
                            <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
                                <ShieldCheck size={10} /> Actif
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleEnableNotifications}
                            disabled={notifLoading}
                            className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 ${
                                userProfile.notificationsEnabled 
                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' 
                                : 'bg-stone-800 text-white shadow-xl shadow-stone-900/20'
                            }`}
                        >
                            {notifLoading ? (
                                <span className="animate-pulse">Calcul...</span>
                            ) : userProfile.notificationsEnabled ? (
                                <><BellOff size={16} /> Couper les alertes</>
                            ) : (
                                <><Bell size={16} /> Activer les alertes Oracle</>
                            )}
                        </button>
                    </div>
                    {notifError && <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest text-center">{notifError}</p>}
                </div>

                <hr className={`border-t-2 ${isActuallyNight ? 'border-stone-800' : 'border-stone-50'}`} />

                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 flex items-center gap-2">
                        <Settings size={14} className="text-amber-500" /> Setup Visuel
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => handleThemeChange('light')} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${themeMode === 'light' ? (isActuallyNight ? 'bg-amber-900/20 border-amber-500 text-amber-500' : 'bg-amber-50 border-amber-400 text-amber-900 shadow-md') : 'bg-stone-50/5 border-transparent text-stone-500'}`}><Sun size={20} /><span className="text-[9px] font-black uppercase">Jour</span></button>
                        <button onClick={() => handleThemeChange('night')} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${themeMode === 'night' ? (isActuallyNight ? 'bg-stone-900 border-amber-500 text-amber-500 shadow-lg' : 'bg-stone-900 border-stone-700 text-amber-400 shadow-md') : 'bg-stone-50/5 border-transparent text-stone-500'}`}><Moon size={20} /><span className="text-[9px] font-black uppercase">Night Ops</span></button>
                        <button onClick={() => handleThemeChange('auto')} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${themeMode === 'auto' ? (isActuallyNight ? 'bg-emerald-950 border-emerald-500 text-emerald-500' : 'bg-emerald-50 border-emerald-400 text-amber-900 shadow-md') : 'bg-stone-50/5 border-transparent text-stone-500'}`}><div className="flex gap-0.5"><Sun size={12} /><Moon size={12} /></div><span className="text-[9px] font-black uppercase">Auto</span></button>
                    </div>
                </div>
            </div>
        </div>
    );
};