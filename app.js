const SAVE_ON_BASE = "https://www.saveonfoods.com/sm/planning/rsid/1982/results?q=";
const CSV_URL = "./items.csv";
const STORAGE_CSV = "plu_items_csv_current";
const STORAGE_HASH = "plu_items_csv_hash";

let items = [];
let filter = "all";
let deferredPrompt = null;

const q = document.getElementById("q");
const results = document.getElementById("results");
const msg = document.getElementById("message");
const count = document.getElementById("count");
const syncStatus = document.getElementById("syncStatus") || { textContent: "", className: "" };

const CODE128 = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112"
];

function parseCSV(text) {
  const rows = [];
  let row = [], val = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (ch === '"' && inQ && nx === '"') { val += '"'; i++; continue; }
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { row.push(val); val = ""; continue; }
    if ((ch === "\n" || ch === "\r") && !inQ) {
      if (val || row.length) { row.push(val); rows.push(row); row = []; val = ""; }
      if (ch === "\r" && nx === "\n") i++;
      continue;
    }
    val += ch;
  }
  if (val || row.length) rows.push([...row, val]);
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim());
  return rows
    .filter(r => r.some(v => String(v).trim()))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = (r[i] || "").trim());
      return obj;
    });
}

async function sha256Short(text) {
  if (!crypto?.subtle) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return String(hash);
  }
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

function detectBrand(name) {
  const brands = ["Earthbound Farm", "Taylor Farms", "Fresh Express", "GoodLeaf Farms", "Goodleaf Farms", "Western Family", "Save-On-Foods"];
  const up = String(name).toUpperCase();
  return brands.find(b => up.startsWith(b.toUpperCase())) || "";
}

function normalize(row) {
  const item_name = row.item_name || row.label || row.display_name || row.clean_name || "";
  const code = String(row.code || row.PLU || row.plu || row.item_number || "").trim();
  const quantity = row.quantity || "";
  const brand = row.brand || detectBrand(item_name);
  const category = row.category || "";
  const type = row.type || (code.length > 6 ? "packaged" : "produce");
  const image_local = row.image_local || row.image || "";
  const image_url = row.image_url || "";
  const notes = row.notes || "";
  const search_keywords = row.search_keywords || [item_name, code, quantity, brand, category, type, notes].join(" ");
  return { item_name, code, quantity, brand, category, type, image_local, image_url, notes, hay: search_keywords.toLowerCase() };
}

function rowsToItems(rows) {
  return rows.map(normalize).filter(x => x.item_name && x.code);
}

function setItemsFromCSV(text) {
  items = rowsToItems(parseCSV(text));
  render();
}

async function loadInitialData() {
  const cachedCSV = localStorage.getItem(STORAGE_CSV);

  if (cachedCSV) {
    setItemsFromCSV(cachedCSV);
    setSync("Loaded cached data. Checking for updates...");
  } else if (window.DEFAULT_ITEMS?.length) {
    items = rowsToItems(window.DEFAULT_ITEMS);
    render();
    setSync("Loaded bundled data. Checking CSV...");
  } else {
    setSync("No cached data found.", "err");
  }

  await checkForCSVUpdate();
}

