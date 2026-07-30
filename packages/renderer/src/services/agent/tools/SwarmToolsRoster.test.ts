import { beforeEach, describe, expect, it, vi } from 'vitest';

const seatAllDepartmentHeads = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({ seatAllDepartmentHeads }),
    },
}));

describe('seat_all_department_heads', () => {
    beforeEach(() => {
        seatAllDepartmentHeads.mockReset();
    });

    it('accepts no caller roster and truthfully reports the store result without agent fanout', async () => {
        seatAllDepartmentHeads.mockReturnValue({
            seatedCount: 23,
            newlySeatedCount: 23,
            stateChanged: true,
            idempotent: false,
        });
        const { seat_all_department_heads } = await import('./SwarmTools');

        const result = await seat_all_department_heads({});

        expect(seatAllDepartmentHeads).toHaveBeenCalledOnce();
        expect(seatAllDepartmentHeads).toHaveBeenCalledWith();
        expect(result.success).toBe(true);
        expect(result.data).toEqual({
            seatedCount: 23,
            newlySeatedCount: 23,
            stateChanged: true,
            idempotent: false,
        });
    });

    it('reports an idempotent repeated call as already seated with zero additions', async () => {
        seatAllDepartmentHeads.mockReturnValue({
            seatedCount: 23,
            newlySeatedCount: 0,
            stateChanged: false,
            idempotent: true,
        });
        const { seat_all_department_heads } = await import('./SwarmTools');

        const result = await seat_all_department_heads({});

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
            seatedCount: 23,
            newlySeatedCount: 0,
            stateChanged: false,
            idempotent: true,
        });
        expect(result.message).toContain('already seated');
    });

    it('rejects caller-supplied targets without touching the store', async () => {
        const { seat_all_department_heads } = await import('./SwarmTools');

        const result = await seat_all_department_heads(
            { agentIds: ['finance'] } as unknown as Record<string, never>
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('accepts no arguments');
        expect(seatAllDepartmentHeads).not.toHaveBeenCalled();
    });
});
