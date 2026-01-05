import { describe, it, expect } from 'vitest';
import { AgentRegistry } from '../registry';
import { SpecializedAgent } from '../types';

describe('AgentRegistry', () => {
    it('should lazy load an agent', async () => {
        const registry = new AgentRegistry();
        const mockAgent: SpecializedAgent = {
            id: 'test-agent',
            name: 'Test Agent',
            description: 'Test',
            color: '#000',
            category: 'specialist',
            execute: async () => ({ text: 'result' })
        };

        let loaded = false;
        registry.registerLazy(mockAgent, async () => {
            loaded = true;
            return mockAgent;
        });

        // Before loading
        expect(loaded).toBe(false);
        const metadata = registry.getAll();
        expect(metadata.find(a => a.id === 'test-agent')).toBeDefined();

        // Load
        const agent = await registry.getAsync('test-agent');
        expect(agent).toBe(mockAgent);
        expect(loaded).toBe(true);

        // Subsequent load should behave same (cached in agents map)
        const agent2 = await registry.getAsync('test-agent');
        expect(agent2).toBe(mockAgent);
    });

    it('should return undefined for non-existent agent', async () => {
        const registry = new AgentRegistry();
        const agent = await registry.getAsync('non-existent');
        expect(agent).toBeUndefined();
    });
});
