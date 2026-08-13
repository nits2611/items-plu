const APP_VERSION = new URL(self.location.href).searchParams.get("v") || "unversioned";
const CACHE_PREFIX = "my-produce-assistant-v";
const CACHE = `${CACHE_PREFIX}${APP_VERSION}`;

const VERSIONED_ASSETS = [
  "./styles.css",
  "./data.js",
  "./src/core/config/AppConfig.js",
  "./src/core/logging/Logger.js",
  "./src/core/utils/UrlUtils.js",
  "./src/core/http/HttpClient.js",
  "./src/core/storage/LocalStorageClient.js",
  "./src/core/storage/IndexedDbClient.js",
  "./src/core/router/Router.js",
  "./src/core/update/AppUpdateManager.js",
  "./src/app.js",
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
  "./src/modules/orders/providers/LocalOrderProvider.js",
  "./src/modules/orders/OrderRepository.js",
  "./src/modules/orders/OrderService.js",
  "./src/modules/orders/OrderController.js",
  "./src/core/barcode/BarcodeRenderer.js",
  "./src/core/barcode/BarcodeViewer.js",
  "./src/core/media/ImageLibrary.js",
  "./src/core/media/ImageListEditor.js",
  "./src/core/media/ImageGallery.js",
  "./app.js"
];

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./items.csv",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

function versioned(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(APP_VERSION)}`;
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(STATIC_ASSETS);
    await cache.addAll(VERSIONED_ASSETS.map(versioned));
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations always try the network first so index.html cannot remain on an
  // older release while its CSS/JS assets belong to a newer release.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-cache" })
        .then(async response => {
          const cache = await caches.open(CACHE);
          cache.put("./index.html", response.clone());
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // The release manifest must never be satisfied by a stale browser cache.
  if (url.pathname.endsWith("/data/versions.json")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(async response => {
          const cache = await caches.open(CACHE);
          cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Versioned JS/CSS requests are immutable for a release. Cache-first is safe
  // because a new app version produces a different URL (?v=x.y.z).
  if (url.searchParams.has("v") && /\.(?:js|css)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(async response => {
        const cache = await caches.open(CACHE);
        cache.put(event.request, response.clone());
        return response;
      }))
    );
    return;
  }

  // Everything else stays available offline but is refreshed from the network
  // whenever possible.
  event.respondWith(
    fetch(event.request, { cache: "no-cache" })
      .then(async response => {
        const cache = await caches.open(CACHE);
        cache.put(event.request, response.clone());
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
