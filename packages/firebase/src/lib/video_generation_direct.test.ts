import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';

import { FUNCTION_INTELLIGENCE_MODELS } from '../config/models';
import { normalizeVeoDuration, resolveVeoModel } from './video';
import { decodeInlineVideoSeedImage, parseOwnedVideoSeedUri, generateVideoDirect } from './video_generation_direct';

vi.mock('firebase-admin', () => {
    const setMock = vi.fn().mockResolvedValue(undefined);
    const docMock = vi.fn(() => ({ set: setMock }));
    const collectionMock = vi.fn(() => ({ doc: docMock }));
    const runTransactionMock = vi.fn(async (cb) => cb({ get: vi.fn(), set: vi.fn() }));
    const firestoreMock = vi.fn(() => ({ collection: collectionMock, doc: docMock, runTransaction: runTransactionMock }));
    const firestoreObj = Object.assign(firestoreMock, {
        FieldValue: { serverTimestamp: vi.fn() },
    });
    const storageMock = vi.fn(() => ({
        bucket: vi.fn(() => ({
            name: 'indii-music-founder.firebasestorage.app',
            file: vi.fn(() => ({
                getMetadata: vi.fn().mockResolvedValue([{ generation: '100', size: 1024, contentType: 'image/png' }]),
                download: vi.fn().mockResolvedValue([Buffer.alloc(1024)]),
                getSignedUrl: vi.fn().mockResolvedValue(['https://mock-signed-url']),
            })),
        })),
    }));
    
    return {
        firestore: firestoreObj,
        storage: storageMock,
        default: {
            firestore: firestoreObj,
            storage: storageMock,
        },
    };
});

vi.mock('@google/genai', () => {
    const generateVideosMock = vi.fn().mockResolvedValue({ name: 'operations/mock-op', done: true });
    const getVideosOperationMock = vi.fn().mockResolvedValue({ name: 'operations/mock-op', done: true });
    
    class MockGoogleGenAI {
        models = { generateVideos: generateVideosMock };
        operations = { getVideosOperation: getVideosOperationMock };
    }
    
    return {
        GoogleGenAI: MockGoogleGenAI
    };
});

import { GoogleGenAI } from '@google/genai';

describe('legacy direct-video seed admission', () => {
    it('accepts bounded image bytes while retaining the declared supported MIME type', () => {
        const seed = decodeInlineVideoSeedImage('data:image/jpeg;base64,aGVsbG8=', undefined);

        expect(seed).toEqual({ imageBytes: 'aGVsbG8=', mimeType: 'image/jpeg' });
    });

    it('rejects HTTP URLs instead of making the callable fetch an arbitrary host', () => {
        expect(() => decodeInlineVideoSeedImage('https://169.254.169.254/latest/meta-data/', 'image/png'))
            .toThrow('inline bytes or an owner-scoped Cloud Storage URI');
    });

    it('requires an exact project bucket and owner-scoped Cloud Storage reference', () => {
        expect(parseOwnedVideoSeedUri(
            'artist-1',
            'gs://indii-music-founder.firebasestorage.app/creative/artist-1/reference.png',
            'indii-music-founder.firebasestorage.app',
        )).toBe('creative/artist-1/reference.png');
        expect(() => parseOwnedVideoSeedUri(
            'artist-1',
            'gs://attacker-bucket/creative/artist-1/reference.png',
            'indii-music-founder.firebasestorage.app',
        )).toThrow('configured project bucket');
        expect(() => parseOwnedVideoSeedUri(
            'artist-1',
            'gs://indii-music-founder.firebasestorage.app/creative/artist-2/reference.png',
            'indii-music-founder.firebasestorage.app',
        )).toThrow('authenticated owner');
    });
});

describe('server-owned Veo execution normalization', () => {
    it('maps every supported tier to the matching allowlisted Vertex model', () => {
        expect(resolveVeoModel('lite')).toEqual({
            tier: 'lite',
            modelId: FUNCTION_INTELLIGENCE_MODELS.VIDEO.LITE,
        });
        expect(resolveVeoModel('fast')).toEqual({
            tier: 'fast',
            modelId: FUNCTION_INTELLIGENCE_MODELS.VIDEO.FAST,
        });
        expect(resolveVeoModel('pro')).toEqual({
            tier: 'pro',
            modelId: FUNCTION_INTELLIGENCE_MODELS.VIDEO.PRO,
        });
        expect(() => resolveVeoModel('attacker-selected-model')).toThrow('Unsupported video model tier');
    });

    it('normalizes billing and provider duration to the same supported value', () => {
        expect(normalizeVeoDuration(4)).toBe(4);
        expect(normalizeVeoDuration(5)).toBe(6);
        expect(normalizeVeoDuration('6')).toBe(6);
        expect(normalizeVeoDuration(7)).toBe(8);
        expect(() => normalizeVeoDuration(9)).toThrow('no more than 8 seconds');
    });
});

describe('video_generation_direct: ISSUE-1135 frame-conditioned safety proof', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VERTEX_PROJECT_ID = 'test-project';
        process.env.VERTEX_LOCATION = 'us-central1';
        process.env.VITE_FIREBASE_STORAGE_BUCKET = 'indii-music-founder.firebasestorage.app';
    });

    it('proves that generateVideoDirect calls the provider with personGeneration: dont_allow for frame jobs', async () => {
        const aiInstance = new GoogleGenAI({ apiKey: 'test-key' });
        const generateVideosMock = aiInstance.models.generateVideos as any;
        generateVideosMock.mockResolvedValueOnce({
            name: 'operations/mock-op',
            done: true,
            response: { generatedVideos: [{ video: { uri: 'gs://result' } }] },
        });

        await generateVideoDirect({
            userId: 'artist-1',
            jobId: 'job-123',
            orgId: 'org-123',
            prompt: 'An empty gallery with moving shadows',
            options: {
                aspectRatio: '16:9',
                model: 'fast',
                durationSeconds: 6,
                personGeneration: 'dont_allow',
                resolution: '1080p',
                firstFrame: 'gs://indii-music-founder.firebasestorage.app/creative/artist-1/start.png',
            },
            costReservationId: 'op-123'
        });

        expect(generateVideosMock).toHaveBeenCalledTimes(1);
        const callArgs = generateVideosMock.mock.calls[0][0];

        // 1. Prove it's a frame-conditioned job with loaded inline bytes
        expect(callArgs.image).toBeDefined();
        expect(callArgs.image.mimeType).toBe('image/png');
        expect(typeof callArgs.image.imageBytes).toBe('string');

        // 2. Prove the 'dont_allow' safety setting is accurately preserved to Vertex AI
        expect(callArgs.config).toBeDefined();
        expect(callArgs.config.personGeneration).toBe('dont_allow');
        expect(callArgs.prompt).toBe('An empty gallery with moving shadows');
    });
});
