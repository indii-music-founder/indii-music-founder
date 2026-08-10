import { describe, expect, it, vi, beforeAll } from 'vitest';
import { generateImageV3 } from '../functions/creative/gateway.js';
import firebaseFunctionsTest from 'firebase-functions-test';
import * as admin from 'firebase-admin';
import { initializeApp, getApps } from 'firebase-admin/app';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

// Initialize Firebase Admin for tests
if (!getApps().length) {
    initializeApp({
        projectId: 'indii-music-founder',
        storageBucket: 'indii-music-founder.appspot.com',
    });
}

beforeAll(() => {
    vi.spyOn(admin, 'storage').mockReturnValue({
        bucket: () => ({
            file: () => ({
                save: vi.fn().mockResolvedValue(undefined),
                makePublic: vi.fn().mockResolvedValue(undefined),
                publicUrl: () => 'https://storage.googleapis.com/mock-bucket/mock-path.png'
            }),
            name: 'indii-music-founder.appspot.com'
        })
    } as any);
});

const testEnv = firebaseFunctionsTest({ projectId: 'indii-music-founder' });

vi.mock('../middleware/appCheck.js', () => ({
    validateAppCheckV2: vi.fn(),
    requireVerifiedEmailV2: vi.fn().mockReturnValue('user-123')
}));

vi.mock('firebase-admin/storage', () => ({
    getStorage: vi.fn().mockReturnValue({
        bucket: vi.fn().mockReturnValue({
            file: vi.fn().mockReturnValue({
                save: vi.fn().mockResolvedValue(undefined),
                makePublic: vi.fn().mockResolvedValue(undefined),
                publicUrl: () => 'https://storage.googleapis.com/mock-bucket/mock-path.png'
            })
        })
    })
}));

vi.mock('../functions/auth/entitlements.js', () => ({
    requireVerifiedServerEntitlement: vi.fn().mockResolvedValue({
        subscriptionTier: 'pro',
        featureFlags: {}
    }),
    checkRateLimit: vi.fn().mockResolvedValue(true)
}));

vi.mock('../functions/security/arcjet.js', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        protectAuthenticatedApiRequest: vi.fn().mockResolvedValue({
            status: 'ALLOW',
            reason: 'mocked',
            ip: '127.0.0.1',
            isDenied: () => false,
            allowed: true
        })
    };
});

vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: class MockGoogleGenAI {
            models: any;
            constructor() {
                this.models = {
                    generateContent: vi.fn().mockResolvedValue({
                        candidates: [{
                            content: {
                                parts: [{
                                    inlineData: {
                                        mimeType: 'image/png',
                                        data: 'mock-base64-data'
                                    }
                                }]
                            }
                        }]
                    })
                };
            }
        }
    };
});

describe('Image Generation', () => {
    it('generates an image', async () => {
        // Seed cost reservation in Firestore emulator
        await admin.firestore().collection('costLedger').doc('mock-reservation').set({
            userId: 'user-123',
            status: 'APPROVED',
            type: 'image',
            amount: 10,
            estimatedCost: 10
        });

        const wrapped = testEnv.wrap(generateImageV3);
        const data = {
            prompt: "A beautiful sunset over Detroit",
            aspectRatio: "16:9",
            model: "pro",
            costReservationId: "mock-reservation"
        };
        
        const context = {
            auth: {
                uid: 'user-123',
                token: {
                  email_verified: true,
                  uid: 'user-123',
                  aud: 'indii-music-founder',
                  auth_time: 1234567890,
                  exp: 1234567890,
                  firebase: { identities: {}, sign_in_provider: 'password' },
                  iat: 1234567890,
                  iss: 'https://securetoken.google.com/indii-music-founder',
                  sub: 'indii-music-founder'
                },
                rawToken: 'mock-raw-token'
            },
            app: {
              appId: '123',
              token: 'mock-app-token',
              alreadyConsumed: false
            }
        };

        const result = await wrapped({ 
            data, 
            auth: context.auth as any, 
            app: context.app as any,
            rawRequest: {} as any,
            acceptsStreaming: false
        });
        console.log('✅ Success:', JSON.stringify(result, null, 2));
        expect(result).toBeDefined();
    }, 30000);
});
