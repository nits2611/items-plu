# Nesters / Save-On PLU Lookup — Auto Sync Version

This version loads cached data first, then checks `items.csv` from GitHub Pages.

If `items.csv` changed:
- the app updates local cache automatically
- item count updates
- next app open uses the updated cached data

Current bundled CSV rows: 490
CSV hash: 7f702efe2df5

## Files to upload to GitHub
Upload/replace all files in this folder, especially:
- index.html
- app.js
- service-worker.js
- items.csv
- data.js
- styles.css
- manifest.webmanifest
- icons/

## How updates work
1. App opens instantly from cached data.
2. App fetches `items.csv` using browser validation (`cache: no-cache`).
3. If content changed, app saves new CSV to localStorage and re-renders.
4. If offline, app keeps using cached data.

## Important
After pushing these files to GitHub Pages, open the site once and refresh.
The installed PWA may need one close/reopen after the first update because service workers update in the background.


## Compact mobile update
This version collapses filters/tools on mobile to save space.
Use "Show filters & tools" only when you need All/Produce/Packaged/Organic, Upload CSV, or Reset data.
Search still works immediately while typing.
