import { vi } from 'vitest';

export function createMeetingRoomStoreMock() {
    return {
        activeMeetingRoomId: null,
        meetingRoomWorkspaceLayout: 'closed',
        meetingRoomWorkspaceTab: 'memory',
        meetingRoomAssetScope: 'room',
        meetingRoomWorkbenchTarget: null,
        meetingRoomRoundtableStatus: null,
        createMeetingRoom: vi.fn(),
        selectMeetingRoom: vi.fn(),
        leaveMeetingRoomContext: vi.fn(),
        assignMeetingRoomToProject: vi.fn(),
        updateMeetingRoomConfig: vi.fn().mockResolvedValue(undefined),
        pinAssetToMeetingRoom: vi.fn().mockResolvedValue(undefined),
        unpinAssetFromMeetingRoom: vi.fn().mockResolvedValue(undefined),
        archiveMeetingRoom: vi.fn(),
        deleteMeetingRoom: vi.fn(),
        setMeetingRoomWorkspaceLayout: vi.fn(),
        setMeetingRoomWorkspaceTab: vi.fn(),
        setMeetingRoomAssetScope: vi.fn(),
        setMeetingRoomWorkbenchTarget: vi.fn(),
        openMeetingRoomWorkbench: vi.fn(),
        setMeetingRoomRoundtableStatus: vi.fn(),
    };
}
