// ChatCity Service Worker — Firebase Messaging
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyAVKGyPWWQzEWfwkOwhwXabD3HbuLQz-qA",
  authDomain:        "chatcity-63c68.firebaseapp.com",
  databaseURL:       "https://chatcity-63c68-default-rtdb.firebaseio.com",
  projectId:         "chatcity-63c68",
  storageBucket:     "chatcity-63c68.firebasestorage.app",
  messagingSenderId: "1015529457316",
  appId:             "1:1015529457316:web:638f1d8e25539177844831"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'ChatCity 💬', {
    body:    body || 'New message',
    icon:    icon || 'https://cdn-icons-png.flaticon.com/512/3048/3048122.png',
    badge:   'https://cdn-icons-png.flaticon.com/512/3048/3048122.png',
    tag:     'chatcity-msg',
    data:    { url: payload.data?.url || '/ChatCity/home.html' },
    vibrate: [200, 100, 200]
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/ChatCity/home.html';
  event.waitUntil(clients.matchAll({type:'window'}).then(cs => {
    for(const c of cs) if(c.url.includes('ChatCity')) { c.focus(); return; }
    clients.openWindow(url);
  }));
});
