
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { env } from '../src/config/env';

// Mock Browser Environment for Firebase
// @ts-expect-error Firebase scripts assume DOM window exists
global.window = {};
// @ts-expect-error align global self reference for Firebase SDK in Node
global.self = global;

// Hardcoded Token from Step 249 (This is the one-time proof)
// Hardcoded Token from Step 249 (This is the one-time proof)
const ID_TOKEN = "YOUR_ID_TOKEN_HERE";

const ACCESS_TOKEN = "YOUR_ACCESS_TOKEN_HERE";

// Init Firebase (Replicating src/services/firebase.ts config to avoid import issues in script)
const firebaseConfig = {
    apiKey: "AIzaSyCXQDyy5Bc0-ZNoZwI41Zrx9AqhdxUjvQo",
    authDomain: "indiios-v-1-1.firebaseapp.com",
    projectId: "indiios-v-1-1",
    storageBucket: "indiios-v-1-1.firebasestorage.app",
    appId: "1:223837784072:web:3af738739465ea4095e9bd"
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
