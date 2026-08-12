(function (global) {
  "use strict";

  // v47: single source of truth for application-wide configuration.
  // Keep values here instead of duplicating URLs, cache keys, or timeouts
  // throughout feature code.
  global.AppConfig = Object.freeze({
    app: Object.freeze({
      name: "My Produce Assistant",
      version: "52.2.6"
    }),

    urls: Object.freeze({
      saveOnSearchBase: "https://www.saveonfoods.com/sm/planning/rsid/1982/results?q=",
      bundledCatalog: "./items.csv",
      versions: "./data/versions.json"
    }),

    api: Object.freeze({
      googleSheets: Object.freeze({
        // Paste the deployed Google Apps Script web-app URL ending in /exec.
        // Remote product data is requested only when the user clicks Update Catalog.
        apiUrl: "PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE"
      })
    }),

    http: Object.freeze({
      timeoutMs: 30000
    }),

    catalog: Object.freeze({
      storeId: "STR00000001",
      cacheKey: "myProduceAssistant.catalog",
      cacheVersionKey: "myProduceAssistant.catalogVersion",
      cacheUpdatedAtKey: "myProduceAssistant.catalogUpdatedAt",
      releaseVersionKey: "myProduceAssistant.productCatalogReleaseVersion",
      legacyCsvKey: "plu_items_csv_current",
      legacyCsvHashKey: "plu_items_csv_hash",
      bundledVersion: "1.0.0"
    }),

    storage: Object.freeze({
      storeNamespace: "default-store",
      databaseName: "my-produce-assistant",
      databaseVersion: 1
    })
  });
})(window);
