// components/layout/ViewRouter.tsx - Version 10.8.1 (Fixed Modal Positioning)
import React, { useEffect } from 'react';
import Dashboard from '../Dashboard';
import HistoryView from '../HistoryView';
import ArsenalView from '../ArsenalView';
import CoachView from '../CoachView';
import ProfileView from '../ProfileView';
import SessionForm from '../SessionForm';
import LocationsManager from '../LocationsManager';
import { Waves } from 'lucide-react';

const DebugOverlay = ({ data }: { data: any }) => (
    <div style={{ position: 'fixed', bottom: '100px', left: '20px', right: '20px', background: 'rgba(0,0,0,0.9)', color: '#00ff00', padding: '15px', fontSize: '11px', zIndex: 9999, borderRadius: '15px', fontFamily: 'monospace', border: '1px solid #333', pointerEvents: 'none' }}>
        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #333', marginBottom: '5px', paddingBottom: '3px' }}>🔧 ORACLE DIAGNOSTIC</div>
        <div>AUTH_READY: {data.authLoading ? '⏳ LOADING' : '✅ OK'}</div>
        <div>USER_AUTH: {data.hasUser ? `✅ ${data.email}` : '❌ NO_USER'}</div>
        <div>WHITELIST: {data.isWhitelisted === null ? '⏳ CHECKING' : (data.isWhitelisted ? '✅ YES' : '❌ NO')}</div>
        <div>PROFILE_LOAD: {data.profileExists ? '✅ LOADED' : '❌ WAITING'}</div>
        <div>ERROR: {data.error || 'NONE'}</div>
    </div>
);

const OracleSplash = () => (
    <div className="fixed inset-0 z-[200] bg-[#1c1917] flex flex-col items-center justify-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center shadow-2xl animate-pulse mb-6">
            <Waves size={40} className="text-white" />
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.4em] text-stone-600">
            Initialisation Oracle
        </div>
    </div>
);

// Michael : Moteur Physique Global - Version Corrigée pour le positionnement Fixed
const injectOracleStyles = () => {
    if (typeof document === 'undefined' || document.getElementById('oracle-physics-styles')) return;
    const style = document.createElement('style');
    style.id = 'oracle-physics-styles';
    style.textContent = `
        /* 1. Animation d'entrée des Vues - Michael : Correction transform: none pour libérer les modals */
        @keyframes oracleViewEnter {
            from { 
                opacity: 0; 
                transform: translateY(20px) scale(0.98); 
            }
            to { 
                opacity: 1; 
                transform: none; 
            }
        }
        .animate-oracle-view {
            /* Michael : 'both' assure que l'état final est maintenu, 'none' libère le contexte fixed */
            animation: oracleViewEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* 2. Physique des Boutons (Spring Scale + Elevation) */
        .oracle-btn-press {
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        }
        .oracle-btn-press:active {
            transform: scale(0.94);
            filter: brightness(0.92);
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }

        /* 3. Physique des Cartes et Grands Conteneurs (Subtle Depth) */
        .oracle-card-press {
            transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        }
        .oracle-card-press:active {
            transform: scale(0.99);
            filter: contrast(1.02);
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }
    `;
    document.head.appendChild(style);
};

