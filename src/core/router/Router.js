(function (global) {
  "use strict";

  const DEFAULT_VIEW = "lookup";
  const viewToRoute = Object.freeze({
    lookup: "/lookup",
    favorites: "/favorites",
    recent: "/recent",
    order: "/back-stock",
    missing: "/missing",
    archive: "/archive",
    frontStock: "/final-order",
    dashboard: "/dashboard",
    orders: "/orders",
    workday: "/my-shift",
    shrink: "/shrink",
    inventory: "/inventory",
    dataTools: "/data-tools"
  });

  const routeToView = Object.freeze(
    Object.entries(viewToRoute).reduce((map, [view, route]) => {
      map[route] = view;
      return map;
    }, {})
  );

  let routeHandler = null;
  let started = false;

  function normalizeRoute(value) {
    let route = String(value || "").trim();
    if (!route) return viewToRoute[DEFAULT_VIEW];
    if (route.startsWith("#")) route = route.slice(1);
    if (!route.startsWith("/")) route = `/${route}`;
    route = route.replace(/\/+$/, "") || "/";
    return route === "/" ? viewToRoute[DEFAULT_VIEW] : route;
  }

  function routeForView(view) {
    return viewToRoute[view] || null;
  }

  function viewForRoute(route) {
    return routeToView[normalizeRoute(route)] || null;
  }

  function currentView() {
    return viewForRoute(global.location.hash) || DEFAULT_VIEW;
  }

  function dispatch() {
    const route = normalizeRoute(global.location.hash);
    const view = viewForRoute(route);

    if (!view) {
      global.history.replaceState(null, "", `#${viewToRoute[DEFAULT_VIEW]}`);
      if (typeof routeHandler === "function") routeHandler(DEFAULT_VIEW, viewToRoute[DEFAULT_VIEW]);
      return DEFAULT_VIEW;
    }

    if (typeof routeHandler === "function") routeHandler(view, route);
    return view;
  }

  function navigate(view, options) {
    const opts = options || {};
    const route = routeForView(view);
    if (!route) {
      console.warn(`[Router] Unknown view: ${view}`);
      return false;
    }

    if (!opts.bypassGuard && typeof global.__workdayNavigationGuard === "function") {
      const allowed = global.__workdayNavigationGuard(view);
      if (allowed === false) return false;
    }

    const targetHash = `#${route}`;
    if (global.location.hash === targetHash) {
      dispatch();
      return true;
    }

    if (opts.replace) {
      global.history.replaceState(null, "", targetHash);
      dispatch();
    } else {
      global.location.hash = route;
    }

    return true;
  }

  function setHandler(handler) {
    routeHandler = typeof handler === "function" ? handler : null;
  }

  function start(defaultView) {
    if (started) return dispatch();
    started = true;
    global.addEventListener("hashchange", dispatch);

    const fallback = routeForView(defaultView) || viewToRoute[DEFAULT_VIEW];
    if (!global.location.hash || !viewForRoute(global.location.hash)) {
      global.history.replaceState(null, "", `#${fallback}`);
    }

    return dispatch();
  }

  global.AppRouter = Object.freeze({
    start,
    navigate,
    dispatch,
    setHandler,
    currentView,
    routeForView,
    viewForRoute,
    routes: viewToRoute
  });
})(window);
