import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextResolver } from '@/services/agent/components/ContextResolver';
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

    it('uses the requested room history and project when another room is selected', async () => {
        const messages = [{ id: 'original', role: 'user', text: 'Original room prompt', timestamp: 1 }];
        vi.mocked(useStore.getState).mockReturnValue({
            currentModule: 'meeting-rooms',
            currentProjectId: 'other-project',
            activeMeetingRoomId: 'other-room',
            agentHistory: [{ id: 'other', role: 'user', text: 'Other room prompt', timestamp: 2 }],
            sessions: {
                'other-room': { id: 'other-room', namespace: 'meeting-room', projectId: 'other-project' },
                'pinned-room': { id: 'pinned-room', namespace: 'meeting-room', messages },
            },
        } as unknown as ReturnType<typeof useStore.getState>);

        const result = await resolver.resolveContext('pinned-room');

        expect(result.meetingRoomSessionId).toBe('pinned-room');
        expect(result.projectId).toBeUndefined();
        expect(result.chatHistory).toEqual(messages);
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

        vi.mocked(useStore.getState).mockReturnValue(mockState as unknown as Awaited<ReturnType<typeof useStore.getState>>);

        const context = await resolver.resolveContext();

        expect(context.whiskState).toEqual(mockWhiskState);
        expect(context.whiskState?.preciseReference).toBe(true);
        expect(context!.whiskState?.subjects[0]!.content).toBe('Test Subject');
    });
});
