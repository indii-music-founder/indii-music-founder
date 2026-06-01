const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const app = initializeApp({
    apiKey: "AIzaSyFakeKeyForTesting123", // Has to start with AIza
    projectId: "test-project"
});
const auth = getAuth(app);

const originalFetch = global.fetch;
global.fetch = async (url, options) => {
    if (url.toString().includes('identitytoolkit.googleapis.com')) {
        return {
            ok: true,
            status: 200,
            json: async () => ({
                localId: "test-user-uid-e2e",
                email: "e2e@indii.test",
                displayName: "E2E Test User",
                idToken: "mock-id-token-e2e",
                refreshToken: "mock-refresh-token-e2e",
                expiresIn: "3600",
            }),
            text: async () => JSON.stringify({
                localId: "test-user-uid-e2e",
                email: "e2e@indii.test",
                displayName: "E2E Test User",
                idToken: "mock-id-token-e2e",
                refreshToken: "mock-refresh-token-e2e",
                expiresIn: "3600",
            })
        };
    }
    return originalFetch(url, options);
};

signInWithEmailAndPassword(auth, 'e2e@indii.test', 'password123')
    .then(console.log)
    .catch(console.error);
