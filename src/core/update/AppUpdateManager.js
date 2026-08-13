(function (global) {
  "use strict";

  class AppUpdateManager {
    constructor(options = {}) {
      this.versionsUrl = options.versionsUrl || global.AppConfig?.urls?.versions || "./data/versions.json";
      this.currentVersion = String(options.currentVersion || global.AppConfig?.app?.version || global.__APP_VERSION__ || "0").trim();
      this.registration = null;
      this.remoteVersion = this.currentVersion;
      this.updateAvailable = false;
      this.refreshing = false;
      this.banner = document.getElementById("appUpdateBanner");
      this.message = document.getElementById("appUpdateMessage");
      this.button = document.getElementById("appUpdateBtn");
      this.dismissButton = document.getElementById("dismissAppUpdateBtn");
      this.boundControllerChange = () => {
        if (this.refreshing) return;
        this.refreshing = true;
        global.location.reload();
      };
    }

    async init() {
      this.bindUi();
      const protocol = global.location?.protocol || "";
      const canUseWebUpdates = protocol === "http:" || protocol === "https:";
      if (!canUseWebUpdates) {
        global.Logger?.info?.("App update checks skipped outside HTTP/HTTPS.");
        return;
      }

      await this.registerServiceWorker(this.currentVersion);
      await this.checkVersionManifest();
    }

    bindUi() {
      this.button?.addEventListener("click", () => this.applyUpdate());
      this.dismissButton?.addEventListener("click", () => this.hideBanner());
    }

    workerUrl(version) {
      return `service-worker.js?v=${encodeURIComponent(String(version || this.currentVersion || "0"))}`;
    }

    async registerServiceWorker(version) {
      if (!("serviceWorker" in navigator)) return null;
      if (!global.isSecureContext && global.location?.hostname !== "localhost" && global.location?.hostname !== "127.0.0.1") {
        global.Logger?.info?.("Service worker registration skipped because the page is not in a secure context.");
        return null;
      }

      try {
        this.registration = await navigator.serviceWorker.register(this.workerUrl(version), { scope: "./" });
      } catch (error) {
        global.Logger?.warn?.("Service worker registration skipped/failed.", error);
        return null;
      }

      navigator.serviceWorker.removeEventListener("controllerchange", this.boundControllerChange);
      navigator.serviceWorker.addEventListener("controllerchange", this.boundControllerChange);

      this.registration.addEventListener("updatefound", () => {
        const worker = this.registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            this.showAvailable(this.remoteVersion || version || "new");
          }
        });
      });

      if (this.registration.waiting) {
        this.showAvailable(this.remoteVersion || version || this.currentVersion);
      }

      return this.registration;
    }

    async checkVersionManifest() {
      try {
        const manifest = await global.HttpClient.get(this.versionsUrl, {
          cache: "no-store",
          params: { _: Date.now() }
        });
        const remote = String(manifest?.app?.version || "").trim();
        if (!remote) return;
        this.remoteVersion = remote;

        if (remote !== this.currentVersion) {
          this.showAvailable(remote);
          await this.registerServiceWorker(remote);
        }
      } catch (error) {
        global.Logger?.warn?.("Unable to read app version manifest.", error);
      }
    }

    showAvailable(version) {
      this.updateAvailable = true;
      if (this.message) {
        this.message.textContent = version && version !== "new"
          ? `App version ${version} is available.`
          : "A new app version is available.";
      }
      if (this.banner) this.banner.hidden = false;
    }

    hideBanner() {
      if (this.banner) this.banner.hidden = true;
    }

    waitForInstalled(worker) {
      if (!worker) return Promise.resolve();
      if (worker.state === "installed" || worker.state === "activated") return Promise.resolve();
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timed out preparing app update.")), 20000);
        const onState = () => {
          if (worker.state === "installed" || worker.state === "activated") {
            clearTimeout(timeout);
            worker.removeEventListener("statechange", onState);
            resolve();
          } else if (worker.state === "redundant") {
            clearTimeout(timeout);
            worker.removeEventListener("statechange", onState);
            reject(new Error("New service worker became redundant."));
          }
        };
        worker.addEventListener("statechange", onState);
      });
    }

    async applyUpdate() {
      this.button && (this.button.disabled = true);
      if (this.message) this.message.textContent = "Preparing the latest app version...";

      try {
        await this.registerServiceWorker(this.remoteVersion || this.currentVersion);
        if (!this.registration) throw new Error("Service worker registration unavailable.");

        if (this.registration.installing) {
          await this.waitForInstalled(this.registration.installing);
        }

        const waiting = this.registration.waiting;
        if (waiting) {
          waiting.postMessage({ type: "SKIP_WAITING" });
          return;
        }

        // If activation already completed, reload. The bootstrap loader will
        // request every app asset using the same release query string.
        global.location.reload();
      } catch (error) {
        if (this.message) this.message.textContent = "Unable to update right now. Please try again.";
        this.button && (this.button.disabled = false);
        global.Logger?.error?.("App update failed.", error);
      }
    }
  }

  global.AppUpdateManager = AppUpdateManager;
})(window);
