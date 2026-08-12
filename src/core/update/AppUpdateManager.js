(function (global) {
  "use strict";

  class AppUpdateManager {
    constructor(options = {}) {
      this.versionsUrl = options.versionsUrl || global.AppConfig?.urls?.versions || "./data/versions.json";
      this.currentVersion = String(options.currentVersion || global.AppConfig?.app?.version || "0").trim();
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

      // Service workers and fetch-based update checks are not available when
      // the app is opened directly from the filesystem (file://, origin=null).
      // In that case, keep the rest of the application fully usable and simply
      // skip the app-update workflow.
      const protocol = global.location?.protocol || "";
      const canUseWebUpdates = protocol === "http:" || protocol === "https:";

      if (!canUseWebUpdates) {
        global.Logger?.info?.("App update checks skipped outside HTTP/HTTPS.");
        return;
      }

      await this.registerServiceWorker();
      await this.checkVersionManifest();
    }

    bindUi() {
      this.button?.addEventListener("click", () => this.applyUpdate());
      this.dismissButton?.addEventListener("click", () => this.hideBanner());
    }

    async registerServiceWorker() {
      if (!("serviceWorker" in navigator)) return null;
      if (!global.isSecureContext && global.location?.hostname !== "localhost" && global.location?.hostname !== "127.0.0.1") {
        global.Logger?.info?.("Service worker registration skipped because the page is not in a secure context.");
        return null;
      }

      try {
        this.registration = await navigator.serviceWorker.register("service-worker.js");
      } catch (error) {
        // App updates are an enhancement. A registration failure must never
        // prevent the main application from starting.
        global.Logger?.warn?.("Service worker registration skipped/failed.", error);
        return null;
      }
      navigator.serviceWorker.addEventListener("controllerchange", this.boundControllerChange);

      if (this.registration.waiting) {
        this.showAvailable(this.remoteVersion || this.currentVersion);
      }

      this.registration.addEventListener("updatefound", () => {
        const worker = this.registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            this.showAvailable(this.remoteVersion || "new");
          }
        });
      });

      try {
        await this.registration.update();
      } catch (error) {
        global.Logger?.warn?.("App update check failed.", error);
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
          try { await this.registration?.update(); } catch (_) {}
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

    async applyUpdate() {
      if (!this.registration) return;
      this.button && (this.button.disabled = true);
      if (this.message) this.message.textContent = "Preparing the latest app version...";

      try {
        await this.registration.update();
        const waiting = this.registration.waiting;
        if (waiting) {
          waiting.postMessage({ type: "SKIP_WAITING" });
          return;
        }

        // If the new worker activated immediately, a reload is enough.
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
