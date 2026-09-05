import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

// All values are Firebase project identifiers (not secrets).
// Using env vars enables staging/production environment isolation.
// See CLAUDE.md §3.1 and docs/API_CREDENTIALS_POLICY.md for rationale.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Only initialize Firebase on the client side to prevent SSG build errors
// when NEXT_PUBLIC_FIREBASE_API_KEY is not available during static export
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let functions: Functions | undefined;

const isPlaceholderKey = (key?: string): boolean =>
  !key ||
  key === 'dummy' ||
  key === 'placeholder' ||
  key === 'mock' ||
  key.includes('placeholder') ||
  key.trim().length === 0;

if (typeof window !== 'undefined') {
  try {
    if (!firebaseConfig.apiKey || isPlaceholderKey(firebaseConfig.apiKey)) {
      console.warn('[Firebase] Firebase API key not provided or placeholder — skipping Firebase client initialization.');
    } else {
      app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      db = getFirestore(app);
      storage = getStorage(app);
      auth = getAuth(app);
      functions = getFunctions(app, 'us-central1');
      const appCheckKey = import.meta.env.VITE_FIREBASE_APP_CHECK_KEY;
      if (appCheckKey && !isPlaceholderKey(appCheckKey)) {
        initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(appCheckKey),
          isTokenAutoRefreshEnabled: true,
        });
      }
      console.log('[Firebase] Initialization successful');
    }
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
  }
}

export { auth, db, storage, functions };
export default app;
