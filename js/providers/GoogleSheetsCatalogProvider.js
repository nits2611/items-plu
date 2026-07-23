(function (global) {
  "use strict";

  class GoogleSheetsCatalogProvider {
    constructor(options = {}) {
      this.apiUrl = String(options.apiUrl || "").trim();
      this.storageCatalogKey = options.storageCatalogKey || "myProduceAssistant.catalog";
      this.storageVersionKey = options.storageVersionKey || "myProduceAssistant.catalogVersion";
      this.storageUpdatedAtKey = options.storageUpdatedAtKey || "myProduceAssistant.catalogUpdatedAt";
      this.storeId = options.storeId || "";
      this.timeoutMs = Number(options.timeoutMs) || 30000;
    }

    isConfigured() {
      return Boolean(this.apiUrl && /^https:\/\//i.test(this.apiUrl));
    }

    getCachedCatalog() {
      try {
        const raw = localStorage.getItem(this.storageCatalogKey);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.warn("Unable to read catalog cache.", error);
        return null;
      }
    }

    getCachedVersion() {
      return localStorage.getItem(this.storageVersionKey) || "";
    }

    saveCatalog(catalog, version) {
      localStorage.setItem(this.storageCatalogKey, JSON.stringify(catalog));
      localStorage.setItem(this.storageVersionKey, String(version || ""));
      localStorage.setItem(this.storageUpdatedAtKey, new Date().toISOString());
    }

    clearCache() {
      localStorage.removeItem(this.storageCatalogKey);
      localStorage.removeItem(this.storageVersionKey);
      localStorage.removeItem(this.storageUpdatedAtKey);
    }

    requestJsonp(url) {
      return new Promise((resolve, reject) => {
        console.info("[Catalog sync] Starting JSONP request:", url);
        const callbackName = `googleSheetsCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const script = document.createElement("script");
        let settled = false;

        const cleanup = () => {
          global.clearTimeout(timeoutId);
          script.remove();
          try { delete global[callbackName]; } catch (_) { global[callbackName] = undefined; }
        };

        const finish = (handler, value) => {
          if (settled) return;
          settled = true;
          cleanup();
          handler(value);
        };

        const timeoutId = global.setTimeout(() => {
          finish(reject, new Error("Google Sheets request timed out."));
        }, this.timeoutMs);

        global[callbackName] = result => {
          console.info("[Catalog sync] JSONP callback received.", {
            success: result?.success,
            updated: result?.updated,
            catalogVersion: result?.catalogVersion,
            productCount: result?.data?.products?.length
          });
          finish(resolve, result);
        };
        script.onerror = event => {
          console.error("[Catalog sync] JSONP script failed to load.", event);
          finish(reject, new Error("Unable to load Google Sheets data."));
        };

        const requestUrl = new URL(url);
        requestUrl.searchParams.set("callback", callbackName);
        requestUrl.searchParams.set("_", String(Date.now()));
        script.src = requestUrl.toString();
        script.async = true;
        document.head.appendChild(script);
      });
    }

    async sync() {
      if (!this.isConfigured()) {
        throw new Error("Google Apps Script URL is not configured in js/AppConfig.js.");
      }

      const url = new URL(this.apiUrl);
      const version = this.getCachedVersion();
      if (version) url.searchParams.set("version", version);
      if (this.storeId) url.searchParams.set("storeId", this.storeId);

      let result = await this.requestJsonp(url.toString());

      // If a version remains in storage but the catalog payload was removed,
      // the server may correctly answer "updated: false" while the app has
      // nothing usable to display. Retry once without a version in that case.
      if (result?.updated === false && !this.getCachedCatalog()) {
        console.warn("[Catalog sync] Version exists without catalog cache; forcing a full download.");
        const retryUrl = new URL(this.apiUrl);
        if (this.storeId) retryUrl.searchParams.set("storeId", this.storeId);
        retryUrl.searchParams.set("force", "1");
        result = await this.requestJsonp(retryUrl.toString());
      }

      if (!result || result.success !== true) {
        throw new Error(result?.message || "Google catalog returned an invalid response.");
      }

      const catalogVersion = String(result.catalogVersion ?? "");
      if (result.updated === false) {
        return { changed: false, version: catalogVersion, catalog: null };
      }

      if (!result.data || !Array.isArray(result.data.products)) {
        throw new Error("Google catalog response is missing required data.");
      }

      this.saveCatalog(result.data, catalogVersion);
      console.info("[Catalog sync] Catalog cache updated.", {
        catalogVersion,
        products: result.data.products.length,
        productCodes: result.data.productCodes?.length || 0,
        productAliases: result.data.productAliases?.length || 0
      });
      return { changed: true, version: catalogVersion, catalog: result.data };
    }
  }

  global.GoogleSheetsCatalogProvider = GoogleSheetsCatalogProvider;
})(window);
