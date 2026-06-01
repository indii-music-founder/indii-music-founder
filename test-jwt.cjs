const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const app = initializeApp({ apiKey: "AIzaSyFakeKeyForTesting123", projectId: "test-project" });
const auth = getAuth(app);
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
    if (url.toString().includes('identitytoolkit.googleapis.com')) {
        return {
            ok: true, status: 200,
            json: async () => ({
                localId: "test-user-uid-e2e",
                email: "e2e@indii.test",
                idToken: "mock-id-token-e2e",
                refreshToken: "mock-refresh-token-e2e",
                expiresIn: "3600",
            }),
            text: async () => JSON.stringify({
                localId: "test-user-uid-e2e",
                email: "e2e@indii.test",
                idToken: "mock-id-token-e2e",
                refreshToken: "mock-refresh-token-e2e",
                expiresIn: "3600",
            })
        };
    }
    return originalFetch(url, options);
};

// We need to bypass the API key check by overriding the fetch response correctly.
// Oh wait, node fetch is tricky. Let's just create a test JWT.
