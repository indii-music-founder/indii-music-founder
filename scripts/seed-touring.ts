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

const vehicleStats = {
    milesDriven: 12500,
    fuelLevelPercent: 75,
    tankSizeGallons: 200,
    mpg: 12,
    gasPricePerGallon: 4.80,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
};

const itineraries = [
    {
        tourName: "West Coast Run 2024",
        totalDistance: "1200 miles",
        estimatedBudget: "$5000",
        stops: [
            {
                date: "2024-06-01",
                city: "Los Angeles, CA",
                venue: "The Roxy",
                activity: "Show",
                notes: "Load in at 4pm",
                type: "performance",
                distance: 0
            },
            {
                date: "2024-06-03",
                city: "San Francisco, CA",
                venue: "The Independent",
                activity: "Show",
                notes: "Hotel nearby",
                type: "performance",
                distance: 380
            }
        ],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    }
];

async function seed() {
    console.log('Seeding Touring Data...');

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

        // Seed Vehicle Stats
        // Note: VehicleStats is usually one-per-user, but for seeding we just add one.
        const vehiclesRef = collection(db, 'tour_vehicles');
        await addDoc(vehiclesRef, { ...vehicleStats, userId });
        console.log('Added vehicle stats.');

        // Seed Itineraries
        const itinerariesRef = collection(db, 'tour_itineraries');
        for (const itin of itineraries) {
            await addDoc(itinerariesRef, { ...itin, userId });
            console.log(`Added itinerary: ${itin.tourName}`);
        }

        console.log('Seeding complete.');
        process.exit(0);
    } catch (error) {
        console.error('CRITICAL ERROR during seeding:', error);
        process.exit(1);
    }
}

seed();
