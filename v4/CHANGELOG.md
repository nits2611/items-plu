# v52.1.8 — Barcode Long-Press Options

- Added long press / right-click barcode options.
- Added Show Large Barcode and Copy Product Code actions.
- Product Details is reserved as Coming Soon.
- Added smooth open/close transitions for the large barcode viewer.
- Long press cancels when the user scrolls or moves the pointer.
- Normal tap remains dedicated to the large barcode viewer.

# v52.1.7 — Large Barcode Viewer

- Added full-screen barcode focus mode on a single tap.
- Uses a darkened backdrop and bright white barcode panel to reduce visual distraction for external price-gun scanning.
- Reuses the shared Barcode Renderer v2 with larger scanner-safe dimensions.
- Tap outside, use the Close button, or press Escape to exit.
- Barcode elements are keyboard-focusable and can open with Enter/Space.
- No long-press menu, swipe navigation, auto-close, or Lookup redesign in this release.

# v52.1.6 — Barcode Renderer v2

- Added one shared Code 128 renderer under `src/core/barcode/BarcodeRenderer.js`.
- Standardized barcode display width and height across product and order cards.
- Preserved Code 128 bar/module ratios while scaling the complete symbol consistently.
- Kept human-readable code text separate from the SVG so text is not distorted.
- Preserved the manually verified mobile Lookup drawer clearance (`bottom: 71px`).
- No barcode viewer, long-press menu, or Lookup redesign is included in this step.

# v52.1.3 — Final Order quick placement + Lookup drawer clearance

- Added a direct **Place Order** button to the Final Order screen.
- Reused the existing placement/session logic; no duplicate order logic was introduced.
- The button is disabled when Final Order is empty or the current session is already placed.
- Added extra mobile clearance above the fixed bottom navigation so the Lookup search drawer is fully visible.

## v52.1.2 - Dashboard placed-button compatibility fix
- Fixed a runtime error caused by legacy dashboard code expecting nested `<small>` and `.dash-circle` elements that no longer exist in the v52 dashboard button.
- The placed-order status updater now supports both the old and current dashboard button markup safely.
- Updated app/service-worker version metadata for this patch.

## v52.1.1 - Local file protocol guard

- Skip Service Worker registration and app-version fetch checks when opened via `file://`.
- Prevent `origin null` Service Worker errors from interrupting local testing.
- Keep the normal Service Worker/update workflow unchanged on localhost and HTTPS/GitHub Pages.

## v52.1 - Dashboard redesign

- Rebuilt Home/Dashboard as an operational command center.
- Added today's order progress, counts, workflow state, and continuation actions.
- Added daily quick access, contextual attention items, recent products, and recent order history.
- Reused existing order, missing-item, recent-product, catalog-update, and routing logic without changing business rules.
- No changes to scanner, catalog storage, order sessions, or import behavior.

## v52.1 - Mobile header alignment fix

- Fixed the remaining 10px gap between the top navbar and regular page headers on mobile.
- Preserved the full-width mobile header treatment from v52.0.4.
- Lookup remains unchanged because its title already sits directly beneath the navbar.
- No business logic changes.


## v52.0.4 - Mobile full-width header correction
- Rebuilt the mobile heading fix using a true viewport-width breakout.
- Page headings now extend edge-to-edge even though page content keeps its normal mobile padding.
- Preserved the corrected mobile top spacing from v52.0.2.
- No business logic changes.

## v52.0.4 - Mobile full-width heading correction

- Restored edge-to-edge page headings on mobile while preserving the corrected top spacing from v52.0.2.
- Lookup fixed heading now spans the full viewport width.
- Other page headers extend through the mobile view padding without changing content spacing.
- No business logic changes.

# Changelog

## v52.0.2 - Shell corrections from stable v52.0

- Rebuilt this patch directly from v52.0; v52.0.1 is fully discarded.
- Removed excessive mobile top spacing while retaining sticky page headings.
- Final Order guidance now appears only when the order list is empty.
- Lookup search drawer now clears the v52 mobile bottom navigation.
- Redesigned dated Order History summaries with clear date, status, counts and expandable details.
- No business logic or storage behavior changed.

## v52.0 - Application shell and design foundation

