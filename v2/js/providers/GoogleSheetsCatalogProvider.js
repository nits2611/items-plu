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
      return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?|$)/i.test(this.apiUrl);
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

    getCachedVersion() { return localStorage.getItem(this.storageVersionKey) || ""; }

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
        const timeoutId = global.setTimeout(() => finish(reject, new Error("Google catalog request timed out.")), this.timeoutMs);

        global[callbackName] = result => finish(resolve, result);
        script.onerror = () => finish(reject, new Error("Unable to load the Google catalog endpoint."));

        const requestUrl = new URL(url);
        requestUrl.searchParams.set("callback", callbackName);
        requestUrl.searchParams.set("_", String(Date.now()));
        script.src = requestUrl.toString();
        script.async = true;
        document.head.appendChild(script);
      });
    }

    normalizeCatalog(data) {
      return {
        products: data?.products,
        productCodes: data?.productCodes ?? data?.product_codes,
        productAliases: data?.productAliases ?? data?.product_aliases,
        categories: data?.categories,
        storeProducts: data?.storeProducts ?? data?.store_products,
        appSettings: data?.appSettings ?? data?.app_settings ?? []
      };
    }

    async downloadCatalog({ force = true } = {}) {
      if (!this.isConfigured()) {
        throw new Error("Set the deployed Google Apps Script /exec URL in src/core/config/AppConfig.js.");
      }

      const url = new URL(this.apiUrl);
      url.searchParams.set("action", "products");
      if (this.storeId) {
        url.searchParams.set("store_id", this.storeId);
        url.searchParams.set("storeId", this.storeId);
      }
      if (force) url.searchParams.set("force", "1");

      const result = await this.requestJsonp(url.toString());
      if (!result || result.success !== true) {
        throw new Error(result?.message || "Google catalog returned an invalid response.");
      }

      const catalog = this.normalizeCatalog(result.data);
      const version = String(result.version ?? result.catalogVersion ?? "").trim();
      if (!version) throw new Error("Google catalog response is missing its version.");

      const required = ["products", "productCodes", "productAliases", "categories", "storeProducts"];
      const missing = required.filter(key => !Array.isArray(catalog[key]));
      if (missing.length) throw new Error(`Google catalog response is missing: ${missing.join(", ")}.`);

      return { changed: true, version, catalog };
    }

    // Compatibility alias for older code. v50 uses downloadCatalog only when
    // the user clicks Update Catalog.
    sync() { return this.downloadCatalog({ force: true }); }
  }

  global.GoogleSheetsCatalogProvider = GoogleSheetsCatalogProvider;
})(window);
