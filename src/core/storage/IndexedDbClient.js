(function (global) {
  "use strict";

  /**
   * Small IndexedDB wrapper used by feature repositories.
   * Keeps browser database mechanics out of business/UI modules.
   */
  class IndexedDbClient {
    constructor({ databaseName, databaseVersion = 1, stores = [] } = {}) {
      if (!databaseName) throw new Error("IndexedDbClient requires databaseName.");
      this.databaseName = databaseName;
      this.databaseVersion = Number(databaseVersion) || 1;
      this.stores = Array.isArray(stores) ? stores : [];
      this.dbPromise = null;
    }

    isSupported() {
      return "indexedDB" in global;
    }

    open() {
      if (!this.isSupported()) return Promise.reject(new Error("IndexedDB is not supported in this browser."));
      if (this.dbPromise) return this.dbPromise;

      this.dbPromise = new Promise((resolve, reject) => {
        const request = global.indexedDB.open(this.databaseName, this.databaseVersion);

        request.onupgradeneeded = event => {
          const db = event.target.result;
          this.stores.forEach(store => {
            if (!store?.name || db.objectStoreNames.contains(store.name)) return;
            db.createObjectStore(store.name, store.options || { keyPath: "id" });
          });
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          this.dbPromise = null;
          reject(request.error || new Error("Unable to open IndexedDB."));
        };
        request.onblocked = () => console.warn("IndexedDB upgrade is blocked by another open tab.");
      });

      return this.dbPromise;
    }

    async getAll(storeName) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const request = transaction.objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error(`Unable to read ${storeName}.`));
      });
    }

    async replaceAll(storeName, records) {
      const db = await this.open();
      const rows = Array.isArray(records) ? records : [];
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        store.clear();
        rows.forEach(record => store.put(record));
        transaction.oncomplete = () => resolve(rows.length);
        transaction.onerror = () => reject(transaction.error || new Error(`Unable to write ${storeName}.`));
        transaction.onabort = () => reject(transaction.error || new Error(`Writing ${storeName} was aborted.`));
      });
    }

    async clear(storeName) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error(`Unable to clear ${storeName}.`));
      });
    }
  }

  global.IndexedDbClient = IndexedDbClient;
})(window);
