(function (global) {
  "use strict";

  class ProductController {
    constructor({ service, view, onItemsChanged } = {}) {
      if (!service) throw new Error("ProductController requires ProductService.");
      this.service = service;
      this.view = view || null;
      this.onItemsChanged = onItemsChanged;
      this.pendingUpdate = null;
    }

    replaceItems(items, { render = true } = {}) {
      const next = this.service.setItems(items);
      if (typeof this.onItemsChanged === "function") this.onItemsChanged(next);
      if (render && this.view) this.view.renderAll();
      return next;
    }

    setItemsFromCsv(text) { return this.replaceItems(this.service.csvToItems(text)); }

    async loadInitialData() {
      try {
        const initial = await this.service.loadInitialCatalog();
        this.replaceItems(initial.items);
        this.view?.setSync(`Loaded local catalog (${initial.items.length} items).`);
        this.view?.renderCatalogUpdate({
          status: "checking",
          localVersion: this.service.getLocalVersion(),
          message: "Checking for a newer catalog version..."
        });
      } catch (error) {
        this.replaceItems([]);
        this.view?.setSync("Unable to load catalog data.", "warn");
        this.view?.renderCatalogUpdate({ status: "error", message: error?.message || "Unable to load local catalog." });
        return;
      }
      await this.checkForUpdate();
    }

    async checkForUpdate() {
      try {
        const update = await this.service.checkForUpdate();
        this.pendingUpdate = update?.available ? update : null;
        this.view?.renderCatalogUpdate({
          status: update?.available ? "available" : "current",
          ...update,
          message: update?.available
            ? `Catalog ${update.remoteVersion} is available.`
            : `Your local catalog is up to date (${update.localVersion}).`
        });
        this.view?.setSync(update?.available
          ? `Catalog update ${update.remoteVersion} is available.`
          : `Local catalog is up to date (${this.service.getItems().length} items).`);
        return update;
      } catch (error) {
        console.error("[Catalog version check] Failed:", error);
        this.view?.renderCatalogUpdate({
          status: "error",
          localVersion: this.service.getLocalVersion(),
          message: "Could not check for catalog updates. Your local catalog is still available."
        });
        this.view?.setSync(`Offline/local mode (${this.service.getItems().length} items).`, "warn");
        return null;
      }
    }

    async applyAvailableUpdate() {
      const expectedVersion = this.pendingUpdate?.remoteVersion || "";
      if (!expectedVersion) throw new Error("No catalog update is currently available.");

      this.view?.renderCatalogUpdate({
        status: "downloading",
        localVersion: this.service.getLocalVersion(),
        remoteVersion: expectedVersion,
        message: `Downloading catalog ${expectedVersion}...`
      });
      this.view?.setSync("Downloading approved catalog update...");

      try {
        const result = await this.service.downloadUpdate(expectedVersion);
        this.replaceItems(result.items);
        this.pendingUpdate = null;
        this.view?.renderCatalogUpdate({
          status: "current",
          localVersion: result.version,
          remoteVersion: result.version,
          message: `Catalog ${result.version} installed successfully.`
        });
        this.view?.setSync(`Catalog ${result.version} updated (${result.items.length} items).`);
        return result;
      } catch (error) {
        console.error("[Catalog update] Failed:", error);
        this.view?.renderCatalogUpdate({
          status: "error",
          localVersion: this.service.getLocalVersion(),
          remoteVersion: expectedVersion,
          message: `${error?.message || "Catalog update failed"} Your existing local catalog was kept.`
        });
        this.view?.setSync("Catalog update failed. Existing local data was preserved.", "warn");
        throw error;
      }
    }

    async importCsv(text, options = {}) {
      const imported = await this.service.importCsv(text, options);
      this.replaceItems(imported.items);
      return imported;
    }

    async reset() {
      const items = await this.service.reset();
      this.pendingUpdate = null;
      return this.replaceItems(items);
    }
  }

  global.ProductController = ProductController;
})(window);
