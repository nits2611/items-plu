(function (global) {
  "use strict";

  /** Product-domain state and search/filter rules. */
  class ProductService {
    constructor(repository) {
      if (!repository) throw new Error("ProductService requires ProductRepository.");
      this.repository = repository;
      this.items = [];
    }

    setItems(items) {
      this.items = Array.isArray(items) ? items : [];
      return this.items;
    }

    getItems() {
      return this.items;
    }

    isOrganic(item) {
      return /(^ORG\b|ORGANIC)/i.test(String(item?.item_name || ""));
    }

    isPackaged(item) {
      return String(item?.code || "").length > 6 || /packaged|upc/i.test(String(item?.type || ""));
    }

    byCodes(codes) {
      const wanted = Array.isArray(codes) ? codes : [];
      return wanted.map(code => this.items.find(item => item.code === code)).filter(Boolean);
    }

    search({
      query = "",
      filter = "all",
      limit = 100,
      isArchived = null,
      isSeasonal = null,
      includeArchived = true
    } = {}) {
      let found = this.items;

      if (!includeArchived && typeof isArchived === "function") {
        found = found.filter(item => !isArchived(item));
      }

      if (filter === "produce") found = found.filter(item => !this.isPackaged(item));
      if (filter === "packaged") found = found.filter(item => this.isPackaged(item));
      if (filter === "organic") found = found.filter(item => this.isOrganic(item));
      if (filter === "seasonal" && typeof isSeasonal === "function") found = found.filter(isSeasonal);

      const terms = String(query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (terms.length) {
        found = found.filter(item => terms.every(term => {
          const hay = String(item?.hay || "").toLowerCase();
          const name = String(item?.item_name || "").toLowerCase();
          const code = String(item?.code || "").toLowerCase();
          const season = String(item?.season || "").toLowerCase();
          const festival = String(item?.festival || "").toLowerCase();
          return hay.includes(term) || name.includes(term) || code.includes(term) || season.includes(term) || festival.includes(term);
        }));
      }

      return found.slice(0, limit);
    }

    loadInitialCatalog() {
      return this.repository.loadInitialCatalog();
    }

    checkForUpdate() {
      return this.repository.checkForUpdate();
    }

    importCsv(text) {
      return this.repository.importCsv(text);
    }

    reset() {
      return this.repository.reset();
    }

    csvToItems(text) {
      return this.repository.csvToItems(text);
    }
  }

  global.ProductService = ProductService;
})(window);
