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
