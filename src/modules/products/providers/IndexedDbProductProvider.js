(function (global) {
  "use strict";

  /**
   * IndexedDB is the Product module's primary local cache.
   * v50 checks a tiny static version file and downloads the remote catalog
   * only after the user explicitly requests the update.
   */
  class IndexedDbProductProvider {
    constructor({
      primaryProvider,
      dbClient,
      versionProvider = null,
      storeName = "products",
      versionStorageKey = "myProduceAssistant.catalogVersion",
      bundledVersion = "1.0.0"
    } = {}) {
      if (!primaryProvider) throw new Error("IndexedDbProductProvider requires primaryProvider.");
      if (!dbClient) throw new Error("IndexedDbProductProvider requires dbClient.");
      this.primaryProvider = primaryProvider;
      this.dbClient = dbClient;
      this.versionProvider = versionProvider;
      this.storeName = storeName;
      this.versionStorageKey = versionStorageKey;
      this.bundledVersion = String(bundledVersion || "1.0.0");
    }

    getLocalVersion() {
      return global.localStorage.getItem(this.versionStorageKey) || this.bundledVersion;
    }

    setLocalVersion(version) {
      const value = String(version || "").trim();
      if (value) global.localStorage.setItem(this.versionStorageKey, value);
    }

    async readItems() {
      try {
        const rows = await this.dbClient.getAll(this.storeName);
        return rows
          .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
          .map(row => row.item)
          .filter(Boolean);
      } catch (error) {
        console.warn("[Product storage] IndexedDB read failed; using legacy fallback.", error);
        return [];
      }
    }

    async saveItems(items) {
      if (!Array.isArray(items)) throw new Error("Product catalog must be an array.");
      const records = items.map((item, index) => ({
        id: `${String(item?.code || "item")}::${index}`,
        position: index,
        item
      }));
      await this.dbClient.replaceAll(this.storeName, records);
    }

    async loadInitial() {
      const cachedItems = await this.readItems();
      if (cachedItems.length) {
        return { items: cachedItems, source: "indexeddb", csvText: "", version: this.getLocalVersion() };
      }

      const initial = await this.primaryProvider.loadInitial();
      const items = initial?.items || [];

      // The catalog must remain usable even if IndexedDB cannot be written.
      // This is especially important after a browser has already opened a newer
      // database version: IndexedDB does not support opening that database with
      // an older version number (VersionError). In that situation we render the
      // bundled/local catalog and treat IndexedDB as a cache, not a startup dependency.
      try {
        await this.saveItems(items);
      } catch (error) {
        console.warn("[Product storage] IndexedDB cache write failed; continuing with local catalog.", error);
      }

      if (!global.localStorage.getItem(this.versionStorageKey)) this.setLocalVersion(this.bundledVersion);
      return { ...initial, version: this.getLocalVersion() };
    }

    async checkForUpdate() {
      if (!this.versionProvider) {
        return {
          changed: false,
          available: false,
          localVersion: this.getLocalVersion(),
          remoteVersion: "",
          reason: "version-provider-not-configured"
        };
      }

      const remote = await this.versionProvider.getProductVersion();
      const localVersion = this.getLocalVersion();
      return {
        changed: remote.version !== localVersion,
        available: remote.version !== localVersion,
        localVersion,
        remoteVersion: remote.version,
        remoteUpdatedAt: remote.updatedAt,
        source: "versions-file"
      };
    }

    async downloadUpdate(expectedVersion = "") {
      const result = await this.primaryProvider.downloadRemoteCatalog({ force: true });
      const items = result?.items;
      const version = String(result?.version || expectedVersion || "").trim();

      if (!Array.isArray(items) || !items.length) {
        throw new Error("The remote catalog did not contain any usable products. Your local catalog was not changed.");
      }
      if (!version) throw new Error("The remote catalog did not include a version.");
      if (expectedVersion && version !== String(expectedVersion)) {
        throw new Error(`Catalog version mismatch. Expected ${expectedVersion}, but the server returned ${version}.`);
      }

      // replaceAll is a single IndexedDB transaction. The existing local
      // catalog remains intact if validation or the remote request fails.
      await this.saveItems(items);
      this.setLocalVersion(version);
      return { ...result, items, version };
    }

    async importCsv(text, options = {}) {
      const existingItems = options.mode === "merge" ? await this.readItems() : [];
      const result = await this.primaryProvider.importCsv(text, { ...options, existingItems });
      await this.saveItems(result?.items || []);
      return result;
    }

    async reset() {
      await this.dbClient.clear(this.storeName);
      const items = await Promise.resolve(this.primaryProvider.reset());
      await this.saveItems(items || []);
      this.setLocalVersion(this.bundledVersion);
      return items;
    }

    csvToItems(text) {
      return this.primaryProvider.csvToItems(text);
    }
  }

  global.IndexedDbProductProvider = IndexedDbProductProvider;
})(window);
