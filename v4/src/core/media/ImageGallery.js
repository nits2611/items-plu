(function (global) {
  "use strict";

  let root = null;
  let imageEl = null;
  let titleEl = null;
  let counterEl = null;
  let dotsEl = null;
  let prevBtn = null;
  let nextBtn = null;
  let closeBtn = null;
  let current = [];
  let currentIndex = 0;
  let lastFocus = null;
  let touchStartX = null;

  function ensureDom() {
    if (root) return;
    root = document.createElement("div");
    root.className = "image-gallery-modal";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.innerHTML = `
      <div class="image-gallery-panel" role="document">
        <div class="image-gallery-head">
          <div>
            <span class="image-gallery-kicker">PRODUCT IMAGES</span>
            <h2 class="image-gallery-title">Product</h2>
          </div>
          <button class="image-gallery-close" type="button" aria-label="Close image gallery">✕</button>
        </div>
        <div class="image-gallery-stage">
          <button class="image-gallery-nav image-gallery-prev" type="button" aria-label="Previous image">‹</button>
          <div class="image-gallery-image-wrap"><img class="image-gallery-image" alt=""></div>
          <button class="image-gallery-nav image-gallery-next" type="button" aria-label="Next image">›</button>
        </div>
        <div class="image-gallery-footer">
          <span class="image-gallery-counter"></span>
          <div class="image-gallery-dots" aria-label="Image position"></div>
        </div>
      </div>`;
    document.body.appendChild(root);

    imageEl = root.querySelector(".image-gallery-image");
    titleEl = root.querySelector(".image-gallery-title");
    counterEl = root.querySelector(".image-gallery-counter");
    dotsEl = root.querySelector(".image-gallery-dots");
    prevBtn = root.querySelector(".image-gallery-prev");
    nextBtn = root.querySelector(".image-gallery-next");
    closeBtn = root.querySelector(".image-gallery-close");

    closeBtn.addEventListener("click", close);
    root.addEventListener("click", event => { if (event.target === root) close(); });
    prevBtn.addEventListener("click", () => show(currentIndex - 1));
    nextBtn.addEventListener("click", () => show(currentIndex + 1));

    root.addEventListener("touchstart", event => {
      touchStartX = event.touches?.[0]?.clientX ?? null;
    }, { passive: true });
    root.addEventListener("touchend", event => {
      if (touchStartX == null) return;
      const endX = event.changedTouches?.[0]?.clientX ?? touchStartX;
      const delta = endX - touchStartX;
      touchStartX = null;
      if (Math.abs(delta) < 45 || current.length < 2) return;
      show(currentIndex + (delta < 0 ? 1 : -1));
    }, { passive: true });

    document.addEventListener("keydown", event => {
      if (!root || root.hidden) return;
      if (event.key === "Escape") close();
      else if (event.key === "ArrowLeft") show(currentIndex - 1);
      else if (event.key === "ArrowRight") show(currentIndex + 1);
    });
  }

  function show(index) {
    if (!current.length) return;
    currentIndex = (index + current.length) % current.length;
    const src = current[currentIndex];
    imageEl.src = src;
    imageEl.alt = `${titleEl.textContent || "Product"} image ${currentIndex + 1}`;
    counterEl.textContent = `${currentIndex + 1} of ${current.length}`;
    const multi = current.length > 1;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
    dotsEl.innerHTML = "";
    if (multi) {
      current.forEach((_, dotIndex) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "image-gallery-dot" + (dotIndex === currentIndex ? " active" : "");
        dot.setAttribute("aria-label", `Show image ${dotIndex + 1}`);
        dot.addEventListener("click", () => show(dotIndex));
        dotsEl.appendChild(dot);
      });
    }
  }

  function open({ images = [], title = "Product", startIndex = 0 } = {}) {
    ensureDom();
    current = global.ImageLibrary?.normalizeImages(images) || [];
    if (!current.length) return false;
    lastFocus = document.activeElement;
    titleEl.textContent = title || "Product";
    root.hidden = false;
    document.body.classList.add("image-gallery-open");
    show(Math.max(0, Math.min(Number(startIndex) || 0, current.length - 1)));
    requestAnimationFrame(() => root.classList.add("open"));
    closeBtn.focus({ preventScroll: true });
    return true;
  }

  function close() {
    if (!root || root.hidden) return;
    root.classList.remove("open");
    document.body.classList.remove("image-gallery-open");
    setTimeout(() => {
      if (!root.classList.contains("open")) {
        root.hidden = true;
        imageEl.removeAttribute("src");
      }
    }, 180);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
  }

  global.ImageGallery = Object.freeze({ open, close });
})(window);
