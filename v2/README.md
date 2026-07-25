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

## v46 architecture migration

v46 begins the incremental migration toward a modular SPA/MVC-style structure while preserving the current working UI and features.

New core infrastructure lives under `src/core/`:

- `config/AppConfig.js` - central application configuration.
- `http/HttpClient.js` - shared HTTP request wrapper.
- `storage/LocalStorageClient.js` - small local-storage helper.
- `utils/UrlUtils.js` - shared URL/query helper.
- `logging/Logger.js` - consistent logging helper.
- `src/app.js` - reserved bootstrap namespace for the upcoming SPA router migration.
- `data/versions.json` - lightweight future catalog-version manifest.

The legacy `app.js`, catalog service/providers, views, navigation, and local workflows remain in place in v46 so this release can be regression-tested before the next migration step.
