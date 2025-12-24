
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Standard Firebase Config
const firebaseConfig = {
    apiKey: process.env.VITE_API_KEY,
    authDomain: process.env.VITE_AUTH_DOMAIN,
    projectId: process.env.VITE_PROJECT_ID || process.env.VITE_VERTEX_PROJECT_ID || "indiios-v-1-1",
    storageBucket: process.env.VITE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

// Use local functions if configured
if (process.env.VITE_FUNCTIONS_URL) {
    // Note: connectFunctionsEmulator logic would go here if using local emulator
    // But we are testing live connectivity usually
}

// Connect to Cloud Function
const generateImageFn = httpsCallable(functions, 'generateImage');

async function runTest() {
    console.log("🎨 Starting Image Generation Test (Vertex AI / Gemini Image 3)...");

    const prompt = "A cyberpunk street scene with neon lights, detailed, 8k";

    try {
        console.log(`1. Triggering Image Generation for: "${prompt}"`);
        const response = await generateImageFn({
            prompt: prompt,
            aspectRatio: "16:9",
            count: 1
        });
        console.log("   ✅ Image Generated:", response.data);
    } catch (error: any) {
        const message = error.message || '';
        const code = error.code || '';

        if (code === 'functions/unauthenticated' || message.includes('unauthenticated')) {
            console.log("   ✅ Connectivity verified! (Request reached server but was blocked by Auth as expected for script usage).");
            console.log("   ℹ️  To fully test generation, run within the authenticated Electron app.");
        } else if (code === 'functions/not-found' || message.includes('not found')) {
            console.error("   ❌ Function NOT FOUND. Check function name export in index.ts.");
            console.error("   Details:", error);
        } else {
            console.error('   ✗ Error:', message, error);
        }
    }
}

runTest();
