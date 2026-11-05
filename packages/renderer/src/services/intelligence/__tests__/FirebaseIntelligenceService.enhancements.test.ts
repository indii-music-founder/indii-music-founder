import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseIntelligenceService } from '../FirebaseIntelligenceService';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { CostPredictor } from '../utils/CostPredictor';
import { APPROVED_MODELS } from '@/core/config/intelligence-models';

// Mocks must be hoisted to the top
vi.mock('@/services/firebase', () => ({
    getFirebaseAI: vi.fn(() => ({})), // Return dummy object
    remoteConfig: {}, // Dummy remote config
    functions: {},
    auth: {
        currentUser: { uid: 'test-user-id' }
    },
    db: {},
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/ai', () => ({
    getGenerativeModel: vi.fn(() => ({
        generateContent: vi.fn().mockResolvedValue({
            response: {
                text: () => 'Mock response',
                usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 }
            }
        })
    })),
    getAI: vi.fn(),
    GenerativeModel: class { },
    getLiveGenerativeModel: vi.fn()
}));

vi.mock('firebase/remote-config', () => ({
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: vi.fn(() => ({ asString: () => '' })),
    getRemoteConfig: vi.fn()
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: {} })),
    getFunctions: vi.fn()
}));

describe('FirebaseIntelligenceService Enhancements', () => {
    let service: any;

    beforeEach(() => {
        vi.clearAllMocks(); // Clear mocks before each test
        service = new FirebaseIntelligenceService();
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    describe('handleError', () => {
        it('should mark 429 as retryable', () => {
            const error = new Error('Rate limit exceeded (429)');
            const appException = service.handleError(error);
            expect(appException.code).toBe(AppErrorCode.RATE_LIMITED);
            expect(appException.details.retryable).toBe(true);
        });

        it('should mark 503 as retryable', () => {
            const error = new Error('Service Unavailable (503)');
            const appException = service.handleError(error);
            expect(appException.code).toBe(AppErrorCode.NETWORK_ERROR);
            expect(appException.details.retryable).toBe(true);
        });

        it('should mark 500/Internal Error as retryable', () => {
            const error = new Error('Internal error occurred');
            const appException = service.handleError(error);
            expect(appException.details.retryable).toBe(true);
        });

        it('should mark Permission Denied as non-retryable', () => {
            const error = new Error('PERMISSION_DENIED: App Check failed');
            const appException = service.handleError(error);
            expect(appException.code).toBe(AppErrorCode.UNAUTHORIZED);
            expect(appException.details.retryable).toBeFalsy();
        });
    });

    describe('withRetry', () => {
        it('cancels retry backoff immediately without resubmitting or retaining the timer', async () => {
            vi.useFakeTimers();
            try {
                const controller = new AbortController();
                const operation = vi.fn().mockRejectedValue(new Error('503 Service Unavailable'));
                const pending = service.withRetry(operation, 3, 10000, controller.signal);
                const rejected = expect(pending).rejects.toMatchObject({ code: AppErrorCode.CANCELLED, details: { retryable: false } });
                await vi.advanceTimersByTimeAsync(0);
                controller.abort();
                await rejected;
                expect(operation).toHaveBeenCalledTimes(1);
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('handles an abort just before the backoff listener is registered', async () => {
            const controller = new AbortController();
            const register = controller.signal.addEventListener.bind(controller.signal);
            vi.spyOn(controller.signal, 'addEventListener').mockImplementation((...args) => {
                controller.abort();
                register(...args);
            });
            const operation = vi.fn().mockRejectedValue(new Error('503 Service Unavailable'));
            await expect(service.withRetry(operation, 3, 10000, controller.signal))
                .rejects.toMatchObject({ code: AppErrorCode.CANCELLED });
            expect(operation).toHaveBeenCalledTimes(1);
        });


        it.each([
            [undefined, AppErrorCode.CANCELLED],
            ['TIMEOUT', AppErrorCode.TIMEOUT],
            [new Error('private abort reason'), AppErrorCode.CANCELLED],
        ])('does not submit an already-aborted request', async (reason, code) => {
            const controller = new AbortController();
            controller.abort(reason);
            const operation = vi.fn();
            await expect(service.withRetry(operation, 3, 1, controller.signal))
                .rejects.toMatchObject({ code });
            expect(operation).not.toHaveBeenCalled();
        });

        it('normalizes an in-flight abort instead of leaking the provider rejection', async () => {
            const controller = new AbortController();
            const operation = vi.fn(async () => {
                controller.abort();
                throw new Error('private provider failure');
            });
            await expect(service.withRetry(operation, 3, 1, controller.signal))
                .rejects.toMatchObject({ code: AppErrorCode.CANCELLED, message: 'AI Request was cancelled.' });
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it.each([
            new DOMException('The operation was aborted', 'AbortError'),
            new DOMException('', 'AbortError'),
            new Error('signal is aborted'),
            new AppException(AppErrorCode.CANCELLED, 'Cancelled', { retryable: true }),
        ])('never resubmits cancelled work without an external signal', async error => {
            const operation = vi.fn().mockRejectedValue(error);
            await expect(service.withRetry(operation, 3, 1)).rejects.toMatchObject({ code: AppErrorCode.CANCELLED });
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should succeed on first attempt', async () => {
            const op = vi.fn().mockResolvedValue('ok');
            const result = await service.withRetry(op);
            expect(result).toBe('ok');
            expect(op).toHaveBeenCalledTimes(1);
        });

        it('should retry with exponential backoff on transient errors', async () => {
            const op = vi.fn()
                .mockRejectedValueOnce(new Error('429: Too many requests'))
                .mockRejectedValueOnce(new Error('503: Service Unavailable'))
                .mockResolvedValueOnce('success');

            // Using small initialDelay (1ms) to avoid long tests without fake timers
            const result = await service.withRetry(op, 3, 1);

            expect(result).toBe('success');
            expect(op).toHaveBeenCalledTimes(3);
        });

        it('should give up after max retries', async () => {
            const op = vi.fn().mockRejectedValue(new Error('503: Busy'));

            // Should fail after 3 total attempts (0, 1, 2)
            await expect(service.withRetry(op, 2, 1)).rejects.toThrow();
            expect(op).toHaveBeenCalledTimes(3);
        });
    });
});

describe('CostPredictor', () => {
    it('should calculate text costs correctly', () => {
        const prompt = "Hello world"; // ~3 tokens
        const estimate = CostPredictor.predictTextCost(prompt, 100, APPROVED_MODELS.TEXT_FAST);

        expect(estimate.estimatedCostUsd).toBeGreaterThan(0);
        expect(estimate.estimatedCredits).toBeGreaterThan(0);
        expect(estimate.unit).toBe('tokens');
    });

    it('should calculate video costs', () => {
        const estimate = CostPredictor.predictVideoCost(5);

        expect(estimate.estimatedCostUsd).toBe(1.0); // 5s * $0.20/s (perSecond pricing)
        expect(estimate.estimatedCredits).toBe(1000);
    });
});
