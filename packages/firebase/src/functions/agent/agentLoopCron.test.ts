import { describe, expect, it, vi } from 'vitest';
import * as admin from 'firebase-admin';
import { AgentLoopExecutionSchema } from '@indii/shared';
import { agentLoopCron, processAgentLoopCron } from './agentLoopCron';

const scheduledFor = Date.parse('2026-11-13T12:00:00Z');
const definition = {
    trigger: 'SCHEDULE', goal: 'Review the release plan', verifiabilityCriteria: 'Return an actionable review',
    judgeMode: 'LLM_EVALUATION', maxIterations: 2,
};
function document(path: string, data: Record<string, unknown> = definition) {
    const segments = path.split('/');
    return { id: segments.at(-1)!, data: () => data, ref: { path, parent: { parent: segments.length === 4 ? { id: segments[1] } : null } } };
}
// Structural adapter only: fake records exercise enqueue contracts, not live-user behavior.
function adapter(documents: ReturnType<typeof document>[]) {
    const records = new Map<string, Record<string, unknown>>();
    const get = vi.fn(async () => ({ docs: documents }));
    const create = vi.fn(async (path: string, data: Record<string, unknown>) => {
        if (records.has(path)) throw Object.assign(new Error('already exists'), { code: 6 });
        records.set(path, structuredClone(data));
    });
    const db = {
        collectionGroup: vi.fn(() => ({ where: vi.fn(() => ({ get })) })),
        collection: vi.fn((collection: string) => {
            // Legacy root query is included so regressions run against the old implementation too.
            if (collection === 'agentLoopDefinitions') return { where: () => ({ get: async () => ({ docs: [] }) }) };
            return { doc: (userId: string) => ({ collection: (subcollection: string) => ({ doc: (id = `random-${records.size}`) => {
                const path = `${collection}/${userId}/${subcollection}/${id}`;
                return { id, path, create: (data: Record<string, unknown>) => create(path, data) };
            } }) }) };
        }),
        batch: vi.fn(() => ({ set: (ref: { path: string }, data: Record<string, unknown>) => records.set(ref.path, structuredClone(data)), commit: async () => undefined })),
    } as unknown as admin.firestore.Firestore;
    return { db, records, create, get };
}

