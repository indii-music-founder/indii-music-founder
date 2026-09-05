(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("e2e") === "true" || params.get("mock") === "true") {
    try {
      window.FIREBASE_E2E_MOCK = true;
      localStorage.setItem("FIREBASE_E2E_MOCK", "true");
    } catch (error) {
      console.warn("Unable to set local Firebase mock flag", error);
    }
  }

  const productionFirebaseHosts = new Set([
    "indii-music-studio.web.app",
    "indii-music-studio.firebaseapp.com",
  ]);

  // Canonicalize only the live Firebase aliases. Preview-channel hosts also
  // end in web.app; redirecting those prevents staging from ever serving the
  // freshly deployed build or exercising its real public routes.
  if (productionFirebaseHosts.has(window.location.hostname)) {
    window.location.replace(
      `https://indii.music${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
  }

  // Intercept Google Firelog telemetry to prevent COEP ERR_BLOCKED_BY_RESPONSE
  // and subsequent infinite retry storms in cross-origin-isolated environments
  try {
    const isFirelog = (input) => {
      if (!input) return false;
      const url = typeof input === "string" ? input : (input && input.url ? input.url : "");
      return typeof url === "string" && (
        url.includes("firebaselogging-pa.googleapis.com") ||
        url.includes("firebaselogging.googleapis.com")
      );
    };

    const isLocalhost = typeof window !== "undefined" && (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.endsWith(".local") ||
      Boolean(window.FIREBASE_E2E_MOCK)
    );

    const isInstallations = (input) => {
      if (!isLocalhost || !input) return false;
      const url = typeof input === "string" ? input : (input && input.url ? input.url : "");
      return typeof url === "string" && url.includes("firebaseinstallations.googleapis.com");
    };

    const isRemoteConfig = (input) => {
      if (!isLocalhost || !input) return false;
      const url = typeof input === "string" ? input : (input && input.url ? input.url : "");
      return typeof url === "string" && url.includes("firebaseremoteconfig.googleapis.com");
    };

    if (typeof window !== "undefined" && typeof window.fetch === "function") {
      const originalFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        if (isFirelog(input)) {
          const payload = JSON.stringify({ nextRequestWaitMillis: "86400000", logResponseDetails: [] });
          if (typeof Response !== "undefined") {
            return Promise.resolve(new Response(payload, {
              status: 200,
              statusText: "OK",
              headers: {
                "Content-Type": "application/json",
                "Cross-Origin-Resource-Policy": "cross-origin",
              },
            }));
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => JSON.parse(payload),
            text: async () => payload,
          });
        }

        if (isInstallations(input)) {
          const url = typeof input === "string" ? input : (input && input.url ? input.url : "");
          let fid = "cDummyInstallationFid001";
          try {
            if (init && init.body && typeof init.body === "string") {
              const parsed = JSON.parse(init.body);
              if (parsed && parsed.fid) fid = parsed.fid;
            }
          } catch (_) {}

          const payload = url.includes("/authTokens:generate")
            ? JSON.stringify({
                token: "local-dummy-installation-token",
                expiresIn: "604800s",
              })
            : JSON.stringify({
                name: "projects/indii-music-founder/installations/" + fid,
                fid: fid,
                refreshToken: "local-dummy-refresh-token",
                authToken: {
                  token: "local-dummy-installation-token",
                  expiresIn: "604800s",
                },
              });

          if (typeof Response !== "undefined") {
            return Promise.resolve(new Response(payload, {
              status: 200,
              statusText: "OK",
              headers: {
                "Content-Type": "application/json",
                "Cross-Origin-Resource-Policy": "cross-origin",
              },
            }));
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => JSON.parse(payload),
            text: async () => payload,
          });
        }

        if (isRemoteConfig(input)) {
          const payload = JSON.stringify({
            entries: {},
            state: "EMPTY_CONFIG",
          });
          if (typeof Response !== "undefined") {
            return Promise.resolve(new Response(payload, {
              status: 200,
              statusText: "OK",
              headers: {
                "Content-Type": "application/json",
                "Cross-Origin-Resource-Policy": "cross-origin",
              },
            }));
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => JSON.parse(payload),
            text: async () => payload,
          });
        }

        return originalFetch.apply(this, arguments);
      };
    }

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const originalSendBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) {
        if (isFirelog(url)) {
          return true;
        }
        return originalSendBeacon(url, data);
      };
    }
  } catch (err) {
    // Non-critical telemetry defense failure, safe to ignore
  }
})();
