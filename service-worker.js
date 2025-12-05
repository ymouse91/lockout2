const CACHE = 'lockout2-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (e)=>{
  const req = e.request;
  e.respondWith(
    caches.match(req).then(res => res || fetch(req).then(r=>{
      // dynaaminen cache vain GET:lle
      if(req.method==='GET'){
        const copy = r.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
      }
      return r;
    }).catch(()=>caches.match('./index.html')))
  );
});
