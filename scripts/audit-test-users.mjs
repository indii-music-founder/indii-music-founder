/**
 * Audit Firestore State for Test Users
 *
 * Checks the existence and content of user/org/project docs for the
 * specific UIDs we've been debugging.
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

const UIDS = [
    'cuyWtUv8QCcgv7AtwQU62cEleos2', // The UID seen in auth table
    '5z8y0y0A8CheC4FIAeUp6LWzGbm2'  // The UID seen in browser session
];

async function audit() {
    console.log('🔍 Auditing Firestore State...\n');

    for (const uid of UIDS) {
        console.log(`--- Checking UID: ${uid} ---`);

        // 1. Check User Doc
        const userSnap = await db.collection('users').doc(uid).get();
        if (!userSnap.exists) {
            console.log('❌ User Doc: MISSING');
        } else {
            console.log('✅ User Doc: FOUND');
            console.log('   Data:', JSON.stringify(userSnap.data(), null, 2));
        }

        // 2. Check Organizations owned by this user
        const orgsSnap = await db.collection('organizations')
            .where('members', 'array-contains', uid)
            .get();

        if (orgsSnap.empty) {
            console.log('❌ Orgs: NONE FOUND where user is member');
        } else {
            console.log(`✅ Orgs: Found ${orgsSnap.size}`);
            orgsSnap.forEach(doc => {
                console.log(`   - Org ID: ${doc.id}`);
                console.log(`     Data:`, JSON.stringify(doc.data(), null, 2));
            });
        }

        // 3. Check Projects owned by this user
        const projectsSnap = await db.collection('projects')
            .where('ownerId', '==', uid)
            .get();

        if (projectsSnap.empty) {
            console.log('❌ Projects: NONE FOUND owned by user');
        } else {
            console.log(`✅ Projects: Found ${projectsSnap.size}`);
            projectsSnap.forEach(doc => {
                console.log(`   - Project ID: ${doc.id}`);
                console.log(`     Data:`, JSON.stringify(doc.data(), null, 2));
            });
        }
        console.log('\n');
    }
}

audit().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
