import { logger } from '@/utils/logger';
import { Timestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Directive } from '../../directive/DirectiveTypes';
import { DirectiveService } from '../../directive/DirectiveService';
import type { ToolRiskTier } from '../types';

export interface HandshakeRequest {
    directiveId: string;
    actionDescription: string;
    isDestructive: boolean;
    computeExceeded: boolean;
    riskTier?: ToolRiskTier;
}

/**
 * DigitalHandshake — Governance and execution bounding.
 * Implements the Paperclip "Governance" paradigm.
 *
 * Agentic Harness Primitive #2: Tiered Permission System
 * Now reads `riskTier` from tool metadata when available,
 * falling back to the legacy `isDestructive` boolean.
 */
export class DigitalHandshake {
    /**
     * Middleware/Wrapper to enforce Layer 3 Governance.
     * Blocks execution if the agent exceeds its Compute Allocation or attempts a destructive action.
     *
     * @param directive - The active directive governing this execution scope
     * @param actionDescription - Human-readable description of the action
     * @param isDestructive - Legacy boolean for destructiveness (deprecated — use riskTier)
     * @param riskTier - Tool risk classification from FunctionDeclaration metadata
     * @returns boolean - true if execution can proceed, false if Handshake is required (execution paused).
     */
    static async require(
        directive: Directive,
        actionDescription: string,
        isDestructive: boolean = false,
        riskTier?: ToolRiskTier
    ): Promise<boolean> {
        const { computeAllocation } = directive;

        const computeExceeded = computeAllocation.tokensUsed >= computeAllocation.maxTokens;

        // Resolve destructiveness: riskTier metadata takes precedence over legacy boolean
        const effectivelyDestructive = riskTier
            ? riskTier === 'destructive'
            : isDestructive;

        // Read-only tools never require a handshake (unless compute is exceeded)
        if (riskTier === 'read' && !computeExceeded) {
            return true;
        }

        if ((computeExceeded && !computeAllocation.isMaximizerModeActive) || effectivelyDestructive) {
            logger.warn(`[DigitalHandshake] Action Paused: ${actionDescription}`);
            logger.warn(`[DigitalHandshake] Compute Exceeded: ${computeExceeded}, RiskTier: ${riskTier || 'unset'}, Destructive: ${effectivelyDestructive}`);

            await this.pingMemoryInbox(directive.userId, {
                directiveId: directive.id,
                actionDescription,
                isDestructive: effectivelyDestructive,
                computeExceeded,
                riskTier,
            });

            // Update Directive Status to WAITING_ON_HANDSHAKE
            await DirectiveService.updateStatus(directive.userId, directive.id, 'WAITING_ON_HANDSHAKE');

            return false; // Handshake required, execution paused
        }

        return true; // Approved to proceed
    }

    /**
     * Routes approval requests to the user's memory inbox (~/indiiOS/memory-inbox/).
     */
    private static async pingMemoryInbox(userId: string, request: HandshakeRequest): Promise<void> {
        logger.info(`[DigitalHandshake] Pinging ~/indiiOS/memory-inbox/ for User ${userId}`);

        const inboxRef = collection(db, `users/${userId}/memoryInbox`);

        await addDoc(inboxRef, {
            type: 'DIGITAL_HANDSHAKE_REQUEST',
            ...request,
            status: 'PENDING',
            createdAt: Timestamp.now()
        });
    }
}
