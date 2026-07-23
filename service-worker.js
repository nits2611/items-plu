const CACHE="my-produce-assistant-v45-jsonp-diagnostic";
const SHELL=["./","./index.html","./styles.css","./app.js","./data.js","./js/AppConfig.js","./js/providers/LocalCatalogProvider.js","./js/providers/GoogleSheetsCatalogProvider.js","./js/services/CatalogService.js","./manifest.webmanifest","./items.csv","./icons/icon-192.png","./icons/icon-512.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);

  // Do not intercept Google Apps Script / JSONP or any other cross-origin
  // request. Let the browser handle redirects and script execution directly.
  if(url.origin!==self.location.origin) return;

  if(url.pathname.endsWith("/items.csv")){
    event.respondWith(
      fetch(event.request,{cache:"no-cache"})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          return response;
        })
        .catch(()=>caches.match(event.request))
    );
    return;
  }

  // Always revalidate code/config files so GitHub Pages does not keep an old
  // provider or endpoint configuration after deployment.
  if(/\.(?:js|html)$/.test(url.pathname)||url.pathname.endsWith("/")){
    event.respondWith(
      fetch(event.request,{cache:"no-cache"})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          return response;
        })
        .catch(()=>caches.match(event.request).then(hit=>hit||caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return response;
    }))
  );
});
