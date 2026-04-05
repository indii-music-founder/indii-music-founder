import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FirebaseAIService } from './FirebaseAIService';
import { InputSanitizer } from './utils/InputSanitizer';
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

// Mock Google GenAI SDK (Fallback)
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
    // Mock other exports used by FirebaseAIService
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
    env: { apiKey: 'test-key' }
}));

vi.mock('./billing/TokenUsageService', () => ({
    TokenUsageService: {
        checkQuota: vi.fn().mockResolvedValue(true),
        checkRateLimit: vi.fn().mockResolvedValue(true),
        trackUsage: vi.fn()
    }
}));

describe('FirebaseAIService Security', () => {
    let service: FirebaseAIService;
    let loggerDebugSpy: any;

    beforeEach(() => {
        service = new FirebaseAIService();
        loggerDebugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => { });
    });

    afterEach(() => {
        loggerDebugSpy.mockRestore();
    });

    it('should NOT leak raw PII in debug logs', async () => {
        // Use a password pattern that triggers InputSanitizer (key-value pair)
        const sensitivePrompt = "password: super_secret_123";

        // Ensure InputSanitizer would redact it
        const sanitized = InputSanitizer.sanitize(sensitivePrompt);
        expect(sanitized).toContain('[REDACTED_SECRET]');
        expect(sanitized).not.toContain('super_secret_123');

        // Call generateContent
        await service.generateContent(sensitivePrompt);

        // Check calls to logger.debug
        const calls = loggerDebugSpy.mock.calls;
        const promptLog = calls.find((args: any[]) => args[0] === '[DEBUG-PAYLOAD] prompt:');

        expect(promptLog).toBeDefined();

        // VULNERABILITY CHECK: The current implementation logs the RAW prompt
        const loggedContent = promptLog[1];

        // This assertion confirms the vulnerability exists (it fails because the secret IS present)
        // I'll make it explicit: expect NOT to find the secret.
        expect(loggedContent).not.toContain('super_secret_123');
    });
});
