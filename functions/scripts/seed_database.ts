
import * as admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin
// Note: Requires GOOGLE_APPLICATION_CREDENTIALS or gcloud auth application-default login
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'indiios-v-1-1',
        storageBucket: 'indiios-alpha-electron.firebasestorage.app'
    });
}

const db = getFirestore();
const storage = getStorage();
const auth = getAuth();

// Minimal 1x1 Red Pixel PNG
const IMAGE_BUFFER = Buffer.from('89504e470d0a1a0a0000000d494844520000000100000001010300000025db56ca00000003504c5445ff000019e209370000000174524e530040e6d8660000000a4944415408d76360000000020001e221bc330000000049454e44ae426082', 'hex');

async function seed() {
    console.log('🌱 Starting seed...');

    try {
        // 1. Create Users
        const users = ['demo-user', 'admin-user'];
        for (const uid of users) {
            try {
                await auth.createUser({
                    uid,
                    email: `${uid}@example.com`,
                    password: 'password123', // Dummy password
                    displayName: uid.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
                });
                console.log(`✅ Created user: ${uid}`);
            } catch (e: any) {
                if (e.code === 'auth/uid-already-exists') {
                    console.log(`ℹ️ User ${uid} already exists.`);
                } else {
                    console.error(`❌ Failed to create user ${uid}:`, e);
                }
            }
        }

        // 2. Upload Images & Create Firestore Docs
        const bucket = storage.bucket();
        const images = ['sample-1.png', 'sample-2.png'];

        for (const imgName of images) {
            const file = bucket.file(`seed/${imgName}`);
            await file.save(IMAGE_BUFFER, {
                metadata: { contentType: 'image/png' }
            });
            await file.makePublic();
            const publicUrl = file.publicUrl();
            console.log(`✅ Uploaded image: ${imgName} -> ${publicUrl}`);

            // Firestore Metadata
            await db.collection('images').doc(imgName.replace('.png', '')).set({
                url: publicUrl,
                originalName: imgName,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                ownerId: 'demo-user',
                status: 'ready'
            });
            console.log(`✅ Created Firestore doc for: ${imgName}`);
        }

        // 3. Create Workflows
        const workflows = [
            {
                id: 'workflow-basic',
                name: 'Basic Image Enhancement',
                ownerId: 'demo-user',
                nodes: [
                    { id: '1', type: 'input', data: { label: 'Input Image' } },
                    { id: '2', type: 'filter', data: { filter: 'grayscale' } },
                    { id: '3', type: 'output', data: { label: 'Output' } }
                ],
                edges: [
                    { id: 'e1-2', source: '1', target: '2' },
                    { id: 'e2-3', source: '2', target: '3' }
                ]
            }
        ];

        for (const wf of workflows) {
            await db.collection('workflows').doc(wf.id).set(wf);
            console.log(`✅ Created workflow: ${wf.id}`);
        }

        console.log('🎉 Seeding complete!');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

seed();
