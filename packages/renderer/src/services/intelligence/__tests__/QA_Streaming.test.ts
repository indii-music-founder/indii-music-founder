import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseIntelligenceService } from '../FirebaseIntelligenceService';

const mockGenerateContentStream = vi.fn();
const mockGenerateContent = vi.fn();

// Mock Firebase Service
vi.mock('@/services/firebase', () => ({
    getFirebaseAI: vi.fn(() => ({})),
    functions: {},
    ai: {},
    remoteConfig: {},
    db: {},
    auth: { currentUser: { uid: 'user-stream' } },
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    increment: vi.fn(),
    serverTimestamp: vi.fn(),
    collection: vi.fn()
}));

vi.mock('firebase/remote-config', () => ({
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: vi.fn(() => ({ asString: () => '' }))
}));

vi.mock('@/config/env', () => ({
    env: {
        VITE_API_KEY: '',
        apiKey: '',
        appCheckKey: 'mock-app-check-key',
        appCheckDebugToken: 'mock-debug-token'
    }
}));

vi.mock('../billing/TokenUsageService', () => ({
    TokenUsageService: {
        checkQuota: vi.fn().mockResolvedValue(true),
        checkRateLimit: vi.fn().mockResolvedValue(undefined),
        trackUsage: vi.fn().mockResolvedValue(undefined)
    }
}));

// Raw Google client fallback must stay unused in renderer tests.
vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn(() => {
        throw new Error('Raw Google client fallback must not be constructed');
    })
}));

// Mock firebase/ai
vi.mock('firebase/ai', () => ({
    __esModule: true,
    getGenerativeModel: vi.fn(() => ({
        generateContentStream: mockGenerateContentStream,
        generateContent: mockGenerateContent
    })),
    Schema: {},
    Tool: {}
}));

describe('Streaming QA', () => {
    let service: FirebaseIntelligenceService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new FirebaseIntelligenceService();
    });

    it('should pass AbortSignal to the backend gateway', async () => {
        const controller = new AbortController();
        const signal = controller.signal;

        await service.generateContentStream('prompt', undefined, {}, undefined, undefined, { signal });

        const call = [...vi.mocked(fetch).mock.calls].reverse().find(([url]) => String(url).includes('generateContentStream'));
        expect(call?.[1]?.signal).toBeInstanceOf(AbortSignal);
    });

    it('should read backend stream chunks', async () => {
        const { stream } = await service.generateContentStream('prompt');
        const reader = stream.getReader();

        const r1 = await reader.read();
        expect(r1.value?.text()).toBe('Good');

        const r2 = await reader.read();
        expect(r2.done).toBe(true);
    });
});
