// components/LocationsManager.tsx - Version 12.1.0 (Modular & Typed)
import React, { useState, useEffect } from 'react';
import { Location, Spot, UserProfile } from '../types';
import LocationListView from './LocationListView';
import LocationEditor from './LocationEditor';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import { LOCATION_DELETION_MESSAGES } from '../constants/deletionMessages';
import { Check, AlertCircle } from 'lucide-react';

interface LocationsManagerProps {
    locations: Location[];
    spots: Spot[];
    userId: string;
    userProfile: UserProfile | null;
    onUpdateUserAnchor: (anchor: { lat: number; lng: number }) => void;
    onAddLocation: (label: string, coordinates?: { lat: number; lng: number }) => void;
    onEditLocation: (id: string, label: string, extraData?: any) => void;
    onDeleteLocation: (id: string) => void;
    onToggleFavorite: (location: Location) => void;
    onMoveLocation: (id: string, direction: 'up' | 'down') => void;
    onAddSpot: (label: string, locationId: string) => void;
    onDeleteSpot: (id: string) => void;
    onEditSpot: (id: string, label: string) => void;
    onBack: () => void;
    initialOpenLocationId?: string | null;
    isActuallyNight?: boolean;
}

const LocationsManager: React.FC<LocationsManagerProps> = (props) => {
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'location' | 'spot'; id: string; label: string; } | null>(null);

    useEffect(() => {
        if (props.initialOpenLocationId && props.locations.length > 0) {
            const target = props.locations.find(l => l.id === props.initialOpenLocationId);
            if (target) setSelectedLocation(target);
        }
    }, [props.initialOpenLocationId, props.locations]);

    const handleConfirmDelete = () => {
        if (!deleteConfirm) return;
        if (deleteConfirm.type === 'location') {
            props.onDeleteLocation(deleteConfirm.id);
            if (selectedLocation?.id === deleteConfirm.id) setSelectedLocation(null);
        } else {
            props.onDeleteSpot(deleteConfirm.id);
        }
        setDeleteConfirm(null);
    };

    return (
        <div className="pb-24 px-4 pt-4 max-w-2xl mx-auto relative">
            <DeleteConfirmDialog 
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                onConfirm={handleConfirmDelete}
                title={deleteConfirm?.type === 'location' ? `Supprimer "${deleteConfirm?.label}" ?` : `Supprimer le spot ?`}
                customMessages={LOCATION_DELETION_MESSAGES} 
                isActuallyNight={props.isActuallyNight}
            />

            {notification && (
                <div className="mb-4 bg-emerald-900/20 text-emerald-500 border border-emerald-900/30 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <Check size={16}/> {notification}
                </div>
            )}
            
            {error && (
                <div className="mb-4 bg-rose-950/20 text-rose-500 border border-rose-900/30 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={16}/> {error}
                </div>
            )}

            {selectedLocation ? (
                <LocationEditor 
                    location={selectedLocation}
                    spots={props.spots.filter(s => s.locationId === selectedLocation.id)}
                    isActuallyNight={props.isActuallyNight}
                    userProfile={props.userProfile}
                    onBack={() => setSelectedLocation(null)}
                    onEditLocation={props.onEditLocation}
                    onAddSpot={props.onAddSpot}
                    onDeleteSpot={(id: string, label: string) => setDeleteConfirm({ type: 'spot', id, label })}
                    onEditSpot={props.onEditSpot}
                    setNotification={setNotification}
                    setError={setError}
                />
            ) : (
                <LocationListView 
                    {...props}
                    onSelectLocation={setSelectedLocation}
                    onRequestDeleteLocation={(id: string, label: string) => setDeleteConfirm({ type: 'location', id, label })}
                    setError={setError}
                    setNotification={setNotification}
                />
            )}
        </div>
    );
};

export default LocationsManager;