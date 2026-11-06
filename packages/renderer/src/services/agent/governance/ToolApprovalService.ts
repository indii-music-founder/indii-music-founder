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
 * arguments (not a re-run of the LLM turn). Session-local implementations stay
 * session scoped; validated report_bug calls can resume through their stable
 * registry handler after reload.
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
    /** Session-local non-computer calls resolve against their originating renderer session. */
    bindingSessionId?: string;
    status: 'pending' | 'approved' | 'claimed' | 'denied' | 'executed' | 'failed';
    createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
    resolvedAt?: Timestamp | ReturnType<typeof serverTimestamp>;
    /** Persisted before a non-computer implementation is called. */
    claimedAt?: Timestamp | ReturnType<typeof serverTimestamp>;
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
    const active = new WeakSet<object>();
    const normalize = (item: unknown): unknown => {
        if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
        if (typeof item === 'number' && Number.isFinite(item)) return item;
        if (typeof item !== 'object' || active.has(item)) {
            throw new Error('Tool arguments must contain only finite JSON values');
        }
        if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
            throw new Error('Tool arguments must contain only plain JSON objects');
        }
        active.add(item);
        try {
            if (Array.isArray(item)) return Array.from(item, normalize);
            if (Reflect.ownKeys(item).some(key => typeof key !== 'string' ||
                !Object.getOwnPropertyDescriptor(item, key)?.enumerable ||
                !('value' in (Object.getOwnPropertyDescriptor(item, key) ?? {})))) {
                throw new Error('Tool arguments must contain only plain JSON fields');
            }
            return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))
                .map(([key, nested]) => [key, normalize(nested)]));
        } finally {
            active.delete(item);
        }
    };
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Tool arguments must be a JSON object');
    }
    const json = JSON.stringify(normalize(value));
    return json;
}

/**
 * Bug reports have a stable, global implementation and a durable, explicit
 * payload. They can be resumed from another renderer after the requesting
 * session closes. Other non-computer tools may close over session-only state
 * and remain bound to the renderer that created them.
 */
function isRecoverableBugReport(approval: PendingToolApproval): boolean {
    if (approval.status !== 'pending'
        || approval.agentId !== 'generalist'
        || approval.toolName !== 'report_bug'
        || approval.riskTier !== 'write'
        || approval.description !== 'File a bug report and sync it to GitHub Issues'
        || !approval.args || typeof approval.args !== 'object' || Array.isArray(approval.args)) return false;

    const args = approval.args as Record<string, unknown>;
    const allowedKeys = new Set([
        'title', 'description', 'stepsToReproduce', 'expectedBehavior',
        'actualBehavior', 'severity', 'module', 'errorMessage',
    ]);
    if (Object.keys(args).some(key => !allowedKeys.has(key))) return false;
    if (typeof args.title !== 'string' || !args.title.trim() || args.title.length > 200) return false;
    if (typeof args.description !== 'string' || !args.description.trim() || args.description.length > 20_000) return false;
    if (args.severity !== undefined && !['critical', 'major', 'minor', 'cosmetic'].includes(String(args.severity))) return false;
    return ['stepsToReproduce', 'expectedBehavior', 'actualBehavior', 'module', 'errorMessage']
        .every(key => args[key] === undefined || (typeof args[key] === 'string' && (args[key] as string).length <= 20_000));
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
        if (isRecoverableBugReport(approval)) return getUserId() !== null;
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
        let reportBugHandler: ((args: ToolFunctionArgs) => Promise<ToolFunctionResult>) | undefined;
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
            if (isRecoverableBugReport(candidate)) {
                const { TOOL_REGISTRY } = await import('../tools');
                reportBugHandler = TOOL_REGISTRY.report_bug;
                if (!reportBugHandler) throw new Error('The registered bug-report handler is unavailable. The request remains pending.');
            }
            if (isComputerApproval) {
                if (candidate.status !== 'pending') throw new Error(`Approval ${approvalId} is not pending (status: ${candidate.status})`);
                approval = candidate;
            } else approval = await runTransaction(db, async transaction => {
                const snap = await transaction.get(approvalDocRef);
                if (!snap.exists()) throw new Error(`Approval ${approvalId} not found`);
                const current = snap.data() as PendingToolApproval;
                if (current.status !== 'pending') throw new Error(`Approval ${approvalId} is not pending (status: ${current.status})`);
                if (!matchesBinding(current) && !isRecoverableBugReport(current)) {
                    throw new Error(`Approval ${approvalId} no longer matches its original tool call. Request it again.`);
                }
                transaction.update(approvalDocRef, { status: 'approved', resolvedAt: serverTimestamp() });
                return current;
            });
        } catch (error: unknown) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }

        if (!isComputerApproval) {
            try {
                // A durable claim separates approval from the point where a side effect may start.
                await updateDoc(approvalDocRef, { status: 'claimed', claimedAt: serverTimestamp() });
            } catch {
                this.boundCalls.delete(approvalId);
                logger.error(`[ToolApprovalService] Approval ${approvalId} dispatch claim could not be recorded; tool was not run`);
                return {
                    success: false,
                    error: 'Tool was not run because its dispatch claim could not be saved. Review the approval state before requesting it again.',
                };
            }
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
            } else if (isRecoverableBugReport(approval)) {
                // This tool has no renderer-local closure and consumes only its
                // persisted, validated arguments, so it remains executable after
                // reload or approval from another active renderer.
                result = await reportBugHandler!(approval.args);
            } else {
                // Use the selected implementation and original arguments from the requesting turn.
                // A reload loses this binding and fails closed instead of replaying a bare tool name.
                result = await binding!.execute(JSON.parse(binding!.argsJson) as ToolFunctionArgs);
            }
        } catch (err: unknown) {
            if (!isComputerApproval) {
                // The claim is durable, but the tool may have completed an external
                // effect before its response was lost. Leave it unresolved.
                this.boundCalls.delete(approvalId);
                logger.warn(`[ToolApprovalService] Approval ${approvalId} dispatched without a verifiable result`);
                return {
                    success: false,
                    error: 'Action outcome needs reconciliation: the dispatched tool did not return a result. Check its effect before requesting it again.',
                };
            }
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
            } catch {
                logger.error(`[ToolApprovalService] Approval ${approvalId} result could not be recorded; effect may have occurred`);
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
        logger.info(`[ToolApprovalService] Approval ${approvalId} denied`);
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

    /** Show claimed calls until a recorded outcome resolves their ambiguity. */
    onUnresolvedApprovals(callback: (approvals: (PendingToolApproval & { id: string })[]) => void): Unsubscribe {
        const ref = getApprovalsRef();
        if (!ref) return () => {};

        const q = query(ref, where('status', 'in', ['pending', 'approved', 'claimed']), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snapshot => {
            const approvals: (PendingToolApproval & { id: string })[] = [];
            snapshot.forEach(d => approvals.push({ ...(d.data() as PendingToolApproval), id: d.id }));
            callback(approvals);
        }, error => {
            logger.error('[ToolApprovalService] onUnresolvedApprovals listener error:', error);
        });
    }
}

export const toolApprovalService = new ToolApprovalService();
