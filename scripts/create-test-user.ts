import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

// Support ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
config({ path: path.join(__dirname, '../.env') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.VITE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "indiios-v-1-1.firebaseapp.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "indiios-v-1-1",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "gs://indiios-alpha-electron",
    appId: process.env.VITE_FIREBASE_APP_ID || "1:223837784072:web:3af738739465ea4095e9bd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function main() {
    const email = process.env.AUDITOR_EMAIL;
    const password = process.env.AUDITOR_PASSWORD;

    if (!email || !password) {
        console.error("❌ CRTICAL ERROR: Test credentials not found in env.");
        console.error("   Please set AUDITOR_EMAIL and AUDITOR_PASSWORD in your .env file.");
        process.exit(1);
    }

    try {
        console.log(`Attempting to create user: ${email}...`);
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        console.log("User created! UID:", cred.user.uid);
    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            console.log("User already exists. Logging in...");
            const cred = await signInWithEmailAndPassword(auth, email, password);
            console.log("Logged in! UID:", cred.user.uid);
        } else {
            console.error("Error:", error);
            process.exit(1);
        }
    }
    process.exit(0);
}

main();
