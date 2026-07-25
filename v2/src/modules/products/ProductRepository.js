(function (global) {
  "use strict";

  /**
   * ProductRepository is the data-access boundary for the Product module.
   * UI/controllers do not need to know whether products currently come from
   * CSV, Google Sheets cache, IndexedDB, or a future API.
   */
  class ProductRepository {
    constructor(provider) {
      if (!provider) throw new Error("ProductRepository requires a product provider.");
      this.provider = provider;
    }

    loadInitialCatalog() {
      return this.provider.loadInitial();
    }

    checkForUpdate() {
      return this.provider.checkForUpdate();
    }

    importCsv(text) {
      return this.provider.importCsv(text);
    }

    reset() {
      return this.provider.reset();
    }

    csvToItems(text) {
      return this.provider.csvToItems(text);
    }
  }

  global.ProductRepository = ProductRepository;
})(window);
