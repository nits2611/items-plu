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

## Product image gallery (v52.2.1)

The preferred product image field is now `images` on the `products` tab.

Store the value as a JSON array in a single Google Sheets cell:

```text
["https://example.com/apple-front.jpg","https://example.com/apple-side.jpg"]
```

A product may contain one or many images. The first image is used as the card thumbnail and all images are available in the product gallery.

For backward compatibility, existing `image_url` values still work. You do not need to migrate every record immediately. New or edited products should use `images` going forward. The Apps Script endpoint already returns this field automatically because it reads all sheet headers dynamically.

### Optional normalized `product_images` tab

For the current Google Sheets phase, the `products.images` JSON-array cell is supported and is the simplest way to maintain multiple images.

The app also supports an optional `product_images` tab for a more database-like structure. Suggested columns:

```text
product_image_id | product_id | image_url | sort_order | is_primary | status
```

If the tab exists, its rows are merged into the same frontend `images[]` array. This prepares us for PostgreSQL later, where a one-to-many `product_images` table is preferable to storing an array directly in a relational product row.


## Default count unit (v52.5.4)

Add this column to the `products` sheet:

```text
default_count_unit
```

This is the product's normal **operational counting/transaction unit**, not its package size unit. Example: a 946 ml juice can have `unit = ml` and `default_count_unit = each`; Banana can use `default_count_unit = kg`. Shrink preselects this value for new entries, but the user can override it for an individual transaction.

Keep `quantity` + `unit` for product/package size (for example `946` + `ml`). Future order units, case-pack conversions, pricing units, and cost units remain separate concepts.
