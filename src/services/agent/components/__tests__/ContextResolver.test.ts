import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextResolver } from '../ContextResolver';
import { useStore } from '@/core/store';

// Mock the store
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

describe('ContextResolver', () => {
    let resolver: ContextResolver;

    beforeEach(() => {
        resolver = new ContextResolver();
        vi.clearAllMocks();
    });

    it('should include whiskState in the resolved context', async () => {
        const mockWhiskState = {
            subjects: [{ id: '1', type: 'text', content: 'Test Subject', checked: true, category: 'subject' }],
            scenes: [],
            styles: [],
            preciseReference: true
        };

        const mockState = {
            currentProjectId: 'p1',
            projects: [{ id: 'p1', name: 'Test Project', type: 'music' }],
            currentOrganizationId: 'org1',
            userProfile: undefined,
            currentModule: 'creative',
            agentHistory: [],
            whiskState: mockWhiskState
        };

        (useStore.getState as any).mockReturnValue(mockState);

        const context = await resolver.resolveContext();

        expect(context.whiskState).toEqual(mockWhiskState);
        expect(context.whiskState?.preciseReference).toBe(true);
        expect(context.whiskState?.subjects[0].content).toBe('Test Subject');
    });
});
