import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
        if (doc.data().status === 'completed' && doc.data().videoUrl) {
            jobData = doc.data();
            jobId = doc.id;
            break;
        }
    }

    if (!jobData) {
        console.log("No completed video jobs with a URL found in the last 5 jobs.");
        process.exit(0);
    }

    const rawUrl = jobData.videoUrl;
    console.log(`Found completed video: ${jobId}`);
    console.log(`Original URL: ${rawUrl}`);

    if (!rawUrl) {
        console.log("No videoUrl in doc.");
        process.exit(0);
    }

    // Is it a direct generativelanguage URL?
    if (rawUrl.includes('generativelanguage.googleapis.com')) {
        const apiKey = process.env.VITE_API_KEY;
        if (!apiKey) {
            console.error("NO VITE_API_KEY in .env");
            process.exit(1);
        }

        const fetchUrl = rawUrl.includes('key=') ? rawUrl : `${rawUrl}&key=${apiKey}`;
        console.log(`Fetching from Google APIs...`);
        
        const res = await fetch(fetchUrl);
        if (!res.ok) {
            console.error(`Fetch failed: ${res.status} ${res.statusText}`);
            console.error(await res.text());
            process.exit(1);
        }

        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        
        const destPath = path.join(process.env.HOME || process.env.USERPROFILE, 'Desktop', 'veo_3_1_latest_test.mp4');
        fs.writeFileSync(destPath, buffer);
        console.log(`\n✅ Video successfully downloaded to your Desktop: ${destPath}`);
        
    } else {
        console.log(`URL seems to be a normal public URL or Storage URL. Downloading...`);
        const res = await fetch(rawUrl);
        if (!res.ok) {
            console.error(`Fetch failed: ${res.status} ${res.statusText}`);
            process.exit(1);
        }

        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        
        const destPath = path.join(process.env.HOME || process.env.USERPROFILE, 'Desktop', 'veo_3_1_latest_test.mp4');
        fs.writeFileSync(destPath, buffer);
        console.log(`\n✅ Video successfully downloaded to your Desktop: ${destPath}`);
    }
    
    process.exit(0);
}

run().catch(console.error);
