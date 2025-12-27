import { config } from 'dotenv';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { fileURLToPath } from 'url';

// Support ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
config({ path: path.join(__dirname, '../.env') });

// Protocol 16: The Auditor
// Verifies Live Infrastructure Configuration & Security

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.VITE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "indiios-v-1-1.firebaseapp.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "indiios-v-1-1",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "indiios-alpha-electron.firebasestorage.app",
    appId: process.env.VITE_FIREBASE_APP_ID || "1:223837784072:web:3af738739465ea4095e9bd"
};

const email = process.env.AUDITOR_EMAIL;
const password = process.env.AUDITOR_PASSWORD;

if (!email || !password) {
    console.error("❌ CRTICAL ERROR: Test credentials not found in env.");
    console.error("   Please set AUDITOR_EMAIL and AUDITOR_PASSWORD in your .env file.");
    process.exit(1);
}

async function audit() {
    console.log("📝 The Auditor: Initiating Live Infrastructure Audit...");

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const storage = getStorage(app);

    // 1. Authentication Audit
    console.log("\n🔒 Auditing Authentication Provider...");
    let user;
    try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        user = cred.user;
        console.log(`✅ Auth Success: Service Account Active (${user.uid})`);
    } catch (e: any) {
        console.error(`❌ Auth Failed: ${e.message}`);
        process.exit(1);
    }

    // 2. Storage Connectivity & Rules Audit
    console.log("\n📦 Auditing Storage Bucket (gs://indiios-alpha-electron)...");
    const content = new TextEncoder().encode("Auditor Verification Timestamp: " + new Date().toISOString());

    // Test 2.1: Write Access (Private)
    const myRef = ref(storage, `users/${user.uid}/auditor-test.txt`);
    try {
        await uploadBytes(myRef, content);
        console.log("✅ Storage Write: Success (Own Path)");
    } catch (e: any) {
        console.error(`❌ Storage Write Failed: ${e.message}`);
        process.exit(1);
    }

    // Test 2.2: Cleanup (Delete)
    try {
        await deleteObject(myRef);
        console.log("✅ Storage Cleanup: Success");
    } catch (e: any) {
        console.warn(`⚠️ Storage Cleanup Failed: ${e.message}`);
    }

    // Test 2.3: Security Rule Enforcement (Deny Other)
    const otherRef = ref(storage, `users/other-user/auditor-hack.txt`);
    try {
        await uploadBytes(otherRef, content);
        console.error("❌ Security Failure: Write to Other User Path SUCCEEDED (Should Fail)");
        process.exit(1);
    } catch (e: any) {
        console.log("✅ Security Rule Verified: Write to Other User Path DENIED");
    }

    console.log("\n🎉 AUDIT COMPLETE: All Infrastructure Contracts Valid.");
    process.exit(0);
}

audit();
