#!/usr/bin/env node
/**
 * Activate Founder Pass
 *
 * This script manually activates a Founder Pass for a specific user.
 * It updates their user profile in Firestore to grant the 'founder' tier,
 * generates a Verification Hash, and binds it to their account.
 *
 * Usage: node scripts/activate-founder.mjs <user-email-or-uid>
 */

import admin from 'firebase-admin';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'indiios-studio';

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: projectId,
});

const db = admin.firestore();
const auth = admin.auth();

const targetId = process.argv[2];

if (!targetId) {
    console.error('❌ Error: Please provide an email or UID.');
    console.log('   Usage: node scripts/activate-founder.mjs <user-email-or-uid>');
    process.exit(1);
}

async function activateFounder() {
    console.log(`🚀 Activating Founder Pass for: ${targetId}`);

    let userRecord;
    try {
        if (targetId.includes('@')) {
            userRecord = await auth.getUserByEmail(targetId);
        } else {
            userRecord = await auth.getUser(targetId);
        }
    } catch (error) {
        console.error('❌ Could not find user in Firebase Auth:', error.message);
        process.exit(1);
    }

    const uid = userRecord.uid;
    console.log(`   ✅ Found user: ${userRecord.email} (UID: ${uid})`);

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        console.error('❌ User profile document not found in Firestore!');
        process.exit(1);
    }

    const userData = userDoc.data();
    
    if (userData.tier === 'founder' || userData.subscriptionTier === 'founder' || userData.isFounder) {
        console.log('   ℹ️  User is already a Founder.');
    }

    const rawString = `${uid}:${userRecord.email}:FOUNDER:${new Date().toISOString()}`;
    const verificationHash = crypto.createHash('sha256').update(rawString).digest('hex');

    await userRef.update({
        tier: 'founder',
        subscriptionTier: 'founder',
        isFounder: true,
        verificationHash: verificationHash,
        founderActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('   ✅ User profile updated with Founder access.');
    console.log(`   🔐 Verification Hash: ${verificationHash}`);
    console.log('\n✨ Founder Pass activated successfully!');
}

activateFounder()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Activation failed:', error);
        process.exit(1);
    });
