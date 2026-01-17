import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Load environment variables
dotenv.config();

// Validate required env vars
const requiredEnvVars = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_APP_ID', 'AUTOMATOR_EMAIL', 'AUTOMATOR_PASSWORD'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Missing required environment variable: ${envVar}`);
        console.error('Please ensure your .env file contains all required configuration.');
        process.exit(1);
    }
}

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    appId: process.env.FIREBASE_APP_ID,
};

const BUCKET_CANDIDATES = [
    "gs://indiios-alpha-electron",
    "indiios-alpha-electron.appspot.com",
    "indiios-alpha-electron.firebasestorage.app",
    "indiios-alpha-electron"
];

async function main() {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    console.log("Authenticating...");
    const email = process.env.AUTOMATOR_EMAIL!;
    const password = process.env.AUTOMATOR_PASSWORD!;
    let user;
    try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        user = cred.user;
        console.log(`Authenticated: ${user.uid}`);
    } catch (e) {
        console.error("Auth Failed:", e);
        process.exit(1);
    }

    const content = new TextEncoder().encode("probe content");

    for (const bucket of BUCKET_CANDIDATES) {
        console.log(`\n--- Probing Bucket: ${bucket} ---`);
        try {
            // Initialize Storage with specific bucket
            // Note: getStorage(app, bucketUrl) is the API
            const storage = getStorage(app, bucket);
            const testRef = ref(storage, `users/${user.uid}/probe.txt`);

            await uploadBytes(testRef, content);
            console.log("✅ SUCCESS! Upload worked.");

            // Cleanup
            try { await deleteObject(testRef); } catch (e) {
                // Ignore cleanup errors
            }

            console.log("Found Valid Bucket Strong:", bucket);
            // We found it, no need to probe others (though we could)
            process.exit(0);

        } catch (e: any) {
            console.log(`❌ Failed (${bucket}):`, e.code, e.message || e);
        }
    }

    console.error("\nALL BUCKET PROBES FAILED.");
    process.exit(1);
}

main();
