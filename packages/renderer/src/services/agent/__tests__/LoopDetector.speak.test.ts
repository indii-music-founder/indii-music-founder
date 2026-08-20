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

    it('still detects genuine alternating loops (A→B→A→B)', async () => {
        detector.recordToolCall('tool_a', { arg: '1' });
        detector.recordToolCall('tool_b', { arg: '2' });
        detector.recordToolCall('tool_a', { arg: '1' });

        const result = await detector.detectLoop('tool_b', { arg: '2' });

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
            ['tool_a', '0'], ['tool_b', '1'], ['tool_c', '2'],
            ['tool_a', '0'], ['tool_b', '1'], ['tool_c', '2'],
        ];
        for (const [tool, arg] of sequence) {
            looper.recordToolCall(tool, { arg });
        }
        const result = await looper.detectLoop('tool_next', { arg: 'x' });
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

        // The same frequency of a billable tool is still a loop.
        const fresh = new LoopDetector();
        for (let i = 0; i < 6; i += 1) {
            fresh.recordToolCall('generate_image', { prompt: `p${i}` });
        }
        const costedResult = await fresh.detectLoop('generate_image', { prompt: 'p6' });
        expect(costedResult.isLoop).toBe(true);
        expect(costedResult.reason).toContain('times in last');
    });
});
