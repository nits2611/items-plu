const SAVE_ON_BASE="https://www.saveonfoods.com/sm/planning/rsid/1982/results?q=",CSV_URL="./items.csv",STORAGE_CSV="plu_items_csv_current",STORAGE_HASH="plu_items_csv_hash",STORE="default-store";
let items=[],filter="all",deferredPrompt=null,scannerStream=null,scannerTimer=null;
const q=document.getElementById("q"),results=document.getElementById("results"),msg=document.getElementById("message"),count=document.getElementById("count"),syncStatus=document.getElementById("syncStatus");
const CODE128=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];

const localCatalogProvider=new LocalCatalogProvider({
  csvUrl:CSV_URL,
  storageCsvKey:STORAGE_CSV,
  storageHashKey:STORAGE_HASH,
  bundledItems:window.DEFAULT_ITEMS||[]
});
const cloudCatalogProvider=new GoogleSheetsCatalogProvider({
  apiUrl:window.AppConfig?.googleSheets?.apiUrl||"",
  storageCatalogKey:window.AppConfig?.catalog?.cacheKey,
  storageVersionKey:window.AppConfig?.catalog?.cacheVersionKey,
  storageUpdatedAtKey:window.AppConfig?.catalog?.cacheUpdatedAtKey,
  storeId:window.AppConfig?.catalog?.storeId
});
const catalogService=new CatalogService(localCatalogProvider,cloudCatalogProvider);

// Compatibility wrappers keep the existing UI code unchanged while all catalog
// parsing, normalization, caching, and update logic lives in the service layer.
const parseCSV=text=>catalogService.parseCsv(text);
const sha256Short=text=>catalogService.hashText(text);
const detectBrand=name=>catalogService.detectBrand(name);
const normalize=row=>catalogService.normalizeRow(row);
const rowsToItems=rows=>catalogService.rowsToItems(rows);
function setItemsFromCSV(text){items=catalogService.csvToItems(text);renderAll()}
async function loadInitialData(){
  try{
    const initial=await catalogService.loadInitialCatalog();
    items=initial.items;
    renderAll();
    setSync(initial.source==="cloud-cache"?"Loaded cached cloud catalog. Checking updates...":initial.source==="csv-cache"?"Loaded cached CSV. Checking updates...":"Loaded bundled data. Checking updates...");
  }catch(error){
    items=[];
    renderAll();
    setSync("Unable to load catalog data.","warn");
  }
  await checkForCSVUpdate();
}
async function checkForCSVUpdate(){
  try{
    const update=await catalogService.checkForUpdate();
    if(update.changed){
      items=update.items;
      renderAll();
      setSync(`${update.source==="google-sheets"?"Cloud catalog":"Data"} updated (${items.length} items).`);
    }else{
      setSync(`Data up to date (${items.length} items).`);
    }
  }catch(error){
    console.error("[Catalog sync] Update failed:", error);
    setSync(`Offline/cached mode (${items.length} items).`,"warn");
  }
}
function getJSON(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}function setJSON(k,v){localStorage.setItem(k,JSON.stringify(v))}
const key=n=>`plu_${STORE}_${n}`;const favs=()=>getJSON(key("favorites"),[]);const recents=()=>getJSON(key("recent"),[]);const order=()=>getJSON(key("order"),[]);
function isFav(code){return favs().includes(code)}function touch(code){let r=recents().filter(x=>x!==code);r.unshift(code);setJSON(key("recent"),r.slice(0,30))}
function toggleFav(code){let f=favs();f=f.includes(code)?f.filter(x=>x!==code):[code,...f];setJSON(key("favorites"),f);renderAll()}
function addOrder(item, qty, silent = false) {
  qty = String(qty || "").trim();

  if (!qty || Number(qty) <= 0) {
    const before = order();
    const after = before.filter(x => x.code !== item.code);
    setJSON(key("order"), after);
    touch(item.code);
    renderOrder();
    renderFavorites();
    renderRecent();
    if (!silent && before.length !== after.length) toast(`${item.item_name} removed from order`);
    return;
  }

  let current = order().filter(x => x.code !== item.code);
  current.unshift({
    code: item.code,
    qty,
    item_name: item.item_name,
    addedAt: new Date().toISOString()
  });
  setJSON(key("order"), current);
  touch(item.code);
  renderOrder();
  renderFavorites();
  renderRecent();
  if (!silent) toast(`${item.item_name} added to back stock: ${qty}`);
}

function getOrderQty(code) {
  const found = order().find(x => x.code === code);
  return found ? found.qty : "";
}

function toast(text) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}


function missingItems() {
  return getJSON(key("missing"), []);
}

function saveMissing(term) {
  term = String(term || "").trim();
  if (!term) return;
  let list = missingItems();
  const exists = list.some(x => String(x.term).toLowerCase() === term.toLowerCase());
  if (!exists) {
    list.unshift({ term, date: new Date().toISOString(), note: "" });
    setJSON(key("missing"), list.slice(0, 200));
  }
  renderMissing();
  toast(`Saved missing item: ${term}`);
}

function removeMissing(term) {
  setJSON(key("missing"), missingItems().filter(x => x.term !== term));
  renderMissing();
}

function saveOnSearchUrl(term) {
  return SAVE_ON_BASE + encodeURIComponent(String(term || "").trim());
}

function isOrg(x){return /(^ORG\b|ORGANIC)/i.test(x.item_name)}function isPackaged(x){return x.code.length>6||/packaged|upc/i.test(x.type)}
function getResults(){let a=items,terms=q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);if(filter==="produce")a=a.filter(x=>!isPackaged(x));if(filter==="packaged")a=a.filter(isPackaged);if(filter==="organic")a=a.filter(isOrg);if(terms.length)a=a.filter(x=>terms.every(t=>x.hay.includes(t)||x.item_name.toLowerCase().includes(t)||x.code.toLowerCase().includes(t)));return a.slice(0,100)}
function byCodes(codes){return codes.map(c=>items.find(x=>x.code===c)).filter(Boolean)}
function renderAll(){renderLookup();renderFavorites();renderRecent();renderOrder();renderMissing()}

function renderNotFound(term) {
  results.innerHTML = "";
  const clean = String(term || "").trim();
  hide();

  const card = document.createElement("section");
  card.className = "message not-found-panel";
  card.innerHTML = `
    <strong>No local match found.</strong>
    <p>${clean ? `Search/scanned value: <b></b>` : "Enter a keyword, PLU, or UPC to search."}</p>
    <div class="not-found-actions">
      <a class="button-link" target="_blank" rel="noopener">Check on Save-On</a>
      <button type="button">Add to Missing Items</button>
    </div>
  `;

  if (clean) card.querySelector("b").textContent = clean;
  const link = card.querySelector("a");
  link.href = saveOnSearchUrl(clean);
  link.toggleAttribute("hidden", !clean);

  const btn = card.querySelector("button");
  btn.disabled = !clean;
  btn.onclick = () => saveMissing(clean);

  results.appendChild(card);
  count.textContent = clean ? "0 found" : `${items.length} items`;
}

function renderLookup(){const a=getResults();results.innerHTML="";count.textContent=q.value.trim()?`${a.length} found`:`${items.length} items`;if(!a.length){renderNotFound(q.value.trim());return}hide();const f=document.createDocumentFragment();a.forEach(x=>f.appendChild(card(x)));results.appendChild(f)}
function renderFavorites(){const box=document.getElementById("favoritesResults");box.innerHTML="";const a=byCodes(favs());if(!a.length){box.innerHTML='<section class="message">No favorites yet. Tap ☆ on an item.</section>';return}a.forEach(x=>box.appendChild(card(x)))}
function renderRecent(){const box=document.getElementById("recentResults");box.innerHTML="";const a=byCodes(recents());if(!a.length){box.innerHTML='<section class="message">No recent items yet.</section>';return}a.forEach(x=>box.appendChild(card(x)))}
function renderOrder(){const box=document.getElementById("orderResults");box.innerHTML="";const o=order();if(!o.length){box.innerHTML='<section class="message">No back stock items yet. Add items from Lookup.</section>';return}o.forEach(row=>{const item=items.find(x=>x.code===row.code)||row;const e=document.createElement("article");e.className="order-item";e.innerHTML=`<div class="order-row"><div><h3></h3><div class="code"></div></div><div class="qty"></div></div><div class="barcode"></div><div class="actions"><button type="button">Edit Qty</button><button type="button">Remove</button></div>`;e.querySelector("h3").textContent=item.item_name;e.querySelector(".code").textContent=row.code;e.querySelector(".qty").textContent=row.qty;e.querySelector(".barcode").appendChild(code128SVG(row.code));e.querySelectorAll("button")[0].onclick=()=>{const q=prompt("Quantity:",row.qty);if(q){let arr=order();arr=arr.map(x=>x.code===row.code?{...x,qty:q}:x);setJSON(key("order"),arr);renderOrder()}};e.querySelectorAll("button")[1].onclick=()=>{setJSON(key("order"),order().filter(x=>x.code!==row.code));renderOrder()};box.appendChild(e)})}

function renderMissing() {
  const box = document.getElementById("missingResults");
  if (!box) return;
  box.innerHTML = "";
  const list = missingItems();

  if (!list.length) {
    box.innerHTML = '<section class="message">No missing items saved yet.</section>';
    return;
  }

  list.forEach(row => {
    const e = document.createElement("article");
    e.className = "order-item";
    const displayDate = row.date ? new Date(row.date).toLocaleString() : "";
    e.innerHTML = `<div class="order-row"><div><h3></h3><div class="code"></div></div></div><div class="actions"><a target="_blank" rel="noopener">Check Save-On</a><button type="button">Remove</button></div>`;
    e.querySelector("h3").textContent = row.term;
    e.querySelector(".code").textContent = displayDate;
    e.querySelector("a").href = saveOnSearchUrl(row.term);
    e.querySelector("button").onclick = () => removeMissing(row.term);
    box.appendChild(e);
  });
}

