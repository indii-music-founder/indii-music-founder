import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createStore, type StoreApi } from 'zustand/vanilla';

const mockGetRoomMemories = vi.hoisted(() => vi.fn().mockResolvedValue([
    {
        id: 'room-mem-1',
        userId: 'user-1',
        content: 'Use matte silver foil packaging',
        summary: 'Use matte silver foil packaging',
        rawText: 'Use matte silver foil packaging',
        category: 'creative',
        tier: 'working',
        memoryScope: 'room',
        promotedToGlobal: false,
    },
]));

const mockPromoteRoomMemoryToGlobal = vi.hoisted(() => vi.fn().mockResolvedValue({
    promoted: true,
    memoryId: 'room-mem-1',
}));

vi.mock('@/services/agent/memory/AlwaysOnMemoryEngine', () => ({
    alwaysOnMemoryEngine: {
        getRoomMemories: mockGetRoomMemories,
        addRoomMemory: vi.fn().mockResolvedValue({ status: 'stored', memoryId: 'room-mem-2' }),
        ingestFromSession: vi.fn().mockResolvedValue(1),
        promoteRoomMemoryToGlobal: mockPromoteRoomMemoryToGlobal,
        deleteMemory: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('@/services/agent/SessionService', () => ({
    sessionService: {
        createSession: vi.fn().mockResolvedValue('r1'),
        updateSession: vi.fn().mockResolvedValue(undefined),
        deleteSession: vi.fn().mockResolvedValue(undefined),
        subscribeToMessages: vi.fn(() => () => {}),
        appendMessage: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/modules/boardroom/components/BoardroomConversationPanel', () => ({
    BoardroomConversationPanel: ({
        filterSessionId,
        assetScope,
        onAssetScopeChange,
    }: {
        filterSessionId?: string;
        assetScope?: string;
        onAssetScopeChange?: (scope: 'room' | 'project') => void;
    }) => (
        <div data-testid="mock-conversation-panel">
            <span data-testid="panel-room-id">{filterSessionId}</span>
            <span data-testid="panel-asset-scope">{assetScope}</span>
            <button
                type="button"
                data-testid="toggle-scope-project"
                onClick={() => onAssetScopeChange?.('project')}
            >
                Switch Scope
            </button>
        </div>
    ),
}));

vi.mock('@/modules/boardroom/components/BoardroomWorkbenchView', () => ({
    BoardroomWorkbenchView: () => <div data-testid="mock-workbench-view" />,
}));
vi.mock('@/modules/boardroom/components/BoardroomBrowserView', () => ({
    BoardroomBrowserView: () => <div data-testid="mock-browser-view" />,
}));
vi.mock('@/modules/boardroom/components/BoardroomModulePreview', () => ({
    BoardroomModulePreview: () => <div data-testid="mock-module-preview" />,
}));
vi.mock('@/modules/boardroom/components/BoardroomAgentFeedView', () => ({
    BoardroomAgentFeedView: () => <div data-testid="mock-agent-feed" />,
}));

import { createBoardroomSlice } from '@/core/store/slices/boardroomSlice';
import { createMeetingRoomSlice } from '@/core/store/slices/meetingRoomSlice';
import { buildAgentSessionState } from '@/core/store/slices/agent/agentSessionSlice';
import { buildAgentUIState } from '@/core/store/slices/agent/agentUISlice';
import type { StoreState } from '@/core/store/types';

const testStore = vi.hoisted(() => ({
    instance: null as StoreApi<StoreState> | null,
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (s: StoreState) => unknown) => selector(testStore.instance!.getState()),
}));

import { MeetingRoomsModule } from '@/modules/meeting-rooms/MeetingRoomsModule';

function resetTestStore() {
    testStore.instance = createStore<StoreState>()((set, get, api) => {
        const ui = buildAgentUIState(set as never, get as never);
        const session = buildAgentSessionState(set as never, get as never);
        const boardroom = createBoardroomSlice(set as never, get as never, api as never);
        const meetingRoom = createMeetingRoomSlice(set, get, api);
        return {
            currentProjectId: 'proj-1',
            projects: [
                { id: 'proj-1', name: 'Debut LP', type: 'creative', orgId: 'personal', lastModified: 1, assetCount: 0 },
                { id: 'proj-2', name: 'Summer Tour', type: 'road', orgId: 'personal', lastModified: 2, assetCount: 0 },
            ],
            isCommandMenuOpen: false,
            ...ui,
            ...session,
            ...boardroom,
            ...meetingRoom,
        } as unknown as StoreState;
    });
    return testStore.instance;
}

describe('MeetingRoomsModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetTestStore();
    });

    it('renders empty state, creates a room with head + worker, toggles asset scope, and promotes room memory', async () => {
        const store = testStore.instance!;
        const { rerender } = render(<MeetingRoomsModule />);

        expect(screen.getByTestId('meeting-rooms-empty-state')).toBeDefined();

        fireEvent.click(screen.getByTestId('empty-create-meeting-room-btn'));
        expect(screen.getByTestId('create-meeting-room-modal')).toBeDefined();

        fireEvent.change(screen.getByTestId('room-title-input'), {
            target: { value: 'Tour Budget & Merch' },
        });
        fireEvent.change(screen.getByTestId('room-project-select'), {
            target: { value: 'proj-2' },
        });
        fireEvent.click(screen.getByTestId('roster-pick-finance.tax'));
        fireEvent.click(screen.getByTestId('submit-create-room-btn'));

        rerender(<MeetingRoomsModule />);

        const roomId = store.getState().activeMeetingRoomId!;
        expect(roomId).toBeTruthy();
        expect(store.getState().sessions[roomId]?.participants).toContain('finance.tax');
        expect(store.getState().sessions[roomId]?.projectId).toBe('proj-2');
        expect(screen.getByTestId('active-room-title').textContent).toBe('Tour Budget & Merch');
        expect(screen.getByTestId('panel-asset-scope').textContent).toBe('room');

        // Reassign the room to Debut LP (proj-1) via the header project selector
        fireEvent.change(screen.getByTestId('active-room-project-select'), {
            target: { value: 'proj-1' },
        });
        rerender(<MeetingRoomsModule />);
        expect(store.getState().sessions[roomId]?.projectId).toBe('proj-1');
        expect(screen.getByTestId(`room-project-badge-${roomId}`).textContent).toBe('Debut LP');

        // Open Roster Drawer and verify stationary/locked roster with no add/remove buttons
        fireEvent.click(screen.getByTestId('open-room-roster-btn'));
        rerender(<MeetingRoomsModule />);
        expect(screen.getByTestId('meeting-room-roster-drawer')).toBeDefined();
        expect(screen.getByTestId('stationary-roster-notice')).toBeDefined();
        expect(screen.getByTestId('locked-roster-agent-finance.tax')).toBeDefined();
        const lockedRosterList = screen.getByTestId('locked-roster-list');
        expect(lockedRosterList.querySelectorAll('button')).toHaveLength(0);

        fireEvent.click(screen.getByLabelText('Close roster drawer'));
        rerender(<MeetingRoomsModule />);
        expect(screen.queryByTestId('meeting-room-roster-drawer')).toBeNull();

        // Switch asset scope to All Project
        fireEvent.click(screen.getByTestId('toggle-scope-project'));
        rerender(<MeetingRoomsModule />);
        expect(screen.getByTestId('panel-asset-scope').textContent).toBe('project');

        // Open Memory Workspace tab and promote a room memory
        fireEvent.click(screen.getByTestId('room-dock-memory'));
        rerender(<MeetingRoomsModule />);

        await waitFor(() => {
            expect(screen.getByTestId('room-memory-card-room-mem-1')).toBeDefined();
        });

        fireEvent.click(screen.getByTestId('promote-memory-btn-room-mem-1'));
        await waitFor(() => {
            expect(mockPromoteRoomMemoryToGlobal).toHaveBeenCalledWith('room-mem-1', {
                writeToVaultCategory: undefined,
            });
        });
    });
});
