import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

import { env } from '../config/env';

const firebaseConfig = {
    apiKey: env.apiKey,
    authDomain: `${env.projectId}.firebaseapp.com`,
    projectId: env.projectId,
    storageBucket: `${env.projectId}.firebasestorage.app`,
    messagingSenderId: "563584335869",
    appId: "1:563584335869:web:321321321"
};

// Fallback for production if env vars are missing (though they shouldn't be)
if (!firebaseConfig.projectId) {
    console.warn("Firebase config missing env vars, using fallback.");
    firebaseConfig.authDomain = "indiios-v-1-1.firebaseapp.com";
    firebaseConfig.projectId = "indiios-v-1-1";
    firebaseConfig.storageBucket = "indiios-v-1-1.firebasestorage.app";
}

import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a a time.
        console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code == 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore persistence not supported');
    }
});
export const storage = getStorage(app);
export const auth = getAuth(app);
import { signInAnonymously } from 'firebase/auth';
signInAnonymously(auth).catch(console.error);
export const functions = getFunctions(app);

if (env.DEV) {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
