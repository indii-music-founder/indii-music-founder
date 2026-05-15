import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiTurnAutorater, TraceMessage } from '../MultiTurnAutorater';
import { AutonomousGenAI } from '@/services/intelligence/AutonomousGenAI';

vi.mock('@/services/intelligence/AutonomousGenAI', () => ({
    AutonomousGenAI: {
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

        vi.mocked(AutonomousGenAI.generateStructuredData).mockResolvedValue(mockResult);

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
        expect(AutonomousGenAI.generateStructuredData).toHaveBeenCalledTimes(1);
        
        const callArgs = vi.mocked(AutonomousGenAI.generateStructuredData).mock.calls[0];
        expect(callArgs).toBeDefined();
        if (callArgs) {
            expect(callArgs[0]).toContain('Create a project'); // Check prompt contains goal
            expect(callArgs[0]).toContain('Do not hallucinate files'); // Check prompt contains guidelines
        }
    });

    it('should handle failures in evaluation gracefully', async () => {
        vi.mocked(AutonomousGenAI.generateStructuredData).mockRejectedValue(new Error('Intelligence Service down'));

        const result = await MultiTurnAutorater.evaluateTrace(
            'trace-456',
            [],
            'Test goal'
        );

        expect(result).toBeNull();
    });
    
    it('should handle empty evaluation results', async () => {
        vi.mocked(AutonomousGenAI.generateStructuredData).mockResolvedValue(null);

        const result = await MultiTurnAutorater.evaluateTrace(
            'trace-789',
            [],
            'Test goal'
        );

        expect(result).toBeNull();
    });
});
