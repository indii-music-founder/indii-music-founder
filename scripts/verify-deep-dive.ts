
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Load environment variables
dotenv.config();

// Mock Browser Environment for Firebase
// @ts-expect-error Firebase scripts assume DOM window exists
global.window = {};
// @ts-expect-error align global self reference for Firebase SDK in Node
global.self = global;

// Validate required env vars
const requiredEnvVars = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET', 'FIREBASE_APP_ID'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Missing required environment variable: ${envVar}`);
        console.error('Please ensure your .env file contains all required Firebase configuration.');
        process.exit(1);
    }
}

// Hardcoded Token from Step 249 (This is the one-time proof)
// Replace with your actual tokens for testing
const ID_TOKEN = process.env.GOOGLE_ID_TOKEN || "YOUR_ID_TOKEN_HERE";
const ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN || "YOUR_ACCESS_TOKEN_HERE";

// Init Firebase from environment variables
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    appId: process.env.FIREBASE_APP_ID,
};

console.log("Initializing Firebase...");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);

async function runDeepDive() {
    try {
        console.log("Signing in with Credential...");
        const credential = GoogleAuthProvider.credential(ID_TOKEN, ACCESS_TOKEN);
        const userCred = await signInWithCredential(auth, credential);
        console.log("Signed In User:", userCred.user.uid, userCred.user.email);

        console.log("Invoking triggerVideoJob (Cloud Function) directly to bypass UI...");
        // Use httpsCallable directly to match VideoGenerationService.ts logic
        // But simpler: just call the function.

        const triggerVideoJob = httpsCallable(functions, 'triggerVideoJob');

        // Payload
        const payload = {
            model: "video-generation", // AI_MODELS.VIDEO.GENERATION
            prompt: "A futuristic city with flying cars, cinematic lighting, 8k",
            jobId: `test-job-${Date.now()}`
        };

        console.log("Calling triggerVideoJob...", payload);
        const result = await triggerVideoJob(payload);

        console.log("Video Job Triggered Success:", result.data);

        // Ideally we check Firestore for the job, but triggerVideoJob returning something is proof enough for now.

    } catch (e: any) {
        console.error("Deep Dive Failed:", e);
        if (e.code) console.error("Error Code:", e.code);
        if (e.details) console.error("Error Details:", e.details);
        process.exit(1);
    }
}

runDeepDive();
