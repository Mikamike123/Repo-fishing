// components/layout/ViewRouter.tsx - Version 10.7.5 (Turbo Motion Injector)
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

// Michael : Composant Splash Screen pour un démarrage sexy et sans flash
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

// Michael : Injection du CSS d'animation "Oracle Motion" directement dans le head
const injectOracleStyles = () => {
    if (typeof document === 'undefined' || document.getElementById('oracle-motion-styles')) return;
    const style = document.createElement('style');
    style.id = 'oracle-motion-styles';
    style.textContent = `
        @keyframes oracleViewEnter {
            from { 
                opacity: 0; 
                transform: translateY(20px) scale(0.98); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0) scale(1); 
            }
        }
        .animate-oracle-view {
            animation: oracleViewEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
    `;
    document.head.appendChild(style);
};

export const ViewRouter = ({ engine }: { engine: any }) => {
    // Michael : Activation des styles au montage du routeur
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

    // Michael : Si l'auth charge ou si on attend le profil, on montre le Splash Screen
    if (authLoading || (!userProfile && currentUserId !== "guest" && firestoreError !== "DOC_NOT_FOUND")) {
        return <OracleSplash />;
    }

    // Michael : Onboarding forcé si l'utilisateur n'a pas de profil
    if (firestoreError === "DOC_NOT_FOUND") {
        return <ProfileView 
            userProfile={null} sessions={[]} arsenalData={arsenalData} onUpdateProfile={setUserProfile} 
            onLogout={handleLogout} themeMode={themeMode} isActuallyNight={isActuallyNight} 
            isNewUser={true} onCreateProfile={handleCreateProfile}
        />;
    }

    // Michael : Helper pour injecter l'animation de transition sans sabrer le switch
    // On utilise la nouvelle classe personnalisée injectée dynamiquement
    const withTransition = (component: React.ReactNode) => (
        <div key={currentView} className="animate-oracle-view">
            {component}
        </div>
    );

    switch (currentView) {
        case 'locations':
            return withTransition(<LocationsManager userId={currentUserId} initialOpenLocationId={targetLocationId} locations={arsenalData.locations} spots={arsenalData.spots} isActuallyNight={isActuallyNight} onAddLocation={(label: string, coords: any) => handleAddItem('locations', label, coords ? { coordinates: coords } : undefined)} onEditLocation={(id: string, label: string, extra?: any) => handleEditItem('locations', id, label, extra)} onDeleteLocation={(id: string) => handleDeleteItem('locations', id)} onToggleFavorite={handleToggleLocationFavorite} onMoveLocation={(id: string, dir: 'up' | 'down') => handleMoveItem('locations', id, dir)} onAddSpot={(label: string, locId: string) => handleAddItem('zones', label, { locationId: locId })} onDeleteSpot={(id: string) => handleDeleteItem('zones', id)} onEditSpot={(id: string, label: string) => handleEditItem('zones', id, label)} onBack={() => { setTargetLocationId(null); setCurrentView('dashboard'); }} />);
        
        case 'dashboard':
            return withTransition(<Dashboard 
                userProfile={userProfile} 
                usersRegistry={usersRegistry} 
                activeTab={activeDashboardTab} 
                onTabChange={setActiveDashboardTab} 
                userName={userProfile?.pseudo || 'Pêcheur'} 
                currentUserId={currentUserId} 
                sessions={sessions} 
                oracleData={oraclePoints} 
                isOracleLoading={isOracleLoading} 
                activeLocationLabel={activeLocation?.label || "Sélectionner"} 
                activeLocationId={activeLocationId} 
                availableLocations={arsenalData.locations.filter((l: any) => l.active && l.isFavorite)} 
                onLocationClick={() => { if (activeLocationId) setTargetLocationId(activeLocationId); setCurrentView('locations'); }} 
                onLocationSelect={setActiveLocationId} 
                setActiveLocationId={setActiveLocationId} 
                onEditSession={handleEditRequest} 
                onDeleteSession={handleDeleteSession} 
                onMagicDiscovery={handleMagicDiscovery} 
                lureTypes={arsenalData.lureTypes} 
                colors={arsenalData.colors} 
                locations={arsenalData.locations} 
                arsenalData={arsenalData} 
                displayedWeather={displayedWeather} 
                lastSyncTimestamp={lastSyncTimestamp} 
                isActuallyNight={isActuallyNight} 
            />);

        case 'history':
            return withTransition(<HistoryView 
                sessions={sessions} 
                onDeleteSession={handleDeleteSession} 
                onEditSession={handleEditRequest} 
                currentUserId={currentUserId} 
                userProfile={userProfile} 
                usersRegistry={usersRegistry}
                isActuallyNight={isActuallyNight}
                highlightSessionId={lastSavedSessionId} 
                onClearHighlight={() => setLastSavedSessionId(null)} 
            />);

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