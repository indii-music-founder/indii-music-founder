import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "indiios-v-1-1.firebaseapp.com",
  projectId: "indiios-v-1-1",
  storageBucket: "indiios-v-1-1.firebasestorage.app",
  messagingSenderId: "563584335869",
  appId: "1:563584335869:web:321321321"
};

// Initialize Firebase (prevent duplicate initialization in dev)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
