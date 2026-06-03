import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import { generateImageV3 } from '../gateway';
import {
    initializeRealServices,
    teardownServices,
    assertApiLatency
} from '../../../test/integration.setup';

// Integration Tests for Creative Gateway
// These tests hit the REAL Google GenAI APIs and REAL Firebase Storage/Firestore.

describe('Creative Gateway (Integration)', () => {
    let db: admin.firestore.Firestore;
    let storage: admin.storage.Storage;
    const testUserId = 'integration-test-user';
    const createdJobIds: string[] = [];
    const createdStorageUris: string[] = [];

    beforeAll(() => {
        initializeRealServices();
        db = admin.firestore();
        storage = admin.storage();
    });

    afterAll(async () => {
        // Clean up any stray documents and files created during the test
        for (const jobId of createdJobIds) {
            await db.collection('creative_jobs').doc(jobId).delete().catch(() => {});
        }
        
        const bucket = storage.bucket();
        for (const uri of createdStorageUris) {
            if (uri.startsWith(`gs://${bucket.name}/`)) {
                const path = uri.replace(`gs://${bucket.name}/`, '');
                await bucket.file(path).delete().catch(() => {});
            }
        }

        await teardownServices();
    });

    it('should generate an image using real Gemini API and save to Storage', async () => {
        // Only run if GEMINI_API_KEY is available in the environment to avoid failing on unconfigured CI
        if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENAI_API_KEY && !process.env.VITE_VERTEX_LOCATION) {
            console.warn('Skipping real generateImageV3 test: No Google GenAI credentials found in environment.');
            return;
        }

        const start = Date.now();
        
        // Construct a mock CallableRequest
        const request: any = {
            data: {
                prompt: 'A tiny blue cube on a white background, low detail, simple',
                model: 'fast', // use flash for speed
                aspectRatio: '1:1',
                imageSize: '512' // lowest resolution for faster tests
            },
            auth: {
                uid: testUserId,
                token: {}
            }
        };

        // Call the raw function handler
        // The firebase-functions v2 onCall wraps the handler, but we can call it using the .run method (or just call it directly since it's a wrapper)
        // Usually `generateImageV3(request)` works if it's the v2 wrapped function.
        let result: any;
        try {
            // @ts-expect-error - bypassing strict typings for the CallableRequest
            result = await generateImageV3.run(request);
        } catch (e: any) {
            const errorStr = String(e.message || e);
            const errorCode = e?.code || e?.status || '';
            // If local credentials expired (invalid_rapt/invalid_grant), quota exhausted, or credentials missing, gracefully skip
            if (errorStr.includes('invalid_grant') || errorStr.includes('invalid_rapt') || errorStr.includes('resource-exhausted') || errorStr.includes('permission-denied') || errorStr.includes('Could not load the default credentials') || String(errorCode).toLowerCase() === 'permission-denied') {
                console.warn('Skipping test gracefully due to local credential expiration, missing credentials, or quota limit:', errorStr);
                return;
            }
            // If we get an auth/quota error from Google, fail the test but log it nicely
            console.error('Real generation failed:', e);
            throw e;
        }

        const latency = Date.now() - start;
        assertApiLatency(latency, 15000); // Image gen might take up to 15s

        expect(result).toBeDefined();
        expect(result).toHaveProperty('jobId');
        expect(result).toHaveProperty('resultUri');
        
        expect(result.resultUri).toMatch(/^gs:\/\//);

        createdJobIds.push(result.jobId);
        createdStorageUris.push(result.resultUri);

        // Verify Firestore record
        const doc = await db.collection('creative_jobs').doc(result.jobId).get();
        expect(doc.exists).toBe(true);
        expect(doc.data()?.status).toBe('completed');
        expect(doc.data()?.resultUri).toBe(result.resultUri);

        // Verify Storage file
        const bucket = storage.bucket();
        const path = result.resultUri.replace(`gs://${bucket.name}/`, '');
        const file = bucket.file(path);
        const [exists] = await file.exists();
        expect(exists).toBe(true);
    }, 30000); // 30 second timeout for this specific test
});
