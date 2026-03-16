import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

try {
    initializeApp();
} catch (e) {
    // already initialized
}

async function run() {
    const db = getFirestore();
    const jobsRef = db.collection('videoJobs');
    
    // Get latest completed job
    const snapshot = await jobsRef
        .orderBy('updatedAt', 'desc')
        .limit(5)
        .get();

    if (snapshot.empty) {
        console.log("No video jobs found.");
        process.exit(0);
    }

    let jobData;
    let jobId;
    for (const doc of snapshot.docs) {
        if (doc.data().status === 'completed' && doc.data().videoUrl?.includes('generativelanguage')) {
            jobData = doc.data();
            jobId = doc.id;
            break;
        }
    }

    if (!jobData) {
        console.log("No completed video jobs with a generation URL found.");
        process.exit(0);
    }

    const localVideoPath = path.join(process.env.HOME || process.env.USERPROFILE, 'Desktop', 'veo_3_1_latest_test.mp4');
    
    if (!fs.existsSync(localVideoPath)) {
        console.error(`Local video not found at ${localVideoPath}`);
        process.exit(1);
    }

    // Explicitly set the default Storage bucket
    const bucket = getStorage().bucket(process.env.VITE_FIREBASE_STORAGE_BUCKET || 'indiios-alpha-electron');
    const userId = jobData.userId || 'system';
    const storagePath = `videos/${userId}/${jobId}.mp4`;
    const file = bucket.file(storagePath);
    
    await file.save(fs.readFileSync(localVideoPath), {
        metadata: { contentType: 'video/mp4' },
        public: true
    });
    
    const publicUrl = file.publicUrl();
    console.log(`Video uploaded to: ${publicUrl}`);
    
    console.log(`Updating Firestore document...`);
    await jobsRef.doc(jobId).update({
        videoUrl: publicUrl,
        'output.url': publicUrl
    });
    
    // Remove the file from desktop
    try {
        fs.unlinkSync(localVideoPath);
        console.log(`Removed video from Desktop.`);
    } catch (e) {
        console.error(`Failed to remove desktop video:`, e);
    }

    console.log(`\n✅ Done! The video is now attached to your job in Firestore and will appear in indiiOS immediately.`);
    process.exit(0);
}

run().catch(console.error);
