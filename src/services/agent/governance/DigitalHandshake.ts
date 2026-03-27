import { logger } from '@/utils/logger';
import { Timestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Directive } from '../../directive/DirectiveTypes';
import { DirectiveService } from '../../directive/DirectiveService';

export interface HandshakeRequest {
    directiveId: string;
    actionDescription: string;
    isDestructive: boolean;
    computeExceeded: boolean;
}

/**
 * DigitalHandshake — Governance and execution bounding.
 * Implements the Paperclip "Governance" paradigm.
 */
export class DigitalHandshake {
    /**
     * Middleware/Wrapper to enforce Layer 3 Governance.
     * Blocks execution if the agent exceeds its Compute Allocation or attempts a destructive action.
     * 
     * @returns boolean - true if execution can proceed, false if Handshake is required (execution paused).
     */
    static async require(directive: Directive, actionDescription: string, isDestructive: boolean = false): Promise<boolean> {
        const { computeAllocation } = directive;

        const computeExceeded = computeAllocation.tokensUsed >= computeAllocation.maxTokens;

        if ((computeExceeded && !computeAllocation.isMaximizerModeActive) || isDestructive) {
            logger.warn(`[DigitalHandshake] Action Paused: ${actionDescription}`);
            logger.warn(`[DigitalHandshake] Compute Exceeded: ${computeExceeded}, Destructive: ${isDestructive}`);

            await this.pingMemoryInbox(directive.userId, {
                directiveId: directive.id,
                actionDescription,
                isDestructive,
                computeExceeded
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
