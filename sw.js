// OneSignal Web Push SDK Worker Integration
let oneSignalLoaded = false;
try {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
  oneSignalLoaded = true;
} catch (e) {
  // Offline or local environment fallback
}

const CACHE_NAME = 'classradar-v16-notif-engine-fixed';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './OneSignalSDKWorker.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Only cache same-origin GET requests; never intercept OneSignal POST or Google Sheets API calls
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).catch(() => caches.match('./index.html'));
    })
  );
});

// Only attach fallback push/click handlers if OneSignal SDK worker did not load
if (!oneSignalLoaded) {
  self.addEventListener('push', (e) => {
    let data = { title: 'ClassRadar Alert', body: 'Campus update received.', url: './' };
    if (e.data) {
      try {
        data = e.data.json();
      } catch (err) {
        data.body = e.data.text();
      }
    }
    const options = {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || './' }
    };
    e.waitUntil(self.registration.showNotification(data.title, options));
  });
}

// Ensure clicking local ServiceWorker notifications focuses or opens the app
self.addEventListener('notificationclick', (e) => {
  // If this is a OneSignal notification with its own custom data handler, let OneSignal handle it
  if (e.notification && e.notification.data && e.notification.data.custom) return;

  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
