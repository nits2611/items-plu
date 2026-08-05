(function (global) {
  "use strict";

  class LocalOrderSessionStore {
    constructor({ namespace = "plu_default-store", storeId = "STR00000001" } = {}) {
      this.namespace = namespace;
      this.storeId = storeId;
      this.schemaVersion = 1;
      this.sessionFields = new Set(["order", "front_stock", "order_status"]);
      this.sessionsKey = `${namespace}_order_sessions`;
      this.migrationKey = `${namespace}_order_sessions_migrated_v1`;
    }

    getBusinessDate(date = new Date()) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    getYesterdayDate() {
      const date = new Date();
      date.setDate(date.getDate() - 1);
      return this.getBusinessDate(date);
    }

    key(name, date = this.getBusinessDate()) {
      if (!this.sessionFields.has(name)) return `${this.namespace}_${name}`;
      this.ensureSession(date);
      return `${this.namespace}_${name}_${date}`;
    }

    readJson(storageKey, fallback) {
      try {
        const value = JSON.parse(localStorage.getItem(storageKey));
        return value ?? fallback;
      } catch {
        return fallback;
      }
    }

    writeJson(storageKey, value) {
      localStorage.setItem(storageKey, JSON.stringify(value));
    }

    getSessions() {
      return this.readJson(this.sessionsKey, []);
    }

    saveSessions(sessions) {
      this.writeJson(this.sessionsKey, sessions);
    }

    ensureSession(date = this.getBusinessDate(), status = null) {
      const sessions = this.getSessions();
      const found = sessions.find(session => session.businessDate === date && session.storeId === this.storeId);
      if (found) {
        if (status && found.status !== status) {
          found.status = status;
          found.updatedAt = new Date().toISOString();
          if (status === "Placed" && !found.placedAt) found.placedAt = new Date().toISOString();
          if (status !== "Placed") found.placedAt = null;
          this.saveSessions(sessions);
        }
        return found;
      }

      const session = {
        sessionId: `ORDSES_${date.replaceAll("-", "")}_${Date.now()}`,
        storeId: this.storeId,
        businessDate: date,
        status: status || "Draft",
        placedAt: status === "Placed" ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: this.schemaVersion
      };
      sessions.unshift(session);
      this.saveSessions(sessions.slice(0, 365));
      return session;
    }

    getStatus(date = this.getBusinessDate()) {
      const storageValue = localStorage.getItem(this.key("order_status", date));
      const status = storageValue || this.ensureSession(date).status || "Draft";
      return status === "Placed" ? "Placed" : "Draft";
    }

    setStatus(status, date = this.getBusinessDate()) {
      const normalized = status === "Placed" ? "Placed" : "Draft";
      localStorage.setItem(this.key("order_status", date), normalized);
      this.ensureSession(date, normalized);
      return normalized;
    }

    migrateLegacy() {
      if (localStorage.getItem(this.migrationKey) === "1") {
        this.ensureSession(this.getBusinessDate());
        return;
      }

      const legacyOrderKey = `${this.namespace}_order`;
      const legacyFinalKey = `${this.namespace}_front_stock`;
      const legacyStatusKey = `${this.namespace}_order_status`;
      const historyKey = `${this.namespace}_order_history`;

      const backStock = this.readJson(legacyOrderKey, []);
      const finalOrder = this.readJson(legacyFinalKey, []);
      const legacyStatus = localStorage.getItem(legacyStatusKey) || "Draft";
      const history = this.readJson(historyKey, []);
      const latestHistory = history[0] || null;

      let migrationDate = this.getBusinessDate();
      if (legacyStatus === "Placed") {
        migrationDate = latestHistory?.date || this.getYesterdayDate();
      }

      if (backStock.length || finalOrder.length || localStorage.getItem(legacyStatusKey)) {
        const scopedBackKey = `${this.namespace}_order_${migrationDate}`;
        const scopedFinalKey = `${this.namespace}_front_stock_${migrationDate}`;
        const scopedStatusKey = `${this.namespace}_order_status_${migrationDate}`;

        if (!localStorage.getItem(scopedBackKey)) this.writeJson(scopedBackKey, backStock);
        if (!localStorage.getItem(scopedFinalKey)) this.writeJson(scopedFinalKey, finalOrder);
        if (!localStorage.getItem(scopedStatusKey)) localStorage.setItem(scopedStatusKey, legacyStatus === "Placed" ? "Placed" : "Draft");
        this.ensureSession(migrationDate, legacyStatus);

        if (legacyStatus === "Placed" && (backStock.length || finalOrder.length)) {
          const alreadySaved = history.some(row => row.date === migrationDate);
          if (!alreadySaved) {
            history.unshift({
              id: `${migrationDate}-migrated-${Date.now()}`,
              date: migrationDate,
              placedAt: new Date().toISOString(),
              status: "Placed",
              backStock,
              finalOrder,
              migrated: true
            });
            this.writeJson(historyKey, history.slice(0, 100));
          }
        }
      }

      localStorage.removeItem(legacyOrderKey);
      localStorage.removeItem(legacyFinalKey);
      localStorage.removeItem(legacyStatusKey);
      localStorage.setItem(this.migrationKey, "1");

      // A placed historical session must never lock a different business date.
      const today = this.getBusinessDate();
      const todayStatusKey = `${this.namespace}_order_status_${today}`;
      if (!localStorage.getItem(todayStatusKey)) localStorage.setItem(todayStatusKey, "Draft");
      this.ensureSession(today, localStorage.getItem(todayStatusKey) || "Draft");
    }
  }

  global.LocalOrderSessionStore = LocalOrderSessionStore;
})(window);