function card(x) {
  const e = document.createElement("article");
  e.className = "card " + (isOrg(x) ? "org" : "");
  const existingQty = getOrderQty(x.code);

  e.innerHTML = `<div class="top"><div class="thumb placeholder">No image</div><div><h2 class="name"></h2><div class="badges"></div><div class="code"></div></div></div><div class="barcode"></div><div class="order-inline"><div class="qty-line"><label>Qty</label><input class="qty-input" type="number" inputmode="decimal" min="0" step="1" placeholder="0"><span class="save-status"></span></div></div><div class="actions"><button class="fav" type="button"></button><button class="copy" type="button">Copy</button><a target="_blank" rel="noopener">Save-On</a></div>`;

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

  const qtyInput = e.querySelector(".qty-input");
  const saveStatus = e.querySelector(".save-status");
  qtyInput.value = existingQty || "";
  if (existingQty) {
    saveStatus.textContent = "Saved";
    saveStatus.classList.add("saved");
  }

  let saveTimer = null;
  qtyInput.addEventListener("input", () => {
    clearTimeout(saveTimer);
    const qty = qtyInput.value.trim();

    if (!qty || Number(qty) <= 0) {
      saveStatus.textContent = "Removed";
      saveStatus.classList.remove("saved");
      saveTimer = setTimeout(() => {
        addOrder(x, qty, true);
        saveStatus.textContent = "";
      }, 350);
      return;
    }

    saveStatus.textContent = "Saving...";
    saveStatus.classList.remove("saved");

    saveTimer = setTimeout(() => {
      addOrder(x, qty, true);
      saveStatus.textContent = "Saved";
      saveStatus.classList.add("saved");
    }, 450);
  });

  qtyInput.addEventListener("change", () => {
    const qty = qtyInput.value.trim();
    clearTimeout(saveTimer);
    addOrder(x, qty, true);
    if (qty && Number(qty) > 0) {
      saveStatus.textContent = "Saved";
      saveStatus.classList.add("saved");
    } else {
      saveStatus.textContent = "";
      saveStatus.classList.remove("saved");
    }
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

  const fav = e.querySelector(".fav");
  fav.textContent = isFav(x.code) ? "★" : "☆";
  fav.className = "fav " + (isFav(x.code) ? "fav-on" : "");
  fav.onclick = () => toggleFav(x.code);

  e.querySelector(".copy").onclick = async () => {
    try { await navigator.clipboard.writeText(x.code); } catch {}
    touch(x.code);
    e.querySelector(".copy").textContent = "Copied";
    setTimeout(() => e.querySelector(".copy").textContent = "Copy", 900);
    renderRecent();
  };

  const a = e.querySelector("a");
  a.href = SAVE_ON_BASE + encodeURIComponent(x.code);
  a.onclick = () => touch(x.code);

  return e;
}
function placeholder(){const d=document.createElement("div");d.className="thumb placeholder";d.textContent="No image";return d}
function code128SVG(v){v=String(v).trim();const numeric=/^\d+$/.test(v)&&v.length%2===0;let codes=[],sum;if(numeric){codes.push(105);sum=105;for(let i=0;i<v.length;i+=2){const c=Number(v.slice(i,i+2));codes.push(c);sum+=c*(codes.length-1)}}else{codes.push(104);sum=104;for(let i=0;i<v.length;i++){const c=v.charCodeAt(i)-32;codes.push(c);sum+=c*(codes.length-1)}}codes.push(sum%103,106);const mod=numeric&&v.length>6?2.05:2.3,h=58;let x=10,parts=[];for(const c of codes){const p=CODE128[c];if(!p)continue;for(let i=0;i<p.length;i++){const w=Number(p[i])*mod;if(i%2===0)parts.push(`<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${h}"/>`);x+=w}}x+=10;const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox",`0 0 ${Math.ceil(x)} ${h+18}`);svg.innerHTML=`<g fill="#000">${parts.join("")}</g><text x="${Math.ceil(x/2)}" y="${h+14}" text-anchor="middle" font-size="13" font-family="Arial" font-weight="700">${v}</text>`;return svg}
function show(t){msg.hidden=false;msg.textContent=t}function hide(){msg.hidden=true;msg.textContent=""}function setSync(t,l=""){syncStatus.textContent=t;syncStatus.className="sync-status "+l}
function switchView(v){document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===v));document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));document.getElementById(v+"View").classList.add("active");renderAll()}
q.addEventListener("input",renderLookup);document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>switchView(t.dataset.view));document.querySelectorAll(".filters button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;renderLookup()});
function initAdvancedToggle(){const btn=document.getElementById("advancedToggle"),controls=document.getElementById("advancedControls");if(!btn||!controls)return;function set(open){controls.hidden=!open;btn.setAttribute("aria-expanded",String(open));if (open) {
    btn.textContent = "✕";
  } else {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5H21L14 13V19L10 21V13L3 5Z"/></svg>`;
  }localStorage.setItem("plu_advanced_open",open?"1":"0")}set(localStorage.getItem("plu_advanced_open")==="1");btn.onclick=e=>{e.preventDefault();set(controls.hidden)}}
document.getElementById("csvUpload")?.addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const imported=await catalogService.importCsv(await f.text());items=imported.items;renderAll();setSync(`Uploaded CSV loaded (${items.length} items).`)}catch(error){setSync("Unable to import CSV.","warn")}});
document.getElementById("resetBtn").onclick=()=>{items=catalogService.reset();renderAll();checkForCSVUpdate()};document.getElementById("clearRecentBtn").onclick=()=>{setJSON(key("recent"),[]);renderRecent()};document.getElementById("clearOrderBtn").onclick=()=>{if(confirm("Clear back stock?")){setJSON(key("order"),[]);renderOrder()}};
document.getElementById("exportOrderBtn").onclick=()=>downloadCSV("back-stock.csv",["item_name,code,quantity",...order().map(o=>`"${(o.item_name||"").replaceAll('"','""')}",${o.code},"${String(o.qty).replaceAll('"','""')}"`)].join("\n"));document.getElementById("exportProfileBtn").onclick=()=>{const data={favorites:favs(),recent:recents(),order:order(),exportedAt:new Date().toISOString()};downloadFile("plu-profile.json",JSON.stringify(data,null,2),"application/json")};document.getElementById("importProfile")?.addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;const data=JSON.parse(await f.text());if(data.favorites)setJSON(key("favorites"),data.favorites);if(data.recent)setJSON(key("recent"),data.recent);if(data.order)setJSON(key("order"),data.order);renderAll()});
function downloadCSV(n,t){downloadFile(n,t,"text/csv")}function downloadFile(n,t,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([t],{type}));a.download=n;a.click();URL.revokeObjectURL(a.href)}
async function startScanner(){if(!("BarcodeDetector" in window)){alert("Camera barcode scanner is not supported in this browser. Try Android Chrome. Bluetooth scanner can still type into search.");return}const modal=document.getElementById("scannerModal"),video=document.getElementById("scannerVideo"),status=document.getElementById("scannerStatus");modal.hidden=false;status.textContent="Opening camera...";try{scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});video.srcObject=scannerStream;await video.play();const detector=new BarcodeDetector({formats:["code_128","ean_13","upc_a","upc_e","ean_8"]});status.textContent="Point camera at barcode.";scannerTimer=setInterval(async()=>{try{const codes=await detector.detect(video);if(codes.length){const val=codes[0].rawValue;stopScanner();q.value=val;touch(val);switchView("lookup");renderLookup();if(!getResults().length){renderNotFound(val)}}}catch{}},500)}catch(e){status.textContent="Camera unavailable. Check permission/HTTPS."}}
function stopScanner(){const modal=document.getElementById("scannerModal"),video=document.getElementById("scannerVideo");modal.hidden=true;if(scannerTimer)clearInterval(scannerTimer);scannerTimer=null;if(scannerStream)scannerStream.getTracks().forEach(t=>t.stop());scannerStream=null;video.srcObject=null}
document.getElementById("scanBtn").onclick=startScanner;document.getElementById("closeScannerBtn").onclick=stopScanner;
const exportMissingBtn = document.getElementById("exportMissingBtn");
if (exportMissingBtn) {
  exportMissingBtn.onclick = () => {
    const rows = ["term,date,note", ...missingItems().map(x => `"${String(x.term).replaceAll('"','""')}","${String(x.date||"").replaceAll('"','""')}","${String(x.note||"").replaceAll('"','""')}"`)];
    downloadCSV("missing-items.csv", rows.join("\n"));
  };
}


const importMissingCsv = document.getElementById("importMissingCsv");
if (importMissingCsv) {
  importMissingCsv.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const rows = parseCSV(text);

    if (!rows.length) {
      toast("No rows found in Missing CSV");
      return;
    }

    const existing = missingItems();
    const merged = [...existing];

    rows.forEach(row => {
      const term = String(row.term || row.code || row.search || row.scanned_value || "").trim();
      if (!term) return;

      const imported = {
        term,
        item_name: row.item_name || row.name || "",
        brand: row.brand || "",
        quantity: row.quantity || "",
        unit: row.unit || "",
        category: row.category || "",
        organic: row.organic || row.type_quality || row.organic_type || "",
        notes: row.notes || row.note || "",
        date: row.date || new Date().toISOString()
      };

      const idx = merged.findIndex(x => String(x.term).toLowerCase() === term.toLowerCase());
      if (idx >= 0) merged[idx] = { ...merged[idx], ...imported };
      else merged.unshift(imported);
    });

    setJSON(key("missing"), merged.slice(0, 300));
    renderMissing();
    toast(`Imported Missing CSV (${rows.length} rows)`);
    e.target.value = "";
  });
}

const clearMissingBtn = document.getElementById("clearMissingBtn");
if (clearMissingBtn) {
  clearMissingBtn.onclick = () => {
    if (confirm("Clear missing items?")) {
      setJSON(key("missing"), []);
      renderMissing();
    }
  };
}

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.getElementById("installBtn").hidden=false});document.getElementById("installBtn").onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById("installBtn").hidden=true}};if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js").then(r=>r.update?.()).catch(()=>{});
function initMobileBottomUI() {
  const isMobile = window.matchMedia("(max-width: 640px)").matches;
  document.body.classList.toggle("mobile-bottom-ui", isMobile);
}
window.addEventListener("resize", initMobileBottomUI);
initMobileBottomUI();


function initTopTools() {
  const btn = document.getElementById("topToolsBtn");
  const panel = document.getElementById("topToolsPanel");
  const close = document.getElementById("closeTopToolsBtn");
  if (!btn || !panel) return;

  function setOpen(open) {
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open) {
    btn.textContent = "✕";
  } else {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5H21L14 13V19L10 21V13L3 5Z"/></svg>`;
  }
  }

  btn.addEventListener("click", () => setOpen(panel.hidden));
  close?.addEventListener("click", () => setOpen(false));
}

initTopTools();
initAdvancedToggle();loadInitialData();


/* Missing details form v7 fixed - additive overrides */
(function(){
  function safeGetJSON(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}
  function safeSetJSON(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function storeKey(n){try{return key(n)}catch(e){return "plu_default-store_"+n}}

  window.openMissingForm = function(term, index = "") {
    const modal = document.getElementById("missingModal");
    if (!modal) return;

    const list = (typeof missingItems === "function") ? missingItems() : safeGetJSON(storeKey("missing"), []);
    const row = index !== "" ? list[Number(index)] : null;
    const value = row?.term || String(term || "").trim();

    document.getElementById("missingEditIndex").value = index;
    document.getElementById("missingTerm").value = value;
    document.getElementById("missingName").value = row?.item_name || "";
    document.getElementById("missingBrand").value = row?.brand || "";
    document.getElementById("missingQuantity").value = row?.quantity || "";
    document.getElementById("missingUnit").value = row?.unit || "";
    document.getElementById("missingCategory").value = row?.category || "";
    {
      const organicValue = row?.organic || "Conventional";
      document.querySelectorAll('input[name="missingOrganic"]').forEach(r => {
        r.checked = r.value === organicValue;
      });
    }
    document.getElementById("missingNotes").value = row?.notes || "";

    const link = document.getElementById("missingSaveOnLink");
    if (link) link.href = (typeof saveOnSearchUrl === "function") ? saveOnSearchUrl(value) : (SAVE_ON_BASE + encodeURIComponent(value));

    modal.hidden = false;
  };

  window.closeMissingForm = function() {
    const modal = document.getElementById("missingModal");
    if (modal) modal.hidden = true;
  };

  window.saveMissing = function(term) {
    term = String(term || "").trim();
    if (!term) return;
    openMissingForm(term);
  };

  window.saveMissingDetails = function(formData) {
    let list = (typeof missingItems === "function") ? missingItems() : safeGetJSON(storeKey("missing"), []);
    const editIndex = formData.editIndex;
    const row = {
      term: formData.term,
      item_name: formData.item_name,
      brand: formData.brand,
      quantity: formData.quantity,
      unit: formData.unit,
      category: formData.category,
      organic: formData.organic,
      notes: formData.notes,
      date: formData.date || new Date().toISOString()
    };

    if (editIndex !== "") {
      list[Number(editIndex)] = { ...list[Number(editIndex)], ...row };
    } else {
      const existingIndex = list.findIndex(x => String(x.term).toLowerCase() === String(row.term).toLowerCase());
      if (existingIndex >= 0) list[existingIndex] = { ...list[existingIndex], ...row };
      else list.unshift(row);
    }

    safeSetJSON(storeKey("missing"), list.slice(0, 200));
    if (typeof renderMissing === "function") renderMissing();
    closeMissingForm();
    if (typeof toast === "function") toast("Missing item saved");
  };

  const oldRenderMissing = window.renderMissing || (typeof renderMissing === "function" ? renderMissing : null);
  window.renderMissing = function() {
    const box = document.getElementById("missingResults");
    if (!box) return;
    box.innerHTML = "";
    const list = (typeof missingItems === "function") ? missingItems() : safeGetJSON(storeKey("missing"), []);

    if (!list.length) {
      box.innerHTML = '<section class="message">No missing items saved yet.</section>';
      return;
    }

    list.forEach((row, index) => {
      const e = document.createElement("article");
      e.className = "order-item missing-item";
      const displayDate = row.date ? new Date(row.date).toLocaleString() : "";
      const title = row.item_name || row.term;
      const size = [row.quantity, row.unit].filter(Boolean).join(" ");
      const meta = [
        row.brand ? `Brand: ${row.brand}` : "",
        size ? `Size: ${size}` : "",
        row.category ? `Category: ${row.category}` : "",
        row.organic ? `Type: ${row.organic}` : "",
        row.term ? `Code/Search: ${row.term}` : ""
      ].filter(Boolean).join(" • ");

      e.innerHTML = `
        <div class="order-row">
          <div>
            <h3></h3>
            <div class="code"></div>
            <div class="missing-date"></div>
            <div class="missing-notes" hidden></div>
          </div>
        </div>
        <div class="actions">
          <a target="_blank" rel="noopener">Check Save-On</a>
          <button type="button" class="edit-missing">Edit</button>
          <button type="button" class="remove-missing">Remove</button>
        </div>
      `;

      e.querySelector("h3").textContent = title;
      e.querySelector(".code").textContent = meta || row.term;
      e.querySelector(".missing-date").textContent = displayDate;
      const notes = e.querySelector(".missing-notes");
      if (row.notes) { notes.hidden = false; notes.textContent = row.notes; }
      e.querySelector("a").href = (typeof saveOnSearchUrl === "function") ? saveOnSearchUrl(row.term) : (SAVE_ON_BASE + encodeURIComponent(row.term));
      e.querySelector(".edit-missing").onclick = () => openMissingForm(row.term, index);
      e.querySelector(".remove-missing").onclick = () => {
        if (typeof removeMissing === "function") removeMissing(row.term);
        else {
          safeSetJSON(storeKey("missing"), list.filter(x => x.term !== row.term));
          renderMissing();
        }
      };
      box.appendChild(e);
    });
  };

  const closeBtn = document.getElementById("closeMissingModalBtn");
  if (closeBtn) closeBtn.onclick = closeMissingForm;

  const modal = document.getElementById("missingModal");
  if (modal) {
    modal.addEventListener("click", e => {
      if (e.target === modal) closeMissingForm();
    });
  }

  const form = document.getElementById("missingForm");
  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      saveMissingDetails({
        editIndex: document.getElementById("missingEditIndex").value,
        term: document.getElementById("missingTerm").value.trim(),
        item_name: document.getElementById("missingName").value.trim(),
        brand: document.getElementById("missingBrand").value.trim(),
        quantity: document.getElementById("missingQuantity").value.trim(),
        unit: document.getElementById("missingUnit").value.trim(),
        category: document.getElementById("missingCategory").value.trim(),
        organic: (document.querySelector('input[name="missingOrganic"]:checked')?.value || "Conventional").trim(),
        notes: document.getElementById("missingNotes").value.trim()
      });
    });
  }

  const exportBtn = document.getElementById("exportMissingBtn");
  if (exportBtn) {
    exportBtn.onclick = () => {
      const list = (typeof missingItems === "function") ? missingItems() : safeGetJSON(storeKey("missing"), []);
      const rows = [
        "term,item_name,brand,quantity,unit,category,organic,notes,date",
        ...list.map(x => [
          x.term || "", x.item_name || "", x.brand || "", x.quantity || "",
          x.unit || "", x.category || "", x.organic || "", x.notes || "", x.date || ""
        ].map(v => `"${String(v).replaceAll('"','""')}"`).join(","))
      ];
      if (typeof downloadCSV === "function") downloadCSV("missing-items.csv", rows.join("\n"));
    };
  }
})();


