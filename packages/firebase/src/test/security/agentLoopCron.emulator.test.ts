import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { AgentLoopExecutionSchema } from '@indii/shared';
import { agentLoopCron, processAgentLoopCron } from '../../functions/agent/agentLoopCron';

// Real SDK + isolated emulator, with synthetic definitions. This establishes
// structural queue behavior only; it is not a real-user or production test.
const projectId = 'demo-indii-scheduled-loop-structural';
const scheduledFor = Date.parse('2026-11-13T12:00:00Z');
const definition = {
    trigger: 'SCHEDULE', goal: 'Review a release plan', verifiabilityCriteria: 'Return concrete next steps',
    judgeMode: 'LLM_EVALUATION', maxIterations: 2,
};

describe('scheduled loop atomic admission (isolated emulator)', () => {
    let app: App;
    let db: Firestore;
    beforeAll(() => {
        if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')) {
            throw new Error('This structural test requires an explicitly configured local Firestore emulator.');
        }
        app = initializeApp({ projectId }, 'scheduled-loop-structural');
        db = getFirestore(app);
    });
    beforeEach(async () => {
        for (const collection of await db.listCollections()) await db.recursiveDelete(collection);
    });
    afterAll(async () => {
        if (db) {
            for (const collection of await db.listCollections()) await db.recursiveDelete(collection);
            await db.terminate();
        }
        if (app) await deleteApp(app);
    });
    it('declares a UTC unix-cron schedule that supplies a stable occurrence time', () => {
        expect(agentLoopCron.__endpoint.scheduleTrigger).toMatchObject({ schedule: '*/15 * * * *', timeZone: 'UTC' });
    });
    it('admits each tenant once under concurrent deliveries and preserves completed work', async () => {
        await Promise.all([
            db.doc('users/first/agentLoopDefinitions/release').set(definition),
            db.doc('users/second/agentLoopDefinitions/release').set(definition),
            db.doc('agentLoopDefinitions/legacy').set({ ...definition, userId: 'legacy-owner' }),
        ]);
        const deliveries = await Promise.all([processAgentLoopCron(db, scheduledFor), processAgentLoopCron(db, scheduledFor)]);
        expect(deliveries.reduce((sum, result) => sum + result.scheduledCount, 0)).toBe(3);
        const entries = await db.collectionGroup('agentLoopExecutions').get();
        expect(entries.size).toBe(3);
        for (const entry of entries.docs) {
            expect(AgentLoopExecutionSchema.parse(entry.data())).toMatchObject({ scheduledFor, sourceDefinitionPath: expect.stringContaining('agentLoopDefinitions/') });
            expect(entry.data()).toMatchObject({ currentIteration: 1, tokenBudgetSpent: 0, checkpointRevision: 1, actionCheckpoint: { phase: 'READY', iteration: 1 } });
        }
        const completed = entries.docs[0];
        await completed.ref.update({ status: 'COMPLETED', history: [{ output: 'Result retained' }] });
        expect((await processAgentLoopCron(db, scheduledFor)).scheduledCount).toBe(0);
        expect((await completed.ref.get()).data()?.status).toBe('COMPLETED');
        expect((await processAgentLoopCron(db, scheduledFor + 15 * 60_000)).scheduledCount).toBe(3);
        expect((await db.collectionGroup('agentLoopExecutions').get()).size).toBe(6);
    });
    it('refuses a forged tenant field and an ownerless root definition', async () => {
        await Promise.all([
            db.doc('users/owner/agentLoopDefinitions/release').set({ ...definition, userId: 'different-owner' }),
            db.doc('agentLoopDefinitions/unowned').set(definition),
        ]);
        expect((await processAgentLoopCron(db, scheduledFor)).scheduledCount).toBe(0);
        expect((await db.collectionGroup('agentLoopExecutions').get()).empty).toBe(true);
    });
});
