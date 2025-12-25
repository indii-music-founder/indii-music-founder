
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, doc, getDoc } from 'firebase/firestore';

// Hardcoded config to match the integration script
const firebaseConfig = {
    apiKey: "AIzaSyD9SmSp-2TIxw5EV9dfQSOdx4yRNNxU0RM",
    authDomain: "indiios-v-1-1.web.app",
    databaseURL: "https://indiios-v-1-1-default-rtdb.firebaseio.com",
    projectId: "indiios-v-1-1",
    storageBucket: "indiios-v-1-1.firebasestorage.app",
    messagingSenderId: "223837784072",
    appId: "1:223837784072:web:28eabcf0c5dd985395e9bd",
    measurementId: "G-KNWPRGE5JK"
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
