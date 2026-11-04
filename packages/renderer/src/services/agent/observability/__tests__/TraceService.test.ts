import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraceService } from '../TraceService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { doc, setDoc, updateDoc, arrayUnion, increment, serverTimestamp, collection } from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(() => ({ id: 'mock-id' })),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    arrayUnion: vi.fn(),
    increment: vi.fn(),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
    query: vi.fn(),
    where: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user', email: 'test@example.com' }, onAuthStateChanged: vi.fn(), signInWithEmailAndPassword: vi.fn(), createUserWithEmailAndPassword: vi.fn(), signOut: vi.fn() },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

describe('TraceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('startTrace', () => {
        it('preserves the Firestore server timestamp sentinel', async () => {
            const timestamp = { isEqual: vi.fn() } as unknown as ReturnType<typeof serverTimestamp>;
            vi.mocked(serverTimestamp).mockReturnValue(timestamp);

            await TraceService.startTrace('user-1', 'orchestrator', 'Hello');

            expect(setDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ startTime: timestamp }));
        });

        it('should generate a root swarmId if none provided', async () => {
            const _traceId = await TraceService.startTrace('user-1', 'orchestrator', 'Hello');

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

    describe('addStepWithUsage', () => {
        it('appends a step and increments all usage totals in one update', async () => {
            const union = { isEqual: vi.fn() } as unknown as ReturnType<typeof arrayUnion>;
            vi.mocked(arrayUnion).mockReturnValue(union);
            vi.mocked(increment).mockImplementation(value => ({ operand: value, isEqual: vi.fn() } as unknown as ReturnType<typeof increment>));

            await TraceService.addStepWithUsage('trace-1', 'routing', { chosen: 'generalist' }, 'unknown-model', {
                promptTokenCount: 3,
                candidatesTokenCount: 2,
                totalTokenCount: 5
            });

            expect(updateDoc).toHaveBeenCalledOnce();
            expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
                steps: union,
                'totalUsage.promptTokens': expect.objectContaining({ operand: 3 }),
                'totalUsage.candidatesTokens': expect.objectContaining({ operand: 2 }),
                'totalUsage.totalTokens': expect.objectContaining({ operand: 5 }),
                'totalUsage.estimatedCost': expect.objectContaining({ operand: 0 })
            });
            expect(arrayUnion).toHaveBeenCalledWith(expect.objectContaining({ type: 'routing' }));
        });

        it('uses one append when the step has no usage', async () => {
            const union = { isEqual: vi.fn() } as unknown as ReturnType<typeof arrayUnion>;
            vi.mocked(arrayUnion).mockReturnValue(union);

            await TraceService.addStep('trace-1', 'thought', 'No model usage');

            expect(updateDoc).toHaveBeenCalledOnce();
            expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { steps: union });
            expect(increment).not.toHaveBeenCalled();
        });

        it('preserves the server timestamp sentinel on completion', async () => {
            const timestamp = { isEqual: vi.fn() } as unknown as ReturnType<typeof serverTimestamp>;
            vi.mocked(serverTimestamp).mockReturnValue(timestamp);

            await TraceService.completeTrace('trace-1', 'done');

            expect(updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                endTime: timestamp,
                output: 'done'
            }));
        });
    });
});
