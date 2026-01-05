// components/DashboardTacticsTab.tsx - Version 10.0.0 (Tactical Prop Routing)
import React from 'react';
import StrategicIntelligence from './StrategicIntelligence';

export const DashboardTacticsTab: React.FC<any> = ({ 
    sessions, 
    currentUserId, 
    arsenalData,
    isActuallyNight // Michael : Récupération du signal de nuit
}) => {
    return (
        <div className="animate-in slide-in-from-right duration-500 mx-2">
            <StrategicIntelligence 
                sessions={sessions} 
                userId={currentUserId} 
                arsenal={arsenalData} 
                hideHeader={false} // Michael : On garde le titre ici car c'est la vue principale
                isActuallyNight={isActuallyNight} // Michael : Raccordement au pilier V8.0
            />
        </div>
    );
};