describe('scheduled loop admission', () => {
    it('initializes a complete resumable checkpoint in the canonical tenant path', async () => {
        const { db, records } = adapter([document('users/artist/agentLoopDefinitions/release')]);
        expect(await processAgentLoopCron(db, scheduledFor)).toEqual({ scheduledCount: 1 });
        const [path, record] = [...records][0];
        expect(path).toMatch(/^users\/artist\/agentLoopExecutions\//);
        expect(AgentLoopExecutionSchema.parse(record)).toMatchObject({ scheduledFor, sourceDefinitionPath: 'users/artist/agentLoopDefinitions/release' });
        expect(record).toMatchObject({
            loopId: 'release', userId: 'artist', status: 'IDLE', currentIteration: 1,
            actionCheckpoint: { phase: 'READY', iteration: 1 }, tokenBudgetSpent: 0, checkpointRevision: 1,
            definitionSnapshot: { id: 'release', ...definition }, scheduledFor,
        });
    });
    it('does not suppress a different tenant with the same loop ID', async () => {
        const { db, records } = adapter([document('users/first/agentLoopDefinitions/release'), document('users/second/agentLoopDefinitions/release')]);
        expect((await processAgentLoopCron(db, scheduledFor)).scheduledCount).toBe(2);
        expect(new Set([...records.values()].map(record => record.userId))).toEqual(new Set(['first', 'second']));
    });
    it('cannot route a scoped definition into a payload-selected tenant', async () => {
        const { db, records } = adapter([document('users/owner/agentLoopDefinitions/release', { ...definition, userId: 'someone-else' })]);
        expect((await processAgentLoopCron(db, scheduledFor)).scheduledCount).toBe(0);
        expect(records.size).toBe(0);
    });
    it('admits owned legacy root definitions and rejects ownerless or unsupported paths', async () => {
        const { db, records } = adapter([
            document('agentLoopDefinitions/root', { ...definition, userId: 'legacy-owner' }),
            document('agentLoopDefinitions/unowned'),
            document('organizations/org/agentLoopDefinitions/other'),
        ]);
        expect((await processAgentLoopCron(db, scheduledFor)).scheduledCount).toBe(1);
        expect([...records.values()][0].userId).toBe('legacy-owner');
    });
    it('retains completed work when the same scheduled occurrence is delivered again', async () => {
        const doc = document('users/artist/agentLoopDefinitions/release');
        const { db, records } = adapter([doc, doc]);
        expect((await processAgentLoopCron(db, scheduledFor)).scheduledCount).toBe(1);
        const [path, original] = [...records][0];
        const completed = { ...original, status: 'COMPLETED', history: [{ output: 'Saved result' }] };
        records.set(path, completed);
        expect((await processAgentLoopCron(db, scheduledFor)).scheduledCount).toBe(0);
        expect(records.get(path)).toEqual(completed);
        expect((await processAgentLoopCron(db, scheduledFor + 15 * 60_000)).scheduledCount).toBe(1);
        expect(records.size).toBe(2);
    });
    it('creates only one entry for concurrent deliveries of the same occurrence', async () => {
        const { db, records } = adapter([document('users/artist/agentLoopDefinitions/release')]);
        const counts = await Promise.all([processAgentLoopCron(db, scheduledFor), processAgentLoopCron(db, scheduledFor)]);
        expect(counts.reduce((sum, result) => sum + result.scheduledCount, 0)).toBe(1);
        expect(records.size).toBe(1);
    });
    it.each([{ goal: '' }, { maxIterations: 0 }, { judgeMode: 'DETERMINISTIC_TEST' }])('rejects an unusable definition %j', async override => {
        const { db, records } = adapter([document('users/artist/agentLoopDefinitions/release', { ...definition, ...override })]);
        expect((await processAgentLoopCron(db, scheduledFor)).scheduledCount).toBe(0);
        expect(records.size).toBe(0);
    });
    it('propagates discovery and write failures instead of silently dropping tenants', async () => {
        const { db, records, get, create } = adapter([document('users/artist/agentLoopDefinitions/release')]);
        get.mockRejectedValueOnce(new Error('index unavailable'));
        await expect(processAgentLoopCron(db, scheduledFor)).rejects.toThrow();
        expect(records.size).toBe(0);
        create.mockRejectedValueOnce(Object.assign(new Error('permission denied'), { code: 7 }));
        await expect(processAgentLoopCron(db, scheduledFor)).rejects.toThrow();
        expect(records.size).toBe(0);
    });
    it('retries only missing entries after a partially successful delivery', async () => {
        const { db, records, create } = adapter([document('users/first/agentLoopDefinitions/release'), document('users/second/agentLoopDefinitions/release')]);
        create.mockRejectedValueOnce(Object.assign(new Error('temporary write failure'), { code: 14 }));
        await expect(processAgentLoopCron(db, scheduledFor)).rejects.toThrow('did not finish');
        expect(records.size).toBe(1);
        expect((await processAgentLoopCron(db, scheduledFor)).scheduledCount).toBe(1);
        expect(records.size).toBe(2);
    });
    it('uses the original scheduler time for a delayed delivery and its retry', async () => {
        const { db, records } = adapter([document('users/artist/agentLoopDefinitions/release')]);
        vi.mocked(admin.firestore).mockReturnValueOnce(db).mockReturnValueOnce(db);
        const clock = vi.spyOn(Date, 'now').mockReturnValue(scheduledFor + 60 * 60_000);
        try {
            const event = { scheduleTime: new Date(scheduledFor).toISOString() };
            await agentLoopCron.run(event);
            await agentLoopCron.run(event);
            expect(records.size).toBe(1);
            expect([...records.values()][0].scheduledFor).toBe(scheduledFor);
        } finally {
            clock.mockRestore();
        }
    });
    it('does not write for empty discovery or an invalid scheduled time', async () => {
        const { db, create } = adapter([]);
        expect((await processAgentLoopCron(db, scheduledFor)).scheduledCount).toBe(0);
        await expect(processAgentLoopCron(db, NaN)).rejects.toThrow();
        expect(create).not.toHaveBeenCalled();
    });
});
