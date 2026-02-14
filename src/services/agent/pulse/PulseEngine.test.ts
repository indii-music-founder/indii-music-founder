
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PulseEngine } from './PulseEngine';
import { livingFileService } from '../living/LivingFileService';
import { AI } from '@/services/ai/AIService';
import { agentService } from '../AgentService';
// auth is mocked extensively in src/test/setup.ts but we can override it here if needed
// or just rely on the fact that we're running in a test environment where we might need to mock it explicitly to ensure user presence

// Mock dependencies
vi.mock('../living/LivingFileService');
vi.mock('@/services/ai/AIService');
vi.mock('../AgentService');

describe('PulseEngine', () => {
    let engine: PulseEngine;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        engine = new PulseEngine();

        // Default safe mock for AI
        vi.mocked(AI.generateContent).mockResolvedValue({
            text: () => JSON.stringify({ actionNeeded: false, reason: 'test-default' })
        } as any);
    });

    afterEach(() => {
        engine.stop();
        vi.useRealTimers();
    });

    it('should start and schedule periodic pulses', () => {
        const firePulseSpy = vi.spyOn(engine, 'firePulse');
        engine.start();

        // Should fire initial pulse after 5s
        vi.advanceTimersByTime(5000);
        expect(firePulseSpy).toHaveBeenCalledTimes(1);

        // Should fire interval pulse after 30 mins
        vi.advanceTimersByTime(30 * 60 * 1000);
        expect(firePulseSpy).toHaveBeenCalledTimes(2);
    });

    it('should trigger agent when action is needed', async () => {
        // Mock Living File Read
        vi.mocked(livingFileService.read).mockResolvedValue('- [ ] Check emails\n- [ ] Post to social media');

        // Mock AI Triage Decision (Action Needed)
        vi.mocked(AI.generateContent).mockResolvedValue({
            text: () => JSON.stringify({
                actionNeeded: true,
                reason: 'Emails are pending',
                instruction: 'Check the emails'
            })
        } as any);

        await engine.firePulse();

        expect(livingFileService.read).toHaveBeenCalledWith('test-uid', 'PULSE');
        expect(AI.generateContent).toHaveBeenCalled();

        // Verify low cost model usage (triage = flash)
        // We don't check exact string 'flash' because config might change, but we check it was called.
        // If we want to be specific:
        // expect(AI.generateContent).toHaveBeenCalledWith(expect.objectContaining({ model: expect.stringContaining('flash') }));

        expect(agentService.runAgent).toHaveBeenCalledWith(
            'generalist',
            'Check the emails',
            expect.objectContaining({ triggerType: 'schedule' })
        );
    });

    it('should NOT trigger agent when no action is needed', async () => {
        // Mock Living File Read
        vi.mocked(livingFileService.read).mockResolvedValue('- [x] All done');

        // Mock AI Triage Decision (No Action)
        vi.mocked(AI.generateContent).mockResolvedValue({
            text: () => JSON.stringify({
                actionNeeded: false,
                reason: 'PULSE_OK'
            })
        } as any);

        await engine.firePulse();

        expect(agentService.runAgent).not.toHaveBeenCalled();
    });
});