/* v12: promote missing items to local catalog + archive */
(function(){
  function csvEscape(v){ return `"${String(v ?? "").replaceAll('"','""')}"`; }

  function itemRowsToCSV(rows){
    const headers = ["item_name","code","quantity","brand","category","type","image_local","image_url","notes","aliases","search_keywords","organic"];
    const lines = [headers.join(",")];
    rows.forEach(r => {
      const obj = normalize ? r : r;
      const line = headers.map(h => csvEscape(obj[h] || "")).join(",");
      lines.push(line);
    });
    return lines.join("\n");
  }

  function currentItemsCSV(){
    const rows = (items || []).map(x => {
      const search = [x.item_name,x.code,x.quantity,x.brand,x.category,x.type,x.notes,x.aliases,x.organic].filter(Boolean).join(" ").toUpperCase();
      return {
        item_name:x.item_name || "",
        code:x.code || "",
        quantity:x.quantity || "",
        brand:x.brand || "",
        category:x.category || "",
        type:x.type || ((String(x.code).length > 6) ? "packaged" : "produce"),
        image_local:x.image_local || "",
        image_url:x.image_url || "",
        notes:x.notes || "",
        aliases:x.aliases || "",
        search_keywords:x.hay ? x.hay.toUpperCase() : search,
        organic:x.organic || (isOrg && isOrg(x) ? "Organic" : "Conventional")
      };
    });
    return itemRowsToCSV(rows);
  }

  function getSelectedMissingTerms(){
    return Array.from(document.querySelectorAll(".missing-select:checked")).map(x => x.value);
  }

  function missingToItem(row){
    const itemName = (row.item_name || row.term || "").trim();
    const code = String(row.term || "").trim();
    const quantity = row.quantity || "";
    const unit = row.unit || "";
    const quantityText = [quantity, unit].filter(Boolean).join(" ");
    const brand = row.brand || "";
    const category = row.category || "Uncategorized";
    const organic = row.organic || "Conventional";
    const aliases = [
      itemName,
      brand && itemName ? `${brand} ${itemName}` : "",
      quantityText ? `${itemName} ${quantityText}` : "",
      row.notes || ""
    ].filter(Boolean).join("; ");

    return {
      item_name: itemName,
      code,
      quantity: quantityText,
      brand,
      category,
      type: String(code).length > 6 ? "packaged" : "produce",
      image_local: "",
      image_url: "",
      notes: row.notes || "",
      aliases,
      search_keywords: [itemName, code, quantityText, brand, category, organic, aliases].filter(Boolean).join(" ").toUpperCase(),
      organic
    };
  }

  window.addMissingToCatalog = async function(terms){
    const allMissing = missingItems();
    const selected = allMissing.filter(x => terms.includes(String(x.term)));
    if (!selected.length) {
      toast("Select missing items first");
      return;
    }

    const existingCodes = new Set((items || []).map(x => String(x.code).trim().toLowerCase()));
    const newRows = selected.map(missingToItem).filter(x => x.item_name && x.code && !existingCodes.has(String(x.code).trim().toLowerCase()));

    if (!newRows.length) {
      toast("Selected items already exist or need details");
      return;
    }

    const existingCSV = currentItemsCSV();
    const newCSVLines = newRows.map(r => {
      const headers = ["item_name","code","quantity","brand","category","type","image_local","image_url","notes","aliases","search_keywords","organic"];
      return headers.map(h => csvEscape(r[h] || "")).join(",");
    });
    const updatedCSV = existingCSV + "\n" + newCSVLines.join("\n");

    const hash = (typeof sha256Short === "function") ? await sha256Short(updatedCSV) : String(Date.now());
    localStorage.setItem(STORAGE_CSV, updatedCSV);
    localStorage.setItem(STORAGE_HASH, hash);
    setItemsFromCSV(updatedCSV);

    // remove promoted items from missing list
    setJSON(key("missing"), allMissing.filter(x => !terms.includes(String(x.term))));
    renderMissing();
    toast(`Added ${newRows.length} item(s) to catalog`);
  };

  window.archiveMissingItems = function(terms){
    if (!terms.length) {
      toast("Select missing items first");
      return;
    }
    const archived = getJSON(key("missing_archived"), []);
    const allMissing = missingItems();
    const selected = allMissing.filter(x => terms.includes(String(x.term)));
    setJSON(key("missing_archived"), [...selected, ...archived].slice(0,500));
    setJSON(key("missing"), allMissing.filter(x => !terms.includes(String(x.term))));
    renderMissing();
    toast(`Archived ${selected.length} missing item(s)`);
  };

  // Override renderMissing to include selection checkboxes
  window.renderMissing = function(){
    const box = document.getElementById("missingResults");
    if (!box) return;
    box.innerHTML = "";
    const list = missingItems();

    if (!list.length) {
      box.innerHTML = '<section class="message">No missing items saved yet.</section>';
      return;
    }

    list.forEach((row, index) => {
      const e = document.createElement("article");
      e.className = "order-item missing-item";
      const displayDate = row.date ? new Date(row.date).toLocaleString() : "";
      const title = row.item_name || row.term;
      const size = [row.quantity, row.unit].filter(Boolean).join(" ");
      const meta = [
        row.brand ? `Brand: ${row.brand}` : "",
        size ? `Size: ${size}` : "",
        row.category ? `Category: ${row.category}` : "",
        row.organic ? `Type: ${row.organic}` : "",
        row.term ? `Code/Search: ${row.term}` : ""
      ].filter(Boolean).join(" • ");

      e.innerHTML = `
        <div class="missing-row-head">
          <label class="missing-check"><input class="missing-select" type="checkbox" value=""> Select</label>
        </div>
        <div class="order-row">
          <div>
            <h3></h3>
            <div class="code"></div>
            <div class="missing-date"></div>
            <div class="missing-notes" hidden></div>
          </div>
        </div>
        <div class="actions">
          <a target="_blank" rel="noopener">Check Save-On</a>
          <button type="button" class="edit-missing">Edit</button>
          <button type="button" class="remove-missing">Remove</button>
        </div>
      `;

      const check = e.querySelector(".missing-select");
      check.value = row.term || "";
      e.querySelector("h3").textContent = title;
      e.querySelector(".code").textContent = meta || row.term;
      e.querySelector(".missing-date").textContent = displayDate;
      const notes = e.querySelector(".missing-notes");
      if (row.notes) { notes.hidden = false; notes.textContent = row.notes; }
      e.querySelector("a").href = (typeof saveOnSearchUrl === "function") ? saveOnSearchUrl(row.term) : (SAVE_ON_BASE + encodeURIComponent(row.term));
      e.querySelector(".edit-missing").onclick = () => openMissingForm(row.term, index);
      e.querySelector(".remove-missing").onclick = () => removeMissing(row.term);
      box.appendChild(e);
    });
  };

  const addBtn = document.getElementById("addMissingToCatalogBtn");
  if (addBtn) addBtn.onclick = () => addMissingToCatalog(getSelectedMissingTerms());

  const archiveBtn = document.getElementById("archiveMissingBtn");
  if (archiveBtn) archiveBtn.onclick = () => archiveMissingItems(getSelectedMissingTerms());

  const exportItemsBtn = document.getElementById("exportItemsBtn");
  if (exportItemsBtn) exportItemsBtn.onclick = () => downloadCSV("items.csv", currentItemsCSV());

  // re-render after override
  if (typeof renderMissing === "function") renderMissing();
})();


