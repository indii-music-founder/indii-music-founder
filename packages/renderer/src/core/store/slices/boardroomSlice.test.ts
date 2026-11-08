import { createStore } from 'zustand/vanilla';
import { describe, expect, it } from 'vitest';
import { listHeadIds, listWorkerIds } from '@/services/agent/departments';
import { BoardroomSlice, createBoardroomSlice } from './boardroomSlice';

function createBoardroomStore() {
    return createStore<BoardroomSlice>()(createBoardroomSlice);
}

describe('Boardroom canonical department-head seating', () => {
    it('atomically retains the conductor and seats each of the 23 canonical heads once', () => {
        const store = createBoardroomStore();
        store.setState({
            activeAgents: ['generalist', 'finance', 'finance', 'finance.tax', 'unknown-agent'],
        });

        const result = store.getState().seatAllDepartmentHeads();
        const activeAgents = store.getState().activeAgents;

        expect(result).toEqual({
            seatedCount: 23,
            newlySeatedCount: 22,
            stateChanged: true,
            idempotent: false,
        });
        expect(activeAgents).toEqual([
            'generalist',
            'finance',
            ...listHeadIds().filter(agentId => agentId !== 'finance'),
        ]);
        expect(new Set(activeAgents).size).toBe(24);
        expect(activeAgents).not.toContain('unknown-agent');
        for (const workerId of listWorkerIds()) {
            expect(activeAgents).not.toContain(workerId);
        }
    });

    it('preserves the first occurrence and order of permitted existing members', () => {
        const store = createBoardroomStore();
        store.setState({
            activeAgents: ['legal', 'generalist', 'finance', 'legal', 'finance.tax', 'unknown-agent'],
        });

        store.getState().seatAllDepartmentHeads();

        expect(store.getState().activeAgents.slice(0, 3)).toEqual(['legal', 'generalist', 'finance']);
        expect(store.getState().activeAgents).toHaveLength(24);
    });

    it('restores the conductor and canonical heads from an empty roster idempotently', () => {
        const store = createBoardroomStore();
        store.setState({ activeAgents: [] });

        const firstResult = store.getState().seatAllDepartmentHeads();
        const afterFirst = store.getState();

        expect(afterFirst.activeAgents).toEqual(['generalist', ...listHeadIds()]);
        expect(new Set(afterFirst.activeAgents).size).toBe(24);
        expect(firstResult).toEqual({
            seatedCount: 23,
            newlySeatedCount: 23,
            stateChanged: true,
            idempotent: false,
        });

        const secondResult = store.getState().seatAllDepartmentHeads();
        expect(store.getState()).toBe(afterFirst);
        expect(secondResult).toEqual({
            seatedCount: 23,
            newlySeatedCount: 0,
            stateChanged: false,
            idempotent: true,
        });
    });

    it('replaces a worker-only roster with one conductor and 23 unique heads idempotently', () => {
        const store = createBoardroomStore();
        store.setState({ activeAgents: ['finance.tax', 'finance.tax', 'unknown-agent'] });

        store.getState().seatAllDepartmentHeads();
        const afterFirst = store.getState();

        expect(afterFirst.activeAgents).toEqual(['generalist', ...listHeadIds()]);
        expect(afterFirst.activeAgents.filter(agentId => agentId === 'generalist')).toHaveLength(1);
        expect(new Set(afterFirst.activeAgents).size).toBe(24);
        expect(afterFirst.activeAgents).not.toContain('finance.tax');
        expect(afterFirst.activeAgents).not.toContain('unknown-agent');

        const secondResult = store.getState().seatAllDepartmentHeads();
        expect(store.getState()).toBe(afterFirst);
        expect(secondResult).toMatchObject({
            newlySeatedCount: 0,
            stateChanged: false,
            idempotent: true,
        });
    });

    it('is idempotent and preserves the state reference when the roster is already canonical', () => {
        const store = createBoardroomStore();
        store.getState().seatAllDepartmentHeads();
        const before = store.getState();

        const result = store.getState().seatAllDepartmentHeads();

        expect(result).toEqual({
            seatedCount: 23,
            newlySeatedCount: 0,
            stateChanged: false,
            idempotent: true,
        });
        expect(store.getState()).toBe(before);
    });

    it('supports console solo mode and toggling agents cleanly', () => {
        const store = createBoardroomStore();
        expect(store.getState().activeAgents).toEqual(['generalist']);

        // Solo finance
        store.getState().soloAgent('finance');
        expect(store.getState().activeAgents).toEqual(['finance']);

        // Unsolo finance (restores Conductor + finance)
        store.getState().soloAgent('finance');
        expect(store.getState().activeAgents).toEqual(['generalist', 'finance']);

        // Solo generalist
        store.getState().soloAgent('generalist');
        expect(store.getState().activeAgents).toEqual(['generalist']);

        // Toggle generalist off for specialist-only direct session
        store.getState().toggleAgent('generalist');
        expect(store.getState().activeAgents).toEqual([]);
    });

    it('manages Boardroom expandable split / tabbed workspace state and actions', () => {
        const store = createBoardroomStore();

        // Initial default state
        expect(store.getState().boardroomWorkspaceLayout).toBe('closed');
        expect(store.getState().boardroomWorkspaceTab).toBe('browser');
        expect(store.getState().boardroomBrowserUrl).toBe('https://artists.spotify.com');
        expect(store.getState().boardroomPreviewModuleId).toBe('creative');
        expect(store.getState().boardroomWorkbenchTarget).toBeNull();

        // Setting layout explicitly
        store.getState().setBoardroomWorkspaceLayout('split');
        expect(store.getState().boardroomWorkspaceLayout).toBe('split');

        // Setting tab auto-opens split layout if closed
        store.getState().setBoardroomWorkspaceLayout('closed');
        store.getState().setBoardroomWorkspaceTab('module');
        expect(store.getState().boardroomWorkspaceLayout).toBe('split');
        expect(store.getState().boardroomWorkspaceTab).toBe('module');

        // Open Boardroom browser with custom URL and stage layout
        store.getState().openBoardroomBrowser('https://members.ascap.com', 'stage');
        expect(store.getState().boardroomWorkspaceLayout).toBe('stage');
        expect(store.getState().boardroomWorkspaceTab).toBe('browser');
        expect(store.getState().boardroomBrowserUrl).toBe('https://members.ascap.com');
        expect(store.getState().boardroomBrowserHistory).toContain('https://members.ascap.com');

        // Open Studio module preview
        store.getState().openBoardroomModulePreview('publishing', 'split');
        expect(store.getState().boardroomWorkspaceLayout).toBe('split');
        expect(store.getState().boardroomWorkspaceTab).toBe('module');
        expect(store.getState().boardroomPreviewModuleId).toBe('publishing');

        // Open Workbench targeting an asset
        store.getState().openBoardroomWorkbench({ kind: 'asset', itemId: 'art-001' });
        expect(store.getState().boardroomWorkspaceTab).toBe('workbench');
        expect(store.getState().boardroomWorkbenchTarget).toEqual({ kind: 'asset', itemId: 'art-001' });

        // Open Agent Feed
        store.getState().openBoardroomAgentFeed('stage');
        expect(store.getState().boardroomWorkspaceLayout).toBe('stage');
        expect(store.getState().boardroomWorkspaceTab).toBe('agent-feed');
    });
});
