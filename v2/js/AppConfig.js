(function (global) {
  "use strict";

  // Deprecated compatibility fallback. The canonical configuration is now
  // src/core/config/AppConfig.js and is loaded by index.html in v46.
  if (global.AppConfig) return;

  console.warn("Deprecated js/AppConfig.js loaded; update the page to use src/core/config/AppConfig.js.");
  global.AppConfig = Object.freeze({
    app: Object.freeze({ name: "My Produce Assistant", version: "46" }),
    urls: Object.freeze({
      saveOnSearchBase: "https://www.saveonfoods.com/sm/planning/rsid/1982/results?q=",
      bundledCatalog: "./items.csv",
      versions: "./data/versions.json"
    }),
    api: Object.freeze({
      googleSheets: Object.freeze({
        apiUrl: "https://docs.google.com/spreadsheets/d/1gymt2fofTRKHkr9Xi8eLGG8_Ju2bYXxa6ur2y9vBPMo/edit?usp=sharing"
      })
    }),
    http: Object.freeze({ timeoutMs: 30000 }),
    catalog: Object.freeze({
      storeId: "STR00000001",
      cacheKey: "myProduceAssistant.catalog",
      cacheVersionKey: "myProduceAssistant.catalogVersion",
      cacheUpdatedAtKey: "myProduceAssistant.catalogUpdatedAt",
      legacyCsvKey: "plu_items_csv_current",
      legacyCsvHashKey: "plu_items_csv_hash"
    }),
    storage: Object.freeze({
      storeNamespace: "default-store",
      databaseName: "my-produce-assistant",
      databaseVersion: 1
    })
  });
})(window);
