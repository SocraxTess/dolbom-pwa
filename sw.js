// 오프라인 캐시: 한 번 열면 화면·그림·문장 데이터는 인터넷 없이도 열림.
// (기기 TTS 음성은 기기에 설치된 음성에 따라 오프라인 가능 여부가 다름 — 사전 녹음 파일은 audio/ 에 넣으면 함께 캐시)
const CACHE = 'dolbom-v0.1.3';
const CORE = ['./', 'index.html', 'app.js', 'icons.js', 'data/phrases.json', 'manifest.webmanifest', 'icons/app.svg', 'icons/app-192.png', 'icons/app-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // 음성 파일: 캐시 우선 (크고 잘 안 바뀜)
  if (url.pathname.includes('/audio/')) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
      return r;
    })));
    return;
  }
  // 화면·코드·문장: 네트워크 우선(시험 기간 수정 즉시 반영) → 인터넷 없으면 저장본
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
