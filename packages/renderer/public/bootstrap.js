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
})();
