(function (global) {
  "use strict";

  class LocalStorageClient {
    static get(key, fallback = null) {
      const value = global.localStorage.getItem(key);
      return value === null ? fallback : value;
    }

    static set(key, value) {
      global.localStorage.setItem(key, String(value));
    }

    static remove(key) {
      global.localStorage.removeItem(key);
    }

    static getJson(key, fallback = null) {
      try {
        const value = global.localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch (_) {
        return fallback;
      }
    }

    static setJson(key, value) {
      global.localStorage.setItem(key, JSON.stringify(value));
    }
  }

  global.LocalStorageClient = LocalStorageClient;
})(window);