/* v13 archive seasonal */
(function(){
function truthy(v){return ["yes","true","1","y","archived","seasonal"].includes(String(v||"").trim().toLowerCase())}
function csvEscape(v){return `"${String(v??"").replaceAll('"','""')}"`}
function archivedCodes(){return getJSON(key("catalog_archived_codes"),[])}
function setArchivedCodes(v){setJSON(key("catalog_archived_codes"),Array.from(new Set(v.map(String))))}
function isArchivedItem(x){return truthy(x?.is_archived)||archivedCodes().includes(String(x?.code||""))}
function isSeasonalItem(x){return truthy(x?.is_seasonal)||!!String(x?.season||"").trim()||!!String(x?.festival||"").trim()}

const oldNormalize=normalize;
window.normalize=function(row){const x=oldNormalize(row);x.organic=row.organic||x.organic||(/(^ORG\b|ORGANIC)/i.test(x.item_name)?"Organic":"Conventional");x.is_archived=row.is_archived||row.archived||"";x.is_seasonal=row.is_seasonal||row.seasonal||"";x.season=row.season||"";x.festival=row.festival||"";return x};

window.getResults=function(){let a=(items||[]).filter(x=>!isArchivedItem(x));const terms=q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);if(filter==="produce")a=a.filter(x=>!isPackaged(x));if(filter==="packaged")a=a.filter(isPackaged);if(filter==="organic")a=a.filter(isOrg);if(filter==="seasonal")a=a.filter(isSeasonalItem);if(terms.length)a=a.filter(x=>terms.every(t=>x.hay.includes(t)||x.item_name.toLowerCase().includes(t)||x.code.toLowerCase().includes(t)||String(x.season||"").toLowerCase().includes(t)||String(x.festival||"").toLowerCase().includes(t)));return a.slice(0,100)};

window.archiveCatalogItem=function(code){const a=archivedCodes();if(!a.includes(String(code)))a.unshift(String(code));setArchivedCodes(a);renderAll();toast("Item archived")};
window.restoreCatalogItem=function(code){setArchivedCodes(archivedCodes().filter(x=>x!==String(code)));renderAll();toast("Item restored")};

const oldCard=card;
window.card=function(x){const e=oldCard(x);const badges=e.querySelector(".badges");if(badges&&isSeasonalItem(x)){const s=document.createElement("span");s.className="badge seasonal";s.textContent=[x.season,x.festival].filter(Boolean).join(" / ")||"Seasonal";badges.appendChild(s)}const actions=e.querySelector(".actions");if(actions&&!actions.querySelector(".archive-catalog")){const b=document.createElement("button");b.type="button";b.className="archive-catalog";b.textContent="Archive";b.onclick=()=>archiveCatalogItem(x.code);actions.appendChild(b);actions.style.gridTemplateColumns="repeat(4,1fr)"}return e};

window.renderArchive=function(){const box=document.getElementById("archiveResults");if(!box)return;box.innerHTML="";const arr=(items||[]).filter(isArchivedItem);if(!arr.length){box.innerHTML='<section class="message">No archived catalog items yet.</section>';return}arr.forEach(x=>{const e=document.createElement("article");e.className="card archive-card";e.innerHTML='<div class="top"><div class="thumb placeholder">Archived</div><div><h2 class="name"></h2><div class="badges"></div><div class="code"></div></div></div><div class="actions"><button type="button" class="restore-catalog">Restore</button><a target="_blank" rel="noopener">Check Save-On</a></div>';e.querySelector(".name").textContent=x.item_name;e.querySelector(".code").textContent=x.code;const bd=e.querySelector(".badges");[x.brand,x.quantity,x.category,x.organic,x.season,x.festival].filter(Boolean).forEach(v=>{const s=document.createElement("span");s.className="badge";s.textContent=v;bd.appendChild(s)});e.querySelector(".restore-catalog").onclick=()=>restoreCatalogItem(x.code);e.querySelector("a").href=SAVE_ON_BASE+encodeURIComponent(x.code);box.appendChild(e)})};

const oldRenderAll=renderAll;window.renderAll=function(){oldRenderAll();renderArchive()};

window.currentItemsCSV=function(){const headers=["item_name","code","quantity","brand","category","type","image_local","image_url","notes","aliases","search_keywords","organic","is_archived","is_seasonal","season","festival"];const lines=[headers.join(",")];(items||[]).forEach(x=>{const search=[x.item_name,x.code,x.quantity,x.brand,x.category,x.type,x.notes,x.aliases,x.organic,x.season,x.festival].filter(Boolean).join(" ").toUpperCase();const row={item_name:x.item_name||"",code:x.code||"",quantity:x.quantity||"",brand:x.brand||"",category:x.category||"",type:x.type||((String(x.code).length>6)?"packaged":"produce"),image_local:x.image_local||"",image_url:x.image_url||"",notes:x.notes||"",aliases:x.aliases||"",search_keywords:x.hay?x.hay.toUpperCase():search,organic:x.organic||(isOrg(x)?"Organic":"Conventional"),is_archived:isArchivedItem(x)?"Yes":"",is_seasonal:isSeasonalItem(x)?"Yes":"",season:x.season||"",festival:x.festival||""};lines.push(headers.map(h=>csvEscape(row[h]||"")).join(","))});return lines.join("\n")};

const exportItemsBtn=document.getElementById("exportItemsBtn");if(exportItemsBtn)exportItemsBtn.onclick=()=>downloadCSV("items.csv",currentItemsCSV());
const exportArchiveBtn=document.getElementById("exportArchiveBtn");if(exportArchiveBtn)exportArchiveBtn.onclick=()=>{const h=["item_name","code","quantity","brand","category","organic","season","festival"];const lines=[h.join(","),...(items||[]).filter(isArchivedItem).map(x=>h.map(k=>csvEscape(x[k]||"")).join(","))];downloadCSV("archived-items.csv",lines.join("\n"))};

const oldOpenMissingForm=window.openMissingForm;if(oldOpenMissingForm)window.openMissingForm=function(term,index=""){oldOpenMissingForm(term,index);const row=index!==""?missingItems()[Number(index)]:null;const s=document.getElementById("missingSeasonal");if(s)s.checked=truthy(row?.is_seasonal);const season=document.getElementById("missingSeason");if(season)season.value=row?.season||"";const festival=document.getElementById("missingFestival");if(festival)festival.value=row?.festival||""};
const oldSaveMissingDetails=window.saveMissingDetails;if(oldSaveMissingDetails)window.saveMissingDetails=function(fd){fd.is_seasonal=document.getElementById("missingSeasonal")?.checked?"Yes":"";fd.season=document.getElementById("missingSeason")?.value.trim()||"";fd.festival=document.getElementById("missingFestival")?.value.trim()||"";oldSaveMissingDetails(fd)};
renderAll();
})();


/* v14: delete archived catalog item + image fields */
(function(){
  function csvEscape(v){ return `"${String(v ?? "").replaceAll('"','""')}"`; }

  function saveCurrentItemsToLocalStorage(rows){
    const headers = ["item_name","code","quantity","brand","category","type","image_local","image_url","notes","aliases","search_keywords","organic","is_archived","is_seasonal","season","festival"];
    const lines = [headers.join(",")];

    rows.forEach(x => {
      const search = [x.item_name,x.code,x.quantity,x.brand,x.category,x.type,x.notes,x.aliases,x.organic,x.season,x.festival].filter(Boolean).join(" ").toUpperCase();
      const row = {
        item_name:x.item_name||"",
        code:x.code||"",
        quantity:x.quantity||"",
        brand:x.brand||"",
        category:x.category||"",
        type:x.type||((String(x.code).length>6)?"packaged":"produce"),
        image_local:x.image_local||"",
        image_url:x.image_url||"",
        notes:x.notes||"",
        aliases:x.aliases||"",
        search_keywords:x.hay?x.hay.toUpperCase():search,
        organic:x.organic||(isOrg(x)?"Organic":"Conventional"),
        is_archived:(getJSON(key("catalog_archived_codes"),[]).includes(String(x.code)) || String(x.is_archived||"").toLowerCase()==="yes")?"Yes":"",
        is_seasonal:(String(x.is_seasonal||"").toLowerCase()==="yes" || x.season || x.festival)?"Yes":"",
        season:x.season||"",
        festival:x.festival||""
      };
      lines.push(headers.map(h=>csvEscape(row[h]||"")).join(","));
    });

    const csv = lines.join("\n");
    localStorage.setItem(STORAGE_CSV, csv);
    if (typeof sha256Short === "function") {
      sha256Short(csv).then(hash => localStorage.setItem(STORAGE_HASH, hash));
    } else {
      localStorage.setItem(STORAGE_HASH, String(Date.now()));
    }
    setItemsFromCSV(csv);
  }

  window.deleteCatalogItemPermanently = function(code){
    if(!confirm("Delete this item permanently from local catalog? Export Items CSV after this if you want to update GitHub.")) return;
    const codeStr = String(code);
    const remaining = (items || []).filter(x => String(x.code) !== codeStr);
    const archived = getJSON(key("catalog_archived_codes"),[]).filter(x => String(x) !== codeStr);
    setJSON(key("catalog_archived_codes"), archived);
    saveCurrentItemsToLocalStorage(remaining);
    if (typeof renderArchive === "function") renderArchive();
    toast("Item deleted from local catalog");
  };

  // Override archive renderer to include Delete button and image preview where available.
  window.renderArchive = function(){
    const box = document.getElementById("archiveResults");
    if(!box) return;
    box.innerHTML = "";

    const archivedCodes = getJSON(key("catalog_archived_codes"),[]);
    const archived = (items || []).filter(x => archivedCodes.includes(String(x.code)) || String(x.is_archived||"").toLowerCase()==="yes");

    if(!archived.length){
      box.innerHTML = '<section class="message">No archived catalog items yet.</section>';
      return;
    }

    archived.forEach(x => {
      const e = document.createElement("article");
      e.className = "card archive-card";
      e.innerHTML = `
        <div class="top">
          <div class="thumb placeholder">Archived</div>
          <div>
            <h2 class="name"></h2>
            <div class="badges"></div>
            <div class="code"></div>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="restore-catalog">Restore</button>
          <button type="button" class="delete-catalog danger">Delete</button>
          <a target="_blank" rel="noopener">Save-On</a>
        </div>
      `;

      const src = x.image_local || x.image_url;
      if (src) {
        const img = document.createElement("img");
        img.className = "thumb";
        img.alt = x.item_name;
        img.src = src;
        img.onerror = () => {};
        e.querySelector(".thumb").replaceWith(img);
      }

      e.querySelector(".name").textContent = x.item_name;
      e.querySelector(".code").textContent = x.code;
      const bd=e.querySelector(".badges");
      [x.brand,x.quantity,x.category,x.organic,x.season,x.festival].filter(Boolean).forEach(v=>{
        const s=document.createElement("span"); s.className="badge"; s.textContent=v; bd.appendChild(s);
      });
      e.querySelector(".restore-catalog").onclick = () => restoreCatalogItem(x.code);
      e.querySelector(".delete-catalog").onclick = () => deleteCatalogItemPermanently(x.code);
      e.querySelector("a").href = SAVE_ON_BASE + encodeURIComponent(x.code);
      box.appendChild(e);
    });
  };

  // Add image fields to missing form open/save behavior.
  const oldOpenMissingFormV14 = window.openMissingForm;
  if(oldOpenMissingFormV14){
    window.openMissingForm = function(term,index=""){
      oldOpenMissingFormV14(term,index);
      const row = index !== "" ? missingItems()[Number(index)] : null;
      const imgUrl = document.getElementById("missingImageUrl");
      if(imgUrl) imgUrl.value = row?.image_url || "";
      const imgLocal = document.getElementById("missingImageLocal");
      if(imgLocal) imgLocal.value = row?.image_local || "";
    };
  }

  const oldSaveMissingDetailsV14 = window.saveMissingDetails;
  if(oldSaveMissingDetailsV14){
    window.saveMissingDetails = function(formData){
      formData.image_url = document.getElementById("missingImageUrl")?.value.trim() || "";
      formData.image_local = document.getElementById("missingImageLocal")?.value.trim() || "";
      oldSaveMissingDetailsV14(formData);
    };
  }

  // Improve missingToItem if available through Add to Catalog wrapper:
  // After adding to catalog, rebuild catalog rows with image fields when possible.
  const oldAddMissingToCatalogV14 = window.addMissingToCatalog;
  if(oldAddMissingToCatalogV14){
    window.addMissingToCatalog = async function(terms){
      const selectedBefore = missingItems().filter(x => terms.includes(String(x.term)));
      await oldAddMissingToCatalogV14(terms);

      // Current catalog promotion already keeps search working.
      // Image fields are preserved in missing export; for permanent catalog images, export Items CSV after promotion.
    };
  }

  // Export CSV should include image columns if export button is present.
  const exportMissingBtn = document.getElementById("exportMissingBtn");
  if(exportMissingBtn){
    exportMissingBtn.onclick = () => {
      const rows = [
        "term,item_name,brand,quantity,unit,category,organic,is_seasonal,season,festival,image_url,image_local,notes,date",
        ...missingItems().map(x => [
          x.term||"", x.item_name||"", x.brand||"", x.quantity||"", x.unit||"", x.category||"",
          x.organic||"", x.is_seasonal||"", x.season||"", x.festival||"",
          x.image_url||"", x.image_local||"", x.notes||"", x.date||""
        ].map(v => `"${String(v).replaceAll('"','""')}"`).join(","))
      ];
      downloadCSV("missing-items.csv", rows.join("\n"));
    };
  }

  if(typeof renderArchive === "function") renderArchive();
})();


/* v16 tools modal behavior */
(function(){
  const panel = document.getElementById("topToolsPanel");
  const backdrop = panel?.querySelector(".top-tools-backdrop");
  const btn = document.getElementById("topToolsBtn");
  const close = document.getElementById("closeTopToolsBtn");

  function setOpen(open){
    if(!panel || !btn) return;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "✕" : "⚙️";
    document.body.classList.toggle("tools-open", open);
  }

  if(btn){
    btn.onclick = () => setOpen(panel.hidden);
  }
  if(close){
    close.onclick = () => setOpen(false);
  }
  if(backdrop){
    backdrop.onclick = () => setOpen(false);
  }
})();


