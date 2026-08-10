import firebaseFunctionsTest from 'firebase-functions-test';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.ENFORCE_APP_CHECK = 'false';

initializeApp({ projectId: 'indii-music-founder' });

// Mock Arcjet before importing gateway
const arcjetMock = {
    protectAuthenticatedApiRequest: async () => ({
        status: 'ALLOW',
        reason: 'mocked',
        ip: '127.0.0.1',
        isDenied: () => false
    })
};
import * as arcjetModule from '../packages/firebase/src/functions/security/arcjet.ts';
Object.assign(arcjetModule, arcjetMock);

import { generateImageV3 } from '../packages/firebase/src/functions/creative/gateway.ts';

const testEnv = firebaseFunctionsTest({
  projectId: 'indii-music-founder',
});

async function run() {
  try {
    console.log('Ensuring test user exists in auth emulator...');
    try {
        await getAuth().getUser('user-123');
    } catch (e) {
        await getAuth().createUser({ uid: 'user-123', email: 'test@indii.music', emailVerified: true });
    }
    
    // We also need to mock entitlement doc
    try {
        await getFirestore().collection('userPrivate').doc('user-123').set({
            subscriptionTier: 'pro',
            featureFlags: {}
        }, { merge: true });
    } catch(e) {}
    
    const wrapped = testEnv.wrap(generateImageV3);
    const data = {
      prompt: "A beautiful sunset over Detroit",
      aspectRatio: "16:9",
      modelTier: "FAST",
    };
    console.log('Invoking generateImageV3...');
    const result = await wrapped({
      data,
      auth: {
        uid: 'user-123',
        token: {
          email_verified: true,
          uid: 'user-123'
        }
      },
      app: {
        appId: '123'
      }
    });
    console.log('✅ Success:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

run();
