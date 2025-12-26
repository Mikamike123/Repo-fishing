/// <reference types="vite/client" />
import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, MapCameraChangedEvent } from '@vis.gl/react-google-maps';
import { X, Check, MapPin } from 'lucide-react';

interface LocationPickerProps {
    initialLat?: number;
    initialLng?: number;
    onValidate: (coords: { lat: number; lng: number }) => void;
    onCancel: () => void;
}

const LocationPicker: React.FC<LocationPickerProps> = ({ initialLat, initialLng, onValidate, onCancel }) => {
    // Coordonnées par défaut (Nanterre) si rien n'est fourni
    const defaultCenter = { lat: 48.8924, lng: 2.2071 }; 
    
    // État de la position du marqueur
    const [position, setPosition] = useState<{ lat: number; lng: number }>(
        initialLat && initialLng ? { lat: initialLat, lng: initialLng } : defaultCenter
    );

    const handleDragEnd = (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            // Troncature à 4 décimales (~11m de précision) pour optimiser le cache Météo et éviter les décimales infinies
            const lat = Number(e.latLng.lat().toFixed(4));
            const lng = Number(e.latLng.lng().toFixed(4));
            setPosition({ lat, lng });
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-lg h-[80vh] rounded-[2rem] overflow-hidden flex flex-col shadow-2xl relative">
                
                {/* Header Flottant */}
                <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
                    <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-sm border border-stone-100 pointer-events-auto">
                        <h3 className="font-bold text-stone-800 flex items-center gap-2">
                            <MapPin size={16} className="text-emerald-500" />
                            Définir le point GPS
                        </h3>
                        <p className="text-[10px] text-stone-500">Déplacez le marqueur rouge</p>
                    </div>
                    <button onClick={onCancel} className="p-3 bg-white text-stone-400 hover:text-stone-800 rounded-full shadow-sm pointer-events-auto transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* CARTE GOOGLE MAPS */}
                <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""}>
                    <div className="w-full h-full">
                        <Map
                            defaultCenter={defaultCenter}
                            defaultZoom={13}
                            mapId="DEMO_MAP_ID" // Nécessaire pour AdvancedMarker
                            disableDefaultUI={true} // Options passées en direct (Props)
                            zoomControl={true}
                            streetViewControl={false}
                            mapTypeControl={false}
                            gestureHandling={'greedy'} // Permet de bouger la carte sans CTRL
                        >
                            <AdvancedMarker
                                position={position}
                                draggable={true}
                                onDragEnd={handleDragEnd}
                            >
                                <Pin background={'#ef4444'} borderColor={'#b91c1c'} glyphColor={'#fff'} />
                            </AdvancedMarker>
                        </Map>
                    </div>
                </APIProvider>

                {/* Footer Validation */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/20 to-transparent pointer-events-none flex justify-center">
                    <button 
                        onClick={() => onValidate(position)}
                        className="pointer-events-auto bg-stone-800 text-white px-8 py-4 rounded-2xl shadow-xl font-black flex items-center gap-3 hover:scale-105 transition-transform"
                    >
                        <Check size={20} />
                        VALIDER LA POSITION
                        <span className="text-[10px] font-normal opacity-70 bg-stone-700 px-2 py-0.5 rounded font-mono">
                            {position.lat}, {position.lng}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LocationPicker;