/* v17 mobile search drawer + draggable search button */
(function(){
  const fab = document.getElementById("mobileSearchFab");
  const closeBtn = document.getElementById("closeSearchDrawerBtn");

  function isMobile(){
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function setSearchOpen(open){
    if(!isMobile()) {
      document.body.classList.remove("search-drawer-closed");
      return;
    }
    document.body.classList.toggle("search-drawer-closed", !open);
    try{ localStorage.setItem("search_drawer_open", open ? "1" : "0"); }catch{}
  }

  function initSearchDrawerState(){
    if(!isMobile()) {
      document.body.classList.remove("search-drawer-closed");
      return;
    }
    const saved = localStorage.getItem("search_drawer_open");
    setSearchOpen(saved === null ? true : saved === "1");
  }

  if(fab){
    fab.addEventListener("click", e => {
      if(fab.dataset.dragging === "1") return;
      setSearchOpen(true);
      setTimeout(()=>document.getElementById("q")?.focus(), 80);
    });

    // Restore FAB position.
    try{
      const pos = JSON.parse(localStorage.getItem("search_fab_pos") || "null");
      if(pos && typeof pos.left === "number" && typeof pos.top === "number"){
        fab.style.left = pos.left + "px";
        fab.style.top = pos.top + "px";
        fab.style.right = "auto";
        fab.style.bottom = "auto";
      }
    }catch{}

    let dragging = false, moved = false, startX = 0, startY = 0, baseLeft = 0, baseTop = 0;

    function pointerDown(e){
      if(!isMobile()) return;
      dragging = true;
      moved = false;
      fab.dataset.dragging = "0";
      const p = e.touches ? e.touches[0] : e;
      startX = p.clientX;
      startY = p.clientY;
      const rect = fab.getBoundingClientRect();
      baseLeft = rect.left;
      baseTop = rect.top;
      fab.setPointerCapture?.(e.pointerId);
    }

    function pointerMove(e){
      if(!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - startX;
      const dy = p.clientY - startY;
      if(Math.abs(dx) + Math.abs(dy) > 8){
        moved = true;
        fab.dataset.dragging = "1";
      }
      if(!moved) return;
      const size = fab.offsetWidth || 56;
      const margin = 8;
      const left = Math.max(margin, Math.min(window.innerWidth - size - margin, baseLeft + dx));
      const top = Math.max(margin, Math.min(window.innerHeight - size - margin, baseTop + dy));
      fab.style.left = left + "px";
      fab.style.top = top + "px";
      fab.style.right = "auto";
      fab.style.bottom = "auto";
      e.preventDefault?.();
    }

    function pointerUp(){
      if(!dragging) return;
      dragging = false;
      const rect = fab.getBoundingClientRect();
      try{ localStorage.setItem("search_fab_pos", JSON.stringify({left: rect.left, top: rect.top})); }catch{}
      setTimeout(()=>{ fab.dataset.dragging = "0"; }, 80);
    }

    fab.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointermove", pointerMove, {passive:false});
    window.addEventListener("pointerup", pointerUp);
  }

  if(closeBtn){
    closeBtn.addEventListener("click", () => setSearchOpen(false));
  }

  window.addEventListener("resize", initSearchDrawerState);
  initSearchDrawerState();
})();


/* v18: robust Data & Backup Tools modal fix */
(function(){
  function ready(fn){
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function(){
    const btn = document.getElementById("topToolsBtn");
    const panel = document.getElementById("topToolsPanel");
    const close = document.getElementById("closeTopToolsBtn");
    const backdrop = panel?.querySelector(".top-tools-backdrop");

    if(!btn || !panel) return;

    function openTools(){
      panel.hidden = false;
      panel.style.display = "flex";
      btn.setAttribute("aria-expanded", "true");
      btn.textContent = "✕";
      document.body.classList.add("tools-open");
    }

    function closeTools(){
      panel.hidden = true;
      panel.style.display = "";
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "⚙️";
      document.body.classList.remove("tools-open");
    }

    function toggleTools(event){
      event.preventDefault();
      event.stopPropagation();
      if(panel.hidden || getComputedStyle(panel).display === "none") openTools();
      else closeTools();
    }

    btn.onclick = null;
    btn.addEventListener("click", toggleTools, true);

    if(close){
      close.onclick = null;
      close.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        closeTools();
      }, true);
    }

    if(backdrop){
      backdrop.onclick = null;
      backdrop.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        closeTools();
      }, true);
    }

    document.addEventListener("keydown", function(e){
      if(e.key === "Escape" && !panel.hidden) closeTools();
    });
  });
})();


