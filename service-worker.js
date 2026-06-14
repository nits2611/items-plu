const CACHE='plu-lookup-installable-v1';
const A=[
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './manifest.webmanifest',
  './items.csv',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(A)));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  e.respondWith(
    fetch(e.request).then(r=>{
      const copy=r.clone();
      caches.open(CACHE).then(c=>{
        if(e.request.method==='GET' && new URL(e.request.url).origin===location.origin){
          c.put(e.request, copy);
        }
      });
      return r;
    }).catch(()=>caches.match(e.request).then(c=>c||caches.match('./index.html')))
  );
});
