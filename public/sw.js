// 최소 서비스 워커 — PWABuilder의 APK 생성 요건 충족용
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  // 네트워크 우선 (브금/이미지가 외부 URL이라 오프라인 캐싱은 하지 않음)
  e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
});
