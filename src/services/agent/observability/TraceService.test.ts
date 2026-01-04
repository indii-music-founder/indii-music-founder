import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraceService } from './TraceService';
import * as firestore from 'firebase/firestore';

// Mock Firestore modules
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(() => ({ id: 'mock-trace-id' })),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    arrayUnion: vi.fn((item) => ({ arrayUnion: item })),
    serverTimestamp: vi.fn(() => 'mock-timestamp')
}));

// Mock DB
vi.mock('@/services/firebase', () => ({
    db: {}
}));

describe('TraceService', () => {
    const mockUserId = 'test-user-123';
    const mockAgentId = 'test-agent';
    const mockInput = 'test input';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('startTrace', () => {
        it('should create a new trace document', async () => {
            const traceId = await TraceService.startTrace(mockUserId, mockAgentId, mockInput);

            expect(traceId).toBe('mock-trace-id');
            expect(firestore.setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    userId: mockUserId,
                    agentId: mockAgentId,
                    input: mockInput,
                    status: 'pending'
                })
            );
        });

        it('should return empty string if no userId', async () => {
            const traceId = await TraceService.startTrace('', mockAgentId, mockInput);
            expect(traceId).toBe('');
            expect(firestore.setDoc).not.toHaveBeenCalled();
        });
    });

    describe('addStep', () => {
        it('should add a step to the trace', async () => {
            const mockTraceId = 'trace-123';
            const mockStepContent = { thought: 'thinking...' };

            await TraceService.addStep(mockTraceId, 'thought', mockStepContent);

            expect(firestore.updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                {
                    steps: expect.objectContaining({
                        arrayUnion: expect.objectContaining({
                            type: 'thought',
                            content: mockStepContent
                        })
                    })
                }
            );
        });
    });

    describe('completeTrace', () => {
        it('should update status to completed', async () => {
            const mockTraceId = 'trace-123';
            await TraceService.completeTrace(mockTraceId, { result: 'done' });

            expect(firestore.updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    status: 'completed',
                    output: { result: 'done' }
                })
            );
        });
    });

    describe('failTrace', () => {
        it('should update status to failed', async () => {
            const mockTraceId = 'trace-123';
            await TraceService.failTrace(mockTraceId, 'Something went wrong');

            expect(firestore.updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    status: 'failed',
                    error: 'Something went wrong'
                })
            );
        });
    });
});
