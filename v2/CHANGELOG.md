# Changelog

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
