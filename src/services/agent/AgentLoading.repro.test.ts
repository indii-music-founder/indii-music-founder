import { describe, it, expect, vi } from 'vitest';
import { agentRegistry } from './registry';

// Mock dependencies to avoid full environment/firebase setup issues in unit tests
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user' } },
    db: {}
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            currentOrganizationId: 'org-1',
            uploadedImages: []
        })
    }
}));

describe('AgentRegistry Loading', () => {
    it('should successfully load the GeneralistAgent specifically', async () => {
        console.log('Attempting to load generalist agent...');
        try {
            const agent = await agentRegistry.getAsync('generalist');
            expect(agent).toBeDefined();
            expect(agent?.id).toBe('generalist');
            expect(agent?.name).toBe('Agent Zero');
            console.log('Generalist agent loaded successfully');
        } catch (error) {
            console.error('Failed to load generalist agent:', error);
            throw error;
        }
    });

    it('should list capabilities without crashing', () => {
        const capabilities = agentRegistry.listCapabilities();
        expect(capabilities).toBeDefined();
        console.log('Capabilities:', capabilities);
    });
});
