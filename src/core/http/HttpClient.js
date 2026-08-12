(function (global) {
  "use strict";

  class HttpError extends Error {
    constructor(message, details = {}) {
      super(message);
      this.name = "HttpError";
      this.status = details.status ?? 0;
      this.url = details.url || "";
      this.cause = details.cause;
    }
  }

  class HttpClient {
    static buildUrl(url, params = {}) {
      const resolved = new URL(url, global.location.href);
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        resolved.searchParams.set(key, String(value));
      });
      return resolved.toString();
    }

    static async request(options = {}) {
      const {
        url,
        method = "GET",
        params = {},
        body = null,
        headers = {},
        timeoutMs = global.AppConfig?.http?.timeoutMs || 30000,
        cache = "default",
        responseType = "json"
      } = options;

      if (!url) throw new TypeError("HttpClient.request requires a URL.");

      const controller = new AbortController();
      const timeoutId = global.setTimeout(() => controller.abort(), timeoutMs);
      const requestUrl = this.buildUrl(url, params);
      const requestHeaders = { ...headers };
      const requestOptions = {
        method: String(method || "GET").toUpperCase(),
        headers: requestHeaders,
        signal: controller.signal,
        cache
      };

      if (body !== null && body !== undefined) {
        if (body instanceof FormData || typeof body === "string" || body instanceof Blob) {
          requestOptions.body = body;
        } else {
          if (!Object.keys(requestHeaders).some(key => key.toLowerCase() === "content-type")) {
            requestHeaders["Content-Type"] = "application/json";
          }
          requestOptions.body = JSON.stringify(body);
        }
      }

      try {
        const response = await fetch(requestUrl, requestOptions);
        if (!response.ok) {
          throw new HttpError(`Request failed with status ${response.status}.`, {
            status: response.status,
            url: response.url || requestUrl
          });
        }

        if (responseType === "text") return response.text();
        if (responseType === "response") return response;
        if (response.status === 204) return null;
        return response.json();
      } catch (error) {
        if (error instanceof HttpError) throw error;
        const message = error?.name === "AbortError" ? "Request timed out." : "Network request failed.";
        throw new HttpError(message, { url: requestUrl, cause: error });
      } finally {
        global.clearTimeout(timeoutId);
      }
    }

    static get(url, options = {}) {
      return this.request({ ...options, url, method: "GET" });
    }

    static post(url, body, options = {}) {
      return this.request({ ...options, url, method: "POST", body });
    }
  }

  global.HttpError = HttpError;
  global.HttpClient = HttpClient;
})(window);
