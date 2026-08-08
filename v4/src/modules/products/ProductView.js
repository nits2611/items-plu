(function (global) {
  "use strict";

  class ProductView {
    constructor({ renderAll, setSync, renderCatalogUpdate } = {}) {
      this.renderAllCallback = renderAll;
      this.setSyncCallback = setSync;
      this.renderCatalogUpdateCallback = renderCatalogUpdate;
    }

    renderAll() { if (typeof this.renderAllCallback === "function") this.renderAllCallback(); }
    setSync(message, level) { if (typeof this.setSyncCallback === "function") this.setSyncCallback(message, level); }
    renderCatalogUpdate(state) {
      if (typeof this.renderCatalogUpdateCallback === "function") this.renderCatalogUpdateCallback(state);
    }
  }

  global.ProductView = ProductView;
})(window);
