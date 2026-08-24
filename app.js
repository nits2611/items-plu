const SAVE_ON_BASE=window.AppConfig?.urls?.saveOnSearchBase||"https://www.saveonfoods.com/sm/planning/rsid/1982/results?q=",CSV_URL=window.AppConfig?.urls?.bundledCatalog||"./items.csv",STORAGE_CSV=window.AppConfig?.catalog?.legacyCsvKey||"plu_items_csv_current",STORAGE_HASH=window.AppConfig?.catalog?.legacyCsvHashKey||"plu_items_csv_hash",STORE=window.AppConfig?.storage?.storeNamespace||"default-store";
let items=[],filter="all",deferredPrompt=null,scannerStream=null,scannerTimer=null,scannerContext="lookup",scannerAccepting=false;
const q=document.getElementById("q"),results=document.getElementById("results"),msg=document.getElementById("message"),count=document.getElementById("count"),syncStatus=document.getElementById("syncStatus");
const CODE128=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];

const localCatalogProvider=new LocalCatalogProvider({
  csvUrl:CSV_URL,
  storageCsvKey:STORAGE_CSV,
  storageHashKey:STORAGE_HASH,
  bundledItems:window.DEFAULT_ITEMS||[]
});
const cloudCatalogProvider=new GoogleSheetsCatalogProvider({
  apiUrl:window.AppConfig?.api?.googleSheets?.apiUrl||window.AppConfig?.googleSheets?.apiUrl||"",
  storageCatalogKey:window.AppConfig?.catalog?.cacheKey,
  storageVersionKey:window.AppConfig?.catalog?.cacheVersionKey,
  storageUpdatedAtKey:window.AppConfig?.catalog?.cacheUpdatedAtKey,
  storeId:window.AppConfig?.catalog?.storeId,
  timeoutMs:window.AppConfig?.http?.timeoutMs
});
const catalogService=new CatalogService(localCatalogProvider,cloudCatalogProvider);

// v48 Product module. The adapter keeps the proven CatalogService stack in
// place while the rest of the application now talks through product-domain
// boundaries that can later move to IndexedDB/API providers independently.
const legacyProductProvider=new LegacyCatalogProductProvider(catalogService);
const productDbClient=new IndexedDbClient({
  databaseName:window.AppConfig?.storage?.databaseName||"my-produce-assistant",
  databaseVersion:window.AppConfig?.storage?.databaseVersion||1,
  stores:[{name:"products",options:{keyPath:"id"}}]
});
const catalogVersionProvider=new StaticCatalogVersionProvider({
  url:window.AppConfig?.urls?.versions||"./data/versions.json",
  httpClient:HttpClient,
  timeoutMs:10000
});
const indexedDbProductProvider=new IndexedDbProductProvider({
  primaryProvider:legacyProductProvider,
  dbClient:productDbClient,
  versionProvider:catalogVersionProvider,
  storeName:"products",
  versionStorageKey:window.AppConfig?.catalog?.releaseVersionKey||"myProduceAssistant.productCatalogReleaseVersion",
  bundledVersion:window.AppConfig?.catalog?.bundledVersion||"1.0.0"
});
const productRepository=new ProductRepository(indexedDbProductProvider);
const productService=new ProductService(productRepository);
const productView=new ProductView({
  renderAll:()=>renderAll(),
  setSync:(message,level)=>setSync(message,level),
  renderCatalogUpdate:state=>renderCatalogUpdate(state)
});
const productController=new ProductController({
  service:productService,
  view:productView,
  onItemsChanged:next=>{items=next;}
});
window.ProductModule=Object.freeze({controller:productController,service:productService,repository:productRepository,storage:indexedDbProductProvider});

// Compatibility wrappers preserve existing extension code while catalog parsing
// helpers remain in CatalogService during this migration phase.
const parseCSV=text=>catalogService.parseCsv(text);
const sha256Short=text=>catalogService.hashText(text);
const detectBrand=name=>catalogService.detectBrand(name);
const normalize=row=>catalogService.normalizeRow(row);
const rowsToItems=rows=>catalogService.rowsToItems(rows);
function setItemsFromCSV(text){productController.setItemsFromCsv(text)}
async function loadInitialData(){return productController.loadInitialData()}
async function checkForCSVUpdate(){return productController.checkForUpdate()}
function getJSON(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}function setJSON(k,v){localStorage.setItem(k,JSON.stringify(v))}
const orderSessionStore=new LocalOrderSessionStore({namespace:`plu_${STORE}`,storeId:window.AppConfig?.catalog?.storeId||"STR00000001"});
orderSessionStore.migrateLegacy();
const localOrderProvider=new LocalOrderProvider({sessionStore:orderSessionStore});
const orderRepository=new OrderRepository(localOrderProvider);
const orderService=new OrderService(orderRepository);
const orderController=new OrderController(orderService);
const key=n=>orderController.key(n);
const businessDate=()=>orderController.getBusinessDate();
const currentOrderStatus=()=>orderController.getStatus();
const setCurrentOrderStatus=status=>orderController.setStatus(status);
const getBackStockList=()=>orderController.getBackStock();
const setBackStockList=list=>orderController.setBackStock(list);
const getFinalOrderList=()=>orderController.getFinalOrder();
const setFinalOrderList=list=>orderController.setFinalOrder(list);
const getOrderHistoryList=()=>orderController.getHistory();
const setOrderHistoryList=list=>orderController.setHistory(list);
window.OrderSessionModule=Object.freeze({storage:orderSessionStore,provider:localOrderProvider,repository:orderRepository,service:orderService,controller:orderController,getBusinessDate:businessDate,getStatus:currentOrderStatus,setStatus:setCurrentOrderStatus});
window.OrderModule=Object.freeze({provider:localOrderProvider,repository:orderRepository,service:orderService,controller:orderController});
const favs=()=>getJSON(key("favorites"),[]);const recents=()=>getJSON(key("recent"),[]);const order=()=>getBackStockList();
function isFav(code){return favs().includes(code)}function touch(code){let r=recents().filter(x=>x!==code);r.unshift(code);setJSON(key("recent"),r.slice(0,30))}
function toggleFav(code){let f=favs();f=f.includes(code)?f.filter(x=>x!==code):[code,...f];setJSON(key("favorites"),f);renderAll()}
function isCurrentOrderPlaced() {
  return currentOrderStatus() === "Placed";
}

function syncFinalOrderBackStock(code, qty) {
  const list = getFinalOrderList();
  let changed = false;
  const updated = list.map(row => {
    if (String(row.code) !== String(code)) return row;
    const nextQty = String(qty || "").trim();
    if (String(row.back_qty || "") === nextQty) return row;
    changed = true;
    return { ...row, back_qty: nextQty };
  });

  if (changed) {
    setFinalOrderList(updated);
  }

  if (typeof window.renderFrontStock === "function") window.renderFrontStock();
  if (typeof window.renderFrontSearchResults === "function") window.renderFrontSearchResults();
}

function addOrder(item, qty, silent = false) {
  if (isCurrentOrderPlaced()) {
    if (!silent) toast("Order is placed and Back Stock is locked");
    return false;
  }

  qty = String(qty || "").trim();

  if (!qty || Number(qty) <= 0) {
    const before = order();
    const after = before.filter(x => String(x.code) !== String(item.code));
    setBackStockList(after);
    syncFinalOrderBackStock(item.code, "");
    touch(item.code);
    renderOrder();
    renderLookup();
    renderFavorites();
    renderRecent();
    if (typeof window.renderFrontStock === "function") window.renderFrontStock();
    if (typeof window.renderFrontSearchResults === "function") window.renderFrontSearchResults();
    if (!silent && before.length !== after.length) toast(`${item.item_name} removed from back stock`);
    return true;
  }

  let current = order().filter(x => String(x.code) !== String(item.code));
  current.unshift({
    code: item.code,
    qty,
    item_name: item.item_name,
    addedAt: new Date().toISOString()
  });
  setBackStockList(current);
  syncFinalOrderBackStock(item.code, qty);
  touch(item.code);
  renderOrder();
  renderLookup();
  renderFavorites();
  renderRecent();
  if (typeof window.renderFrontStock === "function") window.renderFrontStock();
  if (typeof window.renderFrontSearchResults === "function") window.renderFrontSearchResults();
  if (!silent) toast(`${item.item_name} added to back stock: ${qty}`);
  return true;
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

function isOrg(x){return productService.isOrganic(x)}function isPackaged(x){return productService.isPackaged(x)}
function getResults(){return productService.search({query:q.value,filter,limit:100})}
function byCodes(codes){return productService.byCodes(codes)}
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

function renderLookup(){const a=getResults();results.innerHTML="";count.textContent=q.value.trim()?`${a.length} found`:`${items.length} items`;if(!a.length){renderNotFound(q.value.trim());return}hide();const f=document.createDocumentFragment();a.forEach(x=>f.appendChild(card(x,"lookup")));results.appendChild(f)}
function renderFavorites(){const box=document.getElementById("favoritesResults");box.innerHTML="";const a=byCodes(favs());if(!a.length){box.innerHTML='<section class="message">No favorites yet. Tap ☆ on an item.</section>';return}a.forEach(x=>box.appendChild(card(x)))}
function renderRecent(){const box=document.getElementById("recentResults");box.innerHTML="";const a=byCodes(recents());if(!a.length){box.innerHTML='<section class="message">No recent items yet.</section>';return}a.forEach(x=>box.appendChild(card(x)))}
function renderOrder(){
  const box=document.getElementById("orderResults");
  if(!box)return;
  box.innerHTML="";
  const o=order();
  const locked=isCurrentOrderPlaced();
  if(!o.length){box.innerHTML='<section class="message">No back stock items yet. Add items from Lookup.</section>';return}
  o.forEach(row=>{
    const item=items.find(x=>String(x.code)===String(row.code))||row;
    const e=document.createElement("article");
    e.className="order-item";
    e.innerHTML=`<div class="order-row"><div><h3></h3><div class="code"></div></div><div class="qty"></div></div><div class="barcode"></div><div class="actions"><button type="button" class="edit-order-qty">Edit Qty</button><button type="button" class="danger remove-order">Remove</button></div>`;
    e.querySelector("h3").textContent=item.item_name;
    e.querySelector(".code").textContent=row.code;
    e.querySelector(".qty").textContent=row.qty;
    window.BarcodeRenderer.render(e.querySelector(".barcode"),row.code);
    const edit=e.querySelector(".edit-order-qty");
    const remove=e.querySelector(".remove-order");
    edit.disabled=locked;
    remove.disabled=locked;
    edit.onclick=()=>{
      if(isCurrentOrderPlaced()){toast("Order is placed and Back Stock is locked");return}
      const q=prompt("Quantity:",row.qty);
      if(q===null)return;
      addOrder(item,q,true);
    };
    remove.onclick=()=>{
      if(isCurrentOrderPlaced()){toast("Order is placed and Back Stock is locked");return}
      addOrder(item,"",true);
    };
    box.appendChild(e);
  });
}

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

function productImages(item){return window.ImageLibrary?.normalizeImages(item)||[]}
function primaryProductImage(item){return window.ImageLibrary?.primaryImage(item)||""}
function attachImageGallery(target,item){
  if(!target)return;
  const images=productImages(item);
  if(!images.length)return;
  target.classList.add("has-gallery");
  target.setAttribute("role","button");
  target.setAttribute("tabindex","0");
  target.setAttribute("aria-label",`View ${images.length>1?images.length+" images":"image"} for ${item.item_name||"product"}`);
  const open=event=>{event?.preventDefault?.();event?.stopPropagation?.();window.ImageGallery?.open({images,title:item.item_name||"Product"})};
  target.addEventListener("click",open);
  target.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();open(event)}});
}

