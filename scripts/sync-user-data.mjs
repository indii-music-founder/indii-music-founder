/**
 * Sync User Data
 *
 * Copies the rich profile data from the "Source" UID (cuyWtUv8...)
 * to the "Target" UID (5z8y0y0A...) so the browser session has a valid full profile.
 *
 * Source: cuyWtUv8QCcgv7AtwQU62cEleos2
 * Target: 5z8y0y0A8CheC4FIAeUp6LWzGbm2
 */

import admin from 'firebase-admin';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'indiios-studio',
});

const db = admin.firestore();

const SOURCE_UID = 'cuyWtUv8QCcgv7AtwQU62cEleos2';
const TARGET_UID = '5z8y0y0A8CheC4FIAeUp6LWzGbm2';

async function sync() {
    console.log(`🔄 Syncing data from ${SOURCE_UID} to ${TARGET_UID}...`);

    // 1. Get Source Data
    const sourceUser = await db.collection('users').doc(SOURCE_UID).get();
    if (!sourceUser.exists) {
        throw new Error('Source user not found!');
    }
    const sourceData = sourceUser.data();

    // 2. Prepare Target Data (Keep ID and Email specific to Target)
    const targetData = {
        ...sourceData,
        id: TARGET_UID,
        uid: TARGET_UID,
        // We can keep the email since they share it: marcus.deep@test.indiios.com
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 3. Write to Target
    await db.collection('users').doc(TARGET_UID).set(targetData);
    console.log('✅ User Profile cloned successfully.');

    // 4. Update the Organization for Target
    // We found 'org_5z8y0y0A...' previously. Let's make sure it looks like the source org too.
    const sourceOrgSnap = await db.collection('organizations').doc(`org_${SOURCE_UID}`).get();
    const targetOrgId = `org_${TARGET_UID}`;

    if (sourceOrgSnap.exists) {
        const sourceOrgData = sourceOrgSnap.data();
        await db.collection('organizations').doc(targetOrgId).set({
            ...sourceOrgData,
            id: targetOrgId,
            ownerId: TARGET_UID,
            members: [TARGET_UID],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('✅ Organization synced.');
    }

    // 5. Cleanup Duplicate Projects & Create One "Good" One
    const projects = await db.collection('projects').where('ownerId', '==', TARGET_UID).get();
    const batch = db.batch();
    projects.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    console.log('🧹 Cleaned up old projects for target user.');

    // Create fresh correct Black Kitty project
    const newProjectId = `proj_black_kitty_final`;
    await db.collection('projects').doc(newProjectId).set({
        id: newProjectId,
        name: 'Black Kitty',
        orgId: targetOrgId,
        ownerId: TARGET_UID,
        type: 'single',
        status: 'draft',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Add default fields that might be required
        releaseDate: null,
        artwork: null,
        tracks: []
    });
    console.log('✨ Created fresh "Black Kitty" project:', newProjectId);

    console.log('\n🚀 Sync Complete! The browser user now has a full, valid profile.');
}

sync().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
