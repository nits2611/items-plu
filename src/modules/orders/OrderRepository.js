(function (global) {
  "use strict";

  class OrderRepository {
    constructor(provider) {
      if (!provider) throw new Error("OrderRepository requires a provider");
      this.provider = provider;
    }

    getBusinessDate(date) { return this.provider.getBusinessDate(date); }
    key(name, date) { return this.provider.key(name, date); }
    getStatus(date) { return this.provider.getStatus(date); }
    setStatus(status, date) { return this.provider.setStatus(status, date); }
    getBackStock(date) { return this.provider.getBackStock(date); }
    setBackStock(items, date) { return this.provider.setBackStock(items, date); }
    getFinalOrder(date) { return this.provider.getFinalOrder(date); }
    setFinalOrder(items, date) { return this.provider.setFinalOrder(items, date); }
    getHistory() { return this.provider.getHistory(); }
    setHistory(items) { return this.provider.setHistory(items); }
  }

  global.OrderRepository = OrderRepository;
})(window);
