// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

/**
 * Michael : Configuration miroir de lib/firebase.ts
 * Le Service Worker doit avoir EXACTEMENT les mêmes identifiants, 
 * surtout l'appId pour que le push fonctionne.
 */
firebase.initializeApp({
    apiKey: 'AIzaSyBg7rhZeL217FPxcKRUqgNj_85Ujm11pQI',
    authDomain: "mysupstack.firebaseapp.com",
    projectId: "mysupstack",
    storageBucket: "mysupstack.firebasestorage.app",
    messagingSenderId: "951910603732",
    // AJOUT CRITIQUE : Remplace par ton appId réel (celui que tu as mis dans lib/firebase.ts)
    appId: "1:1072483547940:web:b5bdba593e8b74372e11b1" 
});

const messaging = firebase.messaging();

// Gestion des messages en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Notification reçue en arrière-plan:', payload);

  const notificationTitle = payload.notification?.title || "Alerte Oracle";
  const notificationOptions = {
    body: payload.notification?.body || "Nouvelle activité détectée sur l'eau.",
    icon: '/logo192.png',
    badge: '/logo192.png', 
    data: payload.data 
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});