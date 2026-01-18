
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp, doc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.VITE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "indiios-v-1-1.firebaseapp.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "indiios-v-1-1",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "gs://indiios-alpha-electron",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID || "1:223837784072:web:3af738739465ea4095e9bd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const TEST_UID = "cuyWtUv8QCcgv7AtwQU62cEleos2";
const TEST_EMAIL = "the.walking.agency.det@gmail.com";
const TEST_PASSWORD = "qwertyuiop";

// --- SEED DATA DEFINITIONS ---

const ANALYZED_TRACKS = [
    {
        id: "track-1",
        filename: "Neon Dreams.mp3",
        analyzedAt: new Date().toISOString(),
        fileHash: "hash-neon-dreams",
        features: {
            bpm: 124.5,
            key: "C# min",
            energy: 0.92,
            danceability: 0.85,
            valence: 0.65,
            loudness: -8.2,
            mood: 'energetic',
            genre: 'Electronic'
        }
    },
    {
        id: "track-2",
        filename: "Midnight Soul.wav",
        analyzedAt: new Date().toISOString(),
        fileHash: "hash-midnight-soul",
        features: {
            bpm: 90.0,
            key: "G Maj",
            energy: 0.45,
            danceability: 0.65,
            valence: 0.45,
            loudness: -12.5,
            mood: 'chill',
            genre: 'Soul'
        }
    }
];

const CAMPAIGNS = [
    {
        name: "Neon Dreams Release",
        type: "Pre-save",
        status: "ACTIVE",
        startDate: Timestamp.now(),
        endDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        budget: 500,
        reach: 15400,
        conversions: 245,
        assets: ["neon-dreams-art.jpg", "promo-video-1.mp4"]
    }
];

const MERCH_PRODUCTS = [
    {
        title: "Neon Dreams Oversized Tee",
        price: "$35.00",
        image: "https://firebasestorage.googleapis.com/v0/b/indiios-v-1-1.appspot.com/o/merch%2Fstandard_tee.png?alt=media",
        tags: ["Streetwear", "Oversized"],
        category: "standard",
        status: "available"
    }
];

const ISRC_REGISTRY = [
    {
        isrc: "US-DET-24-00001",
        releaseId: "REL-001",
        trackTitle: "Neon Dreams (Original Mix)",
        artistName: "The Walking Agency",
        assignedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    }
];

const TAX_PROFILE = {
    formType: "W-9",
    country: "US",
    tinMasked: "*******12",
    tinValid: true,
    certified: true,
    payoutStatus: "ACTIVE",
    certTimestamp: Timestamp.now(),
    legalName: "The Walking Agency DET",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
};

async function seed() {
    console.log(`🚀 Starting seeding for ${TEST_EMAIL}...`);

    try {
        await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
        console.log("✅ Authenticated successfully.");

        // 1. Analyzed Tracks
        console.log("🎵 Seeding Analyzed Tracks...");
        for (const track of ANALYZED_TRACKS) {
            const ref = doc(db, "users", TEST_UID, "analyzed_tracks", track.id);
            await setDoc(ref, { ...track, userId: TEST_UID }, { merge: true });
        }

        // 2. Campaigns
        console.log("📣 Seeding Campaigns...");
        for (const camp of CAMPAIGNS) {
            // Note: campaigns collection is user-scoped in rules, but doesn't have a strict schema check yet in rules beyond ownership
            await addDoc(collection(db, "campaigns"), { ...camp, userId: TEST_UID });
        }

        // 3. Merchandise
        console.log("👕 Seeding Merchandise...");
        for (const prod of MERCH_PRODUCTS) {
            await addDoc(collection(db, "merchandise"), { ...prod, userId: TEST_UID });
        }

        // 4. ISRC Registry
        console.log("🆔 Seeding ISRC Registry...");
        for (const entry of ISRC_REGISTRY) {
            await addDoc(collection(db, "isrc_registry"), { ...entry, userId: TEST_UID });
        }

        // 5. Tax Profile
        console.log("📄 Seeding Tax Profile...");
        const taxRef = doc(db, "tax_profiles", TEST_UID);
        await setDoc(taxRef, { ...TAX_PROFILE, userId: TEST_UID }, { merge: true });

        console.log("\n✨ Seeding Complete!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
}

seed();