/* v19 navigation redesign */
(function(){
  function ready(fn){ if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",fn); else fn(); }

  ready(function(){
    const settingsBtn = document.getElementById("topToolsBtn");
    const settingsMenu = document.getElementById("settingsMenu");
    const dataBtn = document.getElementById("openDataToolsBtn");
    const missingBtn = document.getElementById("openMissingBtn");
    const archiveBtn = document.getElementById("openArchiveBtn");
    const toolsPanel = document.getElementById("topToolsPanel");
    const closeTools = document.getElementById("closeTopToolsBtn");
    const toolsBackdrop = toolsPanel?.querySelector(".top-tools-backdrop");

    function closeSettingsMenu(){ if(settingsMenu) settingsMenu.hidden = true; if(settingsBtn) settingsBtn.setAttribute("aria-expanded","false"); }
    function toggleSettingsMenu(e){
      e.preventDefault(); e.stopPropagation();
      if(settingsMenu?.hidden){ settingsMenu.hidden = false; settingsBtn?.setAttribute("aria-expanded","true"); }
      else closeSettingsMenu();
    }
    function openToolsModal(){
      closeSettingsMenu();
      if(!toolsPanel) return;
      toolsPanel.hidden = false;
      toolsPanel.style.display = "flex";
      document.body.classList.add("tools-open");
    }
    function closeToolsModal(){
      if(!toolsPanel) return;
      toolsPanel.hidden = true;
      toolsPanel.style.display = "";
      document.body.classList.remove("tools-open");
    }

    if(settingsBtn){
      settingsBtn.onclick = null;
      settingsBtn.addEventListener("click", toggleSettingsMenu, true);
    }
    document.addEventListener("click", function(e){
      if(!settingsMenu || settingsMenu.hidden) return;
      if(settingsMenu.contains(e.target) || settingsBtn?.contains(e.target)) return;
      closeSettingsMenu();
    });
    if(dataBtn) dataBtn.onclick = openToolsModal;
    if(missingBtn) missingBtn.onclick = () => { closeSettingsMenu(); switchView("missing"); };
    if(archiveBtn) archiveBtn.onclick = () => { closeSettingsMenu(); switchView("archive"); };
    if(closeTools) closeTools.onclick = closeToolsModal;
    if(toolsBackdrop) toolsBackdrop.onclick = closeToolsModal;

    const startFront = document.getElementById("startFrontStockBtn");
    if(startFront) startFront.onclick = () => switchView("frontStock");
    const backToBack = document.getElementById("backToBackStockBtn");
    if(backToBack) backToBack.onclick = () => switchView("order");

    const exportOrderBtn = document.getElementById("exportOrderBtn");
    if(exportOrderBtn){
      exportOrderBtn.textContent = "Export CSV";
      exportOrderBtn.onclick = () => downloadCSV("back-stock.csv",["item_name,code,quantity",...order().map(o=>`"${(o.item_name||"").replaceAll('"','""')}",${o.code},"${String(o.qty).replaceAll('"','""')}"`)].join("\n"));
    }
  });

  const oldCard = window.card || (typeof card !== "undefined" ? card : null);
  if(oldCard){
    function iconize(el, icon, label){
      if(!el || el.dataset.iconized === "1") return;
      el.dataset.iconized = "1";
      el.innerHTML = `<span class="action-icon">${icon}</span><span class="action-label">${label}</span>`;
    }
    window.card = function(x){
      const e = oldCard(x);
      iconize(e.querySelector(".fav"), isFav(x.code) ? "★" : "☆", "Fav");
      iconize(e.querySelector(".copy"), "📋", "Copy");
      iconize(e.querySelector(".archive-catalog"), "🗄️", "Archive");
      const a = e.querySelector('a[target="_blank"]');
      iconize(a, "🌐", "Save-On");
      return e;
    };
  }
})();


/* v20: settings menu fix, compact page tools, qty plus/minus */
(function(){
  function ready(fn){ if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",fn); else fn(); }

  ready(function(){
    const settingsBtn = document.getElementById("topToolsBtn");
    const settingsMenu = document.getElementById("settingsMenu");
    const toolsPanel = document.getElementById("topToolsPanel");
    const dataBtn = document.getElementById("openDataToolsBtn");
    const closeTools = document.getElementById("closeTopToolsBtn");
    const toolsBackdrop = toolsPanel?.querySelector(".top-tools-backdrop");

    function closeToolsModal(){
      if(!toolsPanel) return;
      toolsPanel.hidden = true;
      toolsPanel.style.display = "";
      document.body.classList.remove("tools-open");
    }

    function openToolsModal(){
      if(settingsMenu) settingsMenu.hidden = true;
      if(!toolsPanel) return;
      toolsPanel.hidden = false;
      toolsPanel.style.display = "flex";
      document.body.classList.add("tools-open");
    }

    function toggleSettingsOnly(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      closeToolsModal();
      if(!settingsMenu) return;
      settingsMenu.hidden = !settingsMenu.hidden;
      settingsBtn?.setAttribute("aria-expanded", String(!settingsMenu.hidden));
    }

    if(settingsBtn){
      // Replace older listeners by cloning button.
      const newBtn = settingsBtn.cloneNode(true);
      settingsBtn.parentNode.replaceChild(newBtn, settingsBtn);
      newBtn.addEventListener("click", toggleSettingsOnly, true);
    }

    const refreshedDataBtn = document.getElementById("openDataToolsBtn");
    if(refreshedDataBtn){
      refreshedDataBtn.onclick = function(e){
        e.preventDefault();
        e.stopPropagation();
        openToolsModal();
      };
    }
    if(closeTools) closeTools.onclick = closeToolsModal;
    if(toolsBackdrop) toolsBackdrop.onclick = closeToolsModal;

    document.addEventListener("click", function(e){
      const currentBtn = document.getElementById("topToolsBtn");
      if(settingsMenu && !settingsMenu.hidden && !settingsMenu.contains(e.target) && !currentBtn?.contains(e.target)){
        settingsMenu.hidden = true;
      }
    });

    // Make page action areas collapsible to save vertical space.
    document.querySelectorAll(".section-head").forEach((head, idx) => {
      const actions = head.querySelector(".order-actions");
      if(!actions || head.querySelector(".section-tools-toggle")) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "section-tools-toggle";
      btn.textContent = "Tools ▾";
      btn.setAttribute("aria-expanded", "false");

      actions.hidden = true;
      head.appendChild(btn);

      btn.addEventListener("click", () => {
        const open = actions.hidden;
        actions.hidden = !open;
        btn.textContent = open ? "Hide tools ▴" : "Tools ▾";
        btn.setAttribute("aria-expanded", String(open));
      });
    });
  });

  // Enhance quantity input with -/+ buttons.
  function enhanceQtyControls(root=document){
    root.querySelectorAll(".qty-line").forEach(line => {
      if(line.dataset.stepper === "1") return;
      const input = line.querySelector(".qty-input");
      if(!input) return;

      line.dataset.stepper = "1";
      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "qty-step qty-minus";
      minus.textContent = "−";

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "qty-step qty-plus";
      plus.textContent = "+";

      input.insertAdjacentElement("beforebegin", minus);
      input.insertAdjacentElement("afterend", plus);

      function bump(delta){
        const current = Number(input.value || 0);
        let next = current + delta;
        if(next < 0) next = 0;
        input.value = String(next);
        input.dispatchEvent(new Event("input", {bubbles:true}));
        input.dispatchEvent(new Event("change", {bubbles:true}));
      }

      minus.onclick = () => bump(-1);
      plus.onclick = () => bump(1);
    });
  }

  const oldRenderLookup = window.renderLookup || (typeof renderLookup !== "undefined" ? renderLookup : null);
  if(oldRenderLookup){
    window.renderLookup = function(){
      oldRenderLookup();
      enhanceQtyControls(document);
    };
  }

  const oldRenderFavorites = window.renderFavorites || (typeof renderFavorites !== "undefined" ? renderFavorites : null);
  if(oldRenderFavorites){
    window.renderFavorites = function(){
      oldRenderFavorites();
      enhanceQtyControls(document);
    };
  }

  const oldRenderRecent = window.renderRecent || (typeof renderRecent !== "undefined" ? renderRecent : null);
  if(oldRenderRecent){
    window.renderRecent = function(){
      oldRenderRecent();
      enhanceQtyControls(document);
    };
  }

  setTimeout(()=>enhanceQtyControls(document), 300);
})();


/* v21: card action icons load fix */
(function(){
  function iconize(el, icon, label){
    if(!el || el.dataset.iconized === "1") return;
    el.dataset.iconized = "1";
    el.innerHTML = `<span class="action-icon">${icon}</span><span class="action-label">${label}</span>`;
  }

  function iconizeAllCards(){
    document.querySelectorAll(".card").forEach(card => {
      const fav = card.querySelector(".fav");
      if(fav) iconize(fav, fav.classList.contains("fav-on") ? "★" : "☆", "Fav");

      iconize(card.querySelector(".copy"), "📋", "Copy");
      iconize(card.querySelector(".archive-catalog"), "🗄️", "Archive");

      const saveOn = card.querySelector('a[target="_blank"]');
      if(saveOn && /save-on/i.test(saveOn.textContent || "")) {
        iconize(saveOn, "🌐", "Save-On");
      }
    });
  }

  // Patch render functions so initial page load also gets icons.
  ["renderLookup","renderFavorites","renderRecent","renderArchive"].forEach(fnName => {
    const original = window[fnName] || (typeof globalThis[fnName] === "function" ? globalThis[fnName] : null);
    if(!original || original.__iconPatched) return;

    const patched = function(){
      const result = original.apply(this, arguments);
      setTimeout(iconizeAllCards, 0);
      return result;
    };
    patched.__iconPatched = true;
    window[fnName] = patched;
  });

  // Observe result areas because some functions are defined with local scope in older builds.
  const targets = ["results","favoritesResults","recentResults","archiveResults"].map(id => document.getElementById(id)).filter(Boolean);
  const observer = new MutationObserver(() => iconizeAllCards());
  targets.forEach(t => observer.observe(t, {childList:true, subtree:true}));

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", () => setTimeout(iconizeAllCards, 100));
  } else {
    setTimeout(iconizeAllCards, 100);
  }

  // A second pass after data loads from CSV/cache.
  setTimeout(iconizeAllCards, 700);
})();



/* obsolete UI patch removed in v25 */


/* obsolete UI patch removed in v25 */


/* obsolete UI patch removed in v25 */


/* v25 stable clean UI controller */
(function(){
  const down = `<svg class="chevron-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>`;
  const up = `<svg class="chevron-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>`;
  const infoSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M11 17h2v-6h-2v6Zm1-8.75a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z"/></svg>`;

  function ready(fn){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",fn,{once:true}):fn()}

  function showTip(text, anchor){
    let tip=document.getElementById("sectionInfoTooltip");
    if(!tip){tip=document.createElement("div");tip.id="sectionInfoTooltip";tip.className="section-info-tooltip";document.body.appendChild(tip)}
    tip.textContent=text; tip.hidden=false;
    const r=anchor.getBoundingClientRect(), pad=10;
    tip.style.left="10px"; tip.style.top="10px";
    const w=tip.offsetWidth||280, h=tip.offsetHeight||60;
    let left=Math.max(pad, Math.min(window.innerWidth-w-pad, r.left));
    let top=r.bottom+8;
    if(top+h>window.innerHeight-pad) top=r.top-h-8;
    tip.style.left=left+"px"; tip.style.top=Math.max(pad,top)+"px";
  }

  function setupHeader(head){
    const h2=head?.querySelector("h2"), p=head?.querySelector("p"), actions=head?.querySelector(".order-actions");
    if(!h2) return;
    head.querySelectorAll(".section-tools-toggle").forEach(x=>x.remove());
    h2.querySelectorAll(".section-info-btn,.section-tools-icon").forEach(x=>x.remove());
    h2.classList.add("section-title-row");
    if(p){
      const b=document.createElement("button");
      b.type="button"; b.className="section-info-btn"; b.innerHTML=infoSvg; b.setAttribute("aria-label","Info");
      b.onclick=e=>{e.preventDefault();e.stopPropagation();showTip(p.textContent.trim(),b)};
      h2.appendChild(b);
    }
    if(actions){
      if(!actions.dataset.v25Ready){actions.hidden=true; actions.dataset.v25Ready="1";}
      const t=document.createElement("button");
      t.type="button"; t.className="section-tools-icon"; t.innerHTML=actions.hidden?down:up;
      t.setAttribute("aria-expanded",String(!actions.hidden));
      t.onclick=e=>{e.preventDefault();e.stopPropagation();const open=actions.hidden;actions.hidden=!open;t.innerHTML=open?up:down;t.setAttribute("aria-expanded",String(open));};
      h2.appendChild(t);
    }
  }

  function setupHeaders(){document.querySelectorAll(".section-head").forEach(setupHeader)}

  function stepper(root=document){
    root.querySelectorAll(".qty-line").forEach(line=>{
      line.querySelectorAll(".qty-step").forEach(x=>x.remove());
      const input=line.querySelector(".qty-input"); if(!input) return;
      const m=document.createElement("button"), p=document.createElement("button");
      m.type=p.type="button"; m.className="qty-step qty-minus"; p.className="qty-step qty-plus"; m.textContent="−"; p.textContent="+";
      input.insertAdjacentElement("beforebegin",m); input.insertAdjacentElement("afterend",p);
      const bump=d=>{let n=Number(input.value||0)+d; if(n<0)n=0; input.value=String(n); input.dispatchEvent(new Event("input",{bubbles:true})); input.dispatchEvent(new Event("change",{bubbles:true}));};
      m.onclick=()=>bump(-1); p.onclick=()=>bump(1);
    });
  }

  function iconize(el,icon,label){if(!el)return; el.innerHTML=`<span class="action-icon">${icon}</span><span class="action-label">${label}</span>`;}
  function cards(root=document){
    root.querySelectorAll(".card").forEach(c=>{
      const fav=c.querySelector(".fav"); if(fav) iconize(fav,fav.classList.contains("fav-on")?"★":"☆","Fav");
      iconize(c.querySelector(".copy"),"📋","Copy");
      iconize(c.querySelector(".archive-catalog"),"🗄️","Archive");
      iconize(c.querySelector('a[target="_blank"]'),"🌐","Save-On");
    });
  }

  function apply(){setupHeaders(); stepper(); cards();}
  ready(()=>{
    apply();
    const targets=["results","favoritesResults","recentResults","archiveResults","missingResults","orderResults"].map(id=>document.getElementById(id)).filter(Boolean);
    const obs=new MutationObserver(()=>{clearTimeout(window.__v25Timer); window.__v25Timer=setTimeout(apply,0);});
    targets.forEach(t=>obs.observe(t,{childList:true}));
    document.addEventListener("click",e=>{const tip=document.getElementById("sectionInfoTooltip"); if(tip&&!tip.hidden&&!e.target.closest(".section-info-btn")&&!e.target.closest(".section-info-tooltip")) tip.hidden=true;});
    setTimeout(apply,300); setTimeout(apply,900);
  });
})();


/* v26 Final Order v1 */
(function(){
function ready(fn){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",fn,{once:true}):fn()}
function frontStock(){return getJSON(key("front_stock"),[])}
function setFrontStock(v){setJSON(key("front_stock"),v)}
function backQty(code){const f=order().find(x=>String(x.code)===String(code));return f?f.qty:""}
function frontQty(code){const f=frontStock().find(x=>String(x.code)===String(code));return f?f.qty:""}
function esc(v){return `"${String(v??"").replaceAll('"','""')}"`}

function saveFront(item,qty){
 qty=String(qty||"").trim();
 let list=frontStock().filter(x=>String(x.code)!==String(item.code));
 if(qty&&Number(qty)>0){
  list.unshift({code:item.code,qty,item_name:item.item_name,back_qty:backQty(item.code),addedAt:new Date().toISOString()});
  toast(`${item.item_name} saved to final order: ${qty}`);
 }else{toast(`${item.item_name} removed from final order`)}
 setFrontStock(list); renderFrontStock(); renderFrontSearchResults();
}

function matches(qv){
 const terms=String(qv||"").trim().toLowerCase().split(/\s+/).filter(Boolean);
 if(!terms.length)return [];
 return (items||[]).filter(x=>terms.every(t=>String(x.hay||"").includes(t)||String(x.item_name||"").toLowerCase().includes(t)||String(x.code||"").toLowerCase().includes(t))).slice(0,25);
}

function resultCard(item){
 const e=document.createElement("article"); e.className="front-result-card";
 const b=backQty(item.code), f=frontQty(item.code);
 e.innerHTML=`<div class="front-result-main"><h3></h3><div class="code"></div><div class="front-meta"><span class="back-stock-chip">Back: <b></b></span><span class="front-stock-chip">Front: <b></b></span></div></div><div class="front-qty-line"><button type="button" class="qty-step front-minus">−</button><input class="front-qty-input" type="number" inputmode="decimal" min="0" step="1" placeholder="0"><button type="button" class="qty-step front-plus">+</button></div>`;
 e.querySelector("h3").textContent=item.item_name; e.querySelector(".code").textContent=item.code;
 e.querySelector(".back-stock-chip b").textContent=b||"0"; e.querySelector(".front-stock-chip b").textContent=f||"0";
 const input=e.querySelector(".front-qty-input"); input.value=f||"";
 let timer=null; const saveNow=()=>{clearTimeout(timer); saveFront(item,input.value)};
 input.addEventListener("input",()=>{clearTimeout(timer); timer=setTimeout(()=>saveFront(item,input.value),450)});
 input.addEventListener("change",saveNow);
 e.querySelector(".front-minus").onclick=()=>{let n=Number(input.value||0)-1;if(n<0)n=0;input.value=String(n);saveNow()};
 e.querySelector(".front-plus").onclick=()=>{input.value=String(Number(input.value||0)+1);saveNow()};
 return e;
}

window.renderFrontSearchResults=function(){
 const q=document.getElementById("frontQ"), box=document.getElementById("frontSearchResults"); if(!q||!box)return;
 const query=q.value.trim(); box.innerHTML="";
 if(!query){box.innerHTML='<section class="message compact-msg">Search or scan an item to enter final order quantity.</section>';return}
 const arr=matches(query);
 if(!arr.length){
  const m=document.createElement("section"); m.className="message compact-msg";
  m.innerHTML='<strong>No local match found.</strong><div class="not-found-actions"><a class="button-link" target="_blank" rel="noopener">Check Save-On</a><button type="button">Add Missing</button></div>';
  m.querySelector("a").href=saveOnSearchUrl(query); m.querySelector("button").onclick=()=>saveMissing(query); box.appendChild(m); return;
 }
 arr.forEach(x=>box.appendChild(resultCard(x)));
};

window.renderFrontStock=function(){
 const box=document.getElementById("frontStockResults"); if(!box)return; box.innerHTML="";
 const list=frontStock();
 if(!list.length){box.innerHTML='<section class="message">No final order items yet. Search or scan items above.</section>';return}
 list.forEach(row=>{
  const e=document.createElement("article"); e.className="order-item front-stock-item";
  e.innerHTML='<div class="order-row"><div><h3></h3><div class="code"></div><div class="front-meta"><span class="back-stock-chip">Back: <b></b></span><span class="front-stock-chip">Front: <b></b></span></div></div><button type="button" class="danger remove-front">Remove</button></div>';
  e.querySelector("h3").textContent=row.item_name||row.code; e.querySelector(".code").textContent=row.code;
  e.querySelector(".back-stock-chip b").textContent=row.back_qty||backQty(row.code)||"0"; e.querySelector(".front-stock-chip b").textContent=row.qty;
  e.querySelector(".remove-front").onclick=()=>{setFrontStock(frontStock().filter(x=>String(x.code)!==String(row.code)));renderFrontStock();renderFrontSearchResults()};
  box.appendChild(e);
 });
};

function exportFront(){
 const rows=["item_name,code,back_stock_qty,front_stock_qty,date"];
 frontStock().forEach(x=>rows.push([x.item_name||"",x.code||"",x.back_qty||backQty(x.code)||"",x.qty||"",x.addedAt||""].map(esc).join(",")));
 downloadCSV("final-order.csv",rows.join("\n"));
}
function exportCombined(){
 const fm=new Map(frontStock().map(x=>[String(x.code),x])); const b=order(); const codes=new Set([...b.map(x=>String(x.code)),...fm.keys()]);
 const rows=["item_name,code,back_stock_qty,front_stock_qty"];
 codes.forEach(code=>{const br=b.find(x=>String(x.code)===code), fr=fm.get(code); rows.push([fr?.item_name||br?.item_name||"",code,br?.qty||"",fr?.qty||""].map(esc).join(","))});
 downloadCSV("back-final-order.csv",rows.join("\n"));
}

ready(function(){
 const start=document.getElementById("startFrontStockBtn"); if(start)start.onclick=()=>switchView("frontStock");
 const back=document.getElementById("backToBackStockBtn"); if(back)back.onclick=()=>switchView("order");
 const q=document.getElementById("frontQ"); if(q)q.addEventListener("input",renderFrontSearchResults);
 const scan=document.getElementById("frontScanBtn"); if(scan)scan.onclick=()=>{document.getElementById("scanBtn")?.click();toast("Scan code, then search it in Final Order")};
 const ex=document.getElementById("exportFrontStockBtn"); if(ex)ex.onclick=exportFront;
 const comb=document.getElementById("exportCombinedStockBtn"); if(comb)comb.onclick=exportCombined;
 const clr=document.getElementById("clearFrontStockBtn"); if(clr)clr.onclick=()=>{if(confirm("Clear final order list?")){setFrontStock([]);renderFrontStock();renderFrontSearchResults()}};
 renderFrontStock(); renderFrontSearchResults();
});
})();


/* v27 left drawer + workflow shell */
(function(){
function ready(f){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",f,{once:true}):f()}
function status(){return localStorage.getItem(key("order_status"))||"Draft"}
function setStatus(s){localStorage.setItem(key("order_status"),s);summary();lockState()}
function finalList(){try{return getJSON(key("front_stock"),[])}catch{return[]}}
function openDrawer(){let d=document.getElementById("appDrawer"),b=document.getElementById("drawerBackdrop");if(!d)return;d.classList.add("open");d.setAttribute("aria-hidden","false");if(b)b.hidden=false;document.body.classList.add("drawer-open")}
function closeDrawer(){let d=document.getElementById("appDrawer"),b=document.getElementById("drawerBackdrop");if(!d)return;d.classList.remove("open");d.setAttribute("aria-hidden","true");if(b)b.hidden=true;document.body.classList.remove("drawer-open")}
function tools(){closeDrawer();let p=document.getElementById("topToolsPanel");if(p){p.hidden=false;p.style.display="flex";document.body.classList.add("tools-open")}}
function go(v){closeDrawer();switchView(v);setTimeout(summary,50)}
window.refreshWorkflowSummary=summary;
function summary(){
 let back=(typeof order==="function"?order():[]).length, fin=finalList().length, miss=(typeof missingItems==="function"?missingItems():[]).length, st=status();
 [["dashBackCount",back],["orderBackCount",back],["dashFinalCount",fin],["orderFinalCount",fin],["dashMissingCount",miss]].forEach(([i,v])=>{let e=document.getElementById(i);if(e)e.textContent=v});
 ["dashOrderStatus","orderSessionStatus"].forEach(i=>{let e=document.getElementById(i);if(e){e.textContent=st;e.className=st==="Placed"?"status-placed":"status-draft"}});
}
function lockState(){let locked=status()==="Placed";document.body.classList.toggle("order-locked",locked);document.querySelectorAll("#orderView input,#orderView button,#frontStockView input,#frontStockView button").forEach(el=>{if(el.id==="unlockOrderBtn"||el.id==="backToBackStockBtn")return;el.disabled=locked})}
ready(function(){
 document.getElementById("drawerBtn")?.addEventListener("click",openDrawer);
 document.getElementById("closeDrawerBtn")?.addEventListener("click",closeDrawer);
 document.getElementById("drawerBackdrop")?.addEventListener("click",closeDrawer);
 document.querySelectorAll("[data-drawer-action]").forEach(btn=>btn.onclick=()=>{let a=btn.dataset.drawerAction;if(a==="dashboard")go("dashboard");else if(a==="orders"||a==="today-order")go("orders");else if(a==="inventory")go("inventory");else if(a==="missing")go("missing");else if(a==="archive")go("archive");else if(a==="data-tools")tools()});
 document.getElementById("dashGoOrderBtn")?.addEventListener("click",()=>go("orders"));
 document.getElementById("dashGoStockBtn")?.addEventListener("click",()=>go("order"));
 document.getElementById("dashGoFinalBtn")?.addEventListener("click",()=>go("frontStock"));
 document.getElementById("dashGoMissingBtn")?.addEventListener("click",()=>go("missing"));
 document.getElementById("continueOrderBtn")?.addEventListener("click",()=>go("order"));
 document.getElementById("ordersBackStockBtn")?.addEventListener("click",()=>go("order"));
 document.getElementById("ordersFinalOrderBtn")?.addEventListener("click",()=>go("frontStock"));
 document.getElementById("markOrderPlacedBtn")?.addEventListener("click",()=>{if(confirm("Mark today's order as placed? This will lock editing.")){setStatus("Placed");toast("Order marked as placed")}});
 document.getElementById("unlockOrderBtn")?.addEventListener("click",()=>{if(confirm("Unlock today's order as draft?")){setStatus("Draft");toast("Order unlocked")}});
 let sx=0,sy=0,track=false;window.addEventListener("touchstart",e=>{let t=e.touches[0];sx=t.clientX;sy=t.clientY;track=sx<35},{passive:true});window.addEventListener("touchmove",e=>{if(!track)return;let t=e.touches[0],dx=t.clientX-sx,dy=Math.abs(t.clientY-sy);if(dx>70&&dy<45){openDrawer();track=false}},{passive:true});
 window.addEventListener("keydown",e=>{if(e.key==="Escape")closeDrawer()});
 summary();lockState();
 let obs=new MutationObserver(()=>setTimeout(summary,50));["orderResults","frontStockResults","missingResults"].map(i=>document.getElementById(i)).filter(Boolean).forEach(t=>obs.observe(t,{childList:true}));
});
})();


/* v28 dashboard + order history + remove settings menu */
(function(){
function ready(f){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",f,{once:true}):f()}
function esc(v){return `"${String(v??"").replaceAll('"','""')}"`}
function todayKey(){return new Date().toISOString().slice(0,10)}
function orderHistory(){return getJSON(key("order_history"),[])}
function setOrderHistory(v){setJSON(key("order_history"),v)}
function finalList(){try{return getJSON(key("front_stock"),[])}catch{return[]}}
function status(){return localStorage.getItem(key("order_status"))||"Draft"}
function setStatus(s){localStorage.setItem(key("order_status"),s); if(window.refreshWorkflowSummary) window.refreshWorkflowSummary(); renderOrderHistory(); applyLock();}
function applyLock(){document.body.classList.toggle("order-locked",status()==="Placed")}
function snapshotOrder(){
 const date=todayKey();
 const back=(typeof order==="function"?order():[]);
 const final=finalList();
 const snap={id:date+"-"+Date.now(),date,placedAt:new Date().toISOString(),status:"Placed",backStock:back,finalOrder:final};
 let hist=orderHistory().filter(x=>x.date!==date);
 hist.unshift(snap);
 setOrderHistory(hist.slice(0,100));
 setStatus("Placed");
 toast("Order placed and saved to history");
}
function exportHistoryOrder(id){
 const h=orderHistory().find(x=>x.id===id); if(!h)return;
 const rows=["section,item_name,code,quantity"];
 (h.backStock||[]).forEach(x=>rows.push(["Back Stock",x.item_name||"",x.code||"",x.qty||""].map(esc).join(",")));
 (h.finalOrder||[]).forEach(x=>rows.push(["Final Order",x.item_name||"",x.code||"",x.qty||""].map(esc).join(",")));
 downloadCSV(`order-${h.date}.csv`,rows.join("\n"));
}
window.renderOrderHistory=function(){
 const boxes=[document.getElementById("orderHistoryResults"),document.getElementById("ordersHistoryInline")].filter(Boolean);
 const hist=orderHistory();
 boxes.forEach(box=>{
  box.innerHTML="";
  if(!hist.length){box.innerHTML='<section class="message compact-msg">No placed orders yet.</section>';return}
  hist.forEach(h=>{
    const e=document.createElement("article"); e.className="history-card";
    e.innerHTML=`<div><h3></h3><p></p><div class="history-meta"><span>Back: <b></b></span><span>Final: <b></b></span></div></div><button type="button">Export</button>`;
    e.querySelector("h3").textContent=new Date(h.placedAt||h.date).toLocaleDateString();
    e.querySelector("p").textContent=`Placed ${h.placedAt?new Date(h.placedAt).toLocaleTimeString():""}`;
    e.querySelector(".history-meta b").textContent=(h.backStock||[]).length;
    e.querySelectorAll(".history-meta b")[1].textContent=(h.finalOrder||[]).length;
    e.querySelector("button").onclick=()=>exportHistoryOrder(h.id);
    box.appendChild(e);
  });
 });
};
ready(function(){
 // Hide/disable old top-right settings button if any remains.
 document.getElementById("topToolsBtn")?.remove();
 document.getElementById("settingsMenu")?.remove();

 document.getElementById("markOrderPlacedBtn")?.addEventListener("click",e=>{
   e.stopImmediatePropagation();
   if(status()==="Placed"){toast("Order already placed"); return}
   if(confirm("Mark today's order as placed? This will save it by date and lock editing.")) snapshotOrder();
 }, true);

 document.getElementById("unlockOrderBtn")?.addEventListener("click",e=>{
   e.stopImmediatePropagation();
   if(confirm("Unlock today's order as Draft?")) setStatus("Draft");
 }, true);

 renderOrderHistory();
 applyLock();
 setTimeout(renderOrderHistory,300);
});
})();


/* v29 dashboard grid + easier Mark Placed */
(function(){
function ready(f){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",f,{once:true}):f()}
function status(){return localStorage.getItem(key("order_status"))||"Draft"}
function setStatus(s){localStorage.setItem(key("order_status"),s); if(window.refreshWorkflowSummary) window.refreshWorkflowSummary(); if(window.renderOrderHistory) window.renderOrderHistory();}
function finalList(){try{return getJSON(key("front_stock"),[])}catch{return[]}}
function snapshotOrderV29(){
 if(status()==="Placed"){toast("Order already placed");return}
 const back=(typeof order==="function"?order():[]);
 const final=finalList();
 if(!back.length && !final.length){
   if(!confirm("Back Stock and Final Order are empty. Mark empty order as placed?")) return;
 } else {
   if(!confirm("Mark today’s order as placed? This will save it by date and lock editing.")) return;
 }
 const date=new Date().toISOString().slice(0,10);
 const hist=getJSON(key("order_history"),[]).filter(x=>x.date!==date);
 hist.unshift({id:date+"-"+Date.now(),date,placedAt:new Date().toISOString(),status:"Placed",backStock:back,finalOrder:final});
 setJSON(key("order_history"),hist.slice(0,100));
 setStatus("Placed");
 document.body.classList.add("order-locked");
 toast("Order placed and saved");
}
ready(function(){
 const dashBtn=document.getElementById("dashMarkPlacedBtn");
 if(dashBtn) dashBtn.onclick=snapshotOrderV29;
 const quickBtn=document.getElementById("ordersQuickMarkPlacedBtn");
 if(quickBtn) quickBtn.onclick=snapshotOrderV29;
 const oldBtn=document.getElementById("markOrderPlacedBtn");
 if(oldBtn) oldBtn.onclick=snapshotOrderV29;

 function updatePlacedButtons(){
   const placed=status()==="Placed";
   [dashBtn,quickBtn,oldBtn].filter(Boolean).forEach(b=>{
     b.disabled=placed;
     if(b===dashBtn){
       b.querySelector("small").textContent=placed ? "Already placed" : "Lock today’s order";
       b.querySelector(".dash-circle").textContent=placed ? "🔒" : "✅";
     } else {
       b.textContent=placed ? "Placed" : "Mark Placed";
     }
   });
 }
 updatePlacedButtons();
 setInterval(updatePlacedButtons,1000);
});
})();


/* v30 order lock + sticky headers + workflow back buttons */
(function(){
function ready(f){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",f,{once:true}):f()}
function status(){return localStorage.getItem(key("order_status"))||"Draft"}
function isPlaced(){return status()==="Placed"}
function goOrders(){ if(typeof switchView==="function") switchView("orders"); }

function applyOrderLockV30(){
  const locked=isPlaced();
  document.body.classList.toggle("order-locked",locked);
  document.querySelectorAll("#orderView input,#orderView .qty-step,#orderView .danger,#orderView .remove-order,#frontStockView input,#frontStockView .qty-step,#frontStockView .remove-front,#frontStockView .danger,#frontStockView #frontScanBtn").forEach(el=>{
    el.disabled=locked;
    el.setAttribute("aria-disabled",String(locked));
  });
  ["backToOrdersFromStockBtn","backToOrdersFromFinalBtn","backToBackStockBtn","exportOrderBtn","exportFrontStockBtn","exportCombinedStockBtn"].forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.disabled=false;el.removeAttribute("aria-disabled")}
  });
}

function addBackButtons(){
  const stockHead=document.querySelector("#orderView .section-head h2");
  if(stockHead && !document.getElementById("backToOrdersFromStockBtn")){
    const b=document.createElement("button");
    b.id="backToOrdersFromStockBtn";
    b.type="button";
    b.className="header-back-btn";
    b.innerHTML="←";
    b.setAttribute("aria-label","Back to Orders");
    b.onclick=goOrders;
    stockHead.insertBefore(b, stockHead.firstChild);
  }
  const finalHead=document.querySelector("#frontStockView .section-head h2");
  if(finalHead && !document.getElementById("backToOrdersFromFinalBtn")){
    const b=document.createElement("button");
    b.id="backToOrdersFromFinalBtn";
    b.type="button";
    b.className="header-back-btn";
    b.innerHTML="←";
    b.setAttribute("aria-label","Back to Orders");
    b.onclick=goOrders;
    finalHead.insertBefore(b, finalHead.firstChild);
  }
}

function blockPlacedEdits(){
  document.addEventListener("click",function(e){
    if(!isPlaced()) return;
    const blocked=e.target.closest("#orderView .qty-step,#orderView .danger,#orderView .remove-order,#frontStockView .qty-step,#frontStockView .remove-front,#frontStockView .danger,#frontStockView #frontScanBtn");
    if(blocked){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      toast("Order is placed and locked");
    }
  },true);
  document.addEventListener("input",function(e){
    if(!isPlaced()) return;
    if(e.target.closest("#orderView,#frontStockView")){
      e.preventDefault(); e.stopPropagation();
      toast("Order is placed and locked");
    }
  },true);
}

ready(function(){
  addBackButtons();
  applyOrderLockV30();
  blockPlacedEdits();
  ["dashMarkPlacedBtn","ordersQuickMarkPlacedBtn","markOrderPlacedBtn","unlockOrderBtn"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener("click",()=>setTimeout(()=>{applyOrderLockV30();addBackButtons();},150),true);
  });
  document.addEventListener("click",()=>setTimeout(()=>{addBackButtons();applyOrderLockV30();},200));
  setTimeout(()=>{addBackButtons();applyOrderLockV30();},400);
  setTimeout(()=>{addBackButtons();applyOrderLockV30();},1200);
});
window.applyOrderLockV30=applyOrderLockV30;
})();


/* v31 navbar height variable fix */
(function(){
  function setNavbarHeight(){
    const header = document.querySelector("header");
    const h = header ? Math.ceil(header.getBoundingClientRect().height) : 58;
    document.documentElement.style.setProperty("--navbar-height", h + "px");
    document.documentElement.style.setProperty("--header-h", h + "px");
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", setNavbarHeight, {once:true});
  } else {
    setNavbarHeight();
  }

  window.addEventListener("resize", setNavbarHeight);
  window.addEventListener("orientationchange", () => setTimeout(setNavbarHeight, 250));
  setTimeout(setNavbarHeight, 300);
})();


/* v32 fixed page header layout */
(function(){
  function activeSectionHead(){
    const active = document.querySelector(".view.active") || Array.from(document.querySelectorAll(".view")).find(v => getComputedStyle(v).display !== "none");
    return active?.querySelector(":scope > .section-head, :scope > .panel.section-head") || null;
  }

  function setLayoutVars(){
    const nav = document.querySelector("header");
    const section = activeSectionHead();

    const navH = nav ? Math.ceil(nav.getBoundingClientRect().height) : 58;
    const sectionH = section ? Math.ceil(section.getBoundingClientRect().height) : 42;

    document.documentElement.style.setProperty("--navbar-height", navH + "px");
    document.documentElement.style.setProperty("--page-header-height", sectionH + "px");
    document.documentElement.style.setProperty("--fixed-top-total", (navH + sectionH) + "px");
  }

  function refresh(){
    requestAnimationFrame(setLayoutVars);
    setTimeout(setLayoutVars, 120);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", refresh, {once:true});
  } else {
    refresh();
  }

  window.addEventListener("resize", refresh);
  window.addEventListener("orientationchange", () => setTimeout(refresh, 250));

  document.addEventListener("click", () => setTimeout(refresh, 120), true);

  // Do not observe the entire page subtree here. Product/order rendering changes the DOM
  // frequently and caused repeated layout recalculation and visible scroll jumping.
})();


/* v34 force lookup header layout refresh */
(function(){
  function refreshLookupHeaderLayout(){
    const header = document.querySelector("header");
    const active = document.querySelector(".view.active") || document.querySelector("#lookupView");
    const section = active?.querySelector(":scope > .section-head, :scope > .panel.section-head");
    const navH = header ? Math.ceil(header.getBoundingClientRect().height) : 58;
    const sectionH = section ? Math.ceil(section.getBoundingClientRect().height) : 42;
    document.documentElement.style.setProperty("--navbar-height", navH + "px");
    document.documentElement.style.setProperty("--page-header-height", sectionH + "px");
    document.documentElement.style.setProperty("--fixed-top-total", (navH + sectionH) + "px");
    if(window.refreshProduceAssistantUI) window.refreshProduceAssistantUI();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", () => setTimeout(refreshLookupHeaderLayout, 100), {once:true});
  } else {
    setTimeout(refreshLookupHeaderLayout, 100);
  }

  document.addEventListener("click", () => setTimeout(refreshLookupHeaderLayout, 150), true);
  window.addEventListener("resize", refreshLookupHeaderLayout);
})();


/* v35 lookup panel layout refresh */
(function(){
  function refreshLayout(){
    const nav = document.querySelector("header");
    const active = document.querySelector(".view.active") || document.querySelector("#lookupView");
    const section = active?.querySelector(":scope > .section-head, :scope > .panel.section-head");
    const navH = nav ? Math.ceil(nav.getBoundingClientRect().height) : 58;
    const sectionH = section ? Math.ceil(section.getBoundingClientRect().height) : 42;
    document.documentElement.style.setProperty("--navbar-height", navH + "px");
    document.documentElement.style.setProperty("--page-header-height", sectionH + "px");
    document.documentElement.style.setProperty("--fixed-top-total", (navH + sectionH) + "px");
  }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", () => setTimeout(refreshLayout, 100), {once:true});
  } else {
    setTimeout(refreshLayout, 100);
  }
  window.addEventListener("resize", refreshLayout);
})();


/* v36 lookup title without breaking lookup panel */
(function(){
  function setVars(){
    const header = document.querySelector("header");
    const navH = header ? Math.ceil(header.getBoundingClientRect().height) : 58;
    document.documentElement.style.setProperty("--navbar-height", navH + "px");
  }

  function updateLookupTitle(){
    setVars();
    const title = document.getElementById("lookupFixedHeader");
    if(!title) return;
    const active = document.querySelector(".view.active");
    title.hidden = !(active && active.id === "lookupView");
  }

  function showLookupInfo(){
    const msg = "Search, scan, and quickly add items to Back Stock or Favorites.";
    if(typeof toast === "function") toast(msg);
    else alert(msg);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", () => {
      updateLookupTitle();
      document.getElementById("lookupInfoBtn")?.addEventListener("click", showLookupInfo);
    }, {once:true});
  } else {
    updateLookupTitle();
    document.getElementById("lookupInfoBtn")?.addEventListener("click", showLookupInfo);
  }

  document.addEventListener("click", () => setTimeout(updateLookupTitle, 80), true);
  window.addEventListener("resize", updateLookupTitle);
  setTimeout(updateLookupTitle, 300);
})();


