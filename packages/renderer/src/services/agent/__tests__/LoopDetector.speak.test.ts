import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoopDetector } from '@/services/agent/LoopDetector';

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true }),
    },
}));

describe('LoopDetector speak rule', () => {
    let detector: LoopDetector;

    beforeEach(() => {
        detector = new LoopDetector();
    });

    it('does not flag speak calls separated by other tools (intent-chaining)', async () => {
        // The system prompt explicitly directs agents to announce intent and
        // results with `speak` — speak → tool → speak is normal, not a loop.
        detector.recordToolCall('speak', { text: 'I will now generate the image.' });
        detector.recordToolCall('generate_image', { prompt: 'sunset' });

        const result = await detector.detectLoop('speak', { text: 'Image generated!' });

        expect(result.isLoop).toBe(false);
    });

    it('flags back-to-back speak calls as spam', async () => {
        detector.recordToolCall('speak', { text: 'Announcement one.' });

        const result = await detector.detectLoop('speak', { text: 'Announcement two.' });

        expect(result.isLoop).toBe(true);
        expect(result.reason).toContain('consecutive speak');
    });

    it('stops flagging speak once a different tool runs between them', async () => {
        detector.recordToolCall('speak', { text: 'one' });
        detector.recordToolCall('speak', { text: 'two' }); // would have been flagged at this point
        detector.recordToolCall('search_knowledge', { query: 'x' });

        const result = await detector.detectLoop('speak', { text: 'three' });

        expect(result.isLoop).toBe(false);
    });

    it('still detects genuine alternating loops (A→B→A→B) on billable tools', async () => {
        detector.recordToolCall('generate_image', { prompt: '1' });
        detector.recordToolCall('generate_video', { prompt: '2', duration: 4 });
        detector.recordToolCall('generate_image', { prompt: '1' });

        const result = await detector.detectLoop('generate_video', { prompt: '2', duration: 4 });

        expect(result.isLoop).toBe(true);
        expect(result.reason).toContain('Alternating');
    });

    it('does not flag a free tool called twice in a row with identical args', async () => {
        // Re-reading the same document is legitimate — only billable tools
        // trigger the consecutive-call kill switch.
        detector.recordToolCall('read_document', { documentId: 'd1' });

        const result = await detector.detectLoop('read_document', { documentId: 'd1' });

        expect(result.isLoop).toBe(false);
    });

    it('still flags a billable tool called twice in a row with identical args', async () => {
        detector.recordToolCall('generate_image', { prompt: 'sunset' });

        const result = await detector.detectLoop('generate_image', { prompt: 'sunset' });

        expect(result.isLoop).toBe(true);
        expect(result.reason).toContain('consecutively');
    });

    it('flags a repeating (tool, args) sequence but not same-tool pagination', async () => {
        // Same tool, DIFFERENT args six times — not a repeating sequence.
        const paginator = new LoopDetector();
        for (let i = 0; i < 6; i += 1) {
            paginator.recordToolCall('search_knowledge', { query: `page-${i}` });
        }
        await expect(paginator.detectLoop('search_knowledge', { query: 'page-6' })).resolves.toMatchObject({ isLoop: false });

        // A genuine ABC→ABC repetition in the recorded history IS loop-shaped.
        const looper = new LoopDetector();
        const sequence = [
            ['generate_image', '0'], ['generate_video', '1'], ['generate_audio', '2'],
            ['generate_image', '0'], ['generate_video', '1'], ['generate_audio', '2'],
        ];
        for (const [tool, arg] of sequence) {
            looper.recordToolCall(tool, { arg });
        }
        const result = await looper.detectLoop('generate_video', { arg: '1' });
        expect(result.isLoop).toBe(true);
        expect(result.reason).toContain('Repeating sequence');
    });

    it('does not flag frequent free-tool usage, only billable frequency', async () => {
        // 6 distinct searches in the last 10 calls is normal intent-chaining.
        for (let i = 0; i < 6; i += 1) {
            detector.recordToolCall('search_knowledge', { query: `q${i}` });
        }

        const freeResult = await detector.detectLoop('search_knowledge', { query: 'q6' });
        expect(freeResult.isLoop).toBe(false);

        // The same frequency of an EXPENSIVE billable tool is still a loop.
        const fresh = new LoopDetector();
        for (let i = 0; i < 6; i += 1) {
            fresh.recordToolCall('generate_video', { prompt: `v${i}`, duration: 4 });
        }
        const costedResult = await fresh.detectLoop('generate_video', { prompt: 'v6', duration: 4 });
        expect(costedResult.isLoop).toBe(true);
        expect(costedResult.reason).toContain('times in last');
    });

    it('gives cheap image tools more headroom than expensive billable tools', async () => {
        // generate_image is ~$0.04/call and is budget-gated on every call, so a
        // hard "5 in 10" was tripping legitimate multi-image creative batches.
        const img = new LoopDetector();
        for (let i = 0; i < 10; i += 1) {
            img.recordToolCall('generate_image', { prompt: `p${i}` });
        }
        const result = await img.detectLoop('generate_image', { prompt: 'p10' });
        expect(result.isLoop).toBe(false);
    });

    it('does not flag free-tool repetition — the iteration budget bounds it', async () => {
        // list_stored_assets is a free read tool; re-listing is legitimate
        // intent-chaining, not a loop. Only billable tools are loop-killed.
        const free = new LoopDetector();
        for (let i = 0; i < 6; i += 1) {
            free.recordToolCall('list_stored_assets', { source: 'brand_assets' });
        }
        const result = await free.detectLoop('list_stored_assets', { source: 'brand_assets' });
        expect(result.isLoop).toBe(false);
    });
});
