(function (global) {
  "use strict";

  class OrderService {
    constructor(repository) {
      if (!repository) throw new Error("OrderService requires a repository");
      this.repository = repository;
    }

    getBusinessDate(date) { return this.repository.getBusinessDate(date); }
    key(name, date) { return this.repository.key(name, date); }
    getStatus(date) { return this.repository.getStatus(date); }
    setStatus(status, date) { return this.repository.setStatus(status, date); }
    isPlaced(date) { return this.getStatus(date) === "Placed"; }
    getBackStock(date) { return this.repository.getBackStock(date); }
    setBackStock(items, date) { return this.repository.setBackStock(items, date); }
    getFinalOrder(date) { return this.repository.getFinalOrder(date); }
    setFinalOrder(items, date) { return this.repository.setFinalOrder(items, date); }
    getHistory() { return this.repository.getHistory(); }
    setHistory(items) { return this.repository.setHistory(items); }
  }

  global.OrderService = OrderService;
})(window);
