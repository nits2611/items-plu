(function (global) {
  "use strict";

  function isRemote(src) {
    return /^(https?:|data:|blob:)/i.test(String(src || "").trim());
  }

  function create(options = {}) {
    const root = typeof options.root === "string" ? document.querySelector(options.root) : options.root;
    if (!root) return null;

    const input = root.querySelector(options.input || "[data-image-input]");
    const addButton = root.querySelector(options.addButton || "[data-image-add]");
    const list = root.querySelector(options.list || "[data-image-list]");
    const count = root.querySelector(options.count || "[data-image-count]");
    const legacyUrl = options.legacyUrl ? document.querySelector(options.legacyUrl) : null;
    const legacyLocal = options.legacyLocal ? document.querySelector(options.legacyLocal) : null;

    let images = [];

    const normalize = value => global.ImageLibrary?.normalizeImages(value) || [];

    function syncLegacy() {
      if (legacyUrl) legacyUrl.value = images.find(isRemote) || "";
      if (legacyLocal) legacyLocal.value = images.find(src => !isRemote(src)) || "";
    }

    function updateCount() {
      if (!count) return;
      count.textContent = `${images.length} image${images.length === 1 ? "" : "s"}`;
    }

    function render() {
      if (!list) return;
      list.innerHTML = "";
      updateCount();
      syncLegacy();

      if (!images.length) {
        const empty = document.createElement("div");
        empty.className = "image-list-empty";
        empty.textContent = "No images added yet.";
        list.appendChild(empty);
        return;
      }

      images.forEach((src, index) => {
        const row = document.createElement("div");
        row.className = "image-list-row";
        row.dataset.index = String(index);

        const preview = document.createElement("div");
        preview.className = "image-list-preview";
        const img = document.createElement("img");
        img.src = src;
        img.alt = index === 0 ? "Primary product image" : `Product image ${index + 1}`;
        img.loading = "lazy";
        img.onerror = () => {
          preview.classList.add("is-broken");
          img.remove();
          preview.textContent = "Image";
        };
        preview.appendChild(img);

        const info = document.createElement("div");
        info.className = "image-list-info";
        const top = document.createElement("div");
        top.className = "image-list-title-row";
        const title = document.createElement("strong");
        title.textContent = index === 0 ? "Primary image" : `Image ${index + 1}`;
        top.appendChild(title);
        if (index === 0) {
          const badge = document.createElement("span");
          badge.className = "image-primary-badge";
          badge.textContent = "Thumbnail";
          top.appendChild(badge);
        }
        const source = document.createElement("div");
        source.className = "image-list-source";
        source.textContent = src;
        source.title = src;
        info.append(top, source);

        const actions = document.createElement("div");
        actions.className = "image-list-actions";
        if (index !== 0) {
          const primary = document.createElement("button");
          primary.type = "button";
          primary.className = "image-list-primary";
          primary.textContent = "Set primary";
          primary.addEventListener("click", () => {
            const [selected] = images.splice(index, 1);
            images.unshift(selected);
            render();
          });
          actions.appendChild(primary);
        }

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "image-list-remove";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
          images.splice(index, 1);
          render();
        });
        actions.appendChild(remove);

        row.append(preview, info, actions);
        list.appendChild(row);
      });
    }

    function add(value) {
      const additions = normalize(value);
      if (!additions.length) return false;
      images = normalize([...images, ...additions]);
      render();
      return true;
    }

    function addFromInput() {
      if (!input) return;
      const value = input.value.trim();
      if (!value) return;
      if (add(value)) input.value = "";
      input.focus();
    }

    addButton?.addEventListener("click", addFromInput);
    input?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addFromInput();
    });

    render();

    return Object.freeze({
      setImages(value) {
        images = normalize(value);
        render();
      },
      getImages() {
        return [...images];
      },
      add,
      clear() {
        images = [];
        render();
      },
      render
    });
  }

  global.ImageListEditor = Object.freeze({ create });
})(window);
