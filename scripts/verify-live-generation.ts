import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Load environment variables
dotenv.config();

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || process.env.VITE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.VITE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || process.env.VITE_PROJECT_ID || 'indii-music-founder',
    appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || process.env.VITE_APP_ID,
};

// Validate required configurations
if (!firebaseConfig.apiKey) {
    console.error("❌ Missing environment configuration: apiKey (VITE_FIREBASE_API_KEY / VITE_API_KEY)");
    process.exit(1);
}

const email = process.env.AUTOMATOR_EMAIL || 'marcus.deep@test.indii.music';
const password = process.env.AUTOMATOR_PASSWORD || 'Test1234!';

async function main() {
    console.log("🚀 Starting End-to-End Live Generation Pipeline Verification...");
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const functions = getFunctions(app);

    let user;
    try {
        console.log(`   👉 Attempting to sign in test user: ${email}...`);
        const cred = await signInWithEmailAndPassword(auth, email, password);
        user = cred.user;
        console.log(`   ✅ SUCCESS! Authenticated user UID: ${user.uid}`);
    } catch (e: any) {
        console.log(`   ℹ️ Sign-in failed (${e.message}). Attempting to register new test account dynamically...`);
        try {
            const { createUserWithEmailAndPassword } = await import('firebase/auth');
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            user = cred.user;
            console.log(`   ✅ SUCCESS! Registered and authenticated new test user UID: ${user.uid}`);
        } catch (regError: any) {
            console.error("   ❌ ERROR: Authentication & registration failed:", regError.message || regError);
            process.exit(1);
        }
    }

    // 2. Test Image Generation (generateImageV3)
    console.log("\n🎨 Stage 2: Testing live Image Generation (generateImageV3)...");
    const generateImageFn = httpsCallable(functions, 'generateImageV3');
    try {
        console.log("   👉 Invoking generateImageV3 with prompt: 'A futuristic floating island, synthwave style'...");
        const res = await generateImageFn({
            prompt: "A futuristic floating island, synthwave style",
            aspectRatio: "1:1"
        });
        console.log("   ✅ SUCCESS! generateImageV3 returned response:", res.data);
    } catch (e: any) {
        console.error("   ❌ ERROR: Image generation failed:", e.message || e);
        if (e.details) {
            console.error("      Details:", e.details);
        }
    }

    // 3. Test Video Generation (generateVideoV3)
    console.log("\n🎬 Stage 3: Testing live Video Generation (generateVideoV3)...");
    const generateVideoFn = httpsCallable(functions, 'generateVideoV3');
    try {
        console.log("   👉 Invoking generateVideoV3 with prompt: 'Drone shot flying over futuristic synthwave city'...");
        const res = await generateVideoFn({
            prompt: "Drone shot flying over futuristic synthwave city"
        });
        console.log("   ✅ SUCCESS! generateVideoV3 returned response:", res.data);
    } catch (e: any) {
        console.error("   ❌ ERROR: Video generation failed:", e.message || e);
        if (e.details) {
            console.error("      Details:", e.details);
        }
    }

    console.log("\n🏁 Live Generation Pipeline Verification completed.");
}

main();
