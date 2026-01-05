// components/layout/ViewRouter.tsx - Version 5.0.0 (Routing & Logic Bridge)
import React from 'react';
import Dashboard from '../Dashboard';
import HistoryView from '../HistoryView';
import ArsenalView from '../ArsenalView';
import CoachView from '../CoachView';
import ProfileView from '../ProfileView';
import SessionForm from '../SessionForm';
import LocationsManager from '../LocationsManager';

export const ViewRouter = ({ engine }: { engine: any }) => {
    const { 
        currentView, currentUserId, targetLocationId, setTargetLocationId, arsenalData, 
        handleAddItem, handleEditItem, handleDeleteItem, handleToggleLocationFavorite, 
        handleMoveItem, setCurrentView, userProfile, activeDashboardTab, setActiveDashboardTab, 
        sessions, oraclePoints, isOracleLoading, activeLocation, activeLocationId, 
        setActiveLocationId, handleMagicDiscovery, displayedWeather, lastSyncTimestamp, 
        isActuallyNight, handleDeleteSession, handleEditRequest, handleSaveSession, 
        editingSession, magicDraft, lastCatchDefaults, themeMode, setUserProfile, 
        handleLogout, handleResetCollection, currentLiveSnapshot 
    } = engine;

    switch (currentView) {
        case 'locations':
            return <LocationsManager 
                userId={currentUserId} initialOpenLocationId={targetLocationId} locations={arsenalData.locations} spots={arsenalData.spots}
                onAddLocation={(label: string, coords: any) => handleAddItem('locations', label, coords ? { coordinates: coords } : undefined)}
                onEditLocation={(id: string, label: string, extra?: any) => handleEditItem('locations', id, label, extra)}
                onDeleteLocation={(id: string) => handleDeleteItem('locations', id)}
                onToggleFavorite={handleToggleLocationFavorite}
                onMoveLocation={(id: string, dir: 'up' | 'down') => handleMoveItem('locations', id, dir)}
                onAddSpot={(label: string, locId: string) => handleAddItem('zones', label, { locationId: locId })}
                onDeleteSpot={(id: string) => handleDeleteItem('zones', id)}
                onEditSpot={(id: string, label: string) => handleEditItem('zones', id, label)}
                onBack={() => { setTargetLocationId(null); setCurrentView('dashboard'); }}
            />;

        case 'dashboard':
            return <Dashboard 
                userProfile={userProfile} activeTab={activeDashboardTab} onTabChange={setActiveDashboardTab} 
                userName={userProfile?.pseudo || 'Pêcheur'} currentUserId={currentUserId} sessions={sessions} 
                oracleData={oraclePoints} isOracleLoading={isOracleLoading} activeLocationLabel={activeLocation?.label || "Sélectionner"} 
                activeLocationId={activeLocationId} availableLocations={arsenalData.locations.filter((l: any) => l.active && l.isFavorite)} 
                onLocationClick={() => { if (activeLocationId) setTargetLocationId(activeLocationId); setCurrentView('locations'); }} 
                onLocationSelect={setActiveLocationId} setActiveLocationId={setActiveLocationId} onEditSession={handleEditRequest} 
                onDeleteSession={handleDeleteSession} onMagicDiscovery={handleMagicDiscovery} lureTypes={arsenalData.lureTypes} 
                colors={arsenalData.colors} locations={arsenalData.locations} arsenalData={arsenalData} 
                displayedWeather={displayedWeather} lastSyncTimestamp={lastSyncTimestamp} isActuallyNight={isActuallyNight} 
            />;

        case 'history':
            return <HistoryView 
                sessions={sessions} onDeleteSession={handleDeleteSession} onEditSession={handleEditRequest} 
                currentUserId={currentUserId} isActuallyNight={isActuallyNight} 
            />;

        case 'arsenal':
            return <ArsenalView 
                currentUserId={currentUserId} 
                setups={arsenalData.setups} 
                onAddSetup={(l: string) => handleAddItem('setups', l)} 
                onDeleteSetup={(id: string) => handleDeleteItem('setups', id)} 
                onEditSetup={(id: string, l: string) => handleEditItem('setups', id, l)} 
                onMoveSetup={(id: string, dir: 'up' | 'down') => handleMoveItem('setups', id, dir)} 
                techniques={arsenalData.techniques} 
                onAddTechnique={(l: string) => handleAddItem('techniques', l)} 
                onDeleteTechnique={(id: string) => handleDeleteItem('techniques', id)} 
                onEditTechnique={(id: string, l: string) => handleEditItem('techniques', id, l)} 
                onMoveTechnique={(id: string, dir: 'up' | 'down') => handleMoveItem('techniques', id, dir)} 
                lureTypes={arsenalData.lureTypes} 
                onAddLureType={(l: string) => handleAddItem('ref_lure_types', l)} 
                onDeleteLureType={(id: string) => handleDeleteItem('ref_lure_types', id)} 
                onEditLureType={(id: string, label: string) => handleEditItem('ref_lure_types', id, label)} 
                onMoveLureType={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_lure_types', id, dir)} 
                colors={arsenalData.colors} 
                onAddColor={(l: string) => handleAddItem('ref_colors', l)} 
                onDeleteColor={(id: string) => handleDeleteItem('ref_colors', id)} 
                onEditColor={(id: string, l: string) => handleEditItem('ref_colors', id, l)} 
                onMoveColor={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_colors', id, dir)} 
                sizes={arsenalData.sizes} 
                onAddSize={(l: string) => handleAddItem('ref_sizes', l)} 
                onDeleteSize={(id: string) => handleDeleteItem('ref_sizes', id)} 
                onEditSize={(id: string, l: string) => handleEditItem('ref_sizes', id, l)} 
                onMoveSize={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_sizes', id, dir)} 
                weights={arsenalData.weights} 
                onAddWeight={(l: string) => handleAddItem('ref_weights', l)} 
                onDeleteWeight={(id: string) => handleDeleteItem('ref_weights', id)} 
                onEditWeight={(id: string, l: string) => handleEditItem('ref_weights', id, l)} 
                onMoveWeight={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_weights', id, dir)} 
                // Michael : Re-activation des fonctions de Reset Michael (Zéro omission)
                onResetTechniques={(defaults) => handleResetCollection('techniques', defaults, arsenalData.techniques)} 
                onResetLureTypes={(defaults) => handleResetCollection('ref_lure_types', defaults, arsenalData.lureTypes)} 
                onResetColors={(defaults) => handleResetCollection('ref_colors', defaults, arsenalData.colors)} 
                onResetSizes={(defaults) => handleResetCollection('ref_sizes', defaults, arsenalData.sizes)} 
                onResetWeights={(defaults) => handleResetCollection('ref_weights', defaults, arsenalData.weights)} 
                onResetSetups={(defaults) => handleResetCollection('setups', defaults, arsenalData.setups)} 
            />;

        case 'coach':
            return <CoachView 
                sessions={sessions} arsenalData={arsenalData} liveSnapshot={currentLiveSnapshot} 
                currentUserId={currentUserId} userPseudo={userProfile?.pseudo || 'Pêcheur'} isActuallyNight={isActuallyNight} 
            />;

        case 'profile':
            return <ProfileView 
                userProfile={userProfile!} sessions={sessions} arsenalData={arsenalData} 
                onUpdateProfile={setUserProfile} onLogout={handleLogout} themeMode={themeMode} isActuallyNight={isActuallyNight} 
            />;

        case 'session':
            return <SessionForm 
                onAddSession={handleSaveSession} onUpdateSession={(id, data) => handleSaveSession({ ...data, id } as any)} 
                onCancel={() => setCurrentView('dashboard')} initialData={editingSession} initialDiscovery={magicDraft} 
                zones={arsenalData.spots} setups={arsenalData.setups} techniques={arsenalData.techniques} 
                lures={arsenalData.lures} lureTypes={arsenalData.lureTypes} colors={arsenalData.colors} 
                sizes={arsenalData.sizes} weights={arsenalData.weights} locations={arsenalData.locations} 
                defaultLocationId={activeLocationId} lastCatchDefaults={lastCatchDefaults} 
                currentUserId={currentUserId} isActuallyNight={isActuallyNight} 
            />;

        default:
            return null;
    }
};