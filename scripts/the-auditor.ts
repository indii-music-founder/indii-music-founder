import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Protocol 16: The Auditor
// Verifies Live Infrastructure Configuration & Security

const firebaseConfig = {
    apiKey: "AIzaSyD9SmSp-2TIxw5EV9dfQSOdx4yRNNxU0RM",
    authDomain: "indiios-v-1-1.firebaseapp.com",
    projectId: "indiios-v-1-1",
    storageBucket: "gs://indiios-alpha-electron", // VERIFIED BUCKET
    appId: "1:223837784072:web:3af738739465ea4095e9bd"
};

async function audit() {
    console.log("📝 The Auditor: Initiating Live Infrastructure Audit...");

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const storage = getStorage(app);

    // 1. Authentication Audit
    console.log("\n🔒 Auditing Authentication Provider...");
    const email = "automator@indiios.com";
    const password = "AutomatorPass123!";
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
