(function (global) {
  "use strict";

  class OrderController {
    constructor(service) {
      if (!service) throw new Error("OrderController requires a service");
      this.service = service;
    }

    getBusinessDate(date) { return this.service.getBusinessDate(date); }
    key(name, date) { return this.service.key(name, date); }
    getStatus(date) { return this.service.getStatus(date); }
    setStatus(status, date) { return this.service.setStatus(status, date); }
    isPlaced(date) { return this.service.isPlaced(date); }
    getBackStock(date) { return this.service.getBackStock(date); }
    setBackStock(items, date) { return this.service.setBackStock(items, date); }
    getFinalOrder(date) { return this.service.getFinalOrder(date); }
    setFinalOrder(items, date) { return this.service.setFinalOrder(items, date); }
    getHistory() { return this.service.getHistory(); }
    setHistory(items) { return this.service.setHistory(items); }
  }

  global.OrderController = OrderController;
})(window);
