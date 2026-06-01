import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/**
 * Firebase client config for the admin dashboard.
 *
 * These are public identifiers (not secrets) — they identify the project for
 * Identity Platform. Authorization is enforced server-side: the Express backend
 * (server.ts requireAdminAuth) only accepts ID tokens whose email ends in
 * @indii.music, and Firestore Security Rules gate the data itself.
 *
 * Values come from Vite env (VITE_FIREBASE_*) with the production project as a
 * fallback so the dashboard works out of the box.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyDHL8PVxgVYbHtLF95KQtdRfitf3d7zEKc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'indii-music-founder.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'indii-music-founder',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'indii-music-founder.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '148015878263',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:148015878263:web:febc76c0bd56f28cdbb672',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

/** localStorage key the data modules read their Bearer token from. */
export const ADMIN_TOKEN_KEY = 'indii_admin_token';
