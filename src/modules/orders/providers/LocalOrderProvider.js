(function (global) {
  "use strict";

  class LocalOrderProvider {
    constructor({ sessionStore } = {}) {
      if (!sessionStore) throw new Error("LocalOrderProvider requires a sessionStore");
      this.sessionStore = sessionStore;
    }

    key(name, date) { return this.sessionStore.key(name, date); }
    getBusinessDate(date) { return this.sessionStore.getBusinessDate(date); }
    getStatus(date) { return this.sessionStore.getStatus(date); }
    setStatus(status, date) { return this.sessionStore.setStatus(status, date); }

    readJson(storageKey, fallback = []) {
      try {
        const value = JSON.parse(localStorage.getItem(storageKey));
        return value ?? fallback;
      } catch {
        return fallback;
      }
    }

    writeJson(storageKey, value) {
      localStorage.setItem(storageKey, JSON.stringify(value));
      return value;
    }

    getBackStock(date) { return this.readJson(this.key("order", date), []); }
    setBackStock(items, date) { return this.writeJson(this.key("order", date), Array.isArray(items) ? items : []); }
    getFinalOrder(date) { return this.readJson(this.key("front_stock", date), []); }
    setFinalOrder(items, date) { return this.writeJson(this.key("front_stock", date), Array.isArray(items) ? items : []); }
    getHistory() { return this.readJson(this.key("order_history"), []); }
    setHistory(items) { return this.writeJson(this.key("order_history"), Array.isArray(items) ? items : []); }
  }

  global.LocalOrderProvider = LocalOrderProvider;
})(window);
