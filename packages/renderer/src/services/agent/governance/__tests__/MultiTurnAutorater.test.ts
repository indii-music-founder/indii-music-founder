import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiTurnAutorater, TraceMessage } from '@/services/agent/governance/MultiTurnAutorater';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateStructuredData: vi.fn()
    }
}));

describe('MultiTurnAutorater', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should evaluate a passing conversation trace correctly', async () => {
        const mockResult = {
            goalCompletion: 9,
            adherence: 10,
            coherence: 8,
            toolEfficiency: 9,
            reasoning: 'The agent effectively completed the task and followed all guidelines.',
            overallPass: true
        };

        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResult);

        const messages: TraceMessage[] = [
            { role: 'user', content: 'Create a new project.' },
            { role: 'tool', content: 'Creating project...' },
            { role: 'model', content: 'I have created the project for you.' }
        ];

        const result = await MultiTurnAutorater.evaluateTrace(
            'trace-123',
            messages,
            'Create a project',
            ['Do not hallucinate files']
        );

        expect(result).toEqual(mockResult);
        expect(AutonomousIntelligence.generateStructuredData).toHaveBeenCalledTimes(1);
        
        const callArgs = vi.mocked(AutonomousIntelligence.generateStructuredData).mock.calls[0];
        expect(callArgs).toBeDefined();
        if (callArgs) {
            expect(callArgs[0]).toContain('Create a project'); // Check prompt contains goal
            expect(callArgs[0]).toContain('Do not hallucinate files'); // Check prompt contains guidelines
            expect(callArgs[4]).toBe(INTELLIGENCE_MODELS.TEXT.FAST);
        }
    });

    it('should handle failures in evaluation gracefully', async () => {
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockRejectedValue(new Error('Intelligence Service down'));

        const result = await MultiTurnAutorater.evaluateTrace(
            'trace-456',
            [],
            'Test goal'
        );

        expect(result).toBeNull();
    });
    
    it('should handle empty evaluation results', async () => {
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(null);

        const result = await MultiTurnAutorater.evaluateTrace(
            'trace-789',
            [],
            'Test goal'
        );

        expect(result).toBeNull();
    });

    it('bounds oversized tool outputs and strips control characters before evaluation (ISSUE-1711)', async () => {
        const mockResult = {
            goalCompletion: 8,
            adherence: 9,
            coherence: 8,
            toolEfficiency: 8,
            reasoning: 'Good',
            overallPass: true,
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResult);

        const hugeToolDump = `{"ok":true,"blob":"${'A'.repeat(12_000)}\u0000\u0007"}`;
        const messages: TraceMessage[] = [
            { role: 'user', content: 'Pitch my release.' },
            { role: 'tool', content: hugeToolDump },
            { role: 'model', content: 'Done.' },
        ];

        const result = await MultiTurnAutorater.evaluateTrace('trace-bounded', messages, 'Pitch release');
        expect(result).toEqual(mockResult);

        const promptSent = vi.mocked(AutonomousIntelligence.generateStructuredData).mock.calls[0]?.[0] as string;
        expect(promptSent).toContain('...[truncated');
        expect(promptSent).not.toContain('\u0000');
        expect(promptSent).not.toContain('\u0007');
        expect(promptSent.length).toBeLessThan(10_000);
    });
});
