const CACHE="my-produce-assistant-v51.2-context-scanner";
const SHELL=[
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data.js",
  "./src/app.js",
  "./src/core/config/AppConfig.js",
  "./src/core/http/HttpClient.js",
  "./src/core/storage/LocalStorageClient.js",
  "./src/core/storage/IndexedDbClient.js",
  "./src/core/router/Router.js",
  "./src/core/utils/UrlUtils.js",
  "./src/core/logging/Logger.js",
  "./src/core/update/AppUpdateManager.js",
  "./data/versions.json",
  "./js/AppConfig.js",
  "./js/providers/LocalCatalogProvider.js",
  "./js/providers/GoogleSheetsCatalogProvider.js",
  "./js/services/CatalogService.js",
  "./src/modules/products/providers/LegacyCatalogProductProvider.js",
  "./src/modules/products/providers/StaticCatalogVersionProvider.js",
  "./src/modules/products/providers/IndexedDbProductProvider.js",
  "./src/modules/products/ProductRepository.js",
  "./src/modules/products/ProductService.js",
  "./src/modules/products/ProductView.js",
  "./src/modules/products/ProductController.js",
  "./src/modules/orders/LocalOrderSessionStore.js",
  "./manifest.webmanifest",
  "./items.csv",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;

  if(url.pathname.endsWith("/items.csv")||url.pathname.endsWith("/data/versions.json")){
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

  // Revalidate application assets so a released app version can be installed
  // without requiring a manual hard refresh.
  if(/\.(?:js|css|html)$/.test(url.pathname)||url.pathname.endsWith("/")){
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
