/**
 * ToolApprovalService — real pre-execution approve/resume flow (ISSUE-1116).
 *
 * Prior state: `ToolRiskRegistry.requiresApproval` was pure metadata. Nothing in
 * BaseAgent.ts's tool-dispatch loop read it before executing a tool — a
 * `requiresApproval: true` classification (execute_code, rotate_credentials,
 * computer_click/type/key/scroll/drive, ...) had zero real effect. The existing
 * `AWAITING_HUMAN`/`AWAITING_USER_APPROVAL` halt pattern in BaseAgent.ts was also a
 * dead end — grep confirms no renderer code ever consumed that status to show an
 * approve action or resume the paused call. Same for DigitalHandshake's
 * `pingMemoryInbox` writes (A2A-only, and also has no UI consumer).
 *
 * This service is the real fix: a persisted pending-approval record, and an
 * `approve()` that executes the EXACT original tool call (not a re-run of the LLM
 * turn, which could reason differently second time around) once a human says yes.
 *
 * Collection: users/{uid}/tool_approvals/{approvalId}
 */
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { getRealAuthenticatedUserId } from '@/utils/authGuards';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';
import type { ToolFunctionResult, ToolFunctionArgs } from '../types';
import type { ToolRiskTier } from '../types';

export interface PendingToolApproval {
    id?: string;
    agentId: string;
    toolName: string;
    args: ToolFunctionArgs;
    riskTier: ToolRiskTier;
    description: string;
    status: 'pending' | 'approved' | 'denied' | 'executed' | 'failed';
    createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
    resolvedAt?: Timestamp | ReturnType<typeof serverTimestamp>;
    denyReason?: string;
    /** Populated after execution — never before. Absence means the action has not run. */
    result?: { success: boolean; error?: string };
}

function getUserId(): string | null {
    return getRealAuthenticatedUserId(auth.currentUser);
}

function getApprovalsRef() {
    if (isFirebaseE2EMockEnabled()) return null;
    const uid = getUserId();
    if (!uid) return null;
    return collection(db, 'users', uid, 'tool_approvals');
}

class ToolApprovalService {
    /**
     * Called by BaseAgent.ts BEFORE executing a requiresApproval:true tool.
     * Persists the pending record and returns its id. Does NOT execute the tool.
     */
    async createPendingApproval(input: {
        agentId: string;
        toolName: string;
        args: ToolFunctionArgs;
        riskTier: ToolRiskTier;
        description: string;
    }): Promise<string | null> {
        const ref = getApprovalsRef();
        if (!ref) {
            logger.warn('[ToolApprovalService] No auth — cannot create pending approval');
            return null;
        }

        const record: Omit<PendingToolApproval, 'id'> = {
            agentId: input.agentId,
            toolName: input.toolName,
            args: input.args,
            riskTier: input.riskTier,
            description: input.description,
            status: 'pending',
            createdAt: serverTimestamp(),
        };

        const docRef = await addDoc(ref, record);
        logger.info(`[ToolApprovalService] Pending approval created: ${docRef.id} for ${input.toolName}`);
        return docRef.id;
    }

    /**
     * Executes the EXACT original tool call. This is the only path that actually
     * runs a requiresApproval:true tool's side effect — BaseAgent.ts's dispatch
     * loop never runs it directly once the gate fires.
     */
    async approve(approvalId: string): Promise<ToolFunctionResult> {
        const uid = getUserId();
        if (!uid) {
            return { success: false, error: 'Not authenticated — cannot approve tool call' };
        }

        const { getDoc } = await import('firebase/firestore');
        const approvalDocRef = doc(db, 'users', uid, 'tool_approvals', approvalId);
        const snap = await getDoc(approvalDocRef);
        if (!snap.exists()) {
            return { success: false, error: `Approval ${approvalId} not found` };
        }
        const approval = snap.data() as PendingToolApproval;
        if (approval.status !== 'pending') {
            return { success: false, error: `Approval ${approvalId} is not pending (status: ${approval.status})` };
        }

        await updateDoc(approvalDocRef, { status: 'approved', resolvedAt: serverTimestamp() });

        const { TOOL_REGISTRY } = await import('../tools');
        const toolFn = TOOL_REGISTRY[approval.toolName];
        if (!toolFn) {
            const failResult = { success: false, error: `Tool '${approval.toolName}' not found in registry` };
            await updateDoc(approvalDocRef, { status: 'failed', result: failResult });
            return failResult;
        }

        let result: ToolFunctionResult;
        try {
            result = await toolFn(approval.args);
        } catch (err: unknown) {
            result = { success: false, error: err instanceof Error ? err.message : String(err) };
        }

        await updateDoc(approvalDocRef, {
            status: 'executed',
            result: { success: result.success, error: result.error },
        });

        logger.info(`[ToolApprovalService] Approval ${approvalId} executed (${approval.toolName}): success=${result.success}`);
        return result;
    }

    async deny(approvalId: string, reason?: string): Promise<void> {
        const uid = getUserId();
        if (!uid) return;
        const approvalDocRef = doc(db, 'users', uid, 'tool_approvals', approvalId);
        await updateDoc(approvalDocRef, {
            status: 'denied',
            resolvedAt: serverTimestamp(),
            ...(reason ? { denyReason: reason } : {}),
        });
        logger.info(`[ToolApprovalService] Approval ${approvalId} denied${reason ? `: ${reason}` : ''}`);
    }

    /** Live list of pending approvals for the current user — feeds the RightPanel Approvals tab. */
    onPendingApprovals(callback: (approvals: (PendingToolApproval & { id: string })[]) => void): Unsubscribe {
        const ref = getApprovalsRef();
        if (!ref) return () => {};

        const q = query(ref, where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            const approvals: (PendingToolApproval & { id: string })[] = [];
            snapshot.forEach((d) => {
                approvals.push({ ...(d.data() as PendingToolApproval), id: d.id });
            });
            callback(approvals);
        }, (error) => {
            logger.error('[ToolApprovalService] onPendingApprovals listener error:', error);
        });
    }
}

export const toolApprovalService = new ToolApprovalService();
