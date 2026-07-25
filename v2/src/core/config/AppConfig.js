(function (global) {
  "use strict";

  // v46: single source of truth for application-wide configuration.
  // Keep values here instead of duplicating URLs, cache keys, or timeouts
  // throughout feature code.
  global.AppConfig = Object.freeze({
    app: Object.freeze({
      name: "My Produce Assistant",
      version: "46"
    }),

    urls: Object.freeze({
      saveOnSearchBase: "https://www.saveonfoods.com/sm/planning/rsid/1982/results?q=",
      bundledCatalog: "./items.csv",
      versions: "./data/versions.json"
    }),

    api: Object.freeze({
      googleSheets: Object.freeze({
        // Preserved from the stable baseline. Replace this value only when
        // the deployed catalog endpoint changes.
        apiUrl: "https://docs.google.com/spreadsheets/d/1gymt2fofTRKHkr9Xi8eLGG8_Ju2bYXxa6ur2y9vBPMo/edit?usp=sharing"
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
