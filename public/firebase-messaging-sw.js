// public/firebase-messaging-sw.js - Version 12.4.0 (Deep Link Enabled)
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyBg7rhZeL217FPxcKRUqgNj_85Ujm11pQI',
    authDomain: "mysupstack.firebaseapp.com",
    projectId: "mysupstack",
    storageBucket: "mysupstack.firebasestorage.app",
    messagingSenderId: "951910603732",
    appId: "1:1072483547940:web:b5bdba593e8b74372e11b1" 
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[Oracle SW] Colis reçu en background:', payload);

  const title = payload.notification?.title || payload.data?.notification_title || payload.data?.title || "🚨 ÉVÉNEMENT ORACLE";
  const body = payload.notification?.body || payload.data?.notification_body || payload.data?.body || "Activité détectée sur l'eau !";
  const image = payload.notification?.image || payload.data?.notification_image || payload.data?.imageUrl;

  const notificationOptions = {
    body: body,
    icon: '/logo192.png',
    badge: '/logo192.png',
    image: image || undefined,
    tag: 'oracle-event',
    vibrate: [300, 100, 300],
    data: payload.data, // Michael : Contient sessionId et type
    actions: [
        { action: 'open', title: 'VOIR LA SESSION' }
    ]
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Michael : Logique de redirection intelligente vers HistoryView
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const sessionId = event.notification.data?.sessionId;
  // Michael : On construit l'URL de destination pour HistoryView
  const targetPath = sessionId ? `/?view=history&sessionId=${sessionId}` : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si l'app est déjà ouverte, on essaie de naviguer ou de focus
      for (const client of clientList) {
        if ('focus' in client) {
            client.navigate(targetPath);
            return client.focus();
        }
      }
      // Sinon on ouvre une nouvelle fenêtre
      if (clients.openWindow) return clients.openWindow(targetPath);
    })
  );
});