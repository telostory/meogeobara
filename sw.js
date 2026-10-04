// 오프라인에서도 앱이 열리도록 파일을 저장해 두는 서비스 워커.
// 인터넷이 되면 언제나 서버의 새 파일을 먼저 받고(네트워크 우선), 안 될 때만 저장해 둔 파일을 쓴다.
// Claude 호출처럼 다른 주소로 가는 요청은 건드리지 않는다.

const CACHE = 'meogeobara-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return (await caches.match('./')) || (await caches.match('index.html'));
      throw err;
    }
  })());
});
