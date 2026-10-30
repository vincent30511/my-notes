// LVI_Note Service Worker (v2.8.7)
// 支援離線快取、PWA 桌面安裝與自動清除舊版快取 (支援 Android / POCO X8 Pro & PC)

const CACHE_NAME = 'lvi-note-cache-v2.8.7';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js?v=20261031_v2.8.7',
  './styles.css?v=20261031_v2.8.7',
  './manifest.json?v=20261031_v2.8.7',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.ico',
  './logo_loading_256.gif'
];

// 1. 安裝事件：立即跳過等待並預快取最新資源
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('⚡ [SW v2.8.7] 預先快取核心應用資源中...');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('⚠️ [SW] 部份靜態資源快取略過:', err);
      });
    })
  );
});

// 2. 啟動事件：強制清除所有舊版快取 (v2.5.0 / v2.5.1 / v2.6.0 / v2.6.1)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🧹 [SW v2.8.7] 強制清理舊版快取:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. 請求代理：對 HTML / JS / CSS 強制使用 cache: 'no-store' 網路直連，徹底根除舊版快取殘留！
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const urlObj = new URL(event.request.url);
  const isCodeOrHtml = (
    event.request.mode === 'navigate' ||
    urlObj.pathname.endsWith('/') ||
    urlObj.pathname.endsWith('.html') ||
    urlObj.pathname.endsWith('.js') ||
    urlObj.pathname.endsWith('.css') ||
    urlObj.pathname.endsWith('.json')
  );

  const fetchOptions = isCodeOrHtml ? { cache: 'no-store' } : {};

  event.respondWith(
    fetch(event.request, fetchOptions)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((exact) => exact || caches.match(event.request, { ignoreSearch: true }));
      })
  );
});

// 4. Background Fetch 事件監聽
self.addEventListener('backgroundfetchsuccess', (event) => {
  console.log('✅ [SW Background Fetch] 背景傳輸完成:', event.registration.id);
});

self.addEventListener('backgroundfetchfail', (event) => {
  console.warn('⚠️ [SW Background Fetch] 背景傳輸失敗:', event.registration.id);
});