export const ViewRouter = ({ engine }: { engine: any }) => {
    useEffect(() => {
        injectOracleStyles();
    }, []);

    const { 
        currentView, currentUserId, targetLocationId, setTargetLocationId, arsenalData, 
        handleAddItem, handleEditItem, handleDeleteItem, handleToggleLocationFavorite, 
        handleMoveItem, setCurrentView, userProfile, activeDashboardTab, setActiveDashboardTab, 
        sessions, oraclePoints, isOracleLoading, activeLocation, activeLocationId, 
        setActiveLocationId, handleMagicDiscovery, displayedWeather, lastSyncTimestamp, 
        isActuallyNight, handleDeleteSession, handleEditRequest, handleSaveSession, 
        editingSession, magicDraft, lastCatchDefaults, themeMode, setUserProfile, 
        handleLogout, handleResetCollection, currentLiveSnapshot,
        user, authLoading, isWhitelisted, firestoreError, handleCreateProfile,
        usersRegistry,
        lastSavedSessionId, setLastSavedSessionId 
    } = engine;

    if (authLoading || (!userProfile && currentUserId !== "guest" && firestoreError !== "DOC_NOT_FOUND")) {
        return <OracleSplash />;
    }

    if (firestoreError === "DOC_NOT_FOUND") {
        return <ProfileView 
            userProfile={null} sessions={[]} arsenalData={arsenalData} onUpdateProfile={setUserProfile} 
            onLogout={handleLogout} themeMode={themeMode} isActuallyNight={isActuallyNight} 
            isNewUser={true} onCreateProfile={handleCreateProfile}
        />;
    }

    const withTransition = (component: React.ReactNode) => (
        <div key={currentView} className="animate-oracle-view">
            {component}
        </div>
    );

    switch (currentView) {
        case 'locations':
            return withTransition(<LocationsManager userId={currentUserId} initialOpenLocationId={targetLocationId} locations={arsenalData.locations} spots={arsenalData.spots} isActuallyNight={isActuallyNight} onAddLocation={(label: string, coords: any) => handleAddItem('locations', label, coords ? { coordinates: coords } : undefined)} onEditLocation={(id: string, label: string, extra?: any) => handleEditItem('locations', id, label, extra)} onDeleteLocation={(id: string) => handleDeleteItem('locations', id)} onToggleFavorite={handleToggleLocationFavorite} onMoveLocation={(id: string, dir: 'up' | 'down') => handleMoveItem('locations', id, dir)} onAddSpot={(label: string, locId: string) => handleAddItem('zones', label, { locationId: locId })} onDeleteSpot={(id: string) => handleDeleteItem('zones', id)} onEditSpot={(id: string, label: string) => handleEditItem('zones', id, label)} onBack={() => { setTargetLocationId(null); setCurrentView('dashboard'); }} />);
        
        case 'dashboard':
            return withTransition(<Dashboard userProfile={userProfile} usersRegistry={usersRegistry} activeTab={activeDashboardTab} onTabChange={setActiveDashboardTab} userName={userProfile?.pseudo || 'Pêcheur'} currentUserId={currentUserId} sessions={sessions} oracleData={oraclePoints} isOracleLoading={isOracleLoading} activeLocationLabel={activeLocation?.label || "Sélectionner"} activeLocationId={activeLocationId} availableLocations={arsenalData.locations.filter((l: any) => l.active && l.isFavorite)} onLocationClick={() => { if (activeLocationId) setTargetLocationId(activeLocationId); setCurrentView('locations'); }} onLocationSelect={setActiveLocationId} setActiveLocationId={setActiveLocationId} onEditSession={handleEditRequest} onDeleteSession={handleDeleteSession} onMagicDiscovery={handleMagicDiscovery} lureTypes={arsenalData.lureTypes} colors={arsenalData.colors} locations={arsenalData.locations} arsenalData={arsenalData} displayedWeather={displayedWeather} lastSyncTimestamp={lastSyncTimestamp} isActuallyNight={isActuallyNight} />);

        case 'history':
            return withTransition(<HistoryView sessions={sessions} onDeleteSession={handleDeleteSession} onEditSession={handleEditRequest} currentUserId={currentUserId} userProfile={userProfile} usersRegistry={usersRegistry} isActuallyNight={isActuallyNight} highlightSessionId={lastSavedSessionId} onClearHighlight={() => setLastSavedSessionId(null)} />);

        case 'arsenal':
            return withTransition(<ArsenalView currentUserId={currentUserId} setups={arsenalData.setups} onAddSetup={(l: string) => handleAddItem('setups', l)} onDeleteSetup={(id: string) => handleDeleteItem('setups', id)} onEditSetup={(id: string, l: string) => handleEditItem('setups', id, l)} onMoveSetup={(id: string, dir: 'up' | 'down') => handleMoveItem('setups', id, dir)} techniques={arsenalData.techniques} onAddTechnique={(l: string) => handleAddItem('techniques', l)} onDeleteTechnique={(id: string) => handleDeleteItem('techniques', id)} onEditTechnique={(id: string, l: string) => handleEditItem('techniques', id, l)} onMoveTechnique={(id: string, dir: 'up' | 'down') => handleMoveItem('techniques', id, dir)} lureTypes={arsenalData.lureTypes} onAddLureType={(l: string) => handleAddItem('ref_lure_types', l)} onDeleteLureType={(id: string) => handleDeleteItem('ref_lure_types', id)} onEditLureType={(id: string, label: string) => handleEditItem('ref_lure_types', id, label)} onMoveLureType={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_lure_types', id, dir)} colors={arsenalData.colors} onAddColor={(l: string) => handleAddItem('ref_colors', l)} onDeleteColor={(id: string) => handleDeleteItem('ref_colors', id)} onEditColor={(id: string, l: string) => handleEditItem('ref_colors', id, l)} onMoveColor={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_colors', id, dir)} sizes={arsenalData.sizes} onAddSize={(l: string) => handleAddItem('ref_sizes', l)} onDeleteSize={(id: string) => handleDeleteItem('ref_sizes', id)} onEditSize={(id: string, l: string) => handleEditItem('ref_sizes', id, l)} onMoveSize={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_sizes', id, dir)} weights={arsenalData.weights} onAddWeight={(l: string) => handleAddItem('ref_weights', l)} onDeleteWeight={(id: string) => handleDeleteItem('ref_weights', id)} onEditWeight={(id: string, l: string) => handleEditItem('ref_weights', id, l)} onMoveWeight={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_weights', id, dir)} onResetTechniques={(defaults) => handleResetCollection('techniques', defaults, arsenalData.techniques)} onResetLureTypes={(defaults) => handleResetCollection('ref_lure_types', defaults, arsenalData.lureTypes)} onResetColors={(defaults) => handleResetCollection('ref_colors', defaults, arsenalData.colors)} onResetSizes={(defaults) => handleResetCollection('ref_sizes', defaults, arsenalData.sizes)} onResetWeights={(defaults) => handleResetCollection('ref_weights', defaults, arsenalData.weights)} onResetSetups={(defaults) => handleResetCollection('setups', defaults, arsenalData.setups)} />);
        
        case 'coach':
            return withTransition(<CoachView sessions={sessions} arsenalData={arsenalData} liveSnapshot={currentLiveSnapshot} currentUserId={currentUserId} userPseudo={userProfile?.pseudo || 'Pêcheur'} isActuallyNight={isActuallyNight} />);
        
        case 'profile':
            return withTransition(<ProfileView userProfile={userProfile} sessions={sessions} arsenalData={arsenalData} onUpdateProfile={setUserProfile} onLogout={handleLogout} themeMode={themeMode} isActuallyNight={isActuallyNight} />);
        
        case 'session':
            return withTransition(<SessionForm onAddSession={handleSaveSession} onUpdateSession={(id, data) => handleSaveSession({ ...data, id } as any)} onCancel={() => setCurrentView('dashboard')} initialData={editingSession} initialDiscovery={magicDraft} zones={arsenalData.spots} setups={arsenalData.setups} techniques={arsenalData.techniques} lures={arsenalData.lures} lureTypes={arsenalData.lureTypes} colors={arsenalData.colors} sizes={arsenalData.sizes} weights={arsenalData.weights} locations={arsenalData.locations} defaultLocationId={activeLocationId} lastCatchDefaults={lastCatchDefaults} currentUserId={currentUserId} isActuallyNight={isActuallyNight} />);
        
        default:
            return null;
    }
};