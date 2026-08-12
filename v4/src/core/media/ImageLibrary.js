(function (global) {
  "use strict";

  const splitText = value => String(value || "")
    .split(/\r?\n|\s*\|\s*/)
    .map(item => item.trim())
    .filter(Boolean);

  function parseImages(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    if (typeof value === "object") return [value];

    const text = String(value).trim();
    if (!text) return [];

    if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("{") && text.endsWith("}"))) {
      try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (_) {}
    }

    return splitText(text);
  }

  function sourceFromEntry(entry) {
    if (typeof entry === "string") return entry.trim();
    if (!entry || typeof entry !== "object") return "";
    return String(entry.src || entry.url || entry.path || entry.image_url || entry.image_local || "").trim();
  }

  function normalizeImages(itemOrImages, legacyLocal = "", legacyUrl = "") {
    const item = itemOrImages && !Array.isArray(itemOrImages) && typeof itemOrImages === "object"
      ? itemOrImages
      : null;

    const raw = item
      ? [
          ...parseImages(item.images),
          ...parseImages(item.image_urls),
          ...parseImages(item.image_gallery),
          item.image_local,
          item.image_url
        ]
      : [...parseImages(itemOrImages), legacyLocal, legacyUrl];

    const seen = new Set();
    const images = [];
    raw.flatMap(entry => Array.isArray(entry) ? entry : [entry]).forEach(entry => {
      const src = sourceFromEntry(entry);
      if (!src || seen.has(src)) return;
      seen.add(src);
      images.push(src);
    });
    return images;
  }

  function primaryImage(item) {
    return normalizeImages(item)[0] || "";
  }

  function serializeImages(itemOrImages) {
    return JSON.stringify(normalizeImages(itemOrImages));
  }

  global.ImageLibrary = Object.freeze({ parseImages, normalizeImages, primaryImage, serializeImages });
})(window);
