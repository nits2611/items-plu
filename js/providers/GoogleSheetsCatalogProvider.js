(function (global) {
  "use strict";

  class GoogleSheetsCatalogProvider {
    constructor(options = {}) {
      this.apiUrl = String(options.apiUrl || "").trim();
      this.storageCatalogKey = options.storageCatalogKey || "myProduceAssistant.catalog";
      this.storageVersionKey = options.storageVersionKey || "myProduceAssistant.catalogVersion";
      this.storageUpdatedAtKey = options.storageUpdatedAtKey || "myProduceAssistant.catalogUpdatedAt";
      this.storeId = options.storeId || "";
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

    async sync() {
      if (!this.isConfigured()) {
        throw new Error("Google Apps Script URL is not configured in js/AppConfig.js.");
      }

      const url = new URL(this.apiUrl);
      const version = this.getCachedVersion();
      if (version) url.searchParams.set("version", version);
      if (this.storeId) url.searchParams.set("storeId", this.storeId);

      const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        redirect: "follow"
      });

      if (!response.ok) {
        throw new Error(`Google catalog request failed with status ${response.status}.`);
      }

      const result = await response.json();
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
      return { changed: true, version: catalogVersion, catalog: result.data };
    }
  }

  global.GoogleSheetsCatalogProvider = GoogleSheetsCatalogProvider;
})(window);
