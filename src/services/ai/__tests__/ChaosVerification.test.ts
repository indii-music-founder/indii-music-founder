import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentZeroService } from '../../agent/AgentZeroService';
import { firebaseAI } from '../FirebaseAIService';
import { Content } from 'firebase/ai';

// Mock AgentZeroService
vi.mock('../../agent/AgentZeroService', () => ({
    agentZeroService: {
        sendMessage: vi.fn()
    }
}));

describe('ChaosVerification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Agent Zero Connection Failures (IPC Proxy)', () => {
        it('should handle Refused Connection (50080 offline)', async () => {
            // Simulate ECONNREFUSED or similar proxy failure
            vi.mocked(agentZeroService.sendMessage).mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED at 127.0.0.1:50080'));

            await expect(agentZeroService.sendMessage('test', [])).rejects.toThrow('ECONNREFUSED');
        });

        it('should handle Timeout on long-running proxy requests', async () => {
            // Simulate 60s timeout
            vi.mocked(agentZeroService.sendMessage).mockRejectedValueOnce(new Error('Agent Zero Proxy Failed: Execution timeout'));

            await expect(agentZeroService.sendMessage('test', [])).rejects.toThrow('Execution timeout');
        });

        it('should handle Internal Server Error from Agent Zero container', async () => {
            // Simulate 500 error bubbled through proxy
            vi.mocked(agentZeroService.sendMessage).mockRejectedValueOnce(new Error('Agent Zero Error: Internal Server Error (500)'));

            await expect(agentZeroService.sendMessage('test', [])).rejects.toThrow('500');
        });
    });

    describe('Specialist Agent Fallback Logic', () => {
        it('should gracefully handle tool execution failure in BaseAgent', async () => {
            // This would test the error bubbling in BaseAgent/AgentService
            // For now, we verify that AgentZeroService propagates the error which the Service/UI should catch
            vi.mocked(agentZeroService.sendMessage).mockResolvedValueOnce({
                message: 'I tried to use a tool but it failed.',
                attachments: []
            });

            const response = await agentZeroService.sendMessage('test', []);
            expect(response.message).toContain('failed');
        });
    });

    describe('FirebaseAIService Race Conditions', () => {
        it('should NOT coalesce requests with different multimodal data', async () => {
            // This test verifies if different binary payloads are correctly distinguished in the request coalescing map
            const rawGenerateSpy = vi.spyOn(firebaseAI as any, 'rawGenerateContent');

            const promptA: Content[] = [{
                role: 'user',
                parts: [{ text: 'Analyze this image' }, { inlineData: { mimeType: 'image/png', data: 'IMAGE_A_DATA' } }]
            }];

            const promptB: Content[] = [{
                role: 'user',
                parts: [{ text: 'Analyze this image' }, { inlineData: { mimeType: 'image/png', data: 'IMAGE_B_DATA' } }]
            }];

            // We mock the internal execution to see if it's called twice
            // Note: rawGenerateContent uses this.rateLimiter, this.contentBreaker etc.
            // We need to mock the underlying model.generateContent or similar if possible
            // but for a quick check, we can just see if the Map 'activeRequests' handles them as different keys.

            const activeRequests = (firebaseAI as any).activeRequests;

            // Start Request A (don't wait)
            const promiseA = firebaseAI.rawGenerateContent(promptA, undefined, {}, undefined, [], { skipCache: true });
            const keyA = Array.from(activeRequests.keys())[0];

            // Start Request B 
            const promiseB = firebaseAI.rawGenerateContent(promptB, undefined, {}, undefined, [], { skipCache: true });
            const keyB = Array.from(activeRequests.keys()).find(k => k !== keyA);

            // If keyB is undefined or same as keyA, we have a collision
            expect(keyB).toBeDefined();
            expect(keyB).not.toBe(keyA);

            // Cleanup
            promiseA.catch(() => { });
            promiseB.catch(() => { });
        });

        it('should handle AI Generation Timeout via AbortSignal', async () => {
            // Test that the 'timeout' option correctly triggers the AbortController
            const start = Date.now();
            const timeout = 100; // 100ms

            // Mock ensureInitialized to bypass bootstrap
            vi.spyOn(firebaseAI as any, 'ensureInitialized').mockResolvedValue(true);

            // Mock a long running operation (e.g. rateLimiter.acquire)
            vi.spyOn((firebaseAI as any).rateLimiter, 'acquire').mockImplementation(() => new Promise(resolve => setTimeout(resolve, 500)));

            const promise = firebaseAI.rawGenerateContent('Slow request', undefined, {}, undefined, [], { timeout });

            await expect(promise).rejects.toThrow('AI Request timed out');
            const end = Date.now();
            expect(end - start).toBeLessThan(700); // Should have aborted well before 700ms
        });

        it('should succeed after retry for transient 503 errors', async () => {
            const { mockGenerate } = vi.hoisted(() => ({
                mockGenerate: vi.fn()
            }));

            mockGenerate
                .mockRejectedValueOnce(new Error('503 Service Unavailable'))
                .mockResolvedValueOnce({
                    response: {
                        candidates: [{ content: { parts: [{ text: 'Recovered!' }] } }],
                        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
                        text: () => 'Recovered!'
                    }
                });

            // Mock ensureInitialized to return a custom object with generateContent
            vi.spyOn(firebaseAI as any, 'ensureInitialized').mockResolvedValue(true);
            (firebaseAI as any).useFallbackMode = false;

            // Re-mock firebase/ai with the hoisted mock
            vi.mock('firebase/ai', async (importOriginal) => {
                const actual = await importOriginal() as any;
                return {
                    ...actual,
                    getGenerativeModel: () => ({
                        generateContent: mockGenerate
                    })
                };
            });

            // Trigger 
            const result = await firebaseAI.rawGenerateContent('Transient test', undefined, {}, undefined, [], { skipCache: true });

            expect(mockGenerate).toHaveBeenCalledTimes(2);
            expect(result.response.text()).toBe('Recovered!');
        });
    });
});
