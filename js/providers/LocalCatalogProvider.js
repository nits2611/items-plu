(function (global) {
  "use strict";

  class LocalCatalogProvider {
    constructor(options = {}) {
      this.csvUrl = options.csvUrl || "./items.csv";
      this.storageCsvKey = options.storageCsvKey || "plu_items_csv_current";
      this.storageHashKey = options.storageHashKey || "plu_items_csv_hash";
      this.bundledItems = options.bundledItems || [];
    }

    getCachedCsv() {
      return localStorage.getItem(this.storageCsvKey);
    }

    getCachedHash() {
      return localStorage.getItem(this.storageHashKey);
    }

    saveCsv(csvText, hash) {
      localStorage.setItem(this.storageCsvKey, csvText);
      if (hash) localStorage.setItem(this.storageHashKey, hash);
    }

    clearCache() {
      localStorage.removeItem(this.storageCsvKey);
      localStorage.removeItem(this.storageHashKey);
    }

    getBundledRows() {
      return Array.isArray(this.bundledItems) ? this.bundledItems : [];
    }

    async fetchRemoteCsv() {
      if (global.HttpClient) {
        return global.HttpClient.get(this.csvUrl, { cache: "no-cache", responseType: "text" });
      }

      // Compatibility fallback for stale pages that have not loaded HttpClient yet.
      const response = await fetch(this.csvUrl, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`Catalog request failed with status ${response.status}`);
      }
      return response.text();
    }
  }

  global.LocalCatalogProvider = LocalCatalogProvider;
})(window);