- Added the new professional responsive application shell.
- Added mobile navigation: Home, Lookup, Back Stock, Order, More.
- Reorganized desktop/sidebar navigation by Daily, Work, and Settings frequency.
- Added reusable design tokens for color, typography, spacing, surfaces, status, controls, and focus states.
- Added online/offline status in the top header.
- Preserved all v51.2 feature markup and business logic.
- No product, order, scanner, catalog, or storage behavior was intentionally changed.

## v51.2 - Context-aware scanner

- Final Order scanner now stays on Final Order and searches the scanned product there.
- Lookup scanner continues to return to Lookup.
- Added a live detected-barcode rectangle using BarcodeDetector corner points or bounding box when supported.
- Added a central scan guide, short confirmation delay, vibration feedback, and duplicate-scan protection.

## v51.1 - Order session consistency and history details

- Back Stock edits now refresh Lookup quantity controls immediately, including after Final Order items exist.
- Orders cannot be placed unless Final Order contains at least one item.
- Renamed the placed-order correction action to **Adjust Order**; it unlocks both Back Stock and Final Order for correction, then the revised order can be placed again.
- Order History now includes today's active session plus past placed dates.
- History cards are expandable and show Back Stock and Final Order item details for the selected date.
- Existing export-by-date remains available.

## v51.0 - Daily order sessions
- Added local date-scoped order sessions for Back Stock and Final Order.
- A placed order now locks only its own business date instead of blocking future days.
- Adding Back Stock on a new day automatically uses a fresh Draft session.
- Back Stock and Final Order remain separate lists but share the same daily session date and status.
- Added one-time migration from the old global order keys into dated session storage.
- Existing placed data is preserved in order history and no longer becomes the permanent active order.
- Changed order business-date generation to local calendar dates instead of UTC dates.
- No remote database changes were required.

## v50.4 - Back Stock and Final Order consistency

- Back Stock quantity changes now immediately synchronize the matching Back Stock value shown in Final Order.
- Removing an item from Back Stock clears its Back Stock quantity in Final Order without deleting the Final Order quantity.
- Once an order is marked Placed, Back Stock edits are blocked from Lookup, Back Stock cards, quantity steppers, and remove actions.
- Existing unlock-to-draft behavior remains available for authorized correction workflows.
- No product catalog, Google Sheets, or UI redesign changes.

## v50.2 - Flexible Google Catalog Response Parsing

- Accepts both wrapped and direct catalog JSON responses.
- Does not require `success: true` when valid catalog arrays are present.
- Supports camelCase and snake_case table names.
- Reads catalog version from the response or `app_settings`.
- Preserves the existing local catalog when validation fails.

## v50.1 - Direct Fetch Catalog Update

- Replaced the JSONP catalog download with a normal `fetch()` request.
- Explicitly follows the normal Google Apps Script redirect to the final response.
- Added request timeout, no-store caching, JSON validation, and clearer HTTP/response errors.
- Kept the manual-update behavior and existing local catalog preservation unchanged.
- No extra diagnostic requests are made.

# Changelog

## v49.4.1 - Add & Merge button visibility fix
- Fixed the Add & Merge CSV Choose CSV button using the app's existing green theme variables.
- Added clearer hover, focus, and pressed states without changing Data & Backup functionality.
- Bumped the service-worker cache for reliable deployment.

## v49.4 - Dedicated Data & Backup Page

Goal:
- Move catalog import, export, backup, and maintenance tools out of the crowded modal into a full routed page.

Changes:
- Added the `#/data-tools` SPA route and dedicated Data & Backup view.
- Added responsive import cards for Add & Merge and Replace Local Catalog.
- Kept the destructive replace warning in the existing info tooltip and confirmation step.
- Added organized Export & Backup and Maintenance sections.
- Reused all existing import/export/reset handlers and element IDs.
- Updated the drawer action to navigate to the page instead of opening a modal.
- Bumped the service-worker cache to v49.4.

## v49.3 - Replace catalog UI refinement

### Fixes
- Restyled **Replace Local Catalog** as a clear, compact destructive action.
- Replaced the full-width local-scope notice with an information tooltip beside the action.
- The tooltip explains device/store scope and warns that products missing from the replacement CSV will be removed locally.
- Service-worker cache bumped to v49.3.

## v49.2 - Safe local store catalog import

### Goal
Prevent accidental catalog deletion and clarify import scope before multi-store database integration.

### Changes
- Replaced the single risky Upload CSV action with **Add & Merge CSV** and **Replace Local Catalog**.
- Merge matches products by code first, then by normalized name + brand + quantity + organic type when no code exists.
- Existing products absent from a merge file are preserved.
- Duplicate rows inside the uploaded CSV are skipped.
- Existing matched products are updated only with non-empty uploaded values.
- Replace requires explicit confirmation and rejects empty/invalid CSV files.
- Both actions persist through the Product repository and IndexedDB.
- Added clear wording that the current operation is local to this device/store and does not modify a shared master catalog or another store.
- Service-worker cache bumped to v49.2.

### Deferred
- Actual normalized writes to `products`, `product_codes`, and `store_products` will be implemented when the remote/database provider is introduced.
- Role-based System Admin master-catalog imports.

## v49.1 - Missing Items compatibility fix

### Fixes
- Missing Item Image URL and local image path are now saved with the Missing Item record.
- Missing Item image fields are included in Missing CSV export/import.
- Missing Item cards display the saved image when available.
- Promoting a Missing Item to the catalog preserves its image fields.
- Add to Catalog now persists through the Product repository/provider path so the new IndexedDB cache stays synchronized.
- Restored a robust Missing CSV import path compatible with the expanded Missing Item schema.

# Changelog

## v49 - Product catalog IndexedDB migration

Goal: move the Product module's primary local catalog read cache to IndexedDB without changing Product Lookup UI, routing, remote-sync behavior, or order behavior.

Changes:
- Added `src/core/storage/IndexedDbClient.js` as the common IndexedDB infrastructure wrapper.
- Added `src/modules/products/providers/IndexedDbProductProvider.js`.
- ProductRepository now reads through the IndexedDB provider instead of directly through the legacy catalog bridge.
- On the first v49 run, the currently available stable catalog source is automatically copied into IndexedDB.
- Subsequent app starts load Product Lookup data from IndexedDB first.
- Catalog changes received through the existing update flow and CSV imports are persisted into IndexedDB.
- Reset clears/rebuilds the IndexedDB Product cache while preserving existing reset/update behavior.
- Existing legacy localStorage catalog/cache remains temporarily as a compatibility and remote-sync fallback; removing that duplicate cache is intentionally deferred until the new manual version/update workflow is implemented.
- No intended UI, routing, scanner, Favorites, Recent, Back Stock, Final Order, or order-workflow changes.
- Service-worker cache bumped to v49.

Regression target: behavior should remain identical to v48.1.

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

## v50 - Manual Catalog Update

Goal: Check catalog availability without downloading the full Google Sheets catalog on every app load.

Changes:
- Product Lookup still loads immediately from IndexedDB.
- Added a lightweight same-origin `data/versions.json` check.
- Added Catalog Updates section to Data & Backup.
- A newer version is shown to the user but is not installed automatically.
- Added user-controlled Update Catalog action.
- Remote downloads are validated before the IndexedDB catalog is replaced.
- A failed or incomplete update preserves the existing local catalog.
- Added product-domain routing to the Apps Script template using `action=products`.
- Added a separate local release-version key so old cloud-cache metadata cannot cause false update results.
- Updated service-worker cache to v50.

No intended changes:
- Lookup/search UI and filters.
- Favorites, Recent, Back Stock, Orders, Missing Items, scanner, or routing.
- Local Add & Merge CSV and Replace Local Catalog behaviour.

## v50.3 - App asset update workflow
- Added `app.version` to `data/versions.json` alongside the product catalog version.
- Added a reusable `AppUpdateManager` for service-worker registration and app-version checks.
- Added a compact "New app version available" banner with Update now / Later actions.
- The service worker now waits for user confirmation before activating a new release.
- JavaScript, CSS, and HTML are revalidated so users do not need a manual hard refresh.
- Product catalog versioning remains independent from frontend application versioning.


## v52.1.4 - Mobile bottom-safe layout
- Centralized mobile bottom-navigation clearance with `--ui-bottom-safe-gap`.
- Lookup's fixed search drawer now sits fully above the bottom navigation and respects device safe-area insets.
- Normal mobile page content reserves the same bottom-safe area consistently.
- Floating search and toast positions now use the same shared clearance rather than unrelated magic numbers.
- Final Order quick Place Order behavior from v52.1.3 is preserved.
