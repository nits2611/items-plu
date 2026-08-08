(function(global){
  "use strict";

  // Shared Code 128 renderer. UI modules should use this component instead of
  // calculating barcode dimensions independently.
  const CODE128_PATTERNS=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];

  const SVG_NS="http://www.w3.org/2000/svg";

  function encode(value){
    const text=String(value??"").trim();
    if(!text) throw new Error("Barcode value is required.");

    const numeric=/^\d+$/.test(text)&&text.length%2===0;
    const codes=[];
    let sum;

    if(numeric){
      codes.push(105);
      sum=105;
      for(let i=0;i<text.length;i+=2){
        const code=Number(text.slice(i,i+2));
        codes.push(code);
        sum+=code*(codes.length-1);
      }
    }else{
      codes.push(104);
      sum=104;
      for(let i=0;i<text.length;i++){
        const code=text.charCodeAt(i)-32;
        if(code<0||code>94) throw new Error(`Unsupported Code 128 character: ${text[i]}`);
        codes.push(code);
        sum+=code*(codes.length-1);
      }
    }

    codes.push(sum%103,106);
    return {text,codes};
  }

  function buildBars(codes){
    let modules=0;
    const bars=[];

    for(const code of codes){
      const pattern=CODE128_PATTERNS[code];
      if(!pattern) continue;
      for(let i=0;i<pattern.length;i++){
        const width=Number(pattern[i]);
        if(i%2===0) bars.push({x:modules,width});
        modules+=width;
      }
    }

    return {bars,modules};
  }

  function create(value,options={}){
    const {text,codes}=encode(value);
    const {bars,modules}=buildBars(codes);

    const quietModules=Math.max(10,Number(options.quietModules)||10);
    const barHeight=Math.max(44,Number(options.barHeight)||58);
    const totalModules=modules+(quietModules*2);

    // Keep a comfortable physical module width instead of stretching every
    // symbol to exactly the same width. This makes short PLUs look balanced
    // and long packaged codes remain readable while every card still uses the
    // same outer barcode panel.
    const preferredModulePx=Math.max(1.55,Math.min(2.35,Number(options.modulePx)||2.05));
    const symbolWidth=Math.round(Math.max(190,Math.min(330,totalModules*preferredModulePx)));

    const root=document.createElement("div");
    root.className="barcode-render";
    root.dataset.barcode=text;
    root.setAttribute("role","img");
    root.setAttribute("aria-label",`Barcode ${text}`);
    root.style.setProperty("--barcode-symbol-width",`${symbolWidth}px`);

    const svg=document.createElementNS(SVG_NS,"svg");
    svg.classList.add("barcode-render__bars");
    svg.setAttribute("viewBox",`0 0 ${totalModules} ${barHeight}`);
    // The SVG is sized from the encoded module count. Horizontal scaling is
    // uniform across all modules, preserving Code 128 bar/space ratios.
    svg.setAttribute("preserveAspectRatio","none");
    svg.setAttribute("aria-hidden","true");
    svg.setAttribute("focusable","false");

    const group=document.createElementNS(SVG_NS,"g");
    group.setAttribute("fill","#000");
    for(const bar of bars){
      const rect=document.createElementNS(SVG_NS,"rect");
      rect.setAttribute("x",String(bar.x+quietModules));
      rect.setAttribute("y","0");
      rect.setAttribute("width",String(bar.width));
      rect.setAttribute("height",String(barHeight));
      group.appendChild(rect);
    }
    svg.appendChild(group);

    const label=document.createElement("div");
    label.className="barcode-render__value";
    label.textContent=text;

    root.append(svg,label);
    return root;
  }

  function render(target,value,options={}){
    const element=typeof target==="string"?document.querySelector(target):target;
    if(!element) throw new Error("Barcode render target was not found.");
    element.replaceChildren(create(value,options));
    return element.firstElementChild;
  }

  global.BarcodeRenderer=Object.freeze({create,render});
})(window);
