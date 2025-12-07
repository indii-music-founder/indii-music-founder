import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyD7bmREk0yo8-WtJIngr7ek9U1-BC7BTC0",
  authDomain: "indiios-v-1-1.firebaseapp.com",
  databaseURL: "https://indiios-v-1-1-default-rtdb.firebaseio.com",
  projectId: "indiios-v-1-1",
  storageBucket: "indiios-v-1-1.firebasestorage.app",
  messagingSenderId: "223837784072",
  appId: "1:223837784072:web:28eabcf0c5dd985395e9bd",
  measurementId: "G-KNWPRGE5JK"
};

// Initialize Firebase (prevent duplicate initialization in dev)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
