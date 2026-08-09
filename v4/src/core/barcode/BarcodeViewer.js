(function(global){
  "use strict";

  const LONG_PRESS_MS=520;
  const MOVE_CANCEL_PX=12;
  const ANIMATION_MS=190;

  let modal=null;
  let panel=null;
  let barcodeHost=null;
  let titleEl=null;
  let closeBtn=null;
  let previouslyFocused=null;
  let closingTimer=null;
  let suppressNextClickUntil=0;
  let pressState=null;
  let menu=null;
  let menuTitle=null;
  let menuCode=null;
  let menuLargeBtn=null;
  let menuCopyBtn=null;
  let menuDetailsBtn=null;
  let activeMenuPayload=null;

  function ensureElements(){
    if(!modal){
      modal=document.getElementById("barcodeFocusModal");
      panel=document.getElementById("barcodeFocusPanel");
      barcodeHost=document.getElementById("barcodeFocusBarcode");
      titleEl=document.getElementById("barcodeFocusTitle");
      closeBtn=document.getElementById("barcodeFocusClose");

      if(modal&&panel&&barcodeHost&&closeBtn){
        closeBtn.addEventListener("click",close);
        modal.addEventListener("click",event=>{
          if(event.target===modal) close();
        });
      }
    }

    ensureMenu();
  }

  function ensureMenu(){
    if(menu) return;

    menu=document.createElement("div");
    menu.className="barcode-options";
    menu.hidden=true;
    menu.setAttribute("role","dialog");
    menu.setAttribute("aria-modal","true");
    menu.setAttribute("aria-label","Barcode options");
    menu.innerHTML=`
      <div class="barcode-options__sheet" role="document">
        <div class="barcode-options__grab" aria-hidden="true"></div>
        <div class="barcode-options__header">
          <div>
            <div class="barcode-options__kicker">BARCODE OPTIONS</div>
            <h3 class="barcode-options__title">Barcode</h3>
            <div class="barcode-options__code"></div>
          </div>
          <button class="barcode-options__close" type="button" aria-label="Close barcode options">✕</button>
        </div>
        <div class="barcode-options__actions">
          <button type="button" class="barcode-options__action" data-action="large">
            <span class="barcode-options__icon" aria-hidden="true">▣</span>
            <span><strong>Show Large Barcode</strong><small>Open scanner-friendly focus mode</small></span>
          </button>
          <button type="button" class="barcode-options__action" data-action="copy">
            <span class="barcode-options__icon" aria-hidden="true">⧉</span>
            <span><strong>Copy Product Code</strong><small>Copy the barcode / PLU value</small></span>
          </button>
          <button type="button" class="barcode-options__action" data-action="details" disabled aria-disabled="true">
            <span class="barcode-options__icon" aria-hidden="true">ⓘ</span>
            <span><strong>Product Details</strong><small>Coming soon</small></span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(menu);

    menuTitle=menu.querySelector(".barcode-options__title");
    menuCode=menu.querySelector(".barcode-options__code");
    menuLargeBtn=menu.querySelector('[data-action="large"]');
    menuCopyBtn=menu.querySelector('[data-action="copy"]');
    menuDetailsBtn=menu.querySelector('[data-action="details"]');

    menu.querySelector(".barcode-options__close")?.addEventListener("click",closeOptions);
    menu.addEventListener("click",event=>{
      if(event.target===menu) closeOptions();
    });
    menuLargeBtn?.addEventListener("click",()=>{
      if(!activeMenuPayload) return;
      const payload=activeMenuPayload;
      closeOptions({restoreFocus:false});
      open(payload.value,{productName:payload.productName});
    });
    menuCopyBtn?.addEventListener("click",copyActiveCode);
  }

  function getProductName(source){
    const card=source?.closest?.(".card,.order-item,.final-card,.product-card");
    if(!card) return "";
    return card.querySelector(".name,h2,h3")?.textContent?.trim()||"";
  }

  function open(value,options={}){
    ensureElements();
    if(!modal||!barcodeHost||!global.BarcodeRenderer) return;

    const text=String(value??"").trim();
    if(!text) return;

    if(closingTimer){
      clearTimeout(closingTimer);
      closingTimer=null;
    }

    closeOptions({restoreFocus:false});
    previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const productName=String(options.productName||"").trim();
    titleEl.textContent=productName||"Barcode";
    global.BarcodeRenderer.render(barcodeHost,text,{barHeight:92,modulePx:2.2,quietModules:14});

    modal.hidden=false;
    modal.classList.remove("is-closing");
    document.body.classList.add("barcode-focus-open");
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>modal.classList.add("is-open"));
    });
    setTimeout(()=>closeBtn.focus({preventScroll:true}),ANIMATION_MS);
  }

  function close(){
    ensureElements();
    if(!modal||modal.hidden||modal.classList.contains("is-closing")) return;

    modal.classList.remove("is-open");
    modal.classList.add("is-closing");
    closingTimer=setTimeout(()=>{
      modal.hidden=true;
      modal.classList.remove("is-closing");
      document.body.classList.remove("barcode-focus-open");
      barcodeHost?.replaceChildren();
      if(previouslyFocused&&document.contains(previouslyFocused)) previouslyFocused.focus({preventScroll:true});
      previouslyFocused=null;
      closingTimer=null;
    },ANIMATION_MS);
  }

  function openOptions(value,source){
    ensureElements();
    if(!menu) return;
    const text=String(value??"").trim();
    if(!text) return;

    const productName=getProductName(source)||"Barcode";
    activeMenuPayload={value:text,productName,source};
    previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
    menuTitle.textContent=productName;
    menuCode.textContent=text;
    menu.hidden=false;
    document.body.classList.add("barcode-options-open");
    requestAnimationFrame(()=>requestAnimationFrame(()=>menu.classList.add("is-open")));
    setTimeout(()=>menuLargeBtn?.focus({preventScroll:true}),ANIMATION_MS);
  }

  function closeOptions(options={}){
    if(!menu||menu.hidden) return;
    const restoreFocus=options.restoreFocus!==false;
    menu.classList.remove("is-open");
    document.body.classList.remove("barcode-options-open");
    const target=previouslyFocused;
    setTimeout(()=>{
      if(menu) menu.hidden=true;
      activeMenuPayload=null;
      if(restoreFocus&&target&&document.contains(target)) target.focus({preventScroll:true});
      if(restoreFocus) previouslyFocused=null;
    },ANIMATION_MS);
  }

  async function copyActiveCode(){
    const value=activeMenuPayload?.value;
    if(!value) return;
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(value);
      }else{
        const input=document.createElement("textarea");
        input.value=value;
        input.setAttribute("readonly","");
        input.style.position="fixed";
        input.style.opacity="0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      if(menuCopyBtn){
        const strong=menuCopyBtn.querySelector("strong");
        const old=strong?.textContent;
        if(strong) strong.textContent="Copied";
        setTimeout(()=>{ if(strong&&old) strong.textContent=old; },900);
      }
    }catch(error){
      console.warn("[Barcode] Unable to copy product code.",error);
    }
  }

  function cancelPress(){
    if(!pressState) return;
    clearTimeout(pressState.timer);
    pressState=null;
  }

  function bindLongPress(){
    document.addEventListener("pointerdown",event=>{
      const render=event.target.closest?.(".barcode-render");
      if(!render||event.button!==0) return;
      const value=render.dataset.barcode;
      if(!value) return;

      cancelPress();
      const state={
        render,
        pointerId:event.pointerId,
        startX:event.clientX,
        startY:event.clientY,
        timer:null
      };
      state.timer=setTimeout(()=>{
        if(pressState!==state) return;
        suppressNextClickUntil=Date.now()+850;
        try{ render.releasePointerCapture?.(state.pointerId); }catch(_error){}
        pressState=null;
        openOptions(value,render);
      },LONG_PRESS_MS);
      pressState=state;
    },{passive:true});

    document.addEventListener("pointermove",event=>{
      if(!pressState||event.pointerId!==pressState.pointerId) return;
      if(Math.abs(event.clientX-pressState.startX)>MOVE_CANCEL_PX||Math.abs(event.clientY-pressState.startY)>MOVE_CANCEL_PX){
        cancelPress();
      }
    },{passive:true});

    document.addEventListener("pointerup",event=>{
      if(pressState&&event.pointerId===pressState.pointerId) cancelPress();
    },{passive:true});
    document.addEventListener("pointercancel",cancelPress,{passive:true});
    window.addEventListener("scroll",cancelPress,{passive:true,capture:true});

    document.addEventListener("contextmenu",event=>{
      const render=event.target.closest?.(".barcode-render");
      if(!render) return;
      event.preventDefault();
      const value=render.dataset.barcode;
      if(value){
        suppressNextClickUntil=Date.now()+500;
        cancelPress();
        openOptions(value,render);
      }
    });
  }

  function bindDocument(){
    document.addEventListener("click",event=>{
      const render=event.target.closest?.(".barcode-render");
      if(!render) return;
      if(Date.now()<suppressNextClickUntil){
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if(event.button!==undefined&&event.button!==0) return;
      const value=render.dataset.barcode;
      if(!value) return;
      open(value,{productName:getProductName(render)});
    });

    document.addEventListener("keydown",event=>{
      if(event.key==="Escape"){
        if(menu&&!menu.hidden){
          event.preventDefault();
          closeOptions();
          return;
        }
        if(modal&&!modal.hidden){
          event.preventDefault();
          close();
          return;
        }
      }

      if(event.key!=="Enter"&&event.key!==" ") return;
      const render=event.target.closest?.(".barcode-render");
      if(!render) return;
      event.preventDefault();
      const value=render.dataset.barcode;
      if(value) open(value,{productName:getProductName(render)});
    });
  }

  function init(){
    ensureElements();
    bindDocument();
    bindLongPress();
  }

  global.BarcodeViewer=Object.freeze({init,open,close,openOptions,closeOptions});

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})(window);
