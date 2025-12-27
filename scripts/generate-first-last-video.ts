/**
 * Generate a Veo 3.1 video from first frame + last frame
 * Usage: npx tsx scripts/generate-first-last-video.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '../.env') });

// Read images and convert to data URIs
const firstFramePath = path.join(__dirname, '../landing-page/public/nana-banana/first-frame.png');
const lastFramePath = path.join(__dirname, '../landing-page/public/nana-banana/last-frame.png');

const toDataUri = (filePath: string): string => {
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    return `data:${mimeType};base64,${base64}`;
};

const firstFrame = toDataUri(firstFramePath);
const lastFrame = toDataUri(lastFramePath);

console.log('✓ Loaded first frame:', firstFramePath);
console.log('✓ Loaded last frame:', lastFramePath);
console.log('  First frame size:', Math.round(firstFrame.length / 1024) + 'KB');
console.log('  Last frame size:', Math.round(lastFrame.length / 1024) + 'KB');

// Now call the Firebase function
console.log('\n🎬 Calling Veo 3.1 API via Firebase...\n');

import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.VITE_API_KEY,
    authDomain: "indiios-v-1-1.firebaseapp.com",
    projectId: "indiios-v-1-1",
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

const triggerVideoJob = httpsCallable(functions, 'triggerVideoJob');

try {
    const response = await triggerVideoJob({
        jobId: `first-last-video-${Date.now()}`, // Added jobId
        orgId: "nana-banana-test", // Added orgId
        prompt: "Smooth cinematic transition between frames, natural fluid motion, professional quality",
        model: "veo-3.1-fast-generate-preview",
        image: {
            mimeType: 'image/png',
            imageBytes: firstFrame.split(',')[1]
        },
        config: {
            lastFrame: {
                mimeType: 'image/png',
                imageBytes: lastFrame.split(',')[1]
            }
        },
        apiKey: process.env.VITE_API_KEY
    });

    console.log('✓ Video generation response:', JSON.stringify(response.data, null, 2));
} catch (error: any) {
    console.error('✗ Error:', error.message || error);
    if (error.details) {
        console.error('  Details:', error.details);
    }
}
