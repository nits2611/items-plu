(function (global) {
  "use strict";

  // Deprecated compatibility fallback. The canonical configuration is now
  // src/core/config/AppConfig.js and is loaded by index.html in v46.
  if (global.AppConfig) return;

  console.warn("Deprecated js/AppConfig.js loaded; update the page to use src/core/config/AppConfig.js.");
  global.AppConfig = Object.freeze({
    app: Object.freeze({ name: "My Produce Assistant", version: "50" }),
    urls: Object.freeze({
      saveOnSearchBase: "https://www.saveonfoods.com/sm/planning/rsid/1982/results?q=",
      bundledCatalog: "./items.csv",
      versions: "./data/versions.json"
    }),
    api: Object.freeze({
      googleSheets: Object.freeze({
        apiUrl: "PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE"
      })
    }),
    http: Object.freeze({ timeoutMs: 30000 }),
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
