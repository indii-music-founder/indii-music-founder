#!/usr/bin/env node
/**
 * update-agency-profile.mjs
 *
 * Updates the bio and display name for the agency account to reflect
 * its role in managing multiple artists (Marcus Deep, Max Crownwood, Rex Chrome).
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
const AGENCY_UID = 'cuyWtUv8QCcgv7AtwQU62cEleos2';

async function updateProfile() {
    console.log(`🔥 Updating Agency Profile for UID: ${AGENCY_UID}`);

    const userRef = db.collection('users').doc(AGENCY_UID);

    const agencyBio = `The Walking Agency — Detroit-based creative collective and management label. 

Currently managing tactical artist development and digital identity for:
- Marcus Deep (Analog Producer / Synth Specialist)
- Max Crownwood (Industrial Hip-Hop / Dark Electronic)
- Rex Chrome (The Duo: Deep Detroit Tech)

Our mission is the synthesis of hardware grit and digital scale.`;

    await userRef.update({
        displayName: 'The Walking Agency',
        bio: agencyBio,
        'brandKit.brandDescription': 'The Walking Agency — Creative management for Marcus Deep, Max Crownwood, and Rex Chrome.',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Agency profile updated successfully.');
}

updateProfile()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('💥 Error updating profile:', err);
        process.exit(1);
    });
