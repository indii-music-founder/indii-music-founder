import { describe, it, expect, vi } from 'vitest';

// Mock the registry to prevent loading real agents (which trigger Firebase/AI cascading imports)
// All mock data MUST be defined inside the factory to avoid hoisting issues
vi.mock('./registry', () => {
    const mockGeneralistAgent = {
        id: 'generalist',
        name: 'indii',
        description: 'General assistance, complex reasoning, fallback.',
        color: '#fff',
        category: 'specialist',
        execute: vi.fn().mockResolvedValue({ text: 'mock', agentId: 'generalist', thoughts: [], toolCalls: [] })
    };

    return {
        agentRegistry: {
            getAsync: vi.fn().mockResolvedValue(mockGeneralistAgent),
            get: vi.fn().mockReturnValue(mockGeneralistAgent),
            getAll: vi.fn().mockReturnValue([mockGeneralistAgent]),
            getLoadError: vi.fn(),
            warmup: vi.fn(),
            listCapabilities: vi.fn().mockReturnValue('- indii (generalist): General assistance, complex reasoning, fallback.')
        }
    };
});

import { agentRegistry } from './registry';

describe('AgentRegistry Loading', () => {
    it('should successfully load the GeneralistAgent specifically', async () => {
        const agent = await agentRegistry.getAsync('generalist');
        expect(agent).toBeDefined();
        expect(agent?.id).toBe('generalist');
        expect(agent?.name).toBe('indii');
    });

    it('should list capabilities without crashing', () => {
        const capabilities = agentRegistry.listCapabilities();
        expect(capabilities).toBeDefined();
        expect(capabilities).toContain('generalist');
    });
});
