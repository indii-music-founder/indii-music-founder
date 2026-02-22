#!/usr/bin/env node
/**
 * Seed Test User for E2E Testing
 *
 * This script creates the necessary Firestore documents for the test user
 * to pass security rules validation.
 *
 * Usage: node scripts/seed-test-user.mjs
 */

import admin from 'firebase-admin';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

// Initialize Firebase Admin using Application Default Credentials
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'indiios-studio';

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: projectId,
});

console.log(`🔥 Using Firebase project: ${projectId}`);

const db = admin.firestore();
const auth = admin.auth();

const TEST_USER_EMAIL = 'marcus.deep@test.indiios.com';
const TEST_USER_PASSWORD = 'Test1234!';

async function seedTestUser() {
    console.log('🌱 Seeding test user:', TEST_USER_EMAIL);

    // Step 1: Get or create the user in Firebase Auth
    let uid;
    try {
        const existingUser = await auth.getUserByEmail(TEST_USER_EMAIL);
        uid = existingUser.uid;
        console.log('   ✅ User already exists in Auth:', uid);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            const newUser = await auth.createUser({
                email: TEST_USER_EMAIL,
                password: TEST_USER_PASSWORD,
                displayName: 'Marcus Deep (Rex Chrome)',
                emailVerified: true,
            });
            uid = newUser.uid;
            console.log('   ✅ Created new user in Auth:', uid);
        } else {
            throw error;
        }
    }

    // Step 2: Create the user profile document
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        await userRef.set({
            id: uid,
            email: TEST_USER_EMAIL,
            displayName: 'Marcus Deep',
            role: 'artist',
            onboarded: true,
            brandKit: {
                colors: ['#000000', '#222222', '#ff0000'],
                fonts: 'Inter',
                brandDescription: 'Rex Chrome — a Detroit electronic duo. Marcus Deep handles the analog synths, Max Crownwood brings the dark industrial hip-hop. Deep Detroit Tech. Aesthetic is noir, concrete, and industrial.',
                referenceImages: [],
                brandAssets: [],
                releaseDetails: {
                    title: 'Black Kitty',
                    type: 'Single',
                    artists: 'Rex Chrome',
                    genre: 'Deep Detroit Tech',
                    mood: 'Industrial, Dark',
                    themes: 'Detroit, Concrete, Noir',
                }
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('   ✅ Created user profile document');
    } else {
        console.log('   ℹ️  User profile already exists');
    }

    // Step 3: Create the personal organization
    const orgId = `org_${uid}`;
    const orgRef = db.collection('organizations').doc(orgId);
    const orgDoc = await orgRef.get();

    if (!orgDoc.exists) {
        await orgRef.set({
            id: orgId,
            name: 'Rex Chrome Studio',
            members: [uid],
            ownerId: uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('   ✅ Created organization:', orgId);
    } else {
        // Ensure user is in members array
        const orgData = orgDoc.data();
        if (orgData && !orgData.members?.includes(uid)) {
            await orgRef.update({
                members: admin.firestore.FieldValue.arrayUnion(uid),
            });
            console.log('   ✅ Added user to existing organization members');
        } else {
            console.log('   ℹ️  Organization already exists with user as member');
        }
    }

    // Step 4: Create a test project
    const projectDocId = `proj_black_kitty_${uid.substring(0, 8)}`;
    const projectRef = db.collection('projects').doc(projectDocId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
        await projectRef.set({
            id: projectDocId,
            name: 'Black Kitty',
            orgId: orgId,
            ownerId: uid,
            type: 'single',
            status: 'draft',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('   ✅ Created project: Black Kitty');
    } else {
        console.log('   ℹ️  Project "Black Kitty" already exists');
    }

    console.log('\n✨ Seeding complete!');
    console.log('   Email:', TEST_USER_EMAIL);
    console.log('   Password:', TEST_USER_PASSWORD);
    console.log('   User ID:', uid);
    console.log('   Org ID:', orgId);
    console.log('   Project ID:', projectDocId);
}

seedTestUser()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    });
