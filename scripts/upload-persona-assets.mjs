#!/usr/bin/env node
/**
 * upload-persona-assets.mjs
 *
 * Uploads the Rex Chrome persona images from cypress/fixtures/persona/
 * to Firebase Storage (brandKit/{uid}/) and patches the user's Firestore
 * document so brandKit.referenceImages contains proper https:// download URLs.
 *
 * Usage:
 *   node scripts/upload-persona-assets.mjs
 *
 * Prerequisites:
 *   - gcloud auth application-default login  OR  GOOGLE_APPLICATION_CREDENTIALS set
 *   - .env file with VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_STORAGE_BUCKET
 */

import admin from 'firebase-admin';
import { config } from 'dotenv';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'indiios-v-1-1';
const storageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
    storageBucket,
});

console.log(`🔥 Project : ${projectId}`);
console.log(`🪣 Bucket  : ${storageBucket}`);

const db = admin.firestore();
const bucket = admin.storage().bucket();
const auth = admin.auth();

const TEST_USER_EMAIL = 'the.walking.agency.det@gmail.com';

// ─────────────────────────────────────────────
// Persona images to upload
// ─────────────────────────────────────────────
const PERSONA_DIR = resolve(__dirname, '../cypress/fixtures/persona');

const PERSONA_IMAGES = [
    // ── Marcus Deep (analog synths / producer) ──────────────────────────────
    {
        file: '1_establishing_transit.png',
        subject: 'Marcus Deep',
        category: 'lifestyle',
        description: 'Marcus Deep on transit with his gear — establishing the vibe',
        tags: ['marcus-deep', 'transit', 'lifestyle', 'noir'],
    },
    {
        file: '2_raw_portrait.png',
        subject: 'Marcus Deep',
        category: 'portrait',
        description: 'Marcus Deep — raw Detroit street portrait',
        tags: ['marcus-deep', 'portrait', 'street', 'noir'],
    },
    {
        file: '3_studio_session.png',
        subject: 'Marcus Deep',
        category: 'studio',
        description: 'Marcus Deep working on analog synths in the studio',
        tags: ['marcus-deep', 'studio', 'synth', 'analog'],
    },
    {
        file: '4_live_gig.png',
        subject: 'Marcus Deep',
        category: 'live',
        description: 'Marcus Deep live at the hardware — intimate underground gig',
        tags: ['marcus-deep', 'live', 'gig', 'underground'],
    },
    {
        file: '5_clean_selfie.png',
        subject: 'Marcus Deep',
        category: 'portrait',
        description: 'Marcus Deep — clean daylight selfie',
        tags: ['marcus-deep', 'portrait', 'selfie', 'daylight'],
    },

    // ── Max Crownwood (dark industrial hip-hop) ──────────────────────────────
    {
        file: 'max_1_establishing_transit.png',
        subject: 'Max Crownwood',
        category: 'lifestyle',
        description: 'Max Crownwood on transit with his equipment case — noir Detroit atmosphere',
        tags: ['max-crownwood', 'transit', 'lifestyle', 'noir'],
    },
    {
        file: 'max_2_raw_portrait.png',
        subject: 'Max Crownwood',
        category: 'portrait',
        description: 'Max Crownwood — raw industrial street portrait against Detroit brick',
        tags: ['max-crownwood', 'portrait', 'street', 'noir'],
    },
    {
        file: 'max_3_studio_session.png',
        subject: 'Max Crownwood',
        category: 'studio',
        description: 'Max Crownwood deep in session on his MPC and 808 — Detroit home studio',
        tags: ['max-crownwood', 'studio', 'mpc', '808', 'hip-hop'],
    },
    {
        file: 'max_4_live_gig.png',
        subject: 'Max Crownwood',
        category: 'live',
        description: 'Max Crownwood performing live at an intimate underground Detroit venue',
        tags: ['max-crownwood', 'live', 'gig', 'underground'],
    },
    {
        file: 'max_5_clean_selfie.png',
        subject: 'Max Crownwood',
        category: 'portrait',
        description: 'Max Crownwood — street selfie in Detroit',
        tags: ['max-crownwood', 'portrait', 'selfie', 'detroit'],
    },
];

