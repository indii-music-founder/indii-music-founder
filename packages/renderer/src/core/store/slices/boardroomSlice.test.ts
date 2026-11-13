import { createStore } from 'zustand/vanilla';
import { describe, expect, it } from 'vitest';
import {
    listHeadIds,
    listWorkerIds,
    normalizeBoardroomAgentIds,
} from '@/services/agent/departments';
import { BoardroomSlice, createBoardroomSlice } from './boardroomSlice';

function createBoardroomStore() {
    return createStore<BoardroomSlice>()(createBoardroomSlice);
}

describe('Boardroom canonical department-head seating', () => {
    it.each([
        ['URL-restored state', ['finance.tax', 'legal']],
        ['persisted state', ['legal.contracts', 'finance', 'unknown-agent']],
        ['tool payload', ['finance.accounting', 'social', 'social']],
    ])('rejects worker IDs received through %s', (_source, agentIds) => {
        const normalized = normalizeBoardroomAgentIds(agentIds);

        expect(normalized[0]).toBe('generalist');
        expect(normalized).not.toContain('finance.tax');
        expect(normalized).not.toContain('legal.contracts');
        expect(normalized).not.toContain('finance.accounting');
        expect(normalized).not.toContain('unknown-agent');
        expect(new Set(normalized).size).toBe(normalized.length);
    });

    it('rejects worker and unknown identifiers while preserving the conductor', () => {
        const store = createBoardroomStore();

        store.getState().addActiveAgent('finance.tax');
        store.getState().addActiveAgent('unknown-agent');
        store.getState().toggleAgent('legal.contracts');
        store.getState().removeActiveAgent('generalist');

        expect(store.getState().activeAgents).toEqual(['generalist']);
    });

    it('adds and removes managers idempotently and sanitizes restored state', () => {
        const store = createBoardroomStore();
        store.setState({ activeAgents: ['finance.tax', 'generalist', 'legal', 'legal', 'unknown-agent'] });

        store.getState().addActiveAgent('legal');
        expect(store.getState().activeAgents).toEqual(['generalist', 'legal']);

        const afterSanitize = store.getState();
        store.getState().addActiveAgent('legal');
        expect(store.getState()).toBe(afterSanitize);

        store.getState().removeActiveAgent('legal');
        expect(store.getState().activeAgents).toEqual(['generalist']);

        const afterRemove = store.getState();
        store.getState().removeActiveAgent('legal');
        expect(store.getState()).toBe(afterRemove);
    });

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

        expect(store.getState().activeAgents.slice(0, 3)).toEqual(['generalist', 'legal', 'finance']);
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
});
