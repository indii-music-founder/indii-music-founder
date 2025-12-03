import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_API_KEY,
    authDomain: `${import.meta.env.VITE_VERTEX_PROJECT_ID}.firebaseapp.com`,
    projectId: import.meta.env.VITE_VERTEX_PROJECT_ID,
    storageBucket: `${import.meta.env.VITE_VERTEX_PROJECT_ID}.firebasestorage.app`,
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
export const storage = getStorage(app);
export const auth = getAuth(app);
import { signInAnonymously } from 'firebase/auth';
signInAnonymously(auth).catch(console.error);
export const functions = getFunctions(app);

if (import.meta.env.DEV) {
    // connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
