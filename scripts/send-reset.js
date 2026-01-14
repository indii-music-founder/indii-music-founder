
import { initializeApp } from 'firebase/app';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

// Use the VALID key found in .env
const firebaseConfig = {
    apiKey: "AIzaSyBWCig_kA7j_3Xm5IphpAq4WqGLwpwEzvA", // VITE_FIREBASE_API_KEY
    authDomain: "indiios-v-1-1.firebaseapp.com",
    projectId: "indiios-v-1-1",
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
