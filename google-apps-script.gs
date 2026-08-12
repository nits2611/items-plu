const CATALOG_SHEETS = Object.freeze({
  products: "products",
  productCodes: "product_codes",
  productAliases: "product_aliases",
  productImages: "product_images",
  categories: "categories",
  storeProducts: "store_products",
  appSettings: "app_settings"
});

/** Single web-app entry point. Add future modules through the action router. */
function doGet(event) {
  const callback = String(event?.parameter?.callback || "");
  const action = String(event?.parameter?.action || "products").toLowerCase();

  try {
    switch (action) {
      case "products":
      case "catalog":
        return createResponse_(getProductCatalog_(event), callback);
      default:
        return createResponse_({ success: false, message: `Unknown action: ${action}` }, callback);
    }
  } catch (error) {
    return createResponse_({
      success: false,
      message: error && error.message ? error.message : String(error)
    }, callback);
  }
}

function getProductCatalog_(event) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const requestedStoreId = String(
    event?.parameter?.store_id || event?.parameter?.storeId || ""
  );

  const appSettings = readSheet_(spreadsheet, CATALOG_SHEETS.appSettings);
  const version = String(getSetting_(appSettings, "catalog_version"));
  if (!version) throw new Error("app_settings is missing catalog_version.");

  let storeProducts = readSheet_(spreadsheet, CATALOG_SHEETS.storeProducts);
  if (requestedStoreId) {
    storeProducts = storeProducts.filter(row =>
      !row.store_id || String(row.store_id) === requestedStoreId
    );
  }

  return {
    success: true,
    version,
    catalogVersion: version,
    data: {
      products: readSheet_(spreadsheet, CATALOG_SHEETS.products),
      productCodes: readSheet_(spreadsheet, CATALOG_SHEETS.productCodes),
      productAliases: readSheet_(spreadsheet, CATALOG_SHEETS.productAliases),
      productImages: readOptionalSheet_(spreadsheet, CATALOG_SHEETS.productImages),
      categories: readSheet_(spreadsheet, CATALOG_SHEETS.categories),
      storeProducts,
      appSettings
    }
  };
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

function readOptionalSheet_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return [];
  return readSheet_(spreadsheet, sheetName);
}

function getSetting_(settings, key) {
  const target = String(key).toLowerCase();
  const row = settings.find(item =>
    String(item.key || item.setting_key || item.setting_name || "").toLowerCase() === target
  );
  return row ? (row.value ?? row.setting_value ?? "") : "";
}

function createResponse_(data, callback) {
  const json = JSON.stringify(data);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
