const CATALOG_SHEETS = Object.freeze({
  products: "products",
  productCodes: "product_codes",
  productAliases: "product_aliases",
  categories: "categories",
  storeProducts: "store_products",
  appSettings: "app_settings"
});

function doGet(event) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const clientVersion = String(event?.parameter?.version || "");
    const requestedStoreId = String(event?.parameter?.storeId || "");
    const appSettings = readSheet_(spreadsheet, CATALOG_SHEETS.appSettings);
    const catalogVersion = getSetting_(appSettings, "catalog_version");

    if (clientVersion && clientVersion === String(catalogVersion)) {
      return jsonResponse_({
        success: true,
        catalogVersion: String(catalogVersion),
        updated: false
      });
    }

    let storeProducts = readSheet_(spreadsheet, CATALOG_SHEETS.storeProducts);
    if (requestedStoreId) {
      storeProducts = storeProducts.filter(row =>
        !row.store_id || String(row.store_id) === requestedStoreId
      );
    }

    return jsonResponse_({
      success: true,
      catalogVersion: String(catalogVersion),
      updated: true,
      data: {
        products: readSheet_(spreadsheet, CATALOG_SHEETS.products),
        productCodes: readSheet_(spreadsheet, CATALOG_SHEETS.productCodes),
        productAliases: readSheet_(spreadsheet, CATALOG_SHEETS.productAliases),
        categories: readSheet_(spreadsheet, CATALOG_SHEETS.categories),
        storeProducts,
        appSettings
      }
    });
  } catch (error) {
    return jsonResponse_({
      success: false,
      message: error && error.message ? error.message : String(error)
    });
  }
}

function readSheet_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  const headers = values[0].map(header => String(header).trim());
  return values.slice(1)
    .filter(row => row.some(cell => String(cell).trim() !== ""))
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index] ?? "";
      });
      return record;
    });
}

function getSetting_(settings, key) {
  const target = String(key).toLowerCase();
  const row = settings.find(item =>
    String(item.key || item.setting_key || item.setting_name || "").toLowerCase() === target
  );
  return row ? (row.value ?? row.setting_value ?? "") : "";
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