async function checkForCSVUpdate() {
  try {
    const res = await fetch(CSV_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const text = await res.text();
    const newHash = await sha256Short(text);
    const oldHash = localStorage.getItem(STORAGE_HASH);

    if (!oldHash || oldHash !== newHash) {
      localStorage.setItem(STORAGE_CSV, text);
      localStorage.setItem(STORAGE_HASH, newHash);
      setItemsFromCSV(text);
      setSync(`Data updated from CSV (${items.length} items).`);
    } else {
      setSync(`Data is up to date (${items.length} items).`);
    }
  } catch (e) {
    setSync(`Offline/cached mode (${items.length} items).`, "warn");
  }
}

function isOrg(x) {
  return /(^ORG\b|ORGANIC)/i.test(x.item_name);
}

function isPackaged(x) {
  return x.code.length > 6 || /packaged|upc/i.test(x.type);
}

function getResults() {
  const terms = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let arr = items;

  if (filter === "produce") arr = arr.filter(x => !isPackaged(x));
  if (filter === "packaged") arr = arr.filter(isPackaged);
  if (filter === "organic") arr = arr.filter(isOrg);

  if (terms.length) {
    arr = arr.filter(x => terms.every(t =>
      x.hay.includes(t) ||
      x.item_name.toLowerCase().includes(t) ||
      x.code.toLowerCase().includes(t)
    ));
  }

  return arr.slice(0, 100);
}

function render() {
  const arr = getResults();
  results.innerHTML = "";
  count.textContent = `${arr.length}/${items.length} items`;

  if (!arr.length) {
    show(`No matching item found${q.value.trim() ? ` for "${q.value.trim()}"` : ""}. Try item name, brand, quantity, PLU, UPC, or shorter keyword.`);
    return;
  }

  hide();
  const frag = document.createDocumentFragment();
  arr.forEach(x => frag.appendChild(card(x)));
  results.appendChild(frag);
}

function card(x) {
  const e = document.createElement("article");
  e.className = "card " + (isOrg(x) ? "org" : "");
  e.innerHTML = `<div class="top"><div class="thumb placeholder">No image</div><div><h2 class="name"></h2><div class="badges"></div><div class="code"></div></div></div><div class="barcode"></div><div class="actions"><button type="button">Copy Code</button><a target="_blank" rel="noopener">Check Save-On</a></div>`;

  e.querySelector(".name").textContent = x.item_name;
  e.querySelector(".code").textContent = x.code;

  const badges = e.querySelector(".badges");
  [x.brand, x.quantity, x.category, isOrg(x) ? "Organic" : "", isPackaged(x) ? "Packaged" : "Produce"]
    .filter(Boolean)
    .forEach(b => {
      const s = document.createElement("span");
      s.className = "badge " + (b === "Organic" ? "org" : "");
      s.textContent = b;
      badges.appendChild(s);
    });

  const src = x.image_local || x.image_url;
  if (src) {
    const img = document.createElement("img");
    img.className = "thumb";
    img.alt = x.item_name;
    img.src = src;
    img.onerror = () => img.replaceWith(placeholder());
    e.querySelector(".thumb").replaceWith(img);
  }

  e.querySelector(".barcode").appendChild(code128SVG(x.code));

  const btn = e.querySelector("button");
  btn.onclick = async () => {
    try { await navigator.clipboard.writeText(x.code); } catch {}
    btn.textContent = "Copied";
    setTimeout(() => btn.textContent = "Copy Code", 900);
  };

  e.querySelector("a").href = SAVE_ON_BASE + encodeURIComponent(x.code);
  return e;
}

function placeholder() {
  const d = document.createElement("div");
  d.className = "thumb placeholder";
  d.textContent = "No image";
  return d;
}

function code128SVG(v) {
  v = String(v).trim();
  const numeric = /^\d+$/.test(v) && v.length % 2 === 0;
  const codes = [];
  let sum;

  if (numeric) {
    codes.push(105);
    sum = 105;
    for (let i = 0; i < v.length; i += 2) {
      const c = Number(v.slice(i, i + 2));
      codes.push(c);
      sum += c * (codes.length - 1);
    }
  } else {
    codes.push(104);
    sum = 104;
    for (let i = 0; i < v.length; i++) {
      const c = v.charCodeAt(i) - 32;
      codes.push(c);
      sum += c * (codes.length - 1);
    }
  }

  codes.push(sum % 103, 106);

  const module = numeric && v.length > 6 ? 2.05 : 2.3;
  const h = 58;
  let x = 10;
  const parts = [];

  for (const c of codes) {
    const p = CODE128[c];
    if (!p) continue;
    for (let i = 0; i < p.length; i++) {
      const w = Number(p[i]) * module;
      if (i % 2 === 0) parts.push(`<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${h}"/>`);
      x += w;
    }
  }

  x += 10;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${Math.ceil(x)} ${h + 18}`);
  svg.innerHTML = `<g fill="#000">${parts.join("")}</g><text x="${Math.ceil(x / 2)}" y="${h + 14}" text-anchor="middle" font-size="13" font-family="Arial" font-weight="700">${v}</text>`;
  return svg;
}

function show(t) {
  msg.hidden = false;
  msg.textContent = t;
}

function hide() {
  msg.hidden = true;
  msg.textContent = "";
}

function setSync(text, level = "") {
  syncStatus.textContent = text;
  syncStatus.className = "sync-status " + level;
}

q.addEventListener("input", render);

document.getElementById("clearBtn").onclick = () => {
  q.value = "";
  q.focus();
  render();
};

document.querySelectorAll(".filters button").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".filters button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    filter = b.dataset.filter;
    render();
  };
});

const upload = document.getElementById("csvUpload");
if (upload) {
  upload.addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;
    const text = await f.text();
    const hash = await sha256Short(text);
    localStorage.setItem(STORAGE_CSV, text);
    localStorage.setItem(STORAGE_HASH, hash);
    setItemsFromCSV(text);
    setSync(`Uploaded CSV loaded (${items.length} items).`);
  });
}

const reset = document.getElementById("resetBtn");
if (reset) {
  reset.onclick = () => {
    localStorage.removeItem(STORAGE_CSV);
    localStorage.removeItem(STORAGE_HASH);
    items = rowsToItems(window.DEFAULT_ITEMS || []);
    render();
    setSync("Reset to bundled data. Checking CSV...");
    checkForCSVUpdate();
  };
}

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  const install = document.getElementById("installBtn");
  if (install) install.hidden = false;
});

const install = document.getElementById("installBtn");
if (install) {
  install.onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    install.hidden = true;
  };
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").then(reg => {
    // Ask the browser to check for an updated service worker.
    reg.update?.();
  }).catch(() => {});
}


// Compact mobile filters/tools toggle
function initAdvancedToggle() {
  const advancedToggle = document.getElementById("advancedToggle");
  const advancedControls = document.getElementById("advancedControls");
  if (!advancedToggle || !advancedControls) return;

  function setOpen(open) {
    advancedControls.hidden = !open;
    advancedToggle.setAttribute("aria-expanded", String(open));
    advancedToggle.textContent = open ? "Hide filters & tools ▴" : "Show filters & tools ▾";
    try { localStorage.setItem("plu_advanced_open", open ? "1" : "0"); } catch {}
  }

  const savedOpen = localStorage.getItem("plu_advanced_open") === "1";
  setOpen(savedOpen);

  advancedToggle.addEventListener("click", function (event) {
    event.preventDefault();
    setOpen(advancedControls.hidden);
  });
}

initAdvancedToggle();
loadInitialData();