/* v37 dynamic bottom spacing */
(function(){
  function setBottomNavHeight(){
    const tabs = document.querySelector(".tabs");
    const h = tabs ? Math.ceil(tabs.getBoundingClientRect().height) : 58;
    document.documentElement.style.setProperty("--bottom-nav-height", h + "px");
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", setBottomNavHeight, {once:true});
  } else {
    setBottomNavHeight();
  }

  window.addEventListener("resize", setBottomNavHeight);
  window.addEventListener("orientationchange", () => setTimeout(setBottomNavHeight, 250));
  setTimeout(setBottomNavHeight, 300);
})();

/* v40 desktop hierarchy measurement */
(function(){
  function getActivePageHeader(){
    const active = document.querySelector('.view.active');
    if(!active) return null;

    if(active.id === 'lookupView'){
      const lookupTitle = document.getElementById('lookupFixedHeader');
      if(lookupTitle && !lookupTitle.hidden) return lookupTitle;
    }

    return active.querySelector(':scope > .section-head, :scope > .panel.section-head');
  }

  function updateDesktopHierarchy(){
    const appHeader = document.querySelector('header');
    const tabs = document.querySelector('.tabs');
    const pageHeader = getActivePageHeader();

    const appHeaderHeight = appHeader ? Math.ceil(appHeader.getBoundingClientRect().height) : 58;
    const tabsHeight = tabs ? Math.ceil(tabs.getBoundingClientRect().height) : 48;
    const pageHeaderHeight = pageHeader ? Math.ceil(pageHeader.getBoundingClientRect().height) : 42;

    document.documentElement.style.setProperty('--navbar-height', appHeaderHeight + 'px');
    document.documentElement.style.setProperty('--desktop-tabs-height', tabsHeight + 'px');
    document.documentElement.style.setProperty('--page-header-height', pageHeaderHeight + 'px');

    const isDesktop = window.matchMedia('(min-width: 641px)').matches;
    const fixedTopTotal = isDesktop
      ? appHeaderHeight + tabsHeight + pageHeaderHeight
      : appHeaderHeight + pageHeaderHeight;

    document.documentElement.style.setProperty('--fixed-top-total', fixedTopTotal + 'px');
  }

  function refresh(){
    requestAnimationFrame(updateDesktopHierarchy);
    setTimeout(updateDesktopHierarchy, 100);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', refresh, {once:true});
  } else {
    refresh();
  }

  window.addEventListener('resize', refresh);
  window.addEventListener('orientationchange', () => setTimeout(refresh, 250));
  document.addEventListener('click', () => setTimeout(refresh, 100), true);

  // Avoid a subtree MutationObserver. The app updates buttons and result content often;
  // observing those updates created a measurement loop that made the page scroll/jump.
})();