function lookupCard(x) {
  const e = document.createElement("article");
  e.className = "lookup-product-card" + (isOrg(x) ? " is-organic" : "");
  const existingQty = getOrderQty(x.code);

  e.innerHTML = `<div class="lookup-product-main">
    <div class="lookup-product-image"><div class="thumb placeholder">No image</div></div>
    <div class="lookup-product-copy">
      <div class="lookup-product-title-row"><h2 class="name"></h2><button class="fav lookup-fav" type="button" aria-label="Toggle favorite"></button></div>
      <div class="lookup-product-meta"></div>
      <div class="lookup-product-code"><span>PLU / Code</span><strong class="code"></strong></div>
    </div>
  </div>
  <div class="barcode lookup-barcode"></div>
  <div class="lookup-product-controls">
    <div class="lookup-qty-copy"><span>Back Stock</span><small>Today's quantity</small></div>
    <div class="lookup-qty-stepper" role="group" aria-label="Back stock quantity">
      <button class="qty-step qty-minus" type="button" aria-label="Decrease quantity">−</button>
      <input class="qty-input" type="number" inputmode="decimal" min="0" step="1" placeholder="0" aria-label="Back stock quantity">
      <button class="qty-step qty-plus" type="button" aria-label="Increase quantity">+</button>
    </div>
    <span class="save-status" aria-live="polite"></span>
  </div>
  <div class="lookup-product-actions">
    <button class="copy" type="button"><span aria-hidden="true">⧉</span> Copy code</button>
    <a target="_blank" rel="noopener"><span aria-hidden="true">↗</span> Save-On</a>
  </div>`;

  e.querySelector(".name").textContent = x.item_name;
  e.querySelector(".code").textContent = x.code;

  const meta=e.querySelector(".lookup-product-meta");
  const values=[x.brand,x.quantity,x.category,isOrg(x)?"Organic":"",isPackaged(x)?"Packaged":"Produce"].filter(Boolean);
  values.forEach((value,index)=>{
    const s=document.createElement("span");
    s.className="lookup-meta-pill" + (value==="Organic"?" is-organic":"") + (index>1?" is-muted":"");
    s.textContent=value;
    meta.appendChild(s);
  });

  const src=primaryProductImage(x);
  if(src){
    const img=document.createElement("img");
    img.className="thumb";
    img.alt=x.item_name;
    img.src=src;
    img.onerror=()=>img.replaceWith(placeholder());
    e.querySelector(".thumb").replaceWith(img);
    attachImageGallery(img,x);
  }

  window.BarcodeRenderer.render(e.querySelector(".lookup-barcode"),x.code);

  const fav=e.querySelector(".lookup-fav");
  const updateFav=()=>{
    const on=isFav(x.code);
    fav.textContent=on?"★":"☆";
    fav.classList.toggle("fav-on",on);
    fav.setAttribute("aria-label",on?"Remove from favorites":"Add to favorites");
  };
  updateFav();
  fav.onclick=()=>toggleFav(x.code);

  const qtyInput=e.querySelector(".qty-input");
  const qtyMinus=e.querySelector(".qty-minus");
  const qtyPlus=e.querySelector(".qty-plus");
  const saveStatus=e.querySelector(".save-status");
  const locked=isCurrentOrderPlaced();
  qtyInput.value=existingQty||"";
  qtyInput.disabled=locked;
  qtyMinus.disabled=locked;
  qtyPlus.disabled=locked;
  e.classList.toggle("is-order-locked",locked);
  if(locked){
    saveStatus.textContent="Locked";
    saveStatus.classList.add("locked");
    qtyInput.setAttribute("aria-label","Back stock quantity locked because today's order is placed");
  }else if(existingQty){
    saveStatus.textContent="Saved";
    saveStatus.classList.add("saved");
  }

  let saveTimer=null;
  const saveQuantity=(immediate=false)=>{
    if(isCurrentOrderPlaced()){
      qtyInput.value=getOrderQty(x.code)||"";
      saveStatus.textContent="Locked";
      saveStatus.classList.remove("saved");
      saveStatus.classList.add("locked");
      return;
    }
    clearTimeout(saveTimer);
    const qty=qtyInput.value.trim();
    const persist=()=>{
      addOrder(x,qty,true);
      if(qty && Number(qty)>0){saveStatus.textContent="Saved";saveStatus.classList.add("saved")}
      else{saveStatus.textContent="";saveStatus.classList.remove("saved")}
    };
    if(immediate){persist();return}
    saveStatus.textContent=qty&&Number(qty)>0?"Saving...":"Removed";
    saveStatus.classList.remove("saved");
    saveTimer=setTimeout(persist,400);
  };
  qtyInput.addEventListener("input",()=>saveQuantity(false));
  qtyInput.addEventListener("change",()=>saveQuantity(true));
  qtyMinus.onclick=()=>{
    const next=Math.max(0,(Number(qtyInput.value)||0)-1);
    qtyInput.value=next===0?"":String(next);
    saveQuantity(true);
  };
  qtyPlus.onclick=()=>{
    qtyInput.value=String((Number(qtyInput.value)||0)+1);
    saveQuantity(true);
  };

  const copy=e.querySelector(".copy");
  copy.onclick=async()=>{
    try{await navigator.clipboard.writeText(x.code)}catch{}
    touch(x.code);
    copy.innerHTML='<span aria-hidden="true">✓</span> Copied';
    setTimeout(()=>copy.innerHTML='<span aria-hidden="true">⧉</span> Copy code',900);
    renderRecent();
  };
  const link=e.querySelector("a");
  link.href=SAVE_ON_BASE+encodeURIComponent(x.code);
  link.onclick=()=>touch(x.code);
  return e;
}

