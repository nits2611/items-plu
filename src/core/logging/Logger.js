(function (global) {
  "use strict";

  const prefix = "[My Produce Assistant]";
  global.Logger = Object.freeze({
    info: (...args) => console.info(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args)
  });
})(window);
