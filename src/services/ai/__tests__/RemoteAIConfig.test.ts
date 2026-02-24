import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseAIService } from '../FirebaseAIService';
import { APPROVED_MODELS } from '@/core/config/ai-models';
import { CostPredictor } from '../utils/CostPredictor';

// Mocks
const mockGenerateContent = vi.fn();
const mockRemoteConfigValue = vi.fn();

vi.mock('firebase/remote-config', () => ({
  serverTimestamp: vi.fn(),
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: (rc: any, key: string) => ({
        asString: () => mockRemoteConfigValue(key)
    })
}));

vi.mock('firebase/ai', () => ({
  serverTimestamp: vi.fn(),
    getGenerativeModel: vi.fn((ai, config) => ({
        model: config.model,
        generateContent: mockGenerateContent
    })),
    getAI: vi.fn(),
    VertexAIBackend: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
  serverTimestamp: vi.fn(),
    remoteConfig: {},
    getFirebaseAI: () => ({
  serverTimestamp: vi.fn(),}),
    app: {},
    functions: {},
    auth: { currentUser: { uid: 'test-user' } },
    db: {}
}));

vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(),
    getFirestore: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn()
}));

vi.mock('../billing/TokenUsageService', () => ({
  serverTimestamp: vi.fn(),
    TokenUsageService: {
        trackUsage: vi.fn(),
        checkQuota: vi.fn().mockResolvedValue(true),
        checkRateLimit: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('@/config/env', () => ({
  serverTimestamp: vi.fn(),
    env: { appCheckKey: 'mock-key' }
}));

describe('RemoteAIConfig & Dynamic Switching', () => {
    let service: FirebaseAIService;

    beforeEach(() => {
        service = new FirebaseAIService();
        vi.clearAllMocks();
        mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Success' }
        });

        // Default: No overrides
        mockRemoteConfigValue.mockImplementation((key) => {
            if (key === 'model_name') return 'default-model';
            if (key === 'ai_system_config') return null; // No config
            return '';
        });
    });

    it('should use default model when no remote config override exists', async () => {
        await service.bootstrap();

        // Call generateContent with TEXT_AGENT (default)
        // Access private method or infer via mock call
        await service.generateContent('test', APPROVED_MODELS.TEXT_AGENT);

        const { getGenerativeModel } = await import('firebase/ai');
        expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            model: APPROVED_MODELS.TEXT_AGENT
        }));
    });

    it('should intercept and replace model ID when override is present', async () => {
        // Setup override: TEXT_AGENT -> "gemini-4-ultra"
        const config = {
            overrides: {
                TEXT_AGENT: 'gemini-4-ultra'
            },
            pricing: {},
            config: {}
        };

        mockRemoteConfigValue.mockImplementation((key) => {
            if (key === 'ai_system_config') return JSON.stringify(config);
            return '';
        });

        await service.bootstrap();

        // Request the standard TEXT_AGENT
        console.log('Requesting model:', APPROVED_MODELS.TEXT_AGENT);
        await service.generateContent('test', APPROVED_MODELS.TEXT_AGENT);

        const { getGenerativeModel } = await import('firebase/ai');
        const calls = (getGenerativeModel as any).mock.calls;
        console.log('getGenerativeModel calls:', JSON.stringify(calls.map((c: any) => c[1]), null, 2));

        // Expect the overridden model name
        expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            model: 'gemini-4-ultra'
        }));
    });

    it('should fall back if remote schema is invalid', async () => {
        mockRemoteConfigValue.mockImplementation((key) => {
            if (key === 'ai_system_config') return '{ "bad": "json" '; // Malformed
            return '';
        });

        await service.bootstrap();
        await service.generateContent('test', APPROVED_MODELS.TEXT_AGENT);

        const { getGenerativeModel } = await import('firebase/ai');
        // Should use original
        expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            model: APPROVED_MODELS.TEXT_AGENT
        }));
    });
});

describe('CostPredictor Dynamic Pricing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRemoteConfigValue.mockReset();
    });

    it('should respect dynamic pricing from remote config', () => {
        // Setup override: TEXT_FAST cost
        const config = {
            overrides: {},
            pricing: {
                [APPROVED_MODELS.TEXT_FAST]: {
                    input: 99.99, // Super expensive
                    output: 99.99
                }
            },
            config: {}
        };

        mockRemoteConfigValue.mockImplementation((key) => {
            if (key === 'ai_system_config') return JSON.stringify(config);
            return '';
        });

        // Predict cost
        const result = CostPredictor.predictTextCost('test', 1000, APPROVED_MODELS.TEXT_FAST);

        // 99.99 per 1M tokens. 1000 tokens = 99.99 / 1000 = 0.09999
        expect(result.estimatedCostUsd).toBeGreaterThan(0.09);
    });

    it('should use override ID pricing if model is swapped', () => {
        // This test simulates: User asks for TEXT_FAST.
        // But CostPredictor assumes "model" passed to it IS the model being used.
        // It does NOT auto-swap model ID inside CostPredictor (CostPredictor is static).
        // However, if we pas the *swapped* model ID, it should look up that pricing.

        const swappedModel = 'gemini-future';
        const config = {
            overrides: {},
            pricing: {
                [swappedModel]: {
                    input: 50.0,
                    output: 50.0
                }
            },
            config: {}
        };

        mockRemoteConfigValue.mockImplementation((key) => {
            if (key === 'ai_system_config') return JSON.stringify(config);
            return '';
        });

        const result = CostPredictor.predictTextCost('test', 1000, swappedModel as any);
        expect(result.estimatedCostUsd).toBeCloseTo(0.05, 3);
    });
});
