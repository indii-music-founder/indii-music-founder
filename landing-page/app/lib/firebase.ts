import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDahlGblu9DJFLZf2DpiZXrKJVb3luD40w",
  authDomain: "indiios-v-1-1.web.app",
  databaseURL: "https://indiios-v-1-1-default-rtdb.firebaseio.com",
  projectId: "indiios-v-1-1",
  storageBucket: "indiios-v-1-1.firebasestorage.app",
  messagingSenderId: "223837784072",
  appId: "1:223837784072:web:3af738739465ea4095e9bd",
  measurementId: "G-T6V8WPE7Z7"
};

// Only initialize Firebase on the client side to prevent SSG build errors
// when NEXT_PUBLIC_FIREBASE_API_KEY is not available during static export
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

if (typeof window !== 'undefined') {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('[Firebase] Initialization successful');
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
  }
}

export { auth, db };
export default app;
