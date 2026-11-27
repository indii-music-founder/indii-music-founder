import { describe, expect, it } from 'vitest';
import {
    BOARDROOM_CONDUCTOR_ID,
    isValidMeetingRoomAgentId,
    listMeetingRoomSelectableDepartments,
    normalizeBoardroomAgentIds,
    normalizeMeetingRoomAgentIds,
} from '@/services/agent/departments';

describe('Meeting Room department & worker roster rules', () => {
    it('keeps Boardroom HQ normalization strictly head-only and Conductor-inclusive only when seated', () => {
        expect(normalizeBoardroomAgentIds(['creative', 'finance.tax', 'legal.contracts', 'invalid'])).toEqual([
            'creative',
        ]);
        expect(normalizeBoardroomAgentIds([BOARDROOM_CONDUCTOR_ID, 'creative', 'finance.tax'])).toEqual([
            BOARDROOM_CONDUCTOR_ID,
            'creative',
        ]);
    });

    it('allows seating department heads AND scoped workers in Meeting Rooms', () => {
        expect(isValidMeetingRoomAgentId('creative')).toBe(true);
        expect(isValidMeetingRoomAgentId('finance.tax')).toBe(true);
        expect(isValidMeetingRoomAgentId('legal.contracts')).toBe(true);
        expect(isValidMeetingRoomAgentId('generalist')).toBe(true);
        expect(isValidMeetingRoomAgentId('nonexistent.worker')).toBe(false);

        expect(
            normalizeMeetingRoomAgentIds(
                ['creative', 'finance.tax', 'creative', 'legal.contracts', 'bogus'],
                { includeConductor: true }
            )
        ).toEqual(['generalist', 'creative', 'finance.tax', 'legal.contracts']);
    });

    it('omits Indii Conductor when includeConductor is false', () => {
        expect(
            normalizeMeetingRoomAgentIds(['generalist', 'creative', 'finance.tax'], {
                includeConductor: false,
            })
        ).toEqual(['creative', 'finance.tax']);
    });

    it('lists departments with their heads and scoped worker IDs for roster selection', () => {
        const selectable = listMeetingRoomSelectableDepartments();
        const finance = selectable.find(d => d.id === 'finance');
        const legal = selectable.find(d => d.id === 'legal');
        expect(finance?.headId).toBe('finance');
        expect(finance?.workerIds).toEqual(expect.arrayContaining(['finance.accounting', 'finance.tax', 'finance.royalty']));
        expect(legal?.workerIds).toEqual(expect.arrayContaining(['legal.contracts', 'legal.compliance']));
    });
});