async function getSignedUrl(storagePath) {
    const file = bucket.file(storagePath);
    // Generate a signed URL valid for 10 years (close to permanent)
    const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-01-2035',
    });
    return url;
}

async function uploadPersonaAssets() {
    console.log('\n🔍 Looking up test user…');

    let uid;
    try {
        const userRecord = await auth.getUserByEmail(TEST_USER_EMAIL);
        uid = userRecord.uid;
        console.log(`   ✅ Found user: ${uid}`);
    } catch {
        console.error(`   ❌ User not found: ${TEST_USER_EMAIL}`);
        console.error('   → Run: node scripts/seed-test-user.mjs first');
        process.exit(1);
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
        console.error('   ❌ Firestore user document does not exist. Seed the user first.');
        process.exit(1);
    }

    const existingData = userSnap.data();
    const existingImages = existingData?.brandKit?.referenceImages || [];
    console.log(`   ℹ️  Existing reference images: ${existingImages.length}`);

    const uploadedAssets = [];

    for (const img of PERSONA_IMAGES) {
        const localPath = resolve(PERSONA_DIR, img.file);

        if (!existsSync(localPath)) {
            console.warn(`   ⚠️  Skipping — file not found: ${localPath}`);
            continue;
        }

        // Check if already uploaded by matching description exactly
        const alreadyExists = existingImages.some(
            (existing) => existing.description === img.description
        );

        if (alreadyExists) {
            console.log(`   ⏭️  Already uploaded: ${img.file}`);
            continue;
        }

        const storagePath = `brandKit/${uid}/${basename(img.file)}`;
        console.log(`\n   📤 Uploading: ${img.file}`);
        console.log(`      → Storage path: ${storagePath}`);

        const fileBuffer = readFileSync(localPath);

        await bucket.file(storagePath).save(fileBuffer, {
            metadata: {
                contentType: 'image/png',
                metadata: {
                    subject: img.subject,
                    category: img.category,
                    uploadedBy: 'upload-persona-assets.mjs',
                },
            },
        });

        // Make the file publicly readable
        await bucket.file(storagePath).makePublic();

        // Get the public URL (no expiry needed since file is public)
        const publicUrl = `https://storage.googleapis.com/${storageBucket}/${storagePath}`;

        console.log(`      ✅ Uploaded. Public URL: ${publicUrl}`);

        uploadedAssets.push({
            id: randomUUID(),
            url: publicUrl,
            subject: img.subject,
            category: img.category,
            description: img.description,
            tags: img.tags,
            createdAt: new Date().toISOString(),
        });
    }

    if (uploadedAssets.length === 0) {
        console.log('\n✅ All persona assets already present — nothing to upload.');
        await printSummary(existingImages);
        process.exit(0);
    }

    console.log(`\n   📝 Patching Firestore with ${uploadedAssets.length} new asset(s)…`);

    await userRef.update({
        'brandKit.referenceImages': admin.firestore.FieldValue.arrayUnion(...uploadedAssets),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('   ✅ Firestore updated successfully.');

    // Final verification
    const updatedSnap = await userRef.get();
    const updatedImages = updatedSnap.data()?.brandKit?.referenceImages || [];
    await printSummary(updatedImages);
}

async function printSummary(images) {
    console.log('\n─────────────────────────────────────────');
    console.log(`📊 Total reference images in Firestore: ${images.length}`);
    if (images.length > 0) {
        console.log('\nImages:');
        images.forEach((img, i) => {
            console.log(`  [${i + 1}] ${img.subject || 'Unknown'} — ${img.category || 'N/A'}`);
            console.log(`       ${img.url}`);
        });
    }
    console.log('─────────────────────────────────────────\n');
}

uploadPersonaAssets()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n💥 Fatal error:', err);
        process.exit(1);
    });
