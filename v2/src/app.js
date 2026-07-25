(function (global) {
  "use strict";

  // v46 intentionally keeps the existing app.js as the functional runtime.
  // This namespace becomes the SPA bootstrap entry point in a later migration
  // after routing is introduced and tested independently.
  global.MyProduceApp = global.MyProduceApp || {};
  global.MyProduceApp.version = global.AppConfig?.app?.version || "46";
})(window);
