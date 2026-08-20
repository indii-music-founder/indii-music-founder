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
});
