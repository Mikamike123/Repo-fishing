import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Michael : Import du moteur d'enregistrement PWA
import { registerSW } from 'virtual:pwa-register';

// Michael : Enregistrement du Service Worker pour le mode Offline First (V7.4)
const updateSW = registerSW({
  onNeedRefresh() {
    // Petit rappel sardonique pour les mises à jour
    if (confirm('Une mise à jour tactique est disponible. Appliquer maintenant pour rester à la pointe ?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('🚀 OracleFish : Mode Offline First activé. Prêt pour les zones blanches.');
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);