/* v41 stable header measurement without DOM observer loops */
(function(){
  let scheduled = false;

  function measure(){
    scheduled = false;
    const appHeader = document.querySelector('header');
    const tabs = document.querySelector('.tabs');
    const active = document.querySelector('.view.active');
    let pageHeader = null;

    if(active?.id === 'lookupView') {
      const lookup = document.getElementById('lookupFixedHeader');
      if(lookup && !lookup.hidden) pageHeader = lookup;
    }
    if(!pageHeader && active){
      pageHeader = active.querySelector(':scope > .section-head, :scope > .panel.section-head');
    }

    const navH = Math.ceil(appHeader?.getBoundingClientRect().height || 58);
    const tabsH = Math.ceil(tabs?.getBoundingClientRect().height || 48);
    const pageH = Math.ceil(pageHeader?.getBoundingClientRect().height || 42);
    const desktop = window.matchMedia('(min-width: 641px)').matches;
    const total = desktop ? navH + tabsH + pageH : navH + pageH;

    const root = document.documentElement;
    const values = {
      '--navbar-height': navH + 'px',
      '--desktop-tabs-height': tabsH + 'px',
      '--page-header-height': pageH + 'px',
      '--fixed-top-total': total + 'px'
    };

    for(const [name, value] of Object.entries(values)){
      if(root.style.getPropertyValue(name) !== value){
        root.style.setProperty(name, value);
      }
    }
  }

  function schedule(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(measure);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', schedule, {once:true});
  } else {
    schedule();
  }

  document.querySelector('.tabs')?.addEventListener('click', () => setTimeout(schedule, 0));
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => setTimeout(schedule, 200));
})();
