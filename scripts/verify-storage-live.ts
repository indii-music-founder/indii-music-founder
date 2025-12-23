import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyCXQDyy5Bc0-ZNoZwI41Zrx9AqhdxUjvQo",
    authDomain: "indiios-v-1-1.firebaseapp.com",
    projectId: "indiios-v-1-1",
    // storageBucket: We will inject this dynamically
    appId: "1:223837784072:web:3af738739465ea4095e9bd"
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
    const email = "automator@indiios.com";
    const password = "AutomatorPass123!";
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
