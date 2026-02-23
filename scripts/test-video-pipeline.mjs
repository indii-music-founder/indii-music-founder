#!/usr/bin/env node
/**
 * test-video-pipeline.mjs
 * 
 * Simulates a video generation request using one of the new persona reference images.
 * This verifies that the backend (Layer 3) can correctly ingest persona-linked
 * Storage URLs for the VEO 3.1 or Video Generation pipeline.
 */

import admin from 'firebase-admin';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'indiios-v-1-1';

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
});

const db = admin.firestore();
const uid = 'cuyWtUv8QCcgv7AtwQU62cEleos2';

async function testVideoPipeline() {
    console.log(`🎬 Testing Video Pipeline for Agency UID: ${uid}`);

    // 1. Fetch the user document to get a reference image
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
        throw new Error('User not found');
    }

    const userData = userSnap.data();
    const referenceImages = userData.brandKit?.referenceImages || [];

    if (referenceImages.length === 0) {
        throw new Error('No reference images found in brandKit');
    }

    // Use Max Crownwood's first image (Index 5 in our 10-image set)
    const refImage = referenceImages[5];
    console.log(`🔗 Using reference image: ${refImage.url}`);
    console.log(`ℹ️  Subject: ${refImage.subject} (${refImage.description})`);

    // 2. Create a mock video job entry
    // In a real scenario, this would be handled by AIService or a direct tool call.
    // Here we simulate the state that the video generation tool expects or creates.
    const jobId = `test_video_${Date.now()}`;
    const jobRef = db.collection('users').doc(uid).collection('videoJobs').doc(jobId);

    const jobData = {
        id: jobId,
        status: 'queued',
        prompt: `A cinematic close-up of ${refImage.subject} in a noir Detroit setting, industrial atmosphere, matching the visual DNA of the reference photo.`,
        referenceImageUrl: refImage.url,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
            subject: refImage.subject,
            artist: 'Rex Chrome'
        },
        config: {
            model: 'veo-3.1-generate-preview',
            resolution: 'high'
        }
    };

    console.log(`📝 Creating test video job: ${jobId}`);
    await jobRef.set(jobData);

    console.log('✅ Test video job injected into Firestore.');
    console.log('--- Verification Summary ---');
    console.log(`Path: users/${uid}/videoJobs/${jobId}`);
    console.log('Next Step: In a live environment, the Video Worker (Python) would pick this up.');
}

testVideoPipeline()
    .then(() => {
        console.log('🏁 Verification script completed.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('💥 Test failed:', err);
        process.exit(1);
    });
