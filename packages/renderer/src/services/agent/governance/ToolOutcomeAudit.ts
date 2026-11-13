import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';
import { logger } from '@/utils/logger';

export interface ToolOutcome {
    userId?: string;
    agentId: string;
    toolName: string;
    toolCallId: string;
    success: boolean;
    fingerprint?: string;
}

export type ToolAuditReceipt =
    | { status: 'confirmed'; logId: string }
    | { status: 'unconfirmed' }
    | { status: 'unavailable' };

/** Completion evidence only: this does not provide pre-dispatch admission or effect idempotency. */
export async function recordToolOutcome(outcome: ToolOutcome): Promise<ToolAuditReceipt> {
    if (!outcome.userId) return { status: 'unavailable' };
    try {
        // The callable derives ownership from auth, never from the browser's userId.
        const record = httpsCallable<unknown, { logId?: unknown }>(functions, 'logAuditEvent', { timeout: 10_000 });
        const response = await record({
            action: `agent.tool.${outcome.toolName}`,
            resourceId: `agent/${outcome.agentId}`,
            severity: outcome.success ? 'low' : 'medium',
            agentId: outcome.agentId,
            status: outcome.success ? 'success' : 'failure',
            // Link the server event to the local tool event without copying arguments,
            // generated assets, credentials, or provider error text into the audit.
            details: `toolCallId=${outcome.toolCallId}${outcome.fingerprint ? `;agentFingerprint=${outcome.fingerprint}` : ''}`,
        });
        const logId = response.data?.logId;
        if (typeof logId !== 'string' || !logId.trim()) throw new Error('Audit acknowledgement omitted its log ID');
        return { status: 'confirmed', logId: logId.trim() };
    } catch (error: unknown) {
        // A lost response may follow a successful write. Neither automatically retry
        // the audit nor re-execute the tool, whose original result remains authoritative.
        logger.warn('[BaseAgent] Tool outcome audit could not be confirmed:', error);
        return { status: 'unconfirmed' };
    }
}
