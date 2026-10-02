import React, { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import type { WorkflowExecution } from '@indii/shared';
import { auth, db } from '@/services/firebase';
import { workflowStateService } from '@/services/agent/WorkflowStateService';
import { getWorkflowHistorySummary, parseWorkflowHistoryRecord } from '@/services/agent/WorkflowHistory';

export function WorkflowExecutionHistory({ userId, projectId }: { userId: string; projectId: string }) {
    const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
    const [loading, setLoading] = useState(true);
    const [readError, setReadError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [pending, setPending] = useState<string | null>(null);
    const [truncated, setTruncated] = useState(false);
    const [serverConfirmed, setServerConfirmed] = useState(false);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        setLoading(true);
        setReadError(null);
        setExecutions([]);
        setServerConfirmed(false);
        const failed = () => {
            setExecutions([]);
            setLoading(false);
            setServerConfirmed(false);
            setReadError('Saved workflow results could not be loaded. Check your connection and sign-in.');
        };
        if (auth.currentUser?.uid !== userId) {
            failed();
            return;
        }
        return onSnapshot(query(collection(db, 'users', userId, 'workflowExecutions'),
            where('sessionId', '==', projectId), orderBy('updatedAt', 'desc'), limit(51)), { includeMetadataChanges: true }, snapshot => {
            try {
                if (auth.currentUser?.uid !== userId) throw new Error('Workflow owner changed.');
                const records = snapshot.docs.slice(0, 50).map(doc => parseWorkflowHistoryRecord(userId, projectId, doc.id, doc.data()));
                setExecutions(records.sort((a, b) => b.updatedAt - a.updatedAt));
                setTruncated(snapshot.size > 50);
                setServerConfirmed(!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites);
                setReadError(null);
                setLoading(false);
            } catch { failed(); }
        }, failed);
    }, [userId, projectId, reload]);

    async function manage(id: string, action: 'cancel' | 'resume') {
        if (pending || !serverConfirmed || readError) return;
        setPending(id);
        setMessage(null);
        try {
            if (action === 'cancel') await workflowStateService.cancelExecution(userId, id);
            else await workflowStateService.resumeExecution(userId, id);
            setMessage(`${action === 'cancel' ? 'Cancellation' : 'Resume'} request saved. Status updates come from the server.`);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Workflow action failed.');
        } finally { setPending(null); }
    }

    return <section aria-label="Saved workflow results" className="border-t border-white/10 pt-4 space-y-3 text-sm">
        <h4 className="font-semibold text-white">Saved workflow results</h4>
        <p className="text-xs text-gray-400">Current project only. Outputs are drafts for review; a completed preparation workflow does not mean a campaign launched.</p>
        {loading && <p role="status">Loading saved workflows…</p>}
        {!loading && !readError && !serverConfirmed && <p role="status">Waiting for server confirmation. Cached status may be out of date; workflow actions are unavailable.</p>}
        {readError && <div role="alert"><p>{readError}</p><button onClick={() => setReload(value => value + 1)} className="text-indigo-300">Retry loading</button></div>}
        {!loading && !readError && serverConfirmed && executions.length === 0 && <p>No saved workflows for this project.</p>}
        {truncated && !readError && <p>Showing the 50 most recently updated workflows. This is a partial history.</p>}
        {message && <p role="status">{message}</p>}
        {!readError && executions.map(execution => {
            const summary = getWorkflowHistorySummary(execution);
            return <article key={execution.id} className="rounded-lg border border-white/10 p-3 space-y-2">
                <h5 className="font-medium text-white">{execution.workflowId.replaceAll('_', ' ')}</h5>
                <p className="text-xs break-all text-gray-400">{execution.id}</p>
                <p>{serverConfirmed ? 'Server status' : 'Last saved status'}: {execution.status.replaceAll('_', ' ').toLowerCase()}</p>
                <p>{summary.finished} of {summary.total} steps finished</p>
                {!summary.completionEvidenceConsistent && <p role="alert">Completion needs review: step evidence is incomplete.</p>}
                {execution.error && <p className="text-red-300">{execution.error}</p>}
                <div className="flex gap-3">
                    {summary.canCancel && <button disabled={pending !== null || !serverConfirmed} onClick={() => void manage(execution.id, 'cancel')} className="text-indigo-300 disabled:opacity-50">Cancel workflow</button>}
                    {summary.canResume && <button disabled={pending !== null || !serverConfirmed} onClick={() => void manage(execution.id, 'resume')} className="text-indigo-300 disabled:opacity-50">Resume failed steps</button>}
                </div>
                {pending === execution.id && <p role="status">Saving request…</p>}
                {Object.values(execution.steps).map(step => <details key={step.stepId} className="border-t border-white/5 pt-2">
                    <summary className="cursor-pointer">{step.agentId}: {step.status.replaceAll('_', ' ').toLowerCase()}</summary>
                    {step.error && <p className="text-red-300">{step.error}</p>}
                    {step.result !== undefined ? <pre className="whitespace-pre-wrap break-words text-xs text-gray-300 mt-2">{step.result}</pre> : <p className="text-xs text-gray-400">No saved output for this step.</p>}
                </details>)}
            </article>;
        })}
    </section>;
}
