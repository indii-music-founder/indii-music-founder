import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FirebaseIntelligenceService } from './FirebaseIntelligenceService';
import { logger } from '@/utils/logger';

// Mock Dependencies
vi.mock('@/services/firebase', () => ({
    getFirebaseAI: () => ({}),
    auth: { currentUser: { uid: 'test-user' } },
    functions: {},
    db: {},
    remoteConfig: {}, // Added this,
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Mock Google AutonomousIntelligence SDK (Fallback)
vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: class {
            models = {
                generateContent: vi.fn().mockResolvedValue({
                    candidates: [{ content: { parts: [{ text: 'Response' }] } }],
                    usageMetadata: {},
                    text: 'Response'
                }),
                generateContentStream: vi.fn(),
                embedContent: vi.fn()
            };
        }
    };
});

vi.mock('firebase/ai', () => ({
    getGenerativeModel: vi.fn(() => ({
        generateContent: vi.fn().mockResolvedValue({
            response: { text: () => 'Response' }
        })
    })),
    // Mock other exports used by FirebaseIntelligenceService
    getLiveGenerativeModel: vi.fn(),
}));

vi.mock('firebase/remote-config', () => ({
    fetchAndActivate: vi.fn(),
    getValue: vi.fn(() => ({ asString: () => '' }))
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn()
}));

vi.mock('@/config/env', () => ({
    env: { apiKey: 'test-key', appCheckKey: 'test-app-check-key' }
}));

vi.mock('./appcheck', () => ({
    isAppCheckConfigured: () => true,
    isAppCheckError: vi.fn()
}));

vi.mock('./billing/TokenUsageService', () => ({
    TokenUsageService: {
        checkQuota: vi.fn().mockResolvedValue(true),
        checkRateLimit: vi.fn().mockResolvedValue(true),
        trackUsage: vi.fn()
    }
}));

describe('FirebaseIntelligenceService Security', () => {
    let service: FirebaseIntelligenceService;
    let loggerDebugSpy: any;

    beforeEach(() => {
        service = new FirebaseIntelligenceService();
        loggerDebugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => { });
    });

    afterEach(() => {
        loggerDebugSpy.mockRestore();
    });

    it('does not log prompt text that a pattern sanitizer would miss', async () => {
        const sensitivePrompt = 'unreleased lyric: blue glass under the water';

        await service.generateContent(sensitivePrompt);

        expect(JSON.stringify(loggerDebugSpy.mock.calls)).not.toContain(sensitivePrompt);
        expect(loggerDebugSpy).toHaveBeenCalledWith('[FirebaseIntelligenceService] generateContent request');
    });
});
