const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const app = initializeApp({
    apiKey: "AIzaSyFakeKeyForTesting123",
    projectId: "test-project"
});
const rawAuth = getAuth(app);

const authProxy = new Proxy(rawAuth, {
    get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
    }
});

signInWithEmailAndPassword(authProxy, 'e2e@indii.test', 'password123')
    .then(console.log)
    .catch(console.error);
