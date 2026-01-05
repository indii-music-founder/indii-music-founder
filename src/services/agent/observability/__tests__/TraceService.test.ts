import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraceService } from '../TraceService';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(() => ({ id: 'mock-id' })),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    arrayUnion: vi.fn(),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
    query: vi.fn(),
    where: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    db: {}
}));

describe('TraceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('startTrace', () => {
        it('should generate a root swarmId if none provided', async () => {
            const traceId = await TraceService.startTrace('user-1', 'orchestrator', 'Hello');

            expect(setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    swarmId: 'mock-id'
                })
            );
        });

        it('should propagate swarmId from metadata', async () => {
            await TraceService.startTrace('user-1', 'legal', 'Fix contract', {
                swarmId: 'root-swarm-id'
            });

            expect(setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    swarmId: 'root-swarm-id'
                })
            );
        });

        it('should handle parentTraceId but nullify swarmId if not provided (root-relative)', async () => {
            // If parentTraceId provided but no swarmId in metadata, it falls to metadata?.swarmId || (parent ? null : self)
            // This is slightly subtle in the implementation: swarmId: metadata?.swarmId || (parentTraceId ? null : traceId)
            await TraceService.startTrace('user-1', 'finance', 'Check balance', {}, 'parent-id');

            expect(setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    swarmId: null
                })
            );
        });
    });
});
