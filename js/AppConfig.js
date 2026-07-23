(function (global) {
  "use strict";

  global.AppConfig = Object.freeze({
    googleSheets: Object.freeze({
      // Paste the deployed Google Apps Script Web App URL here.
      // Example: https://script.google.com/macros/s/DEPLOYMENT_ID/exec
      apiUrl: ""
    }),

    catalog: Object.freeze({
      storeId: "STR00000001",
      cacheKey: "myProduceAssistant.catalog",
      cacheVersionKey: "myProduceAssistant.catalogVersion",
      cacheUpdatedAtKey: "myProduceAssistant.catalogUpdatedAt"
    })
  });
})(window);
