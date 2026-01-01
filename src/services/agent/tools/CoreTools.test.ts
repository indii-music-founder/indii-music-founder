import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoreTools } from './CoreTools';
import { ValidAgentId } from '../types';

// Define the mock factory outside the tests
const mockGetAgent = vi.fn();
const mockListCapabilities = vi.fn();

vi.mock('../registry', () => ({
    agentRegistry: {
        get: (id: string) => mockGetAgent(id),
        listCapabilities: () => mockListCapabilities()
    }
}));

describe('CoreTools', () => {
    describe('delegate_task', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            // Default behavior: return a mock agent
            mockGetAgent.mockReturnValue({
                name: 'MockAgent',
                execute: vi.fn().mockResolvedValue({ text: 'Task completed' })
            });
            mockListCapabilities.mockReturnValue('mock capabilities');
        });

        it('should accept valid agent IDs', async () => {
            const result = await CoreTools.delegate_task({
                agent_id: 'legal' as ValidAgentId,
                task: 'Review this'
            });

            expect(result).toContain('[MockAgent]: Task completed');
            expect(mockGetAgent).toHaveBeenCalledWith('legal');
        });

        it('should reject invalid agent IDs with a descriptive error', async () => {
            const result = await CoreTools.delegate_task({
                agent_id: 'invalid-agent' as any, // Cast to any to simulate runtime passing of bad string
                task: 'Do something'
            });

            expect(result).toContain('Error: Invalid agent ID "invalid-agent"');
            expect(result).toContain('Valid agent IDs are:');
            expect(result).toContain('legal');
            expect(result).toContain('marketing');

            // Should NOT call the registry if validation fails
            expect(mockGetAgent).not.toHaveBeenCalled();
        });

        it('should support targetAgentId alias', async () => {
            const result = await CoreTools.delegate_task({
                targetAgentId: 'brand',
                agent_id: 'marketing' as ValidAgentId,
                task: 'Review this'
            } as any);

            expect(result).toContain('[MockAgent]: Task completed');
            expect(mockGetAgent).toHaveBeenCalledWith('brand');
        });

        it('should validate the targetAgentId alias as well', async () => {
             const result = await CoreTools.delegate_task({
                targetAgentId: 'invalid-one',
                agent_id: 'marketing' as ValidAgentId,
                task: 'Review this'
            } as any);

            expect(result).toContain('Error: Invalid agent ID "invalid-one"');
            expect(mockGetAgent).not.toHaveBeenCalled();
        });

        it('should handle registry returning null (agent not found despite valid ID)', async () => {
             mockGetAgent.mockReturnValue(null);

             const result = await CoreTools.delegate_task({
                agent_id: 'marketing' as ValidAgentId,
                task: 'Review this'
             });

             expect(result).toContain("Error: Agent 'marketing' not found");
             expect(mockListCapabilities).toHaveBeenCalled();
        });
    });
});
