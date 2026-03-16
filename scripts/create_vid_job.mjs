import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

try {
    const serviceAccount = JSON.parse(fs.readFileSync('/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/indiios-v-1-1-4e76d9bc5462.json', 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
} catch (e) {
    initializeApp();
}

async function run() {
    const db = getFirestore();
    const jobId = crypto.randomUUID();
    const docRef = db.collection('videoJobs').doc(jobId);
    
    await docRef.set({
        id: jobId,
        userId: "cli-tester-quick",
        orgId: "personal",
        prompt: "A beautiful cinematic flythrough of a futuristic neon city, photorealistic, 4k resolution, highly detailed",
        status: "queued",
        createdAt: new Date(),
        updatedAt: new Date(),
        options: {
            model: "veo-3.1-generate-preview",
            duration: 5,
            durationSeconds: 5,
            resolution: "720p",
            aspectRatio: "16:9"
        }
    });

    console.log(`Created video job: ${jobId}`);
    console.log(`Waiting for Cloud Function to process...`);

    const unsubscribe = docRef.onSnapshot((doc) => {
        const data = doc.data();
        if (!data) return;
        
        console.log(`[${new Date().toISOString()}] Status: ${data.status} | Progress: ${data.progress || 0}%`);
        
        if (data.status === 'completed') {
            console.log(`\n✅ VIDEO GENERATION SUCCESSFUL!`);
            console.log(`Firebase Storage Public URL: ${data.videoUrl}`);
            unsubscribe();
            process.exit(0);
        } else if (data.status === 'failed') {
            console.error(`\n❌ VIDEO GENERATION FAILED!`);
            console.error(`Error: ${data.error}`);
            unsubscribe();
            process.exit(1);
        }
    });

    // Timeout after 10 minutes
    setTimeout(() => {
        console.error("Timeout waiting for job.");
        unsubscribe();
        process.exit(1);
    }, 10 * 60 * 1000);
}

run().catch(console.error);
