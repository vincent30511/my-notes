// LVI_Note Service Worker (v2.5.0)
// 支援離線快取、PWA 桌面安裝與背景排程監聽 (支援 Android / POCO X8 Pro & PC)

const CACHE_NAME = 'lvi-note-cache-v2.5.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js?v=20261012_v2.5.0',
  './styles.css?v=20261012_v2.5.0',
  './manifest.json',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.ico',
  './logo_loading_256.gif'
];

// 1. 安裝事件：預先快取關鍵離線資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('⚡ [SW] 預先快取核心應用資源中...');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('⚠️ [SW] 部份靜態資源快取略過:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. 啟動事件：清除過期快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🧹 [SW] 清理歷史快取:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. 請求代理：網路優先 (Network First, Cache Fallback)，確保永遠取得最新雲端資料
self.addEventListener('fetch', (event) => {
  // 排除 Google API 與外部 CDN 走直接連線
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
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
        // 離線狀態下讀取本地快取
        return caches.match(event.request);
      })
  );
});

// 4. Background Fetch 事件監聽 (Android Chrome 背景傳輸支援)
self.addEventListener('backgroundfetchsuccess', (event) => {
  const bgFetch = event.registration;
  event.waitUntil(
    (async () => {
      console.log('✅ [SW Background Fetch] 背景傳輸圓滿完成:', bgFetch.id);
    })()
  );
});

self.addEventListener('backgroundfetchfail', (event) => {
  console.warn('⚠️ [SW Background Fetch] 背景傳輸失敗:', event.registration.id);
});
