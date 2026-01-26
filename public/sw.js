// AIFM Service Worker - Offline Support & Caching
const CACHE_NAME = 'aifm-cache-v1';
const OFFLINE_URL = '/offline';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/aifm-logo.svg',
  '/aifm-logo-white.svg',
  '/manifest.json',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Network first, fall back to cache
  networkFirst: ['api/'],
  // Cache first, fall back to network
  cacheFirst: ['_next/static/', 'fonts/', 'images/'],
  // Stale while revalidate
  staleWhileRevalidate: ['_next/data/'],
};

// Install event - precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching assets');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip WebSocket connections
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Determine cache strategy based on URL
  const strategy = getStrategy(url.pathname);

  event.respondWith(handleFetch(request, strategy));
});

function getStrategy(pathname) {
  for (const [strategy, patterns] of Object.entries(CACHE_STRATEGIES)) {
    if (patterns.some((pattern) => pathname.includes(pattern))) {
      return strategy;
    }
  }
  return 'networkFirst'; // Default strategy
}

async function handleFetch(request, strategy) {
  switch (strategy) {
    case 'cacheFirst':
      return cacheFirst(request);
    case 'staleWhileRevalidate':
      return staleWhileRevalidate(request);
    case 'networkFirst':
    default:
      return networkFirst(request);
  }
}

// Network first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match(OFFLINE_URL);
      if (offlineResponse) return offlineResponse;
    }
    
    throw error;
  }
}

// Cache first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return a fallback response if available
    throw error;
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });
  
  return cachedResponse || fetchPromise;
}

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Ny notifikation från AIFM',
      icon: '/aifm-logo.svg',
      badge: '/aifm-badge.svg',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/',
        ...data,
      },
      actions: data.actions || [
        { action: 'open', title: 'Öppna' },
        { action: 'dismiss', title: 'Stäng' },
      ],
      tag: data.tag || 'aifm-notification',
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'AIFM', options)
    );
  } catch (error) {
    console.error('[SW] Push notification error:', error);
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-data') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  // Get pending data from IndexedDB and sync with server
  console.log('[SW] Syncing pending data...');
  // Implementation depends on what data needs to be synced
}

// Message event - communication with main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});



