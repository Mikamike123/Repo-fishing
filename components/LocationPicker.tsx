/// <reference types="vite/client" />
import React, { useState, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, MapCameraChangedEvent } from '@vis.gl/react-google-maps';
import { X, Check, MapPin, Crosshair, Move } from 'lucide-react';

interface LocationPickerProps {
    initialLat?: number;
    initialLng?: number;
    onValidate: (coords: { lat: number; lng: number }) => void;
    onCancel: () => void;
}

const LocationPicker: React.FC<LocationPickerProps> = ({ initialLat, initialLng, onValidate, onCancel }) => {
    // Coordonnées par défaut (Nanterre) si rien n'est fourni
    const defaultCenter = { lat: 48.8924, lng: 2.2071 }; 
    
    // État de la position du marqueur (Le point rouge)
    const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number }>(
        initialLat && initialLng ? { lat: initialLat, lng: initialLng } : defaultCenter
    );

    // État du centre de la caméra (Ce que l'utilisateur regarde)
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(
        initialLat && initialLng ? { lat: initialLat, lng: initialLng } : defaultCenter
    );

    // Helper de formatage (4 décimales)
    const formatCoord = (val: number) => Number(val.toFixed(4));

    // Gestion du Drag & Drop du marqueur
    const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            setMarkerPosition({ 
                lat: formatCoord(e.latLng.lat()), 
                lng: formatCoord(e.latLng.lng()) 
            });
        }
    };

    // Gestion du mouvement de la carte (Caméra)
    const handleCameraChange = useCallback((ev: MapCameraChangedEvent) => {
        setMapCenter(ev.detail.center);
    }, []);

    // Action : Téléporter le marqueur au centre de l'écran
    const handleMoveMarkerToCenter = () => {
        setMarkerPosition({
            lat: formatCoord(mapCenter.lat),
            lng: formatCoord(mapCenter.lng)
        });
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
                        <p className="text-[10px] text-stone-500">Glissez la carte ou le marqueur</p>
                    </div>
                    <button onClick={onCancel} className="p-3 bg-white text-stone-400 hover:text-stone-800 rounded-full shadow-sm pointer-events-auto transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* CARTE GOOGLE MAPS */}
                <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""}>
                    <div className="w-full h-full relative">
                        <Map
                            defaultCenter={defaultCenter}
                            defaultZoom={13}
                            mapId="DEMO_MAP_ID" // Nécessaire pour AdvancedMarker
                            disableDefaultUI={true}
                            zoomControl={true}
                            streetViewControl={false}
                            mapTypeControl={false}
                            gestureHandling={'greedy'}
                            onCameraChanged={handleCameraChange} // Suivi de la caméra
                        >
                            <AdvancedMarker
                                position={markerPosition}
                                draggable={true}
                                onDragEnd={handleMarkerDragEnd}
                            >
                                <Pin background={'#ef4444'} borderColor={'#b91c1c'} glyphColor={'#fff'} />
                            </AdvancedMarker>
                        </Map>

                        {/* VISEUR CENTRAL (Visuel uniquement) */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30 text-stone-800">
                            <Crosshair size={24} strokeWidth={1} />
                        </div>

                        {/* BOUTON D'ACTION FLOTTANT : RAMENER LE POINT */}
                        <div className="absolute bottom-28 right-4 flex flex-col gap-2 pointer-events-auto">
                            <button 
                                onClick={handleMoveMarkerToCenter}
                                className="bg-white text-stone-700 p-3 rounded-xl shadow-lg border border-stone-100 hover:bg-stone-50 active:scale-95 transition-all flex items-center gap-2"
                                title="Placer le marqueur au centre de l'écran"
                            >
                                <Move size={20} className="text-emerald-600" />
                                <span className="text-xs font-bold hidden sm:inline">Placer ici</span>
                            </button>
                        </div>
                    </div>
                </APIProvider>

                {/* Footer Validation */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/20 to-transparent pointer-events-none flex justify-center">
                    <button 
                        onClick={() => onValidate(markerPosition)}
                        className="pointer-events-auto bg-stone-800 text-white px-8 py-4 rounded-2xl shadow-xl font-black flex items-center gap-3 hover:scale-105 transition-transform"
                    >
                        <Check size={20} />
                        VALIDER LA POSITION
                        <span className="text-[10px] font-normal opacity-70 bg-stone-700 px-2 py-0.5 rounded font-mono">
                            {markerPosition.lat}, {markerPosition.lng}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LocationPicker;