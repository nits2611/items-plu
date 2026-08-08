**Current UI release: v52.1**

# Nesters Produce Assistant - Feature v1

New features:
- Camera icon inside search box
- Native BarcodeDetector camera scanner where browser supports it
- Favorites
- Recently Used
- Today's Order with quantity
- Export order CSV
- Export/import profile JSON
- Alias search support, e.g. eb spinach, tf asian, wf basil

Upload all files to GitHub Pages. Open with ?v=feature1 once after deployment to bypass older cache.

## Catalog architecture (v38)

The visible application still uses plain HTML, CSS, and JavaScript. Catalog data is now separated from the UI:

- `js/providers/LocalCatalogProvider.js` handles localStorage, bundled data, and `items.csv` fetching.
- `js/services/CatalogService.js` handles CSV parsing, normalization, hashing, import, reset, and update checks.
- `js/providers/GoogleSheetsCatalogProvider.js` is a future placeholder and is not active yet.
- `app.js` uses `CatalogService` while preserving the existing interface and workflows.

To add Google Sheets later, implement the same provider contract and switch the provider created near the top of `app.js`.

## Google Sheets catalog sync

Version 43 adds one-request synchronization through Google Apps Script. See `GOOGLE_SHEETS_SETUP.md`.
The only app configuration value is `googleSheets.apiUrl` in `js/AppConfig.js`.
Until that URL is configured, the app continues using its existing CSV update flow.

## v47 SPA routing migration

v47 adds a lightweight hash-based SPA router on top of the stable application while preserving the current working UI and features.

New core infrastructure lives under `src/core/`:

- `config/AppConfig.js` - central application configuration.
- `http/HttpClient.js` - shared HTTP request wrapper.
- `storage/LocalStorageClient.js` - small local-storage helper.
- `utils/UrlUtils.js` - shared URL/query helper.
- `logging/Logger.js` - consistent logging helper.
- `src/app.js` - reserved bootstrap namespace for the upcoming SPA router migration.
- `data/versions.json` - lightweight future catalog-version manifest.

The legacy `app.js`, catalog service/providers, view markup, and local workflows remain in place in v47. Navigation now passes through the shared router so this release can be regression-tested before view/module migration.

## v48 architecture checkpoint

Product/Lookup now has a modular Controller -> Service -> Repository -> Provider boundary. The current provider intentionally bridges to the existing CatalogService so behavior stays unchanged. IndexedDB is deferred to the next migration phase.

## v49 local Product storage

Product Lookup now uses IndexedDB as its primary local catalog cache through `IndexedDbProductProvider`. On first run, the existing proven catalog source is migrated automatically, so no manual data conversion is required. The legacy localStorage catalog remains only as a temporary compatibility/remote-sync fallback until the manual version/update phase.



## v49.2 catalog CSV import
`Data & Backup` now provides two distinct local-store operations:
- **Add & Merge CSV** preserves existing products and adds/updates matching rows.
- **Replace Local Catalog** replaces only the catalog cached on this device after confirmation.

These actions do not yet write to the normalized Google Sheets/PostgreSQL tables. Future providers will map store imports to `store_products` while protecting the global master catalog.

## v50 catalog release flow

The product catalog is local-first and user-controlled:

1. IndexedDB supplies the current catalog immediately.
2. `data/versions.json` is checked in the background.
3. The app displays an available release in Data & Backup.
4. Google Apps Script is called only when the user chooses Update Catalog.
5. The complete product-domain response is validated and then saved atomically to IndexedDB.

The GitHub version and Google Sheet `catalog_version` must match for a release.

### Application vs catalog releases
- `data/versions.json > app.version` announces a new frontend release.
- `AppConfig.app.version` identifies the frontend version currently running.
- `service-worker.js` controls installation of updated JS/CSS/HTML assets.
- `data/versions.json > products.version` remains dedicated to product catalog releases.
- A frontend-only release does not require changing the product catalog version.

## Daily order sessions (v51)

Back Stock and Final Order are stored locally per store and per local business date. A placed session locks only that date. The next date starts with a separate Draft session and empty lists. Existing legacy local order keys are migrated once and preserved in order history.
