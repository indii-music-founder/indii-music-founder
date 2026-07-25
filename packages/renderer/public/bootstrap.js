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

  if (
    window.location.hostname.endsWith("web.app") ||
    window.location.hostname.endsWith("firebaseapp.com")
  ) {
    window.location.replace(
      `https://indii.music${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
  }
})();
