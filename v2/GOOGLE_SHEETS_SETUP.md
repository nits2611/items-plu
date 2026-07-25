# Google Sheets connection

The app now supports one-request catalog synchronization through a Google Apps Script web app.

## 1. Add the server script

1. Open the Google Sheet.
2. Select **Extensions > Apps Script**.
3. Replace the editor contents with `google-apps-script.gs` from this project.
4. Save the project.

## 2. Deploy it

1. Select **Deploy > New deployment**.
2. Choose **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Deploy and copy the `/exec` URL.

Whenever the Apps Script code changes, create a new deployment version or edit the existing deployment and choose **New version**.

## 3. Configure the app

Open `js/AppConfig.js` and paste the deployment URL into:

```js
apiUrl: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
```

This is the only URL that must be maintained in the app.

## Sync behavior

- Cached catalog data displays immediately.
- The app sends one background request with its cached catalog version.
- If `catalog_version` is unchanged, the server returns only a small `updated: false` response.
- If the version changed, all six catalog datasets are returned in one JSON response.
- On network failure, the app continues with cached data or its bundled CSV fallback.

Increase `catalog_version` in `app_settings` whenever catalog data should be downloaded again.

## JSONP deployment update (v44)

The browser now loads the Apps Script endpoint through JSONP to avoid cross-origin fetch problems on GitHub Pages.

After replacing the Apps Script code with `google-apps-script.gs`:

1. Open **Deploy > Manage deployments**.
2. Edit the existing Web App deployment.
3. Select **New version**.
4. Keep **Execute as: Me** and **Who has access: Anyone**.
5. Deploy and continue using the `/exec` URL in `js/AppConfig.js`.

Manual test:

`YOUR_EXEC_URL?version=FORCE_TEST&callback=testCallback`

The response should begin with `testCallback({` and end with `});`.
