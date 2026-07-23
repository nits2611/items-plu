(function (global) {
  "use strict";

  class CatalogService {
    constructor(localProvider, cloudProvider = null) {
      if (!localProvider) throw new Error("CatalogService requires a local provider.");
      this.localProvider = localProvider;
      this.cloudProvider = cloudProvider;
    }

    parseCsv(text) {
      const rows = [];
      let row = [];
      let value = "";
      let inQuotes = false;

      for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];
        if (char === '"' && inQuotes && next === '"') { value += '"'; i += 1; continue; }
        if (char === '"') { inQuotes = !inQuotes; continue; }
        if (char === "," && !inQuotes) { row.push(value); value = ""; continue; }
        if ((char === "\n" || char === "\r") && !inQuotes) {
          if (value || row.length) { row.push(value); rows.push(row); row = []; value = ""; }
          if (char === "\r" && next === "\n") i += 1;
          continue;
        }
        value += char;
      }

      if (value || row.length) rows.push([...row, value]);
      if (!rows.length) return [];
      const headers = rows.shift().map(item => item.trim());
      return rows.filter(values => values.some(item => String(item).trim())).map(values => {
        const result = {};
        headers.forEach((header, index) => { result[header] = (values[index] || "").trim(); });
        return result;
      });
    }

    detectBrand(name) {
      const brands = ["Earthbound Farm", "Taylor Farms", "Fresh Express", "GoodLeaf Farms", "Goodleaf Farms", "Western Family", "Save-On-Foods"];
      const upperName = String(name || "").toUpperCase();
      return brands.find(brand => upperName.startsWith(brand.toUpperCase())) || "";
    }

    normalizeRow(row) {
      const item_name = row.item_name || row.label || row.display_name || row.clean_name || "";
      const code = String(row.code || row.PLU || row.plu || row.item_number || "").trim();
      const quantity = row.quantity || "";
      const brand = row.brand || this.detectBrand(item_name);
      const category = row.category || "";
      const type = row.type || (code.length > 6 ? "packaged" : "produce");
      const image_local = row.image_local || row.image || "";
      const image_url = row.image_url || "";
      const notes = row.notes || "";
      const aliases = row.aliases || "";
      const search_keywords = row.search_keywords || [item_name, code, quantity, brand, category, type, notes, aliases].join(" ");
      return { item_name, code, quantity, brand, category, type, image_local, image_url, notes, aliases, hay: search_keywords.toLowerCase() };
    }

    rowsToItems(rows) {
      return rows.map(row => this.normalizeRow(row)).filter(item => item.item_name && item.code);
    }

    csvToItems(csvText) { return this.rowsToItems(this.parseCsv(csvText)); }

    toBoolean(value, defaultValue = false) {
      if (typeof value === "boolean") return value;
      const normalized = String(value ?? "").trim().toLowerCase();
      if (["true", "1", "yes", "y", "active"].includes(normalized)) return true;
      if (["false", "0", "no", "n", "inactive"].includes(normalized)) return false;
      return defaultValue;
    }

    catalogToItems(catalog) {
      const products = Array.isArray(catalog?.products) ? catalog.products : [];
      const codes = Array.isArray(catalog?.productCodes) ? catalog.productCodes : [];
      const aliases = Array.isArray(catalog?.productAliases) ? catalog.productAliases : [];
      const categories = Array.isArray(catalog?.categories) ? catalog.categories : [];
      const storeProducts = Array.isArray(catalog?.storeProducts) ? catalog.storeProducts : [];
      const configuredStoreId = global.AppConfig?.catalog?.storeId || "";

      const categoryById = new Map(categories.map(row => [String(row.category_id || row.public_id || ""), row]));
      const aliasesByProduct = new Map();
      aliases.forEach(row => {
        const productId = String(row.product_id || "");
        if (!productId) return;
        if (!aliasesByProduct.has(productId)) aliasesByProduct.set(productId, []);
        const alias = String(row.alias || "").trim();
        if (alias) aliasesByProduct.get(productId).push(alias);
      });

      const storeProductByProduct = new Map();
      storeProducts.forEach(row => {
        if (configuredStoreId && row.store_id && String(row.store_id) !== configuredStoreId) return;
        storeProductByProduct.set(String(row.product_id || ""), row);
      });

      const codesByProduct = new Map();
      codes.forEach(row => {
        const productId = String(row.product_id || "");
        if (!productId) return;
        if (!codesByProduct.has(productId)) codesByProduct.set(productId, []);
        codesByProduct.get(productId).push(row);
      });

      const items = [];
      products.forEach(product => {
        const productId = String(product.product_id || product.public_id || "");
        if (!productId) return;
        const status = String(product.status || "active").toLowerCase();
        const approval = String(product.approval_status || "approved").toLowerCase();
        if (status && status !== "active") return;
        if (approval && approval !== "approved") return;

        const storeProduct = storeProductByProduct.get(productId);
        if (storeProduct) {
          if (!this.toBoolean(storeProduct.is_active, true) || this.toBoolean(storeProduct.is_archived, false)) return;
        }

        const productCodes = codesByProduct.get(productId) || [];
        const categoryRow = categoryById.get(String(product.category_id || ""));
        const aliasText = (aliasesByProduct.get(productId) || []).join(" ");
        const itemName = String(product.product_name || "").trim();
        const quantity = [product.size, product.unit].filter(Boolean).join(" ").trim();

        productCodes.forEach(codeRow => {
          const code = String(codeRow.code ?? "").trim();
          if (!code || !itemName) return;
          const type = String(codeRow.code_type || "").toLowerCase() || (code.length > 6 ? "packaged" : "produce");
          items.push(this.normalizeRow({
            item_name: itemName,
            code,
            quantity,
            brand: product.brand || "",
            category: categoryRow?.category_name || product.subcategory || "",
            type,
            image_url: product.image_url || "",
            notes: storeProduct?.notes || "",
            aliases: aliasText,
            search_keywords: [product.search_keywords, aliasText, itemName, code, product.brand, categoryRow?.category_name, quantity].filter(Boolean).join(" ")
          }));
        });
      });
      return items;
    }

    async hashText(text) {
      if (!global.crypto || !global.crypto.subtle) {
        let hash = 0;
        for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
        return String(hash);
      }
      const buffer = await global.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buffer)).map(value => value.toString(16).padStart(2, "0")).join("").slice(0, 12);
    }

    async loadInitialCatalog() {
      const cachedCatalog = this.cloudProvider?.getCachedCatalog?.();
      if (cachedCatalog) return { items: this.catalogToItems(cachedCatalog), source: "cloud-cache", csvText: "" };

      const cachedCsv = this.localProvider.getCachedCsv();
      if (cachedCsv) return { items: this.csvToItems(cachedCsv), source: "csv-cache", csvText: cachedCsv };

      return { items: this.rowsToItems(this.localProvider.getBundledRows()), source: "bundled", csvText: "" };
    }

    async checkForUpdate() {
      if (this.cloudProvider?.isConfigured?.()) {
        const result = await this.cloudProvider.sync();
        return {
          changed: result.changed,
          version: result.version,
          items: result.changed ? this.catalogToItems(result.catalog) : null,
          source: "google-sheets"
        };
      }

      const csvText = await this.localProvider.fetchRemoteCsv();
      const hash = await this.hashText(csvText);
      const previousHash = this.localProvider.getCachedHash();
      const changed = !previousHash || previousHash !== hash;
      if (changed) this.localProvider.saveCsv(csvText, hash);
      return { changed, hash, csvText, items: changed ? this.csvToItems(csvText) : null, source: "bundled-csv" };
    }

    async importCsv(csvText) {
      const hash = await this.hashText(csvText);
      this.localProvider.saveCsv(csvText, hash);
      return { hash, csvText, items: this.csvToItems(csvText) };
    }

    reset() {
      this.localProvider.clearCache();
      this.cloudProvider?.clearCache?.();
      return this.rowsToItems(this.localProvider.getBundledRows());
    }
  }

  global.CatalogService = CatalogService;
})(window);
