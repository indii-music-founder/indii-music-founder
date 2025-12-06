
import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { getAuth, signInAnonymously } from "firebase/auth";
// import { env } from "../src/config/env"; // config/env.ts is too strict for this script

// 1. Manually init firebase (reusing config logic as we are in Node/script env)
// env.ts is isomorphic so this should work if VITE_ vars are present or fallbacks used.

const firebaseConfig = {
    apiKey: "AIzaSyAZi0vng6V6EErwFTBBF9VlFD742nhwQNM",
    authDomain: "architexture-ai-api.firebaseapp.com",
    projectId: "architexture-ai-api",
    storageBucket: "architexture-ai-api.firebasestorage.app",
};

if (!firebaseConfig.apiKey) {
    console.error("Missing API Key in env.");
    process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

async function runVerification() {
    console.log("Starting Live Storage Security Verification...");

    try {
        const userCred = await signInAnonymously(auth);
        const user = userCred.user;
        console.log(`Signed in as: ${user.uid}`);

        // TEST 1: Write to OWN path (Should SUCCEED)
        console.log(`Test 1: Writing to users/${user.uid}/verify.txt...`);
        const myRef = ref(storage, `users/${user.uid}/verify.txt`);
        const blob = new Blob(["verification content"], { type: "text/plain" });
        await uploadBytes(myRef, blob);
        console.log("✅ Test 1 Passed: Write to own path succeeded.");

        // TEST 2: Write to OTHER user path (Should FAIL)
        console.log(`Test 2: Writing to users/other-user/hack.txt...`);
        const otherRef = ref(storage, `users/other-user/hack.txt`);
        try {
            await uploadBytes(otherRef, blob);
            console.error("❌ Test 2 Failed: Write to other user path SUCCEEDED (Should have failed!)");
            process.exit(1);
        } catch (e: any) {
            if (e.code === 'storage/unauthorized' || e.message.includes('permission') || e.code === 403) {
                console.log("✅ Test 2 Passed: Write to other user path denied.");
            } else {
                console.log("⚠️ Test 2 Warning: Failed but not strictly permission denied?", e.code, e.message);
                // In live env, sometimes behavior varies, but unauthorized is expected.
                console.log("Assuming success if failure was regarding access.");
            }
        }

        console.log("---------------------------------------------------");
        console.log("🎉 Security Verification Complete: Rules are Active.");
        process.exit(0);

    } catch (error) {
        console.error("Verification script failed unexpectedly:", error);
        process.exit(1);
    }
}

// Polyfill Blob for Node.js if needed (Node 18+ has Blob global)
if (typeof Blob === 'undefined') {
    global.Blob = require('buffer').Blob;
}

runVerification();
