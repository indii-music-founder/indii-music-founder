import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import { config } from 'dotenv';
import path from 'path';

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verifyProfile() {
    try {
        console.log("Searching for user profile...");
        const usersRef = collection(db, 'users');
        const q = query(usersRef, limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.error("No users found in database.");
            return;
        }

        const userDoc = snapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();

        console.log(`\n--- Verification Report for User: ${userId} ---`);
        console.log(`Bio: ${userData.bio || '(empty)'}`);

        const brandKit = userData.brandKit || {};
        const refImages = brandKit.referenceImages || [];

        console.log(`\nReference Images Count: ${refImages.length}`);

        if (refImages.length > 0) {
            console.log("\nLast 5 Images:");
            refImages.slice(-5).forEach((img: any, index: number) => {
                console.log(`[${index + 1}] Type: ${img.category || 'N/A'}`);
                console.log(`    URL: ${img.url}`);
                console.log(`    Tags: ${img.tags?.join(', ') || 'none'}`);
            });

            // Check if our specific art is there
            const hasArt = refImages.some((img: any) => img.tags?.includes('ai-generated'));
            if (hasArt) {
                console.log("\n✅ SUCCESS: AI Generated Art found in profile.");
            } else {
                console.log("\n⚠️ WARNING: specific 'ai-generated' tag not found in recent images.");
            }

            // Check URL format
            const fileUrls = refImages.filter((img: any) => img.url.startsWith('file://'));
            console.log(`\nStats: ${fileUrls.length} image(s) using local 'file://' protocol.`);

        } else {
            console.error("❌ FAILURE: No reference images found.");
        }

    } catch (error) {
        console.error("Verification failed:", error);
    } finally {
        process.exit(0);
    }
}

verifyProfile();
