# Changelog

## v48.1 - Lookup info tooltip consistency fix

Goal: make the fixed Lookup header information button use the same tooltip presentation and positioning as the information buttons on the other app pages.

Changes:
- Lookup info now uses the shared `.section-info-tooltip` UI instead of a toast/alert.
- The fixed Lookup info button now uses the common `.section-info-btn` styling.
- Exposed the existing tooltip presenter as a small shared UI helper so fixed headers can reuse it without duplicating tooltip logic.
- Service-worker cache bumped to v48.1.

No intended changes to product lookup, routing, scanner, orders, favorites, recent, storage, or catalog behavior.

## v48 - Product/Lookup module migration

Goal: move Product domain responsibilities behind modular Controller, Service, Repository, View, and Provider boundaries without changing existing UI behavior or storage technology.

Changes:
- Added `src/modules/products/ProductController.js`.
- Added `src/modules/products/ProductService.js` for product state, search, classification, and code lookup.
- Added `src/modules/products/ProductRepository.js` as the product data-access boundary.
- Added `src/modules/products/ProductView.js` as a compatibility UI adapter.
- Added `src/modules/products/providers/LegacyCatalogProductProvider.js` to bridge the new module to the proven CatalogService stack.
- Catalog loading, update checks, CSV import/reset, and core lookup filtering now flow through the Product module.
- Existing seasonal/archive extensions continue to work but now delegate product searching to ProductService.
- No IndexedDB migration, UI redesign, route changes, or feature additions in this release.
- Service-worker cache bumped to v48.

Regression target: behavior should remain identical to v47.1.

## v47.1 - Router heading sync fix

Goal:
- Fix page heading state during browser Back/Forward navigation without changing SPA routing behavior.

Changes:
- `activateView()` now synchronizes the fixed Lookup heading directly with the active route/view.
- Added an internal `app:viewchange` event for route-driven UI synchronization.
- Browser Back/Forward no longer depends on click events to refresh the Lookup heading.
- Service-worker cache bumped for this patch.

No intended changes:
- Product/search behavior
- Orders, favorites, recent, inventory, scanner, or other business logic
- Existing route names and navigation behavior

# Changelog

## v47 - SPA routing migration

### Goal
Introduce hash-based SPA navigation while keeping every existing screen and its business behavior intact.

### Changes
- Added `src/core/router/Router.js` as the single navigation entry point.
- Added GitHub Pages-safe hash routes for all existing views.
- Existing `switchView()` calls now navigate through the router instead of changing screens independently.
- Browser Back/Forward navigation now follows application view history.
- Direct links such as `#/lookup`, `#/orders`, and `#/dashboard` open the corresponding existing view.
- Invalid/empty routes safely fall back to `#/lookup`.
- Existing view HTML remains in `index.html`; no view/module rewrite was done in this release.
- Service-worker cache bumped to v47 and includes the router.

### Routes
- `#/lookup` -> Lookup
- `#/favorites` -> Favorites
- `#/recent` -> Recent
- `#/back-stock` -> Back Stock
- `#/final-order` -> Final Order
- `#/orders` -> Orders workflow
- `#/dashboard` -> Dashboard
- `#/missing` -> Missing Items
- `#/archive` -> Archive
- `#/inventory` -> Inventory

### Intentionally deferred
- Moving view HTML out of `index.html`
- Product MVC/module migration
- IndexedDB migration
- Manual catalog update workflow
- Order module MVC refactor


## v46 - Core infrastructure migration

### Goal
Introduce the new application foundation without intentionally changing existing UI or business behavior.

### Changes
- Added `src/core/config/AppConfig.js` as the central configuration source.
- Added reusable `HttpClient` with GET/POST, query parameters, timeout, JSON/text responses, and consistent HTTP errors.
- Added `LocalStorageClient`, `Logger`, and `UrlUtils` core helpers.
- Added `src/app.js` as the future SPA/bootstrap namespace without replacing the legacy runtime yet.
- Added `data/versions.json` for future lightweight catalog version checks.
- Existing catalog, lookup, favorites, recent, order, missing-item, scanner, navigation, and PWA code remains in place.
- Service-worker cache bumped for v46 and includes the new core files.

### Intentionally deferred
- SPA router
- View/module migration
- IndexedDB migration
- Manual catalog update workflow
- Product module MVC refactor
- Order module MVC refactor