function card(x, variant="default") {
  if (variant === "lookup") return lookupCard(x);
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

  const src = primaryProductImage(x);
  if (src) {
    const img = document.createElement("img");
    img.className = "thumb";
    img.alt = x.item_name;
    img.src = src;
    img.onerror = () => img.replaceWith(placeholder());
    e.querySelector(".thumb").replaceWith(img);
    attachImageGallery(img,x);
  }

  window.BarcodeRenderer.render(e.querySelector(".barcode"),x.code);

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
function renderCatalogUpdate(state={}){
  const card=document.getElementById("catalogUpdateCard");
  const message=document.getElementById("catalogUpdateMessage");
  const localVersion=document.getElementById("localCatalogVersion");
  const remoteVersion=document.getElementById("remoteCatalogVersion");
  const updatedDate=document.getElementById("catalogUpdateDate");
  const updateButton=document.getElementById("updateCatalogBtn");
  const checkButton=document.getElementById("checkCatalogUpdateBtn");
  if(!card||!message)return;
  const status=state.status||"checking";
  card.dataset.status=status;
  message.textContent=state.message||"Checking for catalog updates...";
  if(localVersion)localVersion.textContent=state.localVersion||productService?.getLocalVersion?.()||"—";
  if(remoteVersion)remoteVersion.textContent=state.remoteVersion||"—";
  if(updatedDate){
    if(state.remoteUpdatedAt){
      const parsed=new Date(state.remoteUpdatedAt);
      updatedDate.textContent=Number.isNaN(parsed.getTime())?`Published: ${state.remoteUpdatedAt}`:`Published: ${parsed.toLocaleString()}`;
    }else updatedDate.textContent="";
  }
  if(updateButton){
    updateButton.hidden=status!=="available";
    updateButton.disabled=status==="downloading";
  }
  if(checkButton)checkButton.disabled=status==="checking"||status==="downloading";
}
function activateView(v){
  const target=document.getElementById(v+"View");
  if(!target){console.warn(`[View] Unknown view: ${v}`);return false}
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===v));
  document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
  target.classList.add("active");

  // Keep route-driven navigation (including browser Back/Forward) in sync
  // with the fixed Lookup heading. Previously this was refreshed mainly by
  // click handlers, so hashchange navigation could leave the old heading visible.
  const lookupHeader=document.getElementById("lookupFixedHeader");
  if(lookupHeader) lookupHeader.hidden=(v!=="lookup");

  renderAll();
  window.dispatchEvent(new Event("app:viewchange"));
  return true
}
function switchView(v,options={}){
  if(window.AppRouter&&!options.fromRouter){
    return window.AppRouter.navigate(v)
  }
  return activateView(v)
}
q.addEventListener("input",renderLookup);document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>switchView(t.dataset.view));document.querySelectorAll(".filters button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;renderLookup()});
function initAdvancedToggle(){const btn=document.getElementById("advancedToggle"),controls=document.getElementById("advancedControls");if(!btn||!controls)return;function set(open){controls.hidden=!open;btn.setAttribute("aria-expanded",String(open));if (open) {
    btn.textContent = "✕";
  } else {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5H21L14 13V19L10 21V13L3 5Z"/></svg>`;
  }localStorage.setItem("plu_advanced_open",open?"1":"0")}set(localStorage.getItem("plu_advanced_open")==="1");btn.onclick=e=>{e.preventDefault();set(controls.hidden)}}
async function importCatalogCsv(file, mode){
  if(!file)return;
  try{
    const result=await productController.importCsv(await file.text(),{mode});
    const stats=result?.stats||{};
    if(mode==="merge"){
      setSync(`CSV merged: ${stats.added||0} added, ${stats.updated||0} updated, ${stats.skipped||0} skipped. Total ${items.length}.`);
    }else{
      setSync(`Local catalog replaced (${items.length} items).`);
    }
  }catch(error){
    console.error("[Catalog import]",error);
    setSync(error?.message||"Unable to import CSV.","warn");
  }
}

document.getElementById("csvMergeUpload")?.addEventListener("change",async e=>{
  const file=e.target.files[0];
  await importCatalogCsv(file,"merge");
  e.target.value="";
});

document.getElementById("csvReplaceUpload")?.addEventListener("change",async e=>{
  const file=e.target.files[0];
  if(file&&confirm("Replace this device's entire local store catalog with the selected CSV? Existing items not present in the file will be removed. This cannot affect another store or the shared master catalog.")){
    await importCatalogCsv(file,"replace");
  }
  e.target.value="";
});
document.getElementById("checkCatalogUpdateBtn")?.addEventListener("click",async()=>{
  renderCatalogUpdate({status:"checking",localVersion:productService.getLocalVersion(),message:"Checking for a newer catalog version..."});
  await productController.checkForUpdate();
});
document.getElementById("updateCatalogBtn")?.addEventListener("click",async()=>{
  if(!confirm("Download and install the available product catalog update on this device? Your existing local catalog will be preserved if the update fails."))return;
  try{await productController.applyAvailableUpdate()}catch(_){/* UI already reports the error. */}
});
document.getElementById("resetBtn").onclick=async()=>{await productController.reset();await checkForCSVUpdate()};document.getElementById("clearRecentBtn").onclick=()=>{setJSON(key("recent"),[]);renderRecent()};document.getElementById("clearOrderBtn").onclick=()=>{if(confirm("Clear back stock?")){setBackStockList([]);renderOrder()}};
document.getElementById("exportOrderBtn").onclick=()=>downloadCSV("back-stock.csv",["item_name,code,quantity",...order().map(o=>`"${(o.item_name||"").replaceAll('"','""')}",${o.code},"${String(o.qty).replaceAll('"','""')}"`)].join("\n"));document.getElementById("exportProfileBtn").onclick=()=>{const data={favorites:favs(),recent:recents(),order:order(),exportedAt:new Date().toISOString()};downloadFile("plu-profile.json",JSON.stringify(data,null,2),"application/json")};document.getElementById("importProfile")?.addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;const data=JSON.parse(await f.text());if(data.favorites)setJSON(key("favorites"),data.favorites);if(data.recent)setJSON(key("recent"),data.recent);if(data.order)setBackStockList(data.order);renderAll()});
function downloadCSV(n,t){downloadFile(n,t,"text/csv")}function downloadFile(n,t,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([t],{type}));a.download=n;a.click();URL.revokeObjectURL(a.href)}
function positionScannerDetection(code){
 const video=document.getElementById("scannerVideo"),box=document.getElementById("scannerDetectionBox");
 if(!video||!box||!video.videoWidth||!video.videoHeight)return false;
 const rect=video.getBoundingClientRect();
 let left,top,width,height;
 if(Array.isArray(code.cornerPoints)&&code.cornerPoints.length){
  const xs=code.cornerPoints.map(p=>Number(p.x)||0),ys=code.cornerPoints.map(p=>Number(p.y)||0);
  left=Math.min(...xs);top=Math.min(...ys);width=Math.max(...xs)-left;height=Math.max(...ys)-top;
 }else if(code.boundingBox){
  left=Number(code.boundingBox.x)||0;top=Number(code.boundingBox.y)||0;width=Number(code.boundingBox.width)||0;height=Number(code.boundingBox.height)||0;
 }else{return false}
 const sx=rect.width/video.videoWidth,sy=rect.height/video.videoHeight;
 box.style.left=`${Math.max(0,left*sx)}px`;box.style.top=`${Math.max(0,top*sy)}px`;
 box.style.width=`${Math.max(30,width*sx)}px`;box.style.height=`${Math.max(22,height*sy)}px`;
 box.classList.add("visible");return true;
}
function handleScannerResult(value,context){
 const val=String(value||"").trim();if(!val)return;
 touch(val);
 if(context==="finalOrder"){
  const input=document.getElementById("frontQ");if(input)input.value=val;
  switchView("frontStock");
  if(typeof renderFrontSearchResults==="function")renderFrontSearchResults();
  setTimeout(()=>document.querySelector("#frontSearchResults .front-qty-input")?.focus(),80);
  return;
 }
 if(context==="shrink"){
  const input=document.getElementById("shrinkSearchInput");
  if(input){
   input.value=val;
   switchView("shrink");
   input.dispatchEvent(new Event("input",{bubbles:true}));
   setTimeout(()=>input.focus(),80);
  }
  return;
 }
 q.value=val;switchView("lookup");renderLookup();if(!getResults().length)renderNotFound(val);
}
async function startScanner(context="lookup"){
 if(!("BarcodeDetector" in window)){alert("Camera barcode scanner is not supported in this browser. Try Android Chrome. Bluetooth scanner can still type into search.");return}
 scannerContext=context||"lookup";scannerAccepting=false;
 const modal=document.getElementById("scannerModal"),video=document.getElementById("scannerVideo"),status=document.getElementById("scannerStatus"),box=document.getElementById("scannerDetectionBox");
 if(box){box.classList.remove("visible");box.removeAttribute("style")}
 modal.hidden=false;status.textContent=scannerContext==="finalOrder"?"Point camera at a barcode to add it to Final Order.":scannerContext==="shrink"?"Point camera at a barcode to find the product for Shrink Count.":"Point camera at barcode.";
 try{
  scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});video.srcObject=scannerStream;await video.play();
  const detector=new BarcodeDetector({formats:["code_128","ean_13","upc_a","upc_e","ean_8"]});
  scannerTimer=setInterval(async()=>{if(scannerAccepting)return;try{const codes=await detector.detect(video);if(!codes.length){box?.classList.remove("visible");return}const code=codes[0],val=code.rawValue;if(!val)return;scannerAccepting=true;positionScannerDetection(code);status.textContent=`Detected ${val}`;if(navigator.vibrate)navigator.vibrate(80);setTimeout(()=>{const target=scannerContext;stopScanner();handleScannerResult(val,target)},420)}catch{}},350);
 }catch(e){status.textContent="Camera unavailable. Check permission/HTTPS."}
}
function stopScanner(){const modal=document.getElementById("scannerModal"),video=document.getElementById("scannerVideo"),box=document.getElementById("scannerDetectionBox");modal.hidden=true;if(scannerTimer)clearInterval(scannerTimer);scannerTimer=null;if(scannerStream)scannerStream.getTracks().forEach(t=>t.stop());scannerStream=null;video.srcObject=null;scannerAccepting=false;if(box){box.classList.remove("visible");box.removeAttribute("style")}}
document.getElementById("scanBtn").onclick=()=>startScanner("lookup");
document.getElementById("shrinkScanBtn")?.addEventListener("click",()=>startScanner("shrink"));
document.getElementById("closeScannerBtn").onclick=stopScanner;
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
        images: window.ImageLibrary?.normalizeImages(row) || [],
        image_url: row.image_url || row.imageUrl || "",
        image_local: row.image_local || row.image || "",
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

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.getElementById("installBtn").hidden=false});document.getElementById("installBtn").onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById("installBtn").hidden=true}};if(window.AppUpdateManager){
  window.appUpdateManager=new AppUpdateManager({
    versionsUrl:window.AppConfig?.urls?.versions,
    currentVersion:window.AppConfig?.app?.version
  });
  window.appUpdateManager.init().catch(error=>console.warn("[App update]",error));
}
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


