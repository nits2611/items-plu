(function (global) {
  "use strict";

  global.UrlUtils = Object.freeze({
    appendQuery(baseUrl, params = {}) {
      const url = new URL(baseUrl, global.location.href);
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        url.searchParams.set(key, String(value));
      });
      return url.toString();
    }
  });
})(window);
