import React from 'react';
import StrategicIntelligence from './StrategicIntelligence';

export const DashboardTacticsTab: React.FC<any> = ({ sessions, currentUserId, arsenalData }) => {
    return (
        <div className="animate-in slide-in-from-right duration-500 mx-2">
            <StrategicIntelligence 
                sessions={sessions} 
                userId={currentUserId} 
                arsenal={arsenalData} 
                hideHeader={false} // Michael : On garde le titre ici car c'est la vue principale
            />
        </div>
    );
};