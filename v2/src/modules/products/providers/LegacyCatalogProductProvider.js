(function (global) {
  "use strict";

  /**
   * Temporary bridge between the new Product module and the existing
   * CatalogService/provider stack. Keeping this adapter small means v49 can
   * replace the storage implementation without changing ProductController.
   */
  class LegacyCatalogProductProvider {
    constructor(catalogService) {
      if (!catalogService) throw new Error("LegacyCatalogProductProvider requires CatalogService.");
      this.catalogService = catalogService;
    }

    loadInitial() {
      return this.catalogService.loadInitialCatalog();
    }

    checkForUpdate() {
      return this.catalogService.checkForUpdate();
    }

    importCsv(text) {
      return this.catalogService.importCsv(text);
    }

    reset() {
      return this.catalogService.reset();
    }

    csvToItems(text) {
      return this.catalogService.csvToItems(text);
    }
  }

  global.LegacyCatalogProductProvider = LegacyCatalogProductProvider;
})(window);
