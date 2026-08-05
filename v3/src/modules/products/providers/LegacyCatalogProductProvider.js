(function (global) {
  "use strict";

  /** Temporary bridge from the Product repository to the proven CatalogService. */
  class LegacyCatalogProductProvider {
    constructor(catalogService) {
      if (!catalogService) throw new Error("LegacyCatalogProductProvider requires CatalogService.");
      this.catalogService = catalogService;
    }

    loadInitial() { return this.catalogService.loadInitialCatalog(); }
    checkForUpdate() { return this.catalogService.checkForUpdate(); }
    downloadRemoteCatalog(options = {}) { return this.catalogService.downloadRemoteCatalog(options); }
    importCsv(text, options = {}) { return this.catalogService.importCsv(text, options); }
    reset() { return this.catalogService.reset(); }
    csvToItems(text) { return this.catalogService.csvToItems(text); }
  }

  global.LegacyCatalogProductProvider = LegacyCatalogProductProvider;
})(window);
