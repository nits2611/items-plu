const SAVE_ON_BASE="https://www.saveonfoods.com/sm/planning/rsid/1982/results?q=",CSV_URL="./items.csv",STORAGE_CSV="plu_items_csv_current",STORAGE_HASH="plu_items_csv_hash",STORE="default-store";
let items=[],filter="all",deferredPrompt=null,scannerStream=null,scannerTimer=null;
const q=document.getElementById("q"),results=document.getElementById("results"),msg=document.getElementById("message"),count=document.getElementById("count"),syncStatus=document.getElementById("syncStatus");
const CODE128=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];
function parseCSV(t){let rows=[],row=[],val="",inQ=false;for(let i=0;i<t.length;i++){const ch=t[i],nx=t[i+1];if(ch=='"'&&inQ&&nx=='"'){val+='"';i++;continue}if(ch=='"'){inQ=!inQ;continue}if(ch==","&&!inQ){row.push(val);val="";continue}if((ch=="\n"||ch=="\r")&&!inQ){if(val||row.length){row.push(val);rows.push(row);row=[];val=""}if(ch=="\r"&&nx=="\n")i++;continue}val+=ch}if(val||row.length)rows.push([...row,val]);if(!rows.length)return[];const h=rows.shift().map(x=>x.trim());return rows.filter(r=>r.some(v=>String(v).trim())).map(r=>{const o={};h.forEach((k,i)=>o[k]=(r[i]||"").trim());return o})}
async function sha256Short(text){if(!crypto?.subtle){let h=0;for(let i=0;i<text.length;i++)h=((h<<5)-h+text.charCodeAt(i))|0;return String(h)}const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("").slice(0,12)}
function detectBrand(n){const b=["Earthbound Farm","Taylor Farms","Fresh Express","GoodLeaf Farms","Goodleaf Farms","Western Family","Save-On-Foods"];const u=String(n).toUpperCase();return b.find(x=>u.startsWith(x.toUpperCase()))||""}
function normalize(r){const item_name=r.item_name||r.label||r.display_name||r.clean_name||"",code=String(r.code||r.PLU||r.plu||r.item_number||"").trim(),quantity=r.quantity||"",brand=r.brand||detectBrand(item_name),category=r.category||"",type=r.type||(code.length>6?"packaged":"produce"),image_local=r.image_local||r.image||"",image_url=r.image_url||"",notes=r.notes||"",aliases=r.aliases||"",search_keywords=r.search_keywords||[item_name,code,quantity,brand,category,type,notes,aliases].join(" ");return{item_name,code,quantity,brand,category,type,image_local,image_url,notes,aliases,hay:search_keywords.toLowerCase()}}
const rowsToItems=rows=>rows.map(normalize).filter(x=>x.item_name&&x.code);
function setItemsFromCSV(text){items=rowsToItems(parseCSV(text));renderAll()}
async function loadInitialData(){const cached=localStorage.getItem(STORAGE_CSV);if(cached){setItemsFromCSV(cached);setSync("Loaded cached data. Checking updates...")}else if(window.DEFAULT_ITEMS?.length){items=rowsToItems(window.DEFAULT_ITEMS);renderAll();setSync("Loaded bundled data. Checking CSV...")}await checkForCSVUpdate()}
async function checkForCSVUpdate(){try{const res=await fetch(CSV_URL,{cache:"no-cache"});if(!res.ok)throw Error(res.status);const text=await res.text(),hash=await sha256Short(text),old=localStorage.getItem(STORAGE_HASH);if(!old||old!==hash){localStorage.setItem(STORAGE_CSV,text);localStorage.setItem(STORAGE_HASH,hash);setItemsFromCSV(text);setSync(`Data updated (${items.length} items).`)}else setSync(`Data up to date (${items.length} items).`)}catch(e){setSync(`Offline/cached mode (${items.length} items).`,"warn")}}
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
  if (!silent) toast(`${item.item_name} added to order: ${qty}`);
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
function renderOrder(){const box=document.getElementById("orderResults");box.innerHTML="";const o=order();if(!o.length){box.innerHTML='<section class="message">No order items yet. Add items from Lookup.</section>';return}o.forEach(row=>{const item=items.find(x=>x.code===row.code)||row;const e=document.createElement("article");e.className="order-item";e.innerHTML=`<div class="order-row"><div><h3></h3><div class="code"></div></div><div class="qty"></div></div><div class="barcode"></div><div class="actions"><button type="button">Edit Qty</button><button type="button">Remove</button></div>`;e.querySelector("h3").textContent=item.item_name;e.querySelector(".code").textContent=row.code;e.querySelector(".qty").textContent=row.qty;e.querySelector(".barcode").appendChild(code128SVG(row.code));e.querySelectorAll("button")[0].onclick=()=>{const q=prompt("Quantity:",row.qty);if(q){let arr=order();arr=arr.map(x=>x.code===row.code?{...x,qty:q}:x);setJSON(key("order"),arr);renderOrder()}};e.querySelectorAll("button")[1].onclick=()=>{setJSON(key("order"),order().filter(x=>x.code!==row.code));renderOrder()};box.appendChild(e)})}

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
document.getElementById("csvUpload")?.addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;const text=await f.text(),hash=await sha256Short(text);localStorage.setItem(STORAGE_CSV,text);localStorage.setItem(STORAGE_HASH,hash);setItemsFromCSV(text);setSync(`Uploaded CSV loaded (${items.length} items).`)});
document.getElementById("resetBtn").onclick=()=>{localStorage.removeItem(STORAGE_CSV);localStorage.removeItem(STORAGE_HASH);items=rowsToItems(window.DEFAULT_ITEMS||[]);renderAll();checkForCSVUpdate()};document.getElementById("clearRecentBtn").onclick=()=>{setJSON(key("recent"),[]);renderRecent()};document.getElementById("clearOrderBtn").onclick=()=>{if(confirm("Clear today's order?")){setJSON(key("order"),[]);renderOrder()}};
document.getElementById("exportOrderBtn").onclick=()=>downloadCSV("today-order.csv",["item_name,code,quantity",...order().map(o=>`"${(o.item_name||"").replaceAll('"','""')}",${o.code},"${String(o.qty).replaceAll('"','""')}"`)].join("\n"));document.getElementById("exportProfileBtn").onclick=()=>{const data={favorites:favs(),recent:recents(),order:order(),exportedAt:new Date().toISOString()};downloadFile("plu-profile.json",JSON.stringify(data,null,2),"application/json")};document.getElementById("importProfile")?.addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;const data=JSON.parse(await f.text());if(data.favorites)setJSON(key("favorites"),data.favorites);if(data.recent)setJSON(key("recent"),data.recent);if(data.order)setJSON(key("order"),data.order);renderAll()});
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

  // Improve missingToItem if available through Add Selected to Catalog wrapper:
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

  // Export Missing CSV should include image columns if export button is present.
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
