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

    async requestJson(url) {
      const controller = new AbortController();
      const timeoutId = global.setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          method: "GET",
          redirect: "follow",
          cache: "no-store",
          credentials: "omit",
          headers: {
            Accept: "application/json, text/plain, */*"
          },
          signal: controller.signal
        });

        const text = await response.text();
        if (!response.ok) {
          throw new Error(`Google catalog request failed with HTTP ${response.status}.`);
        }

        try {
          return JSON.parse(text);
        } catch (error) {
          const preview = String(text || "").replace(/\s+/g, " ").slice(0, 180);
          throw new Error(`Google catalog returned invalid JSON${preview ? `: ${preview}` : "."}`);
        }
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new Error("Google catalog request timed out.");
        }
        throw error;
      } finally {
        global.clearTimeout(timeoutId);
      }
    }

    normalizeCatalog(data) {
      const source = data && typeof data === "object" ? data : {};
      return {
        products: source.products,
        productCodes: source.productCodes ?? source.product_codes,
        productAliases: source.productAliases ?? source.product_aliases,
        categories: source.categories,
        storeProducts: source.storeProducts ?? source.store_products,
        appSettings: source.appSettings ?? source.app_settings ?? []
      };
    }

    unwrapCatalogPayload(result) {
      if (!result || typeof result !== "object") return null;

      const candidates = [
        result.data,
        result.catalog,
        result.payload,
        result.result?.data,
        result.result?.catalog,
        result.result,
        result
      ];

      return candidates.find(candidate => {
        if (!candidate || typeof candidate !== "object") return false;
        const catalog = this.normalizeCatalog(candidate);
        return Array.isArray(catalog.products) ||
          Array.isArray(catalog.productCodes) ||
          Array.isArray(catalog.productAliases) ||
          Array.isArray(catalog.categories) ||
          Array.isArray(catalog.storeProducts);
      }) || null;
    }

    getResponseVersion(result, catalogPayload) {
      const directVersion = result?.version ?? result?.catalogVersion ??
        result?.data?.version ?? result?.data?.catalogVersion ??
        result?.result?.version ?? result?.result?.catalogVersion;

      if (String(directVersion ?? "").trim()) {
        return String(directVersion).trim();
      }

      const settings = this.normalizeCatalog(catalogPayload).appSettings;
      if (Array.isArray(settings)) {
        const row = settings.find(item => {
          const key = item?.key ?? item?.setting_key ?? item?.setting_name ?? "";
          return String(key).trim().toLowerCase() === "catalog_version";
        });
        const settingVersion = row?.value ?? row?.setting_value ?? "";
        if (String(settingVersion).trim()) return String(settingVersion).trim();
      }

      return "";
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

      const result = await this.requestJson(url.toString());
      const explicitFailure = result?.success === false ||
        result?.success === "false" ||
        result?.ok === false ||
        String(result?.status || "").toLowerCase() === "error";

      if (explicitFailure) {
        throw new Error(result?.message || result?.error || "Google catalog request failed.");
      }

      const catalogPayload = this.unwrapCatalogPayload(result);
      if (!catalogPayload) {
        throw new Error("Google catalog returned JSON, but no recognizable product catalog was found in the response.");
      }

      const catalog = this.normalizeCatalog(catalogPayload);
      const version = this.getResponseVersion(result, catalogPayload);
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