/* v52.2.2 Missing item multi-image editor */
const missingImageEditor = window.ImageListEditor?.create({
  root: "#missingImagesEditor",
  input: "[data-image-input]",
  addButton: "[data-image-add]",
  list: "[data-image-list]",
  count: "[data-image-count]",
  legacyUrl: "#missingImageUrl",
  legacyLocal: "#missingImageLocal"
});

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
    missingImageEditor?.setImages(row ? (window.ImageLibrary?.normalizeImages(row) || []) : []);
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
      images: window.ImageLibrary?.normalizeImages([...(formData.images||[]),formData.image_local,formData.image_url]) || [],
      image_url: formData.image_url,
      image_local: formData.image_local,
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
        image_url: document.getElementById("missingImageUrl").value.trim(),
        image_local: document.getElementById("missingImageLocal").value.trim(),
        images: missingImageEditor?.getImages() || window.ImageLibrary?.normalizeImages([document.getElementById("missingImageLocal").value.trim(),document.getElementById("missingImageUrl").value.trim()]) || [],
        notes: document.getElementById("missingNotes").value.trim()
      });
    });
  }

  const exportBtn = document.getElementById("exportMissingBtn");
  if (exportBtn) {
    exportBtn.onclick = () => {
      const list = (typeof missingItems === "function") ? missingItems() : safeGetJSON(storeKey("missing"), []);
      const rows = [
        "term,item_name,brand,quantity,unit,category,organic,images,image_url,image_local,notes,date",
        ...list.map(x => [
          x.term || "", x.item_name || "", x.brand || "", x.quantity || "",
          x.unit || "", x.category || "", x.organic || "", window.ImageLibrary?.serializeImages(x)||"[]", x.image_url || "", x.image_local || "", x.notes || "", x.date || ""
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
    const headers = ["item_name","code","quantity","brand","category","type","images","image_local","image_url","notes","aliases","search_keywords","organic"];
    const lines = [headers.join(",")];
    rows.forEach(r => {
      const obj = normalize ? r : r;
      const line = headers.map(h => csvEscape(h === "images" ? (window.ImageLibrary?.serializeImages(obj.images || obj) || "[]") : (obj[h] || ""))).join(",");
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
        images:window.ImageLibrary?.serializeImages(x)||"[]",
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
      images: window.ImageLibrary?.normalizeImages(row) || [],
      image_local: row.image_local || "",
      image_url: row.image_url || "",
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
      const headers = ["item_name","code","quantity","brand","category","type","images","image_local","image_url","notes","aliases","search_keywords","organic"];
      return headers.map(h => csvEscape(h === "images" ? (window.ImageLibrary?.serializeImages(r.images || r) || "[]") : (r[h] || ""))).join(",");
    });
    const updatedCSV = existingCSV + "\n" + newCSVLines.join("\n");

    const hash = (typeof sha256Short === "function") ? await sha256Short(updatedCSV) : String(Date.now());
    localStorage.setItem(STORAGE_CSV, updatedCSV);
    localStorage.setItem(STORAGE_HASH, hash);
    await productController.importCsv(updatedCSV);

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

      const missingImage = window.ImageLibrary?.primaryImage(row) || row.image_local || row.image_url || "";
      e.innerHTML = `
        ${missingImage ? `<img class="missing-thumb" src="${String(missingImage).replaceAll('"','&quot;')}" alt="">` : ""}
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

      const missingThumb=e.querySelector(".missing-thumb");
      if(missingThumb) attachImageGallery(missingThumb,row);
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

window.getResults=function(){return productService.search({query:q.value,filter,limit:100,isArchived:isArchivedItem,isSeasonal:isSeasonalItem,includeArchived:false})};

window.archiveCatalogItem=function(code){const a=archivedCodes();if(!a.includes(String(code)))a.unshift(String(code));setArchivedCodes(a);renderAll();toast("Item archived")};
window.restoreCatalogItem=function(code){setArchivedCodes(archivedCodes().filter(x=>x!==String(code)));renderAll();toast("Item restored")};

const oldCard=card;
window.card=function(x){const e=oldCard(x);const badges=e.querySelector(".badges");if(badges&&isSeasonalItem(x)){const s=document.createElement("span");s.className="badge seasonal";s.textContent=[x.season,x.festival].filter(Boolean).join(" / ")||"Seasonal";badges.appendChild(s)}const actions=e.querySelector(".actions");if(actions&&!actions.querySelector(".archive-catalog")){const b=document.createElement("button");b.type="button";b.className="archive-catalog";b.textContent="Archive";b.onclick=()=>archiveCatalogItem(x.code);actions.appendChild(b);actions.style.gridTemplateColumns="repeat(4,1fr)"}return e};

window.renderArchive=function(){const box=document.getElementById("archiveResults");if(!box)return;box.innerHTML="";const arr=(items||[]).filter(isArchivedItem);if(!arr.length){box.innerHTML='<section class="message">No archived catalog items yet.</section>';return}arr.forEach(x=>{const e=document.createElement("article");e.className="card archive-card";e.innerHTML='<div class="top"><div class="thumb placeholder">Archived</div><div><h2 class="name"></h2><div class="badges"></div><div class="code"></div></div></div><div class="actions"><button type="button" class="restore-catalog">Restore</button><a target="_blank" rel="noopener">Check Save-On</a></div>';e.querySelector(".name").textContent=x.item_name;e.querySelector(".code").textContent=x.code;const bd=e.querySelector(".badges");[x.brand,x.quantity,x.category,x.organic,x.season,x.festival].filter(Boolean).forEach(v=>{const s=document.createElement("span");s.className="badge";s.textContent=v;bd.appendChild(s)});e.querySelector(".restore-catalog").onclick=()=>restoreCatalogItem(x.code);e.querySelector("a").href=SAVE_ON_BASE+encodeURIComponent(x.code);box.appendChild(e)})};

const oldRenderAll=renderAll;window.renderAll=function(){oldRenderAll();renderArchive()};

window.currentItemsCSV=function(){const headers=["item_name","code","quantity","brand","category","type","images","image_local","image_url","notes","aliases","search_keywords","organic","is_archived","is_seasonal","season","festival"];const lines=[headers.join(",")];(items||[]).forEach(x=>{const search=[x.item_name,x.code,x.quantity,x.brand,x.category,x.type,x.notes,x.aliases,x.organic,x.season,x.festival].filter(Boolean).join(" ").toUpperCase();const row={item_name:x.item_name||"",code:x.code||"",quantity:x.quantity||"",brand:x.brand||"",category:x.category||"",type:x.type||((String(x.code).length>6)?"packaged":"produce"),images:window.ImageLibrary?.serializeImages(x)||"[]",image_local:x.image_local||"",image_url:x.image_url||"",notes:x.notes||"",aliases:x.aliases||"",search_keywords:x.hay?x.hay.toUpperCase():search,organic:x.organic||(isOrg(x)?"Organic":"Conventional"),is_archived:isArchivedItem(x)?"Yes":"",is_seasonal:isSeasonalItem(x)?"Yes":"",season:x.season||"",festival:x.festival||""};lines.push(headers.map(h=>csvEscape(row[h]||"")).join(","))});return lines.join("\n")};

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
    const headers = ["item_name","code","quantity","brand","category","type","images","image_local","image_url","notes","aliases","search_keywords","organic","is_archived","is_seasonal","season","festival"];
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
        images:window.ImageLibrary?.serializeImages(x)||"[]",
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

      const src = primaryProductImage(x);
      if (src) {
        const img = document.createElement("img");
        img.className = "thumb";
        img.alt = x.item_name;
        img.src = src;
        img.onerror = () => {};
        e.querySelector(".thumb").replaceWith(img);
        attachImageGallery(img,x);
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
      if (missingImageEditor) missingImageEditor.setImages(row ? (window.ImageLibrary?.normalizeImages(row) || []) : []);
    };
  }

  const oldSaveMissingDetailsV14 = window.saveMissingDetails;
  if(oldSaveMissingDetailsV14){
    window.saveMissingDetails = function(formData){
      const editorImages = missingImageEditor?.getImages() || formData.images || [];
      formData.images = window.ImageLibrary?.normalizeImages(editorImages) || [];
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
        "term,item_name,brand,quantity,unit,category,organic,is_seasonal,season,festival,images,image_url,image_local,notes,date",
        ...missingItems().map(x => [
          x.term||"", x.item_name||"", x.brand||"", x.quantity||"", x.unit||"", x.category||"",
          x.organic||"", x.is_seasonal||"", x.season||"", x.festival||"", window.ImageLibrary?.serializeImages(x)||"[]",
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

  // Shared by fixed-page headers (such as Lookup) so every info button uses the same tooltip UI.
  window.showSectionInfoTooltip = showTip;

  function setupReplaceCatalogInfo(){
    const button=document.getElementById("replaceCatalogInfoBtn");
    if(!button || button.dataset.tooltipReady==="1") return;
    button.dataset.tooltipReady="1";
    button.addEventListener("click",e=>{
      e.preventDefault();
      e.stopPropagation();
      showTip(
        "Replace Local Catalog affects only this device's local store catalog. It does not update the shared master catalog or any other store. Existing local products that are not in the uploaded CSV will be removed.",
        button
      );
    });
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

  function apply(){setupHeaders(); setupReplaceCatalogInfo(); stepper(); cards();}
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
function frontStock(){return getFinalOrderList()}
function setFrontStock(v){setFinalOrderList(v)}
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
 if(!query){
  if(!frontStock().length){
   box.innerHTML='<section class="message compact-msg final-order-empty-guide"><strong>Start today’s Final Order</strong><span>Search or scan a product, then enter the quantity you want to order. Your saved Back Stock quantity will appear beside it.</span></section>';
  }
  return;
 }
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
 if(!list.length){return}
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
 const scan=document.getElementById("frontScanBtn"); if(scan)scan.onclick=()=>startScanner("finalOrder");
 const ex=document.getElementById("exportFrontStockBtn"); if(ex)ex.onclick=exportFront;
 const comb=document.getElementById("exportCombinedStockBtn"); if(comb)comb.onclick=exportCombined;
 const clr=document.getElementById("clearFrontStockBtn"); if(clr)clr.onclick=()=>{if(confirm("Clear final order list?")){setFrontStock([]);renderFrontStock();renderFrontSearchResults()}};
 renderFrontStock(); renderFrontSearchResults();
});
})();


/* v27 left drawer + workflow shell */
(function(){
function ready(f){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",f,{once:true}):f()}
function status(){return currentOrderStatus()}
function setStatus(s){setCurrentOrderStatus(s);summary();lockState()}
function finalList(){try{return getFinalOrderList()}catch{return[]}}
function openDrawer(){let d=document.getElementById("appDrawer"),b=document.getElementById("drawerBackdrop");if(!d)return;d.classList.add("open");d.setAttribute("aria-hidden","false");if(b)b.hidden=false;document.body.classList.add("drawer-open")}
function closeDrawer(){let d=document.getElementById("appDrawer"),b=document.getElementById("drawerBackdrop");if(!d)return;d.classList.remove("open");d.setAttribute("aria-hidden","true");if(b)b.hidden=true;document.body.classList.remove("drawer-open")}
function tools(){closeDrawer();let p=document.getElementById("topToolsPanel");if(p){p.hidden=false;p.style.display="flex";document.body.classList.add("tools-open")}}
function go(v){closeDrawer();switchView(v);setTimeout(summary,50)}
function dashboardDateLabel(){
 const d=new Date();
 return d.toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
}
function renderDashboardRecentProducts(){
 const box=document.getElementById("dashRecentProducts"); if(!box)return;
 const recentItems=(typeof byCodes==="function"?byCodes(recents()):[]).slice(0,4);
 box.innerHTML="";
 if(!recentItems.length){box.innerHTML='<div class="dashboard-empty-mini">No recent products yet. Search or scan an item and it will appear here.</div>';return}
 recentItems.forEach(item=>{
  const row=document.createElement("button"); row.type="button"; row.className="dashboard-recent-row";
  const image=primaryProductImage(item);
  row.innerHTML=`<span class="dashboard-recent-thumb">${image?`<img src="${image}" alt="${item.item_name||item.name||"Product"}">`:'<span aria-hidden="true">▧</span>'}</span><span class="dashboard-recent-copy"><b>${item.name||item.item_name||"Product"}</b><small>${item.brand?item.brand+" • ":""}PLU ${item.code||"—"}</small></span><span class="dashboard-recent-arrow">›</span>`;
  if(image){const recentImg=row.querySelector(".dashboard-recent-thumb img");attachImageGallery(recentImg,item)}
  row.onclick=()=>{if(q){q.value=item.code||item.name||""}go("lookup")};
  box.appendChild(row);
 });
}
function renderDashboardAttention(miss){
 const box=document.getElementById("dashAttentionList"); if(!box)return;
 box.innerHTML="";
 const notices=[];
 if(miss>0) notices.push({icon:"!",tone:"danger",title:`${miss} missing item${miss===1?"":"s"}`,text:"Review products that could not be found.",action:()=>go("missing")});
 const catalogCard=document.getElementById("catalogUpdateCard");
 if(catalogCard?.dataset?.status==="available") notices.push({icon:"↻",tone:"warning",title:"Catalog update available",text:"New product data is ready to download.",action:()=>go("dataTools")});
 const appBanner=document.getElementById("appUpdateBanner");
 if(appBanner && !appBanner.hidden) notices.push({icon:"↑",tone:"info",title:"App update available",text:"A newer app version is ready to install.",action:()=>appBanner.scrollIntoView({behavior:"smooth",block:"start"})});
 if(!notices.length){box.innerHTML='<div class="dashboard-all-clear"><span>✓</span><div><b>All caught up</b><small>No urgent items need attention.</small></div></div>';return}
 notices.forEach(n=>{const b=document.createElement("button");b.type="button";b.className=`dashboard-attention-row is-${n.tone}`;b.innerHTML=`<span class="dashboard-attention-icon">${n.icon}</span><span><b>${n.title}</b><small>${n.text}</small></span><span class="dashboard-recent-arrow">›</span>`;b.onclick=n.action;box.appendChild(b)});
}
function renderDashboardRecentOrders(){
 const box=document.getElementById("dashRecentOrders"); if(!box)return;
 const history=getOrderHistoryList().slice(0,4);
 box.innerHTML="";
 if(!history.length){box.innerHTML='<div class="dashboard-empty-mini">No placed orders yet. Completed orders will appear here.</div>';return}
 history.forEach(h=>{
  const d=new Date((h.date||"")+"T12:00:00");
  const dateLabel=Number.isNaN(d.getTime())?(h.date||"Order"):d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
  const row=document.createElement("button");row.type="button";row.className="dashboard-order-history-row";
  row.innerHTML=`<span><b>${dateLabel}</b><small>${(h.backStock||[]).length} back stock • ${(h.finalOrder||[]).length} order items</small></span><span class="dashboard-history-status">${h.status||"Placed"}</span><span class="dashboard-recent-arrow">›</span>`;
  row.onclick=()=>go("orders"); box.appendChild(row);
 });
}
function renderDashboardWorkflow(back,fin,miss,st){
 const date=document.getElementById("dashBusinessDate"); if(date)date.textContent=dashboardDateLabel();
 const greeting=document.getElementById("dashGreeting"); if(greeting){const hr=new Date().getHours();greeting.textContent=hr<12?"Good morning":hr<17?"Good afternoon":"Good evening"}
 const hero=document.getElementById("dashHeroStatus"); if(hero){hero.textContent=st;hero.className=`dashboard-status-pill ${st==="Placed"?"status-placed":"status-draft"}`}
 const steps=document.querySelectorAll("[data-dash-step]"); steps.forEach(x=>x.classList.remove("is-active","is-done"));
 const backStep=document.querySelector('[data-dash-step="back"]'),finalStep=document.querySelector('[data-dash-step="final"]'),placedStep=document.querySelector('[data-dash-step="placed"]');
 if(st==="Placed"){backStep?.classList.add("is-done");finalStep?.classList.add("is-done");placedStep?.classList.add("is-done","is-active")}
 else if(fin>0){backStep?.classList.add("is-done");finalStep?.classList.add("is-active")}
 else{backStep?.classList.add("is-active")}
 const primary=document.getElementById("dashContinuePrimaryBtn"); if(primary){primary.textContent=fin>0?"Continue Final Order":back>0?"Continue Back Stock":"Start Back Stock";primary.disabled=st==="Placed";primary.onclick=()=>go(fin>0?"frontStock":"order")}
 const place=document.getElementById("dashMarkPlacedBtn"); if(place){place.hidden=st==="Placed";place.disabled=fin===0}
 renderDashboardAttention(miss); renderDashboardRecentProducts(); renderDashboardRecentOrders();
}
window.refreshWorkflowSummary=summary;
function summary(){
 let back=(typeof order==="function"?order():[]).length, fin=finalList().length, miss=(typeof missingItems==="function"?missingItems():[]).length, st=status();
 [["dashBackCount",back],["orderBackCount",back],["dashFinalCount",fin],["orderFinalCount",fin],["dashMissingCount",miss]].forEach(([i,v])=>{let e=document.getElementById(i);if(e)e.textContent=v});
 ["dashOrderStatus","orderSessionStatus"].forEach(i=>{let e=document.getElementById(i);if(e){e.textContent=st;e.className=st==="Placed"?"status-placed":"status-draft"}});
 renderDashboardWorkflow(back,fin,miss,st);
}
function lockState(){let locked=status()==="Placed";document.body.classList.toggle("order-locked",locked);document.querySelectorAll("#orderView input,#orderView button,#frontStockView input,#frontStockView button").forEach(el=>{if(el.id==="unlockOrderBtn"||el.id==="backToBackStockBtn")return;el.disabled=locked})}
ready(function(){
 document.getElementById("drawerBtn")?.addEventListener("click",openDrawer);
 document.getElementById("closeDrawerBtn")?.addEventListener("click",closeDrawer);
 document.getElementById("drawerBackdrop")?.addEventListener("click",closeDrawer);
 document.querySelectorAll("[data-drawer-action]").forEach(btn=>btn.onclick=()=>{let a=btn.dataset.drawerAction;if(a==="dashboard")go("dashboard");else if(a==="lookup")go("lookup");else if(a==="back-stock")go("order");else if(a==="final-order")go("frontStock");else if(a==="favorites")go("favorites");else if(a==="recent")go("recent");else if(a==="orders"||a==="today-order")go("orders");else if(a==="shrink")go("shrink");else if(a==="inventory")go("inventory");else if(a==="missing")go("missing");else if(a==="archive")go("archive");else if(a==="data-tools")go("dataTools")});
 document.getElementById("mobileMoreBtn")?.addEventListener("click",openDrawer);
 document.getElementById("dataToolsBackBtn")?.addEventListener("click",()=>{if(window.history.length>1)window.history.back();else go("dashboard")});
 document.getElementById("dashGoOrderBtn")?.addEventListener("click",()=>go("orders"));
 document.getElementById("dashGoStockBtn")?.addEventListener("click",()=>go("order"));
 document.getElementById("dashGoFinalBtn")?.addEventListener("click",()=>go("frontStock"));
 document.getElementById("dashGoMissingBtn")?.addEventListener("click",()=>go("missing"));
 document.getElementById("dashGoLookupBtn")?.addEventListener("click",()=>go("lookup"));
 document.getElementById("dashQuickBackStockBtn")?.addEventListener("click",()=>go("order"));
 document.getElementById("dashQuickOrderBtn")?.addEventListener("click",()=>go("frontStock"));
 document.getElementById("dashGoRecentBtn")?.addEventListener("click",()=>go("recent"));
 document.getElementById("dashViewAllRecentBtn")?.addEventListener("click",()=>go("recent"));
 document.getElementById("dashGoHistoryBtn")?.addEventListener("click",()=>go("orders"));
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
function todayKey(){return businessDate()}
function orderHistory(){return getOrderHistoryList()}
function setOrderHistory(v){setOrderHistoryList(v)}
function finalList(){try{return getFinalOrderList()}catch{return[]}}
function status(){return currentOrderStatus()}
function setStatus(s){setCurrentOrderStatus(s); if(window.refreshWorkflowSummary) window.refreshWorkflowSummary(); renderOrderHistory(); applyLock(); if(typeof renderLookup==="function") renderLookup();}
function applyLock(){document.body.classList.toggle("order-locked",status()==="Placed")}
function canPlaceCurrentOrder(){
 const final=finalList();
 if(!final.length){
  toast("Add at least one item to Final Order before placing the order");
  return false;
 }
 return true;
}
function snapshotOrder(){
 if(!canPlaceCurrentOrder()) return false;
 const date=todayKey();
 const back=(typeof order==="function"?order():[]);
 const final=finalList();
 const snap={id:date+"-"+Date.now(),date,placedAt:new Date().toISOString(),status:"Placed",backStock:back,finalOrder:final};
 let hist=orderHistory().filter(x=>x.date!==date);
 hist.unshift(snap);
 setOrderHistory(hist.slice(0,100));
 setStatus("Placed");
 toast("Order placed and saved to history");
 return true;
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
 const currentDate=todayKey();
 const current={
  id:`current-${currentDate}`,
  date:currentDate,
  placedAt:status()==="Placed"?new Date().toISOString():null,
  status:status(),
  backStock:typeof order==="function"?order():[],
  finalOrder:finalList(),
  isCurrent:true
 };
 const historical=orderHistory().filter(row=>row.date!==currentDate);
 const rows=[current,...historical];
 const PAGE_SIZE=15;

 boxes.forEach(box=>{
  box.innerHTML="";
  rows.forEach(h=>{
    const e=document.createElement("article");
    e.className="history-card history-card-expandable";
    const detailId=`history-detail-${String(h.id).replace(/[^a-zA-Z0-9_-]/g,"-")}-${Math.random().toString(36).slice(2,7)}`;
    e.innerHTML=`<button type="button" class="history-card-summary" aria-expanded="false" aria-controls="${detailId}"><span class="history-date-tile" aria-hidden="true"><b class="history-day"></b><small class="history-month"></small></span><span class="history-summary-copy"><span class="history-title-row"><strong class="history-title"></strong><span class="history-status-badge"></span></span><span class="history-subtitle"></span><span class="history-counts"><span><b class="history-back-count"></b><small>Back Stock</small></span><span><b class="history-final-count"></b><small>Final Order</small></span></span></span><span class="history-summary-action"><small>View details</small><span class="history-toggle" aria-hidden="true">⌄</span></span></button><div id="${detailId}" class="history-detail" hidden><div class="history-detail-tabs" role="tablist" aria-label="Order history details"><button type="button" class="history-detail-tab" data-history-tab="back" role="tab"><span>Back Stock</span><b class="history-tab-back-count"></b></button><button type="button" class="history-detail-tab is-active" data-history-tab="final" role="tab"><span>Final Order</span><b class="history-tab-final-count"></b></button></div><div class="history-detail-toolbar"><label class="history-search-wrap"><span aria-hidden="true">⌕</span><input type="search" class="history-search" placeholder="Search by item name, PLU or quantity" autocomplete="off" aria-label="Search order history"></label></div><div class="history-detail-table-head" aria-hidden="true"><span>Product</span><span>PLU</span><span>Qty</span></div><div class="history-active-list"></div><div class="history-pagination" hidden><button type="button" class="history-page-prev">Previous</button><span class="history-page-info"></span><button type="button" class="history-page-next">Next</button></div><div class="history-detail-footer"><span class="history-result-count"></span><button type="button" class="history-export-btn">Export CSV</button></div></div>`;

    const dateObj=new Date(`${h.date}T12:00:00`);
    const statusText=String(h.status||"Placed");
    e.querySelector(".history-day").textContent=dateObj.toLocaleDateString(undefined,{day:"2-digit"});
    e.querySelector(".history-month").textContent=dateObj.toLocaleDateString(undefined,{month:"short"}).toUpperCase();
    e.querySelector(".history-title").textContent=h.isCurrent?"Today’s order":dateObj.toLocaleDateString(undefined,{weekday:"long"});
    e.querySelector(".history-subtitle").textContent=h.isCurrent
      ? dateObj.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"})
      : `Placed ${h.placedAt?new Date(h.placedAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}):""}`.trim();
    const badge=e.querySelector(".history-status-badge");
    badge.textContent=statusText;
    badge.classList.toggle("is-draft",statusText.toLowerCase()==="draft");
    badge.classList.toggle("is-placed",statusText.toLowerCase()==="placed");
    const backList=Array.isArray(h.backStock)?h.backStock:[];
    const finalListRows=Array.isArray(h.finalOrder)?h.finalOrder:[];
    e.querySelector(".history-back-count").textContent=backList.length;
    e.querySelector(".history-final-count").textContent=finalListRows.length;
    e.querySelector(".history-tab-back-count").textContent=backList.length;
    e.querySelector(".history-tab-final-count").textContent=finalListRows.length;

    const state={tab:"final",query:"",page:1};
    const activeList=e.querySelector(".history-active-list");
    const search=e.querySelector(".history-search");
    const pagination=e.querySelector(".history-pagination");
    const prev=e.querySelector(".history-page-prev");
    const next=e.querySelector(".history-page-next");
    const pageInfo=e.querySelector(".history-page-info");
    const resultCount=e.querySelector(".history-result-count");
    const tabButtons=[...e.querySelectorAll(".history-detail-tab")];

    const normalize=v=>String(v??"").toLowerCase().trim();
    const sourceForTab=()=>state.tab==="back"?backList:finalListRows;
    const filterRows=list=>{
      const q=normalize(state.query);
      if(!q)return list;
      return list.filter(row=>{
        const name=normalize(row.item_name||row.name||"");
        const code=normalize(row.code||row.plu||row.product_code||"");
        const qty=normalize(row.qty??row.quantity??"");
        return name.includes(q)||code.includes(q)||qty.includes(q);
      });
    };
    const renderRows=()=>{
      const source=sourceForTab();
      const filtered=filterRows(source);
      const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
      if(state.page>totalPages)state.page=totalPages;
      const start=(state.page-1)*PAGE_SIZE;
      const pageRows=filtered.slice(start,start+PAGE_SIZE);
      activeList.innerHTML="";
      if(!pageRows.length){
        const empty=document.createElement("p");
        empty.className="history-empty";
        empty.textContent=state.query?"No matching items found.":(state.tab==="back"?"No Back Stock recorded.":"No Final Order recorded.");
        activeList.appendChild(empty);
      }else{
        pageRows.forEach(row=>{
          const line=document.createElement("div");
          line.className="history-item-row";
          line.innerHTML='<span class="history-item-name"></span><span class="history-item-code"></span><strong class="history-item-qty"></strong>';
          line.querySelector(".history-item-name").textContent=row.item_name||row.name||row.code||"Item";
          line.querySelector(".history-item-code").textContent=row.code||row.plu||row.product_code||"";
          line.querySelector(".history-item-qty").textContent=row.qty??row.quantity??"0";
          activeList.appendChild(line);
        });
      }
      const first=filtered.length?start+1:0;
      const last=Math.min(start+PAGE_SIZE,filtered.length);
      resultCount.textContent=state.query
        ? `Showing ${first}–${last} of ${filtered.length} matching ${state.tab==="back"?"Back Stock":"Final Order"} items`
        : `Showing ${first}–${last} of ${filtered.length} ${state.tab==="back"?"Back Stock":"Final Order"} items`;
      pageInfo.textContent=`Page ${state.page} of ${totalPages}`;
      prev.disabled=state.page<=1;
      next.disabled=state.page>=totalPages;
      pagination.hidden=totalPages<=1;
    };
    const setTab=tab=>{
      state.tab=tab;
      state.query="";
      state.page=1;
      search.value="";
      tabButtons.forEach(btn=>{
        const active=btn.dataset.historyTab===tab;
        btn.classList.toggle("is-active",active);
        btn.setAttribute("aria-selected",String(active));
      });
      renderRows();
    };
    tabButtons.forEach(btn=>btn.addEventListener("click",()=>setTab(btn.dataset.historyTab)));
    search.addEventListener("input",()=>{state.query=search.value;state.page=1;renderRows()});
    prev.addEventListener("click",()=>{if(state.page>1){state.page--;renderRows();}});
    next.addEventListener("click",()=>{state.page++;renderRows();});
    renderRows();

    const summary=e.querySelector(".history-card-summary");
    const detail=e.querySelector(".history-detail");
    summary.onclick=()=>{
      const open=summary.getAttribute("aria-expanded")==="true";
      if(!open){
        box.querySelectorAll('.history-card-summary[aria-expanded="true"]').forEach(other=>{
          if(other===summary)return;
          other.setAttribute("aria-expanded","false");
          const otherDetail=document.getElementById(other.getAttribute("aria-controls"));
          if(otherDetail) otherDetail.hidden=true;
          const otherCard=other.closest(".history-card-expandable");
          if(otherCard){
            const toggle=otherCard.querySelector(".history-toggle");
            const label=otherCard.querySelector(".history-summary-action small");
            if(toggle) toggle.textContent="⌄";
            if(label) label.textContent="View details";
          }
        });
      }
      summary.setAttribute("aria-expanded",String(!open));
      detail.hidden=open;
      e.querySelector(".history-toggle").textContent=open?"⌄":"⌃";
      const actionLabel=e.querySelector(".history-summary-action small");
      if(actionLabel) actionLabel.textContent=open?"View details":"Hide details";
      if(!open){ state.query=""; state.page=1; search.value=""; renderRows(); }
    };
    e.querySelector(".history-export-btn").onclick=()=>{
      if(h.isCurrent){
        const exportRows=["section,item_name,code,quantity"];
        backList.forEach(x=>exportRows.push(["Back Stock",x.item_name||"",x.code||"",x.qty||""].map(esc).join(",")));
        finalListRows.forEach(x=>exportRows.push(["Final Order",x.item_name||"",x.code||"",x.qty||""].map(esc).join(",")));
        downloadCSV(`order-${h.date}.csv`,exportRows.join("\n"));
      }else exportHistoryOrder(h.id);
    };
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
   if(confirm("Adjust today's placed order? This will unlock both Back Stock and Final Order for editing. When finished, place the order again to save the revised record.")) { setStatus("Draft"); toast("Order unlocked for adjustment"); }
 }, true);

 renderOrderHistory();
 applyLock();
 setTimeout(renderOrderHistory,300);
});
})();


/* v29 dashboard grid + easier Mark Placed */
(function(){
function ready(f){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",f,{once:true}):f()}
function status(){return currentOrderStatus()}
function setStatus(s){setCurrentOrderStatus(s); if(window.refreshWorkflowSummary) window.refreshWorkflowSummary(); if(window.renderOrderHistory) window.renderOrderHistory(); if(typeof renderLookup==="function") renderLookup();}
function finalList(){try{return getFinalOrderList()}catch{return[]}}
function snapshotOrderV29(){
 if(status()==="Placed"){toast("Order already placed");return}
 const back=(typeof order==="function"?order():[]);
 const final=finalList();
 if(!final.length){toast("Add at least one item to Final Order before placing the order");return;}
 if(!confirm("Mark today’s order as placed? This will save it by date and lock editing.")) return;
 const date=businessDate();
 const hist=getOrderHistoryList().filter(x=>x.date!==date);
 hist.unshift({id:date+"-"+Date.now(),date,placedAt:new Date().toISOString(),status:"Placed",backStock:back,finalOrder:final});
 setOrderHistoryList(hist.slice(0,100));
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
 const finalPlaceBtn=document.getElementById("finalPlaceOrderBtn");
 if(finalPlaceBtn) finalPlaceBtn.onclick=snapshotOrderV29;

 function updatePlacedButtons(){
   const placed=status()==="Placed";
   const hasFinalItems=finalList().length>0;
   [dashBtn,quickBtn,oldBtn,finalPlaceBtn].filter(Boolean).forEach(b=>{
     b.disabled=placed;
     if(b===finalPlaceBtn){
       b.disabled=placed || !hasFinalItems;
       b.textContent=placed ? "Placed" : "Place Order";
     } else if(b===dashBtn){
       // v52 dashboard uses a plain button (no nested <small> / .dash-circle).
       // Keep this legacy status updater compatible with both old and new markup.
       const label=b.querySelector("small");
       const icon=b.querySelector(".dash-circle");
       if(label) label.textContent=placed ? "Already placed" : "Lock today’s order";
       else b.textContent=placed ? "Placed" : "Place Order";
       if(icon) icon.textContent=placed ? "🔒" : "✅";
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
function status(){return currentOrderStatus()}
function isPlaced(){return status()==="Placed"}
function goOrders(){ if(typeof switchView==="function") switchView("orders"); }

function applyOrderLockV30(){
  const locked=isPlaced();
  document.body.classList.toggle("order-locked",locked);
  document.querySelectorAll("#orderView input,#orderView .qty-step,#orderView .edit-order-qty,#orderView .danger,#orderView .remove-order,#frontStockView input,#frontStockView .qty-step,#frontStockView .remove-front,#frontStockView .danger,#frontStockView #frontScanBtn").forEach(el=>{
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
    const blocked=e.target.closest("#orderView .qty-step,#orderView .edit-order-qty,#orderView .danger,#orderView .remove-order,#frontStockView .qty-step,#frontStockView .remove-front,#frontStockView .danger,#frontStockView #frontScanBtn");
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
  ["dashMarkPlacedBtn","ordersQuickMarkPlacedBtn","markOrderPlacedBtn","finalPlaceOrderBtn","unlockOrderBtn"].forEach(id=>{
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

  function showLookupInfo(event){
    event?.preventDefault();
    event?.stopPropagation();
    const button = document.getElementById("lookupInfoBtn");
    const msg = "Search, scan, and quickly add items to Back Stock or Favorites.";
    if(button && typeof window.showSectionInfoTooltip === "function") {
      window.showSectionInfoTooltip(msg, button);
      return;
    }
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


/* v47 SPA router bootstrap: route changes now activate the existing stable views. */
(function initSpaRouter(){
  if(!window.AppRouter) return;
  window.AppRouter.setHandler((view)=>switchView(view,{fromRouter:true}));
  window.AppRouter.start("lookup");
  window.addEventListener("app:viewchange", () => {
    const lookupHeader = document.getElementById("lookupFixedHeader");
    const active = document.querySelector(".view.active");
    if (lookupHeader) lookupHeader.hidden = !(active && active.id === "lookupView");
  });
})();

/* v51.1 order-session consistency and history details */
(function(){
 function ready(fn){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",fn,{once:true}):fn()}
 ready(()=>{
   const unlock=document.getElementById("unlockOrderBtn");
   if(unlock){unlock.textContent="Adjust Order";unlock.title="Unlock today's placed Back Stock and Final Order for correction";}
   if(window.renderOrderHistory) window.renderOrderHistory();
 });
})();

(function(){
  function updateConnectionStatus(){
    const el=document.getElementById("headerOnlineStatus");
    if(!el)return;
    const online=navigator.onLine;
    el.classList.toggle("is-offline",!online);
    const text=el.querySelector(".header-status-text");
    if(text)text.textContent=online?"Online":"Offline";
  }
  window.addEventListener("online",updateConnectionStatus);
  window.addEventListener("offline",updateConnectionStatus);
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",updateConnectionStatus,{once:true}):updateConnectionStatus();
})();


/* v52.3.0 unified Today's Order workflow */
(function(){
  function ready(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn()}
  function backList(){try{return typeof order==='function' ? (order()||[]) : []}catch{return []}}
  function finalListV523(){try{return getFinalOrderList()||[]}catch{return []}}
  function st(){try{return currentOrderStatus()}catch{return 'Draft'}}
  function fmtDate(){try{return new Date(businessDate()+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}catch{return 'Today'}}
  function renderFlow(el){
    if(!el) return;
    const mode=el.dataset.orderFlow||'back';
    const back=backList(), fin=finalListV523(), status=st();
    const placed=status==='Placed';
    const hasBack=back.length>0, hasFinal=fin.length>0;
    let current= mode==='back' ? 1 : 2;
    if(placed) current=3;
    let guidance='';
    if(placed) guidance='Today’s order is placed and locked. Use Adjust Order only when a correction is required.';
    else if(mode==='back') guidance=hasBack ? 'Back Stock is being recorded. When your count is ready, continue to Final Order and use these quantities while deciding what to order.' : 'Start by recording what you currently have in back stock. You can leave and resume this list during your shift.';
    else guidance=hasFinal ? 'Review Back Stock beside each item, finish your order quantities, then place the order when you are ready.' : 'Your Back Stock is ready as a reference. Search or scan the products you need and enter the quantity to order.';
    const statusLabel=placed?'Placed':(hasFinal?'Final Order in progress':(hasBack?'Back Stock in progress':'Draft'));
    const cls=placed?'is-placed':(status==='Draft'&&placed?'is-adjusting':'');
    el.innerHTML=`
      <div class="today-order-flow-head"><div class="today-order-flow-title"><small>Today’s Order</small><strong>${fmtDate()}</strong></div><span class="today-order-status ${cls}">${statusLabel}</span></div>
      <div class="today-order-progress">
        <div class="today-order-step ${current>1||placed?'is-done':current===1?'is-active':''}"><span class="today-order-step-dot">${current>1||placed?'✓':'1'}</span><small>Back Stock</small></div>
        <span class="today-order-line ${current>1||placed?'is-done':''}"></span>
        <div class="today-order-step ${placed?'is-done':current===2?'is-active':''}"><span class="today-order-step-dot">${placed?'✓':'2'}</span><small>Final Order</small></div>
        <span class="today-order-line ${placed?'is-done':''}"></span>
        <div class="today-order-step ${placed?'is-done is-active':''}"><span class="today-order-step-dot">${placed?'✓':'3'}</span><small>Placed</small></div>
      </div>
      <div class="today-order-flow-body">
        <div class="today-order-summary"><span>Back Stock</span><b>${back.length}</b></div>
        <div class="today-order-summary"><span>Order Items</span><b>${fin.length}</b></div>
        <div class="today-order-guidance">${guidance}</div>
        <div class="today-order-flow-actions"></div>
      </div>`;
    const actions=el.querySelector('.today-order-flow-actions');
    if(placed){
      const b=document.createElement('button'); b.type='button'; b.className='secondary'; b.textContent='Adjust Order';
      b.onclick=()=>document.getElementById('unlockOrderBtn')?.click(); actions.appendChild(b);
      return;
    }
    if(mode==='back'){
      const b=document.createElement('button'); b.type='button'; b.className='primary'; b.textContent=hasBack?'Continue to Final Order':'Open Final Order';
      b.onclick=()=>document.getElementById('startFrontStockBtn')?.click(); actions.appendChild(b);
    }else{
      const backBtn=document.createElement('button'); backBtn.type='button'; backBtn.className='secondary'; backBtn.textContent='← Back Stock'; backBtn.onclick=()=>document.getElementById('backToBackStockBtn')?.click(); actions.appendChild(backBtn);
      const p=document.createElement('button'); p.type='button'; p.className='primary'; p.textContent='Place Order'; p.disabled=!hasFinal; p.onclick=()=>document.getElementById('finalPlaceOrderBtn')?.click(); actions.appendChild(p);
    }
  }
  function refresh(){document.querySelectorAll('.today-order-flow').forEach(renderFlow)}
  ready(()=>{refresh();setTimeout(refresh,300);setTimeout(refresh,1000);document.addEventListener('click',()=>setTimeout(refresh,120),true);document.addEventListener('input',()=>setTimeout(refresh,80),true);window.refreshTodayOrderFlow=refresh});
})();


/* v52.4.8 Basic Shrink Count: catalog search + scanner + quantity/unit capture.
   Shrink data is intentionally local-only for now and does not touch Product IndexedDB. */
(function initShrinkCount(){
  function ready(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn()}
  ready(()=>{
    const input=document.getElementById('shrinkSearchInput');
    const clearBtn=document.getElementById('shrinkClearSearchBtn');
    const countEl=document.getElementById('shrinkSearchCount');
    const resultsEl=document.getElementById('shrinkSearchResults');
    const selectedEl=document.getElementById('shrinkSelectedProduct');
    const todayList=document.getElementById('shrinkTodayList');
    const todayCount=document.getElementById('shrinkTodayCount');
    const historyList=document.getElementById('shrinkHistoryList');
    if(!input||!resultsEl||!selectedEl) return;

    const STORAGE_KEY='mpa_shrink_records_v1';
    const UNIT_OPTIONS=['each','case','kg','g','lb','oz','ml','L','bunch','bag','pack','tray','box','clamshell','other'];
    let selectedCode='';
    let selectedItem=null;
    let editingId='';

    function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
    function localDate(){const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
    function loadRecords(){try{const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
    function saveRecords(records){localStorage.setItem(STORAGE_KEY,JSON.stringify(records))}
    function primaryImage(item){try{return window.ImageLibrary?.primaryImage(item)||item?.image_local||item?.image_url||''}catch{return item?.image_local||item?.image_url||''}}
    function searchCatalog(term){
      const query=String(term||'').trim(); if(!query) return [];
      try{return productService.search({query,filter:'all',limit:40})||[]}
      catch(error){console.warn('[Shrink] Product search failed',error);const upper=query.toUpperCase();return (items||[]).filter(item=>[item.item_name,item.code,item.brand,item.quantity,item.aliases,item.search_keywords].filter(Boolean).join(' ').toUpperCase().includes(upper)).slice(0,40)}
    }
    function unitOptions(selected='each'){return UNIT_OPTIONS.map(u=>`<option value="${esc(u)}" ${u===selected?'selected':''}>${u==='other'?'Other':u}</option>`).join('')}
    function selectedRecord(){return editingId?loadRecords().find(r=>r.id===editingId):null}
    function showSelected(item, record=null){
      selectedItem=item; selectedCode=String(item?.code||''); editingId=record?.id||''; selectedEl.hidden=false;
      const qty=record?.quantity??''; const unit=record?.unit||'each'; const custom=record?.custom_unit||'';
      selectedEl.innerHTML=`
        <strong>${esc(item?.item_name||record?.item_name||'Selected product')}</strong>
        <span>PLU / Code: ${esc(item?.code||record?.code||'—')}${item?.brand?` · ${esc(item.brand)}`:''}</span>
        <div class="shrink-entry-card">
          <div class="shrink-entry-grid">
            <label>Quantity
              <div class="shrink-qty-control">
                <button type="button" class="secondary" data-shrink-dec aria-label="Decrease shrink quantity">−</button>
                <input class="shrink-qty-input" data-shrink-qty type="number" min="0" step="any" inputmode="decimal" value="${esc(qty)}" placeholder="0">
                <button type="button" class="secondary" data-shrink-inc aria-label="Increase shrink quantity">+</button>
              </div>
            </label>
            <label>Measurement
              <div class="shrink-unit-wrap">
                <select class="shrink-unit-select" data-shrink-unit>${unitOptions(unit)}</select>
                <input class="shrink-custom-unit" data-shrink-custom type="text" maxlength="30" placeholder="Enter unit" value="${esc(custom)}" ${unit==='other'?'':'hidden'}>
              </div>
            </label>
            <button type="button" class="primary shrink-save-btn" data-shrink-save>${editingId?'Update':'Save'} Shrink</button>
          </div>
          <div class="shrink-entry-actions"><small>Record the quantity that is being removed as shrink today.</small></div>
        </div>`;
      const qtyEl=selectedEl.querySelector('[data-shrink-qty]');
      const unitEl=selectedEl.querySelector('[data-shrink-unit]');
      const customEl=selectedEl.querySelector('[data-shrink-custom]');
      selectedEl.querySelector('[data-shrink-dec]').onclick=()=>{const n=Math.max(0,(Number(qtyEl.value)||0)-1);qtyEl.value=String(n)};
      selectedEl.querySelector('[data-shrink-inc]').onclick=()=>{qtyEl.value=String((Number(qtyEl.value)||0)+1)};
      unitEl.onchange=()=>{customEl.hidden=unitEl.value!=='other'; if(unitEl.value!=='other') customEl.value=''};
      selectedEl.querySelector('[data-shrink-save]').onclick=()=>saveSelected();
      qtyEl.focus();
      renderSearch();
    }
    function saveSelected(){
      if(!selectedItem) return;
      const qtyEl=selectedEl.querySelector('[data-shrink-qty]'); const unitEl=selectedEl.querySelector('[data-shrink-unit]'); const customEl=selectedEl.querySelector('[data-shrink-custom]');
      const quantity=Number(qtyEl?.value); let unit=unitEl?.value||'each'; const custom=String(customEl?.value||'').trim();
      if(!Number.isFinite(quantity)||quantity<=0){qtyEl?.focus(); return toast('Enter a shrink quantity greater than 0.')}
      if(unit==='other'&&!custom){customEl?.focus(); return toast('Enter the measurement unit.')}
      const records=loadRecords(); const now=new Date().toISOString(); const date=localDate();
      if(editingId){
        const i=records.findIndex(r=>r.id===editingId); if(i>=0) records[i]={...records[i],quantity,unit,custom_unit:unit==='other'?custom:'',updated_at:now};
      }else{
        const same=records.findIndex(r=>r.date===date&&String(r.code)===String(selectedItem.code));
        const rec={id:same>=0?records[same].id:`SHR-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,date,code:String(selectedItem.code||''),item_name:selectedItem.item_name||'Unnamed product',brand:selectedItem.brand||'',quantity,unit,custom_unit:unit==='other'?custom:'',created_at:same>=0?records[same].created_at:now,updated_at:now};
        if(same>=0) records[same]=rec; else records.push(rec);
      }
      saveRecords(records); toast(editingId?'Shrink updated.':'Shrink saved.'); editingId=''; selectedItem=null; selectedCode=''; selectedEl.hidden=true; selectedEl.innerHTML=''; renderToday(); renderHistory(); renderSearch();
    }
    function editRecord(record){
      const found=searchCatalog(record.code).find(i=>String(i.code)===String(record.code))||{code:record.code,item_name:record.item_name,brand:record.brand};
      showSelected(found,record); selectedEl.scrollIntoView({behavior:'smooth',block:'center'});
    }
    function removeRecord(id){
      const records=loadRecords(); const rec=records.find(r=>r.id===id); if(!rec) return;
      if(!confirm(`Remove shrink record for ${rec.item_name}?`)) return;
      saveRecords(records.filter(r=>r.id!==id)); if(editingId===id){editingId='';selectedItem=null;selectedEl.hidden=true;selectedEl.innerHTML=''}; renderToday();renderHistory();toast('Shrink record removed.');
    }
    function productRow(item){
      const article=document.createElement('article'); article.className='shrink-product-result'; const img=primaryImage(item); const secondary=[item.brand,item.quantity,item.organic].filter(Boolean).join(' · ');
      article.innerHTML=`<div class="shrink-product-thumb">${img?`<img src="${esc(img)}" alt="">`:'No image'}</div><div class="shrink-product-copy"><strong>${esc(item.item_name||'Unnamed product')}</strong><span class="shrink-product-code">PLU / Code ${esc(item.code||'—')}</span>${secondary?`<span>${esc(secondary)}</span>`:''}</div><button type="button" class="shrink-select-btn ${String(item.code)===selectedCode?'secondary':''}">${String(item.code)===selectedCode?'Selected':'Select'}</button>`;
      article.querySelector('.shrink-select-btn').onclick=()=>showSelected(item); return article;
    }
    function renderSearch(){
      const term=input.value.trim(); clearBtn.hidden=!term; resultsEl.innerHTML='';
      if(!term){countEl.textContent='Search the catalog to begin';resultsEl.innerHTML='<section class="message shrink-placeholder"><strong>Find an item to record.</strong><span>Search or scan a product, then enter the quantity being shrunk.</span></section>';return}
      const matches=searchCatalog(term); countEl.textContent=`${matches.length}${matches.length===40?'+':''} ${matches.length===1?'match':'matches'}`;
      if(!matches.length){resultsEl.innerHTML='<section class="message shrink-placeholder"><strong>No matching product found.</strong><span>Try another product name, PLU, barcode, or brand.</span></section>';return}
      const frag=document.createDocumentFragment();matches.forEach(item=>frag.appendChild(productRow(item)));resultsEl.appendChild(frag);
    }
    function displayUnit(r){return r.unit==='other'?(r.custom_unit||'unit'):r.unit}
    function renderToday(){
      if(!todayList) return; const rows=loadRecords().filter(r=>r.date===localDate()).sort((a,b)=>(b.updated_at||'').localeCompare(a.updated_at||''));
      if(todayCount) todayCount.textContent=`${rows.length} ${rows.length===1?'item':'items'}`; todayList.innerHTML='';
      if(!rows.length){todayList.innerHTML='<div class="shrink-empty">No shrink recorded today.</div>';return}
      rows.forEach(r=>{const el=document.createElement('div');el.className='shrink-record-row';el.innerHTML=`<div class="shrink-record-main"><strong>${esc(r.item_name)}</strong><span>PLU / Code ${esc(r.code||'—')}</span></div><div class="shrink-record-qty">${esc(r.quantity)} ${esc(displayUnit(r))}</div><div class="shrink-record-actions"><button type="button" class="secondary" data-edit>Edit</button><button type="button" class="danger" data-remove>Remove</button></div>`;el.querySelector('[data-edit]').onclick=()=>editRecord(r);el.querySelector('[data-remove]').onclick=()=>removeRecord(r.id);todayList.appendChild(el)});
    }
    function renderHistory(){
      if(!historyList) return; const grouped={}; loadRecords().filter(r=>r.date!==localDate()).forEach(r=>(grouped[r.date]??=[]).push(r)); const dates=Object.keys(grouped).sort().reverse(); historyList.innerHTML='';
      if(!dates.length){historyList.innerHTML='<div class="shrink-empty">No previous shrink history yet.</div>';return}
      dates.forEach(date=>{const d=document.createElement('details');d.className='shrink-history-day';const rows=grouped[date];d.innerHTML=`<summary>${esc(new Date(date+'T00:00:00').toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}))}<span>${rows.length} ${rows.length===1?'item':'items'}</span></summary><div class="shrink-history-day-body">${rows.map(r=>`<div class="shrink-history-row"><span>${esc(r.item_name)}${r.code?` · ${esc(r.code)}`:''}</span><span>${esc(r.quantity)} ${esc(displayUnit(r))}</span></div>`).join('')}</div>`;historyList.appendChild(d)});
    }

    input.addEventListener('input',renderSearch); clearBtn.addEventListener('click',()=>{input.value='';input.focus();renderSearch()});
    window.addEventListener('app:viewchange',()=>{if(document.getElementById('shrinkView')?.classList.contains('active')){renderSearch();renderToday();renderHistory()}});
    window.renderShrinkProductSearch=renderSearch; window.renderShrinkCount=()=>{renderSearch();renderToday();renderHistory()};
    renderSearch(); renderToday(); renderHistory();
  });
})();
