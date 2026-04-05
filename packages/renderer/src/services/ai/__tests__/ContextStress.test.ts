import { describe, it, expect, vi } from 'vitest';
import { ContextManager } from '../context/ContextManager';
import { Content } from '@/shared/types/ai.dto';

describe('ContextManager Stress Tests', () => {

    it('should handle massive conversation histories (10,000+ turns)', () => {
        const history: Content[] = [];
        for (let i = 0; i < 10000; i++) {
            history.push({
                role: i % 2 === 0 ? 'user' : 'model',
                parts: [{ text: `Message turn ${i} with some content that takes up tokens.` }]
            });
        }

        const maxTokens = 5000;
        const startTime = Date.now();
        const truncated = ContextManager.truncateContext(history, maxTokens);
        const duration = Date.now() - startTime;

        console.log(`[STRESS] Truncated 10,000 turns in ${duration}ms`);

        // Should be within token limit or at minimum recent messages
        const tokens = ContextManager.estimateContextTokens(truncated);
        expect(tokens).toBeLessThanOrEqual(maxTokens);
        expect(truncated.length).toBeGreaterThanOrEqual(2); // MIN_RECENT_MESSAGES
        expect(duration).toBeLessThan(500); // Should be very fast
    });

    it('should respect the KEEP_FIRST_MESSAGE flag during extreme truncation', () => {
        const firstMessage: Content = { role: 'user', parts: [{ text: 'INITIAL_CONTEXT_ANCHOR' }] };
        const history: Content[] = [firstMessage];

        for (let i = 1; i < 100; i++) {
            history.push({
                role: i % 2 === 0 ? 'user' : 'model',
                parts: [{ text: 'REDUNDANT_MESSAGE_BODY_THAT_SHOULD_BE_DROPPED' }]
            });
        }

        // Set a very low token limit that forces aggressive dropping
        const maxTokens = 100;
        const truncated = ContextManager.truncateContext(history, maxTokens);

        expect(truncated[0]!.parts[0]).toMatchObject({ text: 'INITIAL_CONTEXT_ANCHOR' });
        expect(truncated.length).toBeLessThan(history.length);
    });

    it('should handle large multimodal attachments without crashing', () => {
        const history: Content[] = [
            {
                role: 'user',
                parts: [
                    { text: 'Analyze these 5 images.' },
                    { inlineData: { mimeType: 'image/png', data: 'huge_base64_payload_1' } },
                    { inlineData: { mimeType: 'image/png', data: 'huge_base64_payload_2' } },
                    { inlineData: { mimeType: 'image/png', data: 'huge_base64_payload_3' } },
                    { inlineData: { mimeType: 'image/png', data: 'huge_base64_payload_4' } },
                    { inlineData: { mimeType: 'image/png', data: 'huge_base64_payload_5' } },
                ]
            },
            {
                role: 'model',
                parts: [{ text: 'I see 5 images of urban landscapes.' }]
            }
        ];

        // Tokens for this: ~5 * 500 = 2500 + text tokens
        const tokensBefore = ContextManager.estimateContextTokens(history);
        expect(tokensBefore).toBeGreaterThan(2500);

        // Truncate to a limit smaller than one image
        const truncated = ContextManager.truncateContext(history, 400);

        // Since MIN_RECENT_MESSAGES is 2, it should keep both but warn they are over limit
        expect(truncated.length).toBe(2);
        const tokensAfter = ContextManager.estimateContextTokens(truncated);
        expect(tokensAfter).toBeGreaterThan(400);
    });

    it('should terminate via safety valve (MAX_DROPS/Safety break) if history is malformed or loop hangs', () => {
        const history: Content[] = [];
        for (let i = 0; i < 15000; i++) {
            history.push({ role: 'user', parts: [{ text: 'A' }] });
        }

        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });

        // Very low limit to force many iterations
        const truncated = ContextManager.truncateContext(history, 10);

        // Should hit safety break (10000) and stop
        expect(truncated.length).toBe(5000); // 15000 - 10000 = 5000
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('EXTREME TRUNCATION: Dropped 10,000 messages'));

        spy.mockRestore();
    });

    it('should handle extreme multimodal payloads (20+ attachments) effortlessly', () => {
        const parts: any[] = [{ text: 'Examine these 25 files.' }];
        for (let i = 0; i < 25; i++) {
            parts.push({
                inlineData: { mimeType: 'image/png', data: `data_${i}` }
            });
        }

        const history: Content[] = [{ role: 'user', parts }];

        // 25 * 500 = 12,500 tokens
        const tokens = ContextManager.estimateContextTokens(history);
        expect(tokens).toBeGreaterThan(12500);

        // Truncate to a limit that forces dropping the whole message if it wasn't the last one
        // But since it's only 1 message, it should be kept if it's within MIN_RECENT_MESSAGES
        const truncated = ContextManager.truncateContext(history, 1000);
        expect(truncated.length).toBe(1);
        expect(truncated[0]!.parts.length).toBe(26);
    });

    it('should handle mixed content types (text, multimodal, tool calls) in stress scenario', () => {
        const history: Content[] = [];
        for (let i = 0; i < 500; i++) {
            if (i % 3 === 0) {
                history.push({ role: 'user', parts: [{ text: 'Some text query' }] });
            } else if (i % 3 === 1) {
                history.push({ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'b64' } }] });
            } else {
                history.push({
                    role: 'model',
                    parts: [{
                        functionCall: { name: 'gen_image', args: { prompt: 'cat' } }
                    } as unknown as Content['parts'][0]]
                });
            }
        }

        const maxTokens = 2000;
        const truncated = ContextManager.truncateContext(history, maxTokens);

        expect(ContextManager.estimateContextTokens(truncated)).toBeLessThanOrEqual(maxTokens);
        expect(truncated.length).toBeGreaterThan(0);
    });
});
