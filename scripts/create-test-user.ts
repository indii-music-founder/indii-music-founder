import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { env } from '../src/config/env';

// Hardcode config because env might be flaky in scripts
const firebaseConfig = {
    apiKey: "AIzaSyCXQDyy5Bc0-ZNoZwI41Zrx9AqhdxUjvQo",
    authDomain: "indiios-v-1-1.firebaseapp.com",
    projectId: "indiios-v-1-1",
    storageBucket: "image_bucket-indiios",
    appId: "1:223837784072:web:3af738739465ea4095e9bd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function main() {
    const email = "automator@indiios.com";
    const password = "AutomatorPass123!";

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
