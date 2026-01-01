
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import * as dotenv from 'dotenv';

dotenv.config();

// Fallback mock config if env vars are missing (development only)
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.VITE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "indiios-v-1-1.firebaseapp.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "indiios-v-1-1",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "gs://indiios-alpha-electron",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID || "1:223837784072:web:3af738739465ea4095e9bd"
};

console.log('Initializing Firebase with project:', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const licenses = [
    {
        title: "Summer Vibes 2024",
        artist: "The Weekend Chillers",
        licenseType: "Synchronization",
        status: "active",
        usage: "TV Commercial",
        notes: "Global rights for 1 year",
        startDate: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdAt: Timestamp.now()
    },
    {
        title: "Neon Nights",
        artist: "CyberSynth",
        licenseType: "Mechanical",
        status: "active",
        usage: "Streaming Distribution",
        notes: "Standard rate",
        startDate: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdAt: Timestamp.now()
    }
];

const requests = [
    {
        title: "Epic Trailer Music",
        artist: "Orchestral Manoeuvres",
        usage: "Movie Trailer",
        status: "checking",
        notes: "Budget is tight, need negotiation",
        requestedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    },
    {
        title: "Lofi Study Beat",
        artist: "Chill Hopper",
        usage: "YouTube Background",
        status: "negotiating",
        notes: "Artist wants credit",
        requestedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    }
];

async function seed() {
    console.log('Seeding Licensing Data...');

    try {
        // Authenticate
        const email = process.env.AUDITOR_EMAIL;
        const password = process.env.AUDITOR_PASSWORD;
        let userId: string;

        if (email && password) {
            console.log(`Authenticating as ${email}...`);
            const cred = await signInWithEmailAndPassword(auth, email, password);
            userId = cred.user.uid;
        } else {
            console.log('No auditor credentials found, attempting anonymous sign-in...');
            const cred = await signInAnonymously(auth);
            userId = cred.user.uid;
        }

        console.log(`Authenticated as UID: ${userId}`);

        const licensesRef = collection(db, 'licenses');
        for (const lic of licenses) {
            await addDoc(licensesRef, { ...lic, userId });
            console.log(`Added license: ${lic.title}`);
        }

        const requestsRef = collection(db, 'license_requests');
        for (const req of requests) {
            await addDoc(requestsRef, { ...req, userId });
            console.log(`Added request: ${req.title}`);
        }

        console.log('Seeding complete.');
        process.exit(0);
    } catch (error) {
        console.error('CRITICAL ERROR during seeding:', error);
        // Fail the build if seeding fails (except in very specific sandbox conditions if needed)
        process.exit(1);
    }
}

seed();
