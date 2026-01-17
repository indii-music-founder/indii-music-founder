import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

const apiKey = process.env.VITE_FIREBASE_API_KEY;
const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

if (!apiKey || !authDomain || !projectId) {
    console.error("❌ Missing Firebase configuration in .env");
    console.error("Please ensure VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID are set.");
    process.exit(1);
}

const firebaseConfig = {
    apiKey,
    authDomain,
    projectId,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const email = "the.walking.agency.det@gmail.com";

console.log(`Sending password reset email to ${email}...`);

sendPasswordResetEmail(auth, email)
    .then(() => {
        console.log("Password reset email sent successfully!");
    })
    .catch((error) => {
        console.error("Error sending reset email:", error);
        process.exit(1);
    });
