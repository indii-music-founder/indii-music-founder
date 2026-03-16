/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// 1. Hoisted mocks for dependencies
const mocks = vi.hoisted(() => ({
  serverTimestamp: vi.fn(),
    httpsCallable: vi.fn(),
    onSnapshot: vi.fn(),
    doc: vi.fn(),
    auth: { currentUser: { uid: 'test-user' } as { uid: string } | null },
    subscriptionService: {
        canPerformAction: vi.fn(),
        getCurrentSubscription: vi.fn()
    },
    useStore: {
        getState: vi.fn(() => ({
  serverTimestamp: vi.fn(), currentOrganizationId: 'org-123' }))
    },
    firebaseAI: {
        analyzeImage: vi.fn(),
        generateVideo: vi.fn().mockResolvedValue('https://storage.googleapis.com/mock/video.mp4')
    },
    uuid: vi.fn(() => 'mock-uuid')
}));

// 2. Mock modules
vi.mock('firebase/functions', () => ({
  serverTimestamp: vi.fn(),
    httpsCallable: mocks.httpsCallable,
    getFunctions: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(),
    doc: mocks.doc,
    onSnapshot: mocks.onSnapshot,
    getFirestore: vi.fn(),
    setDoc: vi.fn(() => Promise.resolve()),
    updateDoc: vi.fn(() => Promise.resolve()),
    collection: vi.fn(() => ({ id: 'mock-coll' })),
}));

vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    auth: mocks.auth,
    db: {},
    functions: {},
    functionsWest1: {},
    remoteConfig: { defaultConfig: {} },
    storage: {},
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Handle dynamic import used in VideoGenerationService
vi.mock('../firebase', () => ({
  serverTimestamp: vi.fn(),
    functions: {},
    functionsWest1: {},
    db: {},
    auth: mocks.auth
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
  serverTimestamp: vi.fn(),
    subscriptionService: mocks.subscriptionService
}));

vi.mock('@/core/store', () => ({
  serverTimestamp: vi.fn(),
    useStore: mocks.useStore
}));

vi.mock('../ai/FirebaseAIService', () => ({
  serverTimestamp: vi.fn(),
    firebaseAI: mocks.firebaseAI
}));

vi.mock('uuid', () => ({
  serverTimestamp: vi.fn(),
    v4: mocks.uuid
}));

// Import service AFTER mocks
import { VideoGenerationService } from './VideoGenerationService';
import { VideoGenerationOptionsSchema } from '@/modules/video/schemas';

describe('VideoGenerationService - Forge Hardening (Schema & Input)', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new VideoGenerationService();

        // Default happy path for quota & auth
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
        mocks.auth.currentUser = { uid: 'test-user' };

        // Default happy path for function trigger
        mocks.httpsCallable.mockReturnValue(async () => ({
  serverTimestamp: vi.fn(), data: { jobId: 'job-123' } }));
    });

    describe('Input Validation (Schema)', () => {
        it('should accept valid inputs', async () => {
            const validOptions = {
                prompt: 'A beautiful sunset',
                aspectRatio: '16:9' as const,
                resolution: '1080p' as const,
                fps: 24,
                duration: 5
            };

            await expect(service.generateVideo(validOptions)).resolves.toBeDefined();
        });

        it('should reject empty prompt', async () => {
            const invalidOptions = {
                prompt: '',
                aspectRatio: '16:9'
            };

            // @ts-expect-error - bypassing TS to test runtime validation
            await expect(service.generateVideo(invalidOptions)).rejects.toThrow(/Invalid video parameters/);
            // @ts-expect-error - Testing schema validation
            await expect(service.generateVideo(invalidOptions)).rejects.toThrow(/Prompt is required/);
        });

        it('should reject invalid aspect ratio', async () => {
            const invalidOptions = {
                prompt: 'Valid prompt',
                aspectRatio: '16:10' // Not in schema
            };

            // @ts-expect-error - Testing schema validation
            await expect(service.generateVideo(invalidOptions)).rejects.toThrow(/Invalid video parameters/);
        });

        it('should reject invalid resolution', async () => {
            const invalidOptions = {
                prompt: 'Valid prompt',
                resolution: '8k' // Truly not in schema
            };

            // @ts-expect-error - Testing schema validation
            await expect(service.generateVideo(invalidOptions)).rejects.toThrow(/Invalid video parameters/);
        });

        it('should reject negative duration', async () => {
            const invalidOptions = {
                prompt: 'Valid prompt',
                duration: -5
            };


            await expect(service.generateVideo(invalidOptions)).rejects.toThrow(/Invalid video parameters/);
        });

        it('should reject duration > 300', async () => {
            const invalidOptions = {
                prompt: 'Valid prompt',
                duration: 301
            };


            await expect(service.generateVideo(invalidOptions)).rejects.toThrow(/Invalid video parameters/);
        });

        it('should reject invalid FPS', async () => {
            const invalidOptions = {
                prompt: 'Valid prompt',
                fps: 120
            };


            await expect(service.generateVideo(invalidOptions)).rejects.toThrow(/Invalid video parameters/);
        });

        it('should reject invalid firstFrame (not a string)', async () => {
            const invalidOptions = {
                prompt: 'Valid prompt',
                firstFrame: 12345 // Should be string
            };


            // @ts-expect-error - bypassing TS to test runtime validation
            await expect(service.generateVideo(invalidOptions)).rejects.toThrow(/Invalid video parameters/);
        });
    });

    describe('Input Sanitization & Edge Cases', () => {
        it('should handle unauthenticated user gracefully', async () => {
            mocks.auth.currentUser = null;

            await expect(service.generateVideo({ prompt: 'test' }))
                .rejects.toThrow('You must be signed in to generate video. Please log in.');
        });

        it('should handle extra fields by stripping them (Zod default behavior) or ignoring them', async () => {
            // Zod .parse() strips unknown keys by default if strict() is not used.
            // If safeParse is used, it might keep them depending on configuration,
            // but here we are testing that the service doesn't crash.

            const extraOptions = {
                prompt: 'test',
                secretKey: 'should-not-be-here'
            };

            // Setup mock — the service now calls firebaseAI.generateVideo directly
            // (no Cloud Functions trigger involved)

            await service.generateVideo(extraOptions);

            // The service should not crash with extra fields.
            // firebaseAI.generateVideo should have been called via the direct SDK path.
            expect(mocks.firebaseAI.generateVideo).toHaveBeenCalled();
        });
    });
});
