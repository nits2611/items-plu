(function (global) {
  "use strict";

  /** Reads the tiny same-origin versions.json file without touching Apps Script. */
  class StaticCatalogVersionProvider {
    constructor({ url, httpClient, timeoutMs = 10000 } = {}) {
      if (!url) throw new Error("StaticCatalogVersionProvider requires a URL.");
      if (!httpClient) throw new Error("StaticCatalogVersionProvider requires HttpClient.");
      this.url = url;
      this.httpClient = httpClient;
      this.timeoutMs = Number(timeoutMs) || 10000;
    }

    async getProductVersion() {
      const payload = await this.httpClient.get(this.url, {
        params: { _: Date.now() },
        cache: "no-store",
        timeoutMs: this.timeoutMs
      });

      const products = payload?.products;
      const version = String(products?.version || "").trim();
      if (!version) throw new Error("versions.json is missing products.version.");

      return {
        version,
        updatedAt: String(products?.updated_at || "").trim()
      };
    }
  }

  global.StaticCatalogVersionProvider = StaticCatalogVersionProvider;
})(window);
