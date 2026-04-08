import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlwaysOnMemoryEngine } from '../AlwaysOnMemoryEngine';

const mockDeleteMany = vi.fn().mockResolvedValue(undefined);
const mockUpdateMany = vi.fn().mockResolvedValue(undefined);

vi.mock('../../FirestoreService', () => ({
    FirestoreService: class {
        constructor(public collectionPath: string) {}
        constructor(public collectionPath: string) { }
        list = vi.fn().mockResolvedValue(
            Array.from({ length: 100 }, (_, i) => ({ id: `id-${this.collectionPath}-${i}` }))
        );
        deleteMany = mockDeleteMany;
        updateMany = mockUpdateMany;
    },
}));

describe('AlwaysOnMemoryEngine ClearAll Optimization Verification', () => {
    let engine: AlwaysOnMemoryEngine;
    const userId = 'test-user';

    beforeEach(() => {
        vi.clearAllMocks();
        engine = new AlwaysOnMemoryEngine();
    });

    it('should use deleteMany in clearAll', async () => {
        await engine.clearAll(userId);

        // Should call deleteMany once for each of the 3 services
        expect(mockDeleteMany).toHaveBeenCalledTimes(3);

        // Each call should have 100 IDs
        expect(mockDeleteMany.mock.calls[0][0]).toHaveLength(100);
        expect(mockDeleteMany.mock.calls[1][0]).toHaveLength(100);
        expect(mockDeleteMany.mock.calls[2][0]).toHaveLength(100);
        expect(mockDeleteMany.mock.calls[0]![0]).toHaveLength(100);
        expect(mockDeleteMany.mock.calls[1]![0]).toHaveLength(100);
        expect(mockDeleteMany.mock.calls[2]![0]).toHaveLength(100);
    });

    it('should use updateMany in markConsolidated', async () => {
        const memories = Array.from({ length: 10 }, (_, i) => ({ id: `mem-${i}` })) as any;
        // Accessing private method via bracket notation for testing
        await (engine as any).markConsolidated(userId, memories);

        expect(mockUpdateMany).toHaveBeenCalledTimes(1);
        expect(mockUpdateMany.mock.calls[0][0]).toHaveLength(10);
        expect(mockUpdateMany.mock.calls[0][0][0].data.consolidated).toBe(true);
        expect(mockUpdateMany.mock.calls[0]![0]).toHaveLength(10);
        expect(mockUpdateMany.mock.calls[0]![0][0].data.consolidated).toBe(true);
    });

    it('should use updateMany in updateAccessStats', async () => {
        const memories = Array.from({ length: 5 }, (_, i) => ({ id: `mem-${i}`, accessCount: 1 })) as any;
        await (engine as any).updateAccessStats(userId, memories);

        expect(mockUpdateMany).toHaveBeenCalledTimes(1);
        expect(mockUpdateMany.mock.calls[0][0]).toHaveLength(5);
        expect(mockUpdateMany.mock.calls[0][0][0].data.accessCount).toBe(2);
        expect(mockUpdateMany.mock.calls[0]![0]).toHaveLength(5);
        expect(mockUpdateMany.mock.calls[0]![0][0].data.accessCount).toBe(2);
    });
});
