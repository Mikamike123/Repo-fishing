// components/MagicScanButton.tsx
import React, { useRef, useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { extractSessionDraft } from '../lib/discovery-service';
import { httpsCallable } from 'firebase/functions';
import { functions, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface MagicScanButtonProps {
    onDiscoveryComplete: (draft: any) => void;
    userPseudo: string;
    lureTypes: any[]; 
    colors: any[];    
    userId: string; 
}

const MagicScanButton: React.FC<MagicScanButtonProps> = ({ 
    onDiscoveryComplete, 
    userPseudo, 
    lureTypes, 
    colors,
    userId 
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const compressImage = (file: File): Promise<{ base64: string, blob: Blob }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1600; 
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_WIDTH) {
                            width *= MAX_WIDTH / height;
                            height = MAX_WIDTH;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    // Michael : On repasse en image/jpeg pour matcher le backend
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    const base64 = dataUrl.split(',')[1];
                    
                    canvas.toBlob((blob) => {
                        if (blob) resolve({ base64, blob });
                        else reject(new Error("Erreur Blob"));
                    }, 'image/jpeg', 0.8);
                };
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const draft: any = await extractSessionDraft(file);
            const { base64, blob } = await compressImage(file);

            const referentials = {
                lureTypes: lureTypes.map(l => ({ id: l.id, label: l.label })),
                colors: colors.map(c => ({ id: c.id, label: c.label }))
            };

            // Appel Cloud Function
            const analyzePromise = httpsCallable(functions, 'analyzeCatchImage')({ 
                image: base64, 
                userPseudo, 
                referentials 
            });

            // Upload Storage lié à l'utilisateur réel
            const storageRef = ref(storage, `catches/${userId}/magic_${Date.now()}_${file.name.replace(/\s/g, '_')}`);
            const uploadPromise = uploadBytes(storageRef, blob);

            const [aiResult, uploadResult] = await Promise.all([analyzePromise, uploadPromise]);
            const downloadUrl = await getDownloadURL(uploadResult.ref);
            const aiData: any = aiResult.data;

            draft.initialCatch = {
                id: `magic_${Date.now()}`,
                species: aiData.species || 'Inconnu',
                size: aiData.size || 30,
                lureTypeId: aiData.lureTypeId || '',
                lureColorId: aiData.lureColorId || '',
                photoUrls: [downloadUrl],
                time: draft.startTime,
                lureName: 'Identifié par Oracle Vision'
            };

            onDiscoveryComplete(draft);
        } catch (err) {
            console.error("Échec du Magic Scan :", err);
            alert("L'Oracle a eu un problème technique. Vérifie ta connexion.");
        } finally {
            setIsLoading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <>
            <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFile} />
            <button 
                type="button"
                onClick={() => !isLoading && fileRef.current?.click()}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg flex items-center justify-center active:scale-95 transition-all"
            >
                {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Wand2 size={24} />}
            </button>
        </>
    );
};

export default MagicScanButton;