(function (global) {
  "use strict";

  /** Coordinates ProductService, repository updates, and the current UI. */
  class ProductController {
    constructor({ service, view, onItemsChanged } = {}) {
      if (!service) throw new Error("ProductController requires ProductService.");
      this.service = service;
      this.view = view || null;
      this.onItemsChanged = onItemsChanged;
    }

    replaceItems(items, { render = true } = {}) {
      const next = this.service.setItems(items);
      if (typeof this.onItemsChanged === "function") this.onItemsChanged(next);
      if (render && this.view) this.view.renderAll();
      return next;
    }

    setItemsFromCsv(text) {
      return this.replaceItems(this.service.csvToItems(text));
    }

    async loadInitialData() {
      try {
        const initial = await this.service.loadInitialCatalog();
        this.replaceItems(initial.items);
        const message = initial.source === "cloud-cache"
          ? "Loaded cached cloud catalog. Checking updates..."
          : initial.source === "csv-cache"
            ? "Loaded cached CSV. Checking updates..."
            : "Loaded bundled data. Checking updates...";
        this.view?.setSync(message);
      } catch (error) {
        this.replaceItems([]);
        this.view?.setSync("Unable to load catalog data.", "warn");
      }
      await this.checkForUpdate();
    }

    async checkForUpdate() {
      try {
        const update = await this.service.checkForUpdate();
        if (update.changed) {
          this.replaceItems(update.items);
          this.view?.setSync(`${update.source === "google-sheets" ? "Cloud catalog" : "Data"} updated (${this.service.getItems().length} items).`);
        } else {
          this.view?.setSync(`Data up to date (${this.service.getItems().length} items).`);
        }
        return update;
      } catch (error) {
        console.error("[Catalog sync] Update failed:", error);
        this.view?.setSync(`Offline/cached mode (${this.service.getItems().length} items).`, "warn");
        return null;
      }
    }

    async importCsv(text) {
      const imported = await this.service.importCsv(text);
      this.replaceItems(imported.items);
      return imported;
    }

    reset() {
      return this.replaceItems(this.service.reset());
    }
  }

  global.ProductController = ProductController;
})(window);
