import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { GoogleAuth } from 'google-auth-library';
import { RightsId, rightsSessionStopReason, filingStateAfterBrowserLoss, type RightsLifecycleSession, type FilingState } from '@indii/shared';

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

/** The capacity registry bounds the sweep to five sessions; no collection-group scan is needed. */
export async function reconcileRightsSessions(): Promise<void> {
  const db = getFirestore();
  const capacityRef = db.doc('rightsInfrastructure/capacity');
  const active = (await capacityRef.get()).data()?.active ?? {};
  for (const [id, reservation] of Object.entries(active)) {
    if (!RightsId.safeParse(id).success) continue;
    const uid = (reservation as { uid?: unknown }).uid;
    if (!RightsId.safeParse(uid).success) continue;
    const ref = db.doc(`users/${uid}/rightsSessions/${id}`);
    const session = (await ref.get()).data();
    if (!session) continue; // Missing execution provenance needs operator review, never silent release.
    const reason = rightsSessionStopReason(session as RightsLifecycleSession, Date.now());
    if (!reason && session.state !== 'termination_pending') continue;
    await db.runTransaction(async tx => {
      const live = (await tx.get(ref)).data();
      if (!live || ['ended', 'failed'].includes(live.state)) return;
      const liveReason = rightsSessionStopReason(live as RightsLifecycleSession, Date.now());
      if (!liveReason && live.state !== 'termination_pending') return;
      const filingRef = db.doc(`users/${uid}/rightsFilings/${live.filingId}`);
      const filing = (await tx.get(filingRef)).data();
      tx.update(ref, { state: 'termination_pending', requestedControl: 'end', control: 'none',
        controlGeneration: live.controlGeneration + (live.state === 'termination_pending' ? 0 : 1),
        stopReason: live.stopReason ?? liveReason ?? 'worker_lost', updatedAt: FieldValue.serverTimestamp() });
      if (filing?.state === 'in_progress') tx.update(filingRef, { state: filingStateAfterBrowserLoss(filing.state as FilingState) });
      if (live.state !== 'termination_pending') tx.create(ref.collection('events').doc(), { type: 'termination_requested', reason: liveReason, at: FieldValue.serverTimestamp() });
    });
    // Cloud state is read only after revoking the session. Never start another Job here.
    try {
      const job = session.jobResource as string | undefined;
      if (!job || !/^projects\/[A-Za-z0-9_-]+\/locations\/[a-z0-9-]+\/jobs\/[a-z0-9-]+$/.test(job)) continue;
      let execution = typeof session.cloudExecutionId === 'string' && /^[a-z0-9-]+$/.test(session.cloudExecutionId) ? `${job}/executions/${session.cloudExecutionId}` : undefined;
      let launchRejected = false;
      if (!execution && typeof session.operationName === 'string' && /^projects\/[A-Za-z0-9_-]+\/locations\/[a-z0-9-]+\/operations\/[A-Za-z0-9_-]+$/.test(session.operationName)) {
        const operation = (await auth.request<{ done?: boolean; error?: unknown; metadata?: { name?: string }; response?: { name?: string } }>({ url: `https://run.googleapis.com/v2/${session.operationName}` })).data;
        const name = operation.response?.name ?? operation.metadata?.name;
        if (name?.startsWith(`${job}/executions/`) && /^[a-z0-9-]+$/.test(name.slice(`${job}/executions/`.length))) execution = name;
        launchRejected = operation.done === true && Boolean(operation.error) && !execution;
      }
      let completed = launchRejected;
      if (execution) {
        const current = (await auth.request<{ completionTime?: string }>({ url: `https://run.googleapis.com/v2/${execution}` })).data;
        completed = Boolean(current.completionTime);
        if (!completed) {
          await auth.request({ method: 'POST', url: `https://run.googleapis.com/v2/${execution}:cancel`, data: {} });
          await ref.update({ cancelRequestedAt: FieldValue.serverTimestamp() });
        }
      }
      if (!completed) continue;
      await db.runTransaction(async tx => {
        const live = (await tx.get(ref)).data();
        const capacity = (await tx.get(capacityRef)).data() ?? {};
        if (!live || live.state !== 'termination_pending') return;
        const remaining = { ...(capacity.active ?? {}) }; delete remaining[id];
        tx.update(ref, { state: 'ended', control: 'none', requestedControl: FieldValue.delete(), endedAt: FieldValue.serverTimestamp(), terminationProof: 'execution_completed' });
        tx.set(capacityRef, { active: remaining });
        tx.create(ref.collection('events').doc(), { type: 'execution_completed', at: FieldValue.serverTimestamp() });
      });
    } catch {
      // Preserve capacity and uncertainty on IAM/network/provider failures; retry observation only.
      await ref.update({ reconciliationError: 'EXECUTION_STATUS_UNCONFIRMED' });
    }
  }
}

export const reconcileRightsSessionsScheduled = onSchedule({ schedule: 'every 1 minutes', region: 'us-central1', memory: '512MiB', timeoutSeconds: 120 }, reconcileRightsSessions);
