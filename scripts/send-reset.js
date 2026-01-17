
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

// Load environment variables
dotenv.config();

// Validate required env vars
const requiredEnvVars = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Missing required environment variable: ${envVar}`);
        console.error('Please ensure your .env file contains all required Firebase configuration.');
        process.exit(1);
    }
}

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
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
