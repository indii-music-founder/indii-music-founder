import { randomUUID } from 'node:crypto';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { JobStore } from './job.js';

const JOB_PATH = /^users\/([^/]+)\/videoRenderJobs\/[A-Za-z0-9_-]{1,128}$/;
const LEASE_MS = 31 * 60_000;

/** One execution owns one fencing token; a stale worker cannot finish a reclaimed job. */
export function createFirestoreJobStore(db: Firestore = getFirestore()): JobStore {
    const leaseToken = randomUUID();
    const ownedRef = (jobPath: string) => {
        if (!JOB_PATH.test(jobPath)) throw new Error('Invalid render job path.');
        return db.doc(jobPath);
    };
    return {
        async getJob(jobPath) {
            const jobSnapshot = await ownedRef(jobPath).get();
            const data = jobSnapshot.data();
            const owner = JOB_PATH.exec(jobPath)?.[1];
            if (!jobSnapshot.exists || !data || data.userId !== owner) throw new Error('Render job is missing or does not match its owner.');
            let project = data.projectSnapshot;
            if (!project) {
                const projectRef = db.collection('users').doc(owner!).collection('videoProjects').doc(data.projectId as string);
                const snapshot = await projectRef.get(); project = snapshot.data()?.project;
                if (!snapshot.exists || !project) throw new Error('Render project is unavailable.');
            }
            if (project.id !== data.projectId) throw new Error('Render snapshot does not match its project.');
            return {
                data: {
                    status: data.status as 'queued' | 'running' | 'completed' | 'failed',
                    projectId: data.projectId as string,
                    userId: data.userId as string,
                    ...(typeof data.leaseExpiresAtMs === 'number' ? { leaseExpiresAtMs: data.leaseExpiresAtMs } : {}),
                    ...(typeof data.outputName === 'string' ? { outputName: data.outputName } : {}),
                },
                project: project as never,
            };
        },
        async setRunning(jobPath) {
            await db.runTransaction(async tx => {
                const ref = ownedRef(jobPath);
                const data = (await tx.get(ref)).data();
                const owner = JOB_PATH.exec(jobPath)?.[1];
                const retryable = data?.status === 'running' && Number.isFinite(data.leaseExpiresAtMs) && data.leaseExpiresAtMs <= Date.now();
                if (!data || data.userId !== owner || (data.status !== 'queued' && !retryable)) throw new Error('Render job is not an owned queued or expired-lease job.');
                tx.update(ref, { status: 'running', executor: 'cloud-worker', leaseToken, leaseExpiresAtMs: Date.now() + LEASE_MS, updatedAt: FieldValue.serverTimestamp() });
            });
        },
        async setCompleted(jobPath, artifactUrl, generation) {
            await db.runTransaction(async tx => {
                const ref = ownedRef(jobPath);
                const data = (await tx.get(ref)).data();
                if (data?.status !== 'running' || data.leaseToken !== leaseToken) throw new Error('Render lease was replaced before completion.');
                tx.update(ref, { status: 'completed', artifactUrl, artifactGeneration: generation, error: null, leaseToken: FieldValue.delete(), leaseExpiresAtMs: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
            });
        },
        async setFailed(jobPath, error) {
            await db.runTransaction(async tx => {
                const ref = ownedRef(jobPath);
                const data = (await tx.get(ref)).data();
                if (data?.status !== 'running' || data.leaseToken !== leaseToken) throw new Error('Render lease was replaced before failure recording.');
                tx.update(ref, { status: 'failed', error: error.slice(0, 800), leaseToken: FieldValue.delete(), leaseExpiresAtMs: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
            });
        },
    };
}
