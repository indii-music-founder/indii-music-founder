import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

const apiKey = process.env.VITE_FIREBASE_API_KEY;
const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

if (!apiKey || !authDomain || !projectId) {
    console.error("❌ Missing Firebase configuration in .env");
    console.error("Please ensure VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID are set.");

if (!apiKey) {
    console.error("❌ Error: VITE_FIREBASE_API_KEY is missing from environment variables.");
    console.error("Please add it to your .env file.");
    process.exit(1);
}

const firebaseConfig = {
    apiKey,
    authDomain,
    projectId,
    apiKey: apiKey,
    authDomain: "indiios-v-1-1.firebaseapp.com",
    projectId: "indiios-v-1-1",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Ideally, this should also be an argument or env var, but focusing on the API key first.
const email = process.argv[2] || "the.walking.agency.det@gmail.com";

console.log(`Sending password reset email to ${email}...`);

sendPasswordResetEmail(auth, email)
    .then(() => {
        console.log("Password reset email sent successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Error sending reset email:", error);
        process.exit(1);
    });
