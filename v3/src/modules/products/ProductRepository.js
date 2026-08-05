(function (global) {
  "use strict";

  class ProductRepository {
    constructor(provider) {
      if (!provider) throw new Error("ProductRepository requires a product provider.");
      this.provider = provider;
    }

    loadInitialCatalog() { return this.provider.loadInitial(); }
    checkForUpdate() { return this.provider.checkForUpdate(); }
    downloadUpdate(expectedVersion) { return this.provider.downloadUpdate(expectedVersion); }
    importCsv(text, options = {}) { return this.provider.importCsv(text, options); }
    reset() { return this.provider.reset(); }
    csvToItems(text) { return this.provider.csvToItems(text); }
    getLocalVersion() { return this.provider.getLocalVersion?.() || ""; }
  }

  global.ProductRepository = ProductRepository;
})(window);
