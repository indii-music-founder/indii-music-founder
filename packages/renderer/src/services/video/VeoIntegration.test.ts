/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';

// Mock dependencies
const mocks = vi.hoisted(() => ({
    httpsCallableFn: vi.fn().mockResolvedValue({ data: { jobId: 'mock-job-id' } }),
    httpsCallable: vi.fn(() => mocks.httpsCallableFn),
    onSnapshot: vi.fn(),
    doc: vi.fn(),
    auth: { currentUser: { uid: 'lens-tester' } },
    subscriptionService: {
        canPerformAction: vi.fn(),
        getCurrentSubscription: vi.fn()
    },
    useStore: {
        getState: vi.fn(() => ({ currentOrganizationId: 'org-lens' }))
    },
    firebaseAI: {
        analyzeImage: vi.fn(),
        generateVideo: vi.fn().mockResolvedValue('https://storage.googleapis.com/mock/video.mp4')
    },
    uuid: vi.fn(() => 'job-uuid-123')
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: mocks.httpsCallable,
    getFunctions: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
    doc: mocks.doc,
    onSnapshot: mocks.onSnapshot,
    getFirestore: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: 1629824800, nanoseconds: 0 })),
    Timestamp: { now: () => ({ seconds: 1629824800, nanoseconds: 0 }) },
    collection: vi.fn(),
    addDoc: vi.fn().mockResolvedValue({ id: 'doc-id' }),
    setDoc: vi.fn().mockResolvedValue(undefined),
    updateDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/firebase', () => ({
    auth: mocks.auth,
    db: {},
    functions: {},
    functionsWest1: {},
    getFirebaseAI: vi.fn(),
    remoteConfig: { defaultConfig: {} },
    storage: { app: { options: { storageBucket: 'mock-bucket' } } },
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('../firebase', () => ({ // Handle relative import in service
    functions: {},
    functionsWest1: {},
    db: {},
    auth: mocks.auth
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: mocks.subscriptionService
}));

vi.mock('@/core/store', () => ({
    useStore: mocks.useStore
}));

vi.mock('../intelligence/FirebaseIntelligenceService', () => ({
    firebaseAI: mocks.firebaseAI
}));

vi.mock('uuid', () => ({
    v4: mocks.uuid
}));

vi.mock('firebase/storage', () => ({
    getStorage: vi.fn(),
    ref: vi.fn(),
    uploadString: vi.fn().mockResolvedValue({ ref: { name: 'mock-file' } }),
    uploadBytes: vi.fn().mockResolvedValue({ ref: { name: 'mock-file' } }),
    getDownloadURL: vi.fn().mockResolvedValue('https://mock.storage.com/file')
}));

describe('Veo 3.1 Integration Pipeline', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new VideoGenerationService();
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
        mocks.httpsCallable.mockReturnValue(vi.fn().mockResolvedValue({ data: { jobId: 'job-uuid-123' } }) as any);
    });



    it('Veo 3.1 Metadata Contract: Should validate completed job output', async () => {
        // Arrange
        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            // Simulate async update - "Flash" response speed logic could be tested here implicitly by fast timeout
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-uuid-123',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'https://mock.generated/video.mp4',
                            metadata: {
                                duration_seconds: 4.0,
                                fps: 30,
                                mime_type: 'video/mp4'
                            }
                        }
                    })
                });
            }, 10);
            return () => { };
        });

        // Act
        const job = await service.waitForJob('job-uuid-123');

        // Assert
        expect(job.output!.metadata).toEqual({
            duration_seconds: 4.0,
            fps: 30,
            mime_type: 'video/mp4'
        });
    });
});
