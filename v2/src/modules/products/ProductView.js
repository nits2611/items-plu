(function (global) {
  "use strict";

  /**
   * Compatibility view adapter for v48. Existing DOM rendering stays intact;
   * the Product module calls this boundary instead of reaching into UI code.
   */
  class ProductView {
    constructor({ renderAll, setSync } = {}) {
      this.renderAllCallback = renderAll;
      this.setSyncCallback = setSync;
    }

    renderAll() {
      if (typeof this.renderAllCallback === "function") this.renderAllCallback();
    }

    setSync(message, level) {
      if (typeof this.setSyncCallback === "function") this.setSyncCallback(message, level);
    }
  }

  global.ProductView = ProductView;
})(window);
