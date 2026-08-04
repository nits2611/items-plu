# Google Sheets Product Catalog Setup - v50

The app is local-first. It reads `data/versions.json` during startup and does not download Google Sheet data automatically.

## 1. Configure the Apps Script endpoint

Open the Google Spreadsheet and choose **Extensions > Apps Script**.

Copy the contents of `google-apps-script.gs` into the Apps Script project.

Deploy it as a web app:

- Execute as: **Me**
- Who has access: **Anyone**

Copy the deployment URL ending in `/exec`.

Paste it in one place:

```javascript
// src/core/config/AppConfig.js
apiUrl: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
```

Do not use the Google Sheet `/edit` URL or a Publish-to-web URL.

## 2. Publish a catalog version

The version must match in both places:

1. Google Sheet `app_settings` tab: `catalog_version`
2. GitHub file: `data/versions.json` > `products.version`

Example:

```json
{
  "products": {
    "version": "1.0.1",
    "updated_at": "2026-08-03T21:30:00Z"
  }
}
```

Recommended publishing order:

1. Finish and verify Google Sheet changes.
2. Increase `catalog_version` in `app_settings`.
3. Deploy a new Apps Script version if its code changed.
4. Update `data/versions.json` on GitHub last.

Updating the GitHub version last prevents users from being offered a release before the remote catalog is ready.

## 3. User update flow

- App opens from IndexedDB immediately.
- App checks only `data/versions.json`.
- Data & Backup displays an update when versions differ.
- Full product data is requested only when the user clicks **Update Catalog**.
- The response must contain products, product codes, aliases, categories, and store products.
- If validation fails, the existing IndexedDB catalog is kept.
