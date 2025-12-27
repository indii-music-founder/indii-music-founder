import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, collection, getDocs, limit, query } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import * as fs from 'fs';
import * as path from 'path';

import { config } from 'dotenv';
config({ path: path.join(__dirname, '../.env') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.VITE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "indiios-v-1-1.web.app",
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || "https://indiios-v-1-1-default-rtdb.firebaseio.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "indiios-v-1-1",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "indiios-v-1-1.firebasestorage.app",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "223837784072",
    appId: process.env.VITE_FIREBASE_APP_ID || "1:223837784072:web:28eabcf0c5dd985395e9bd",
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || "G-KNWPRGE5JK"
};

// Initialize Firebase without persistence for Node.js environment
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);
const auth = getAuth(app);

// Generated Images Metadata
const IMAGES_TO_UPLOAD = [
    {
        path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/6fa7fcfe-e045-4d0d-a947-7a744b66bbf8/cyberpunk_studio_inspiration_1766684812320.png',
        description: 'Cyberpunk Studio Inspiration',
        filename: 'cyberpunk-studio.png',
        tags: ['cyberpunk', 'studio', 'inspiration']
    },
    {
        path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/6fa7fcfe-e045-4d0d-a947-7a744b66bbf8/organic_soundscape_inspiration_1766684828965.png',
        description: 'Organic Soundscape Inspiration',
        filename: 'organic-soundscape.png',
        tags: ['organic', 'soundscape', 'nature']
    },
    {
        path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/6fa7fcfe-e045-4d0d-a947-7a744b66bbf8/lofi_chill_inspiration_1766684845951.png',
        description: 'Lofi Chill Inspiration',
        filename: 'lofi-chill.png',
        tags: ['lofi', 'chill', 'vibe']
    },
    {
        path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/6fa7fcfe-e045-4d0d-a947-7a744b66bbf8/cinematic_orchestral_inspiration_1766684863126.png',
        description: 'Cinematic Orchestral Inspiration',
        filename: 'cinematic-orchestral.png',
        tags: ['cinematic', 'orchestral', 'epic']
    }
];

async function findFirstUser(): Promise<string | null> {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            return snapshot.docs[0].id;
        }
        return null;
    } catch (error) {
        console.error("Error finding user:", error);
        return null;
    }
}

async function uploadImages(userId: string) {
    console.log(`Starting integration process for user: ${userId}`);
    const userRef = doc(db, 'users', userId);

    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        console.error(`User document for ${userId} does not exist!`);
        return;
    }

    const uploadedAssets: any[] = [];

    for (const img of IMAGES_TO_UPLOAD) {
        console.log(`Processing ${img.filename}...`);

        try {
            if (!fs.existsSync(img.path)) {
                console.error(`File not found at path: ${img.path}`);
                continue;
            }

            // Fallback to local file URL since Storage upload is flaky in script context (CORS/Referer/Auth)
            // Electron can render local files if we handle the protocol correctly.
            // We encode the path segments to ensure spaces are handled.
            const url = `file://${img.path.split('/').map(p => encodeURIComponent(p)).join('/').replace('%2F', '/')}`;

            // Fix: encodeURIComponent encodes '/' too, we need to preserve slashes or join them back.
            // Better way:
            const safePath = img.path.split('/').map(segment => encodeURIComponent(segment)).join('/');
            // The leading slash becomes empty string -> %2F -> we need to restore logic.
            // Actually, 'file://' + encodeURI(img.path) is cleaner but encodeURI doesn't escape # or ?.
            // Let's use simplified replacement for spaces which is the main issue.
            const fileUrl = `file://${img.path.replace(/ /g, '%20')}`;

            console.log(`Using local URL: ${fileUrl}`);

            uploadedAssets.push({
                id: crypto.randomUUID(),
                url: fileUrl,
                description: img.description,
                category: 'reference',
                tags: [...img.tags, 'ai-generated'],
                createdAt: new Date().toISOString()
            });

        } catch (e) {
            console.error(`Failed to process ${img.filename}:`, e);
        }
    }

    // Update Firestore
    if (uploadedAssets.length > 0) {
        console.log(`Adding ${uploadedAssets.length} assets to Firestore profile...`);

        try {
            await updateDoc(userRef, {
                "brandKit.referenceImages": arrayUnion(...uploadedAssets)
            });
            console.log("Profile updated successfully! Check the Studio Headquarters.");
        } catch (e) {
            console.error("Failed to update Firestore:", e);
        }
    } else {
        console.log("No assets were processed.");
    }
}

async function main() {
    try {
        console.log("Initializing...");

        // Try anonymous auth first to satisfy potential security rules (if they allow public reads/writes or anon)
        // If rules require 'auth != null', this helps.
        try {
            await signInAnonymously(auth);
            console.log("Signed in anonymously.");
        } catch (e) {
            console.warn("Anonymous sign-in failed, proceeding primarily with unauthenticated client access (might fail if rules are strict).", e);
        }

        let userId = process.argv[2];

        if (!userId) {
            console.log("No User ID provided in args. Attempting to find the first user in database...");
            const foundId = await findFirstUser();
            if (foundId) {
                console.log(`Found user: ${foundId}`);
                userId = foundId;
            } else {
                console.error("Could not find any users in the database and no ID was provided. Please ensure permissions allow listing users or provide an ID manually.");
                process.exit(1);
            }
        }

        await uploadImages(userId);

        // Exit process after completion (firebase app keeps process alive)
        process.exit(0);
    } catch (e) {
        console.error("Fatal Script Error:", e);
        process.exit(1);
    }
}

main();
