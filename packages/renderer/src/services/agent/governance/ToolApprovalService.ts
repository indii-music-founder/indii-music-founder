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
 * `approve()` that executes the selected implementation with the original
 * arguments (not a re-run of the LLM turn). Non-computer bindings are session
 * scoped: after a reload, the approval must be requested again.
 *
 * Collection: users/{uid}/tool_approvals/{approvalId}
 */
import {
    collection,
    doc,
    setDoc,
    updateDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    runTransaction,
    getDoc,
    type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
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
    /** Non-computer calls must resolve against their original renderer session binding. */
    bindingSessionId?: string;
    status: 'pending' | 'approved' | 'denied' | 'executed' | 'failed';
    createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
    resolvedAt?: Timestamp | ReturnType<typeof serverTimestamp>;
    denyReason?: string;
    /** Populated after execution; absence is ambiguous if the renderer stopped after dispatch. */
    result?: { success: boolean; error?: string };
}

type BoundToolCall = {
    userId: string;
    agentId: string;
    toolName: string;
    argsJson: string;
    riskTier: ToolRiskTier;
    description: string;
    execute: (args: ToolFunctionArgs) => Promise<ToolFunctionResult>;
};

function canonicalArgs(value: unknown): string {
    const normalize = (item: unknown): unknown => {
        if (Array.isArray(item)) return item.map(normalize);
        if (item !== null && typeof item === 'object') {
            return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))
                .map(([key, nested]) => [key, normalize(nested)]));
        }
        return item;
    };
    const json = JSON.stringify(normalize(value));
    if (json === undefined) throw new Error('Tool arguments must be JSON-serializable');
    return json;
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
    private readonly rendererSessionId = crypto.randomUUID();
    private readonly boundCalls = new Map<string, BoundToolCall>();

    canApproveInThisSession(approval: PendingToolApproval & { id: string }): boolean {
        if (approval.status !== 'pending') return false;
        if (approval.toolName.startsWith('computer_')) return !approval.bindingSessionId;
        const binding = this.boundCalls.get(approval.id);
        try {
            return Boolean(binding && binding.userId === getUserId()
                && approval.bindingSessionId === this.rendererSessionId
                && binding.agentId === approval.agentId
                && binding.toolName === approval.toolName
                && binding.riskTier === approval.riskTier
                && binding.description === approval.description
                && binding.argsJson === canonicalArgs(approval.args));
        } catch {
            return false;
        }
    }
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
        execute?: (args: ToolFunctionArgs) => Promise<ToolFunctionResult>;
    }): Promise<string | null> {
        const ref = getApprovalsRef();
        if (!ref) {
            logger.warn('[ToolApprovalService] No auth — cannot create pending approval');
            return null;
        }
        const isComputerApproval = input.toolName.startsWith('computer_');
        if (!isComputerApproval && !input.execute) {
            logger.warn('[ToolApprovalService] Refusing approval without a bound tool implementation');
            return null;
        }
        const userId = getUserId();
        if (!userId) return null;
        const argsJson = canonicalArgs(input.args);
        const args = JSON.parse(argsJson) as ToolFunctionArgs;

        const record: Omit<PendingToolApproval, 'id'> = {
            agentId: input.agentId,
            toolName: input.toolName,
            args,
            riskTier: input.riskTier,
            description: input.description,
            status: 'pending',
            createdAt: serverTimestamp(),
            ...(!isComputerApproval ? { bindingSessionId: this.rendererSessionId } : {}),
        };

        const docRef = doc(ref);
        if (!isComputerApproval && input.execute) {
            this.boundCalls.set(docRef.id, {
                userId, agentId: input.agentId, toolName: input.toolName, argsJson,
                riskTier: input.riskTier, description: input.description, execute: input.execute,
            });
        }
        try {
            await setDoc(docRef, record);
        } catch (error) {
            this.boundCalls.delete(docRef.id);
            throw error;
        }
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

        const approvalDocRef = doc(db, 'users', uid, 'tool_approvals', approvalId);
        let approval: PendingToolApproval;
        let isComputerApproval = false;
        const binding = this.boundCalls.get(approvalId);
        const matchesBinding = (candidate: PendingToolApproval): boolean => {
            try {
                return Boolean(binding)
                    && candidate.bindingSessionId === this.rendererSessionId
                    && binding?.userId === uid
                    && binding?.agentId === candidate.agentId
                    && binding?.toolName === candidate.toolName
                    && binding?.riskTier === candidate.riskTier
                    && binding?.description === candidate.description
                    && binding?.argsJson === canonicalArgs(candidate.args);
            } catch {
                return false;
            }
        };
        try {
            const snapshot = await getDoc(approvalDocRef);
            if (!snapshot.exists()) throw new Error(`Approval ${approvalId} not found`);
            const candidate = snapshot.data() as PendingToolApproval;
            isComputerApproval = candidate.toolName.startsWith('computer_') && !candidate.bindingSessionId && !binding;
            if (isComputerApproval) {
                if (candidate.status !== 'pending') throw new Error(`Approval ${approvalId} is not pending (status: ${candidate.status})`);
                approval = candidate;
            } else approval = await runTransaction(db, async transaction => {
                const snap = await transaction.get(approvalDocRef);
                if (!snap.exists()) throw new Error(`Approval ${approvalId} not found`);
                const current = snap.data() as PendingToolApproval;
                if (current.status !== 'pending') throw new Error(`Approval ${approvalId} is not pending (status: ${current.status})`);
                if (!matchesBinding(current)) throw new Error(`Approval ${approvalId} no longer matches its original tool call. Request it again.`);
                transaction.update(approvalDocRef, { status: 'approved', resolvedAt: serverTimestamp() });
                return current;
            });
        } catch (error: unknown) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }

        let result: ToolFunctionResult;
        try {
            if (isComputerApproval) {
                const { TOOL_REGISTRY } = await import('../tools');
                const toolFn = TOOL_REGISTRY[approval.toolName];
                if (!toolFn) throw new Error(`Tool '${approval.toolName}' not found in registry`);
                const user = auth.currentUser;
                if (!user || !window.electronAPI?.computer) throw new Error('Verified desktop sign-in is required for computer control.');
                const idToken = await user.getIdToken();
                const authorized = await window.electronAPI.computer.authorizeApproval({ idToken, approvalId, rendererSessionId: this.rendererSessionId });
                if (!authorized.success || !authorized.data) throw new Error(authorized.error || 'Main-process computer authorization failed.');
                const executionArgs = {
                    ...approval.args,
                    __computerAuthorizationToken: authorized.data.token,
                    __computerRendererSessionId: this.rendererSessionId,
                    __computerAgentId: approval.agentId,
                };
                result = await toolFn(executionArgs);
            } else {
                // Use the selected implementation and original arguments from the requesting turn.
                // A reload loses this binding and fails closed instead of replaying a bare tool name.
                result = await binding!.execute(JSON.parse(binding!.argsJson) as ToolFunctionArgs);
            }
        } catch (err: unknown) {
            result = { success: false, error: err instanceof Error ? err.message : String(err) };
        }

        if (!isComputerApproval) {
            this.boundCalls.delete(approvalId);
            try {
                await updateDoc(approvalDocRef, {
                    status: result.success ? 'executed' : 'failed',
                    result: {
                        success: result.success,
                        ...(typeof result.error === 'string' ? { error: result.error } : {}),
                    },
                });
            } catch (error: unknown) {
                logger.error(`[ToolApprovalService] Approval ${approvalId} result could not be recorded; effect may have occurred`, error);
                return {
                    success: false,
                    error: `Action outcome needs reconciliation: ${result.success ? 'the tool reported success' : 'the tool reported failure'}, but its approval result could not be saved. Do not retry automatically.`,
                };
            }
        }

        logger.info(`[ToolApprovalService] Approval ${approvalId} executed (${approval.toolName}): success=${result.success}`);
        return result;
    }

    async deny(approvalId: string, reason?: string): Promise<void> {
        const uid = getUserId();
        if (!uid) return;
        const approvalDocRef = doc(db, 'users', uid, 'tool_approvals', approvalId);
        const snapshot = await getDoc(approvalDocRef);
        if (snapshot.exists() && String(snapshot.data().toolName).startsWith('computer_')) {
            await httpsCallable(functions, 'denyComputerApproval')({ approvalId });
            return;
        }
        await runTransaction(db, async transaction => {
            const current = await transaction.get(approvalDocRef);
            if (!current.exists() || current.data().status !== 'pending') {
                throw new Error(`Approval ${approvalId} is no longer pending`);
            }
            transaction.update(approvalDocRef, {
                status: 'denied',
                resolvedAt: serverTimestamp(),
                ...(reason ? { denyReason: reason } : {}),
            });
        });
        this.boundCalls.delete(approvalId);
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
