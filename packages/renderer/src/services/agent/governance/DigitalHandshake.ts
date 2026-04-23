import { logger } from '@/utils/logger';
import { Timestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Directive } from '../../directive/DirectiveTypes';
import { DirectiveService } from '../../directive/DirectiveService';
import type { ToolRiskTier } from '../types';
import { getToolRiskMetadata } from '../ToolRiskRegistry';
import type { AgentIdentityCard } from './AgentIdentity';

export interface HandshakeRequest {
    directiveId: string;
    actionDescription: string;
    isDestructive: boolean;
    computeExceeded: boolean;
    riskTier?: ToolRiskTier;
    armorBlocked?: boolean;
    armorReason?: string;
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
     * @param toolName - The name of the tool attempting execution
     * @param agentIdentity - Cryptographic identity card of the executing agent (GEAP)
     * @returns boolean - true if execution can proceed, false if Handshake is required (execution paused).
     */
    static async require(
        directive: Directive,
        actionDescription: string,
        isDestructive: boolean = false,
        toolName?: string,
        agentIdentity?: AgentIdentityCard
    ): Promise<boolean> {
        const { computeAllocation } = directive;

        const computeExceeded = computeAllocation.tokensUsed >= computeAllocation.maxTokens;

        // --- GEAP Phase 2: Model Armor Integration ---
        const { ModelArmor, getDefaultPolicy } = await import('./ModelArmor');
        const armorResult = await ModelArmor.scanInput(actionDescription, getDefaultPolicy());
        let armorBlocked = false;
        
        if (!armorResult.allowed) {
            logger.warn(`[DigitalHandshake] Action Description blocked by Model Armor: ${armorResult.reason}`);
            armorBlocked = true;
        }

        const meta = toolName ? getToolRiskMetadata(toolName) : null;
        const resolvedRiskTier = meta?.riskTier;
        const requiresApproval = meta?.requiresApproval ?? false;

        // Resolve destructiveness: riskTier metadata takes precedence over legacy boolean
        const effectivelyDestructive = requiresApproval || isDestructive || (resolvedRiskTier === 'destructive');

        // Read-only tools never require a handshake (unless compute is exceeded or armor blocked)
        if (resolvedRiskTier === 'read' && !computeExceeded && !armorBlocked) {
            if (toolName) await this.logAuditTrail(directive.userId, 'TOOL_AUTO_APPROVED', { toolName, riskTier: resolvedRiskTier }, agentIdentity);
            return true;
        }

        if ((computeExceeded && !computeAllocation.isMaximizerModeActive) || effectivelyDestructive || armorBlocked) {
            logger.warn(`[DigitalHandshake] Action Paused: ${actionDescription}`);
            logger.warn(`[DigitalHandshake] Compute Exceeded: ${computeExceeded}, RiskTier: ${resolvedRiskTier || 'unset'}, Destructive: ${effectivelyDestructive}, ArmorBlocked: ${armorBlocked}`);

            await this.pingMemoryInbox(directive.userId, {
                directiveId: directive.id,
                actionDescription,
                isDestructive: effectivelyDestructive,
                computeExceeded,
                riskTier: resolvedRiskTier,
                armorBlocked,
                armorReason: armorResult.reason
            });

            await this.logAuditTrail(directive.userId, 'HANDSHAKE_REQUESTED', {
                directiveId: directive.id,
                toolName,
                actionDescription,
                riskTier: resolvedRiskTier
            }, agentIdentity);

            // Update Directive Status to WAITING_ON_HANDSHAKE
            await DirectiveService.updateStatus(directive.userId, directive.id, 'WAITING_ON_HANDSHAKE');

            return false; // Handshake required, execution paused
        }

        if (toolName) {
            await this.logAuditTrail(directive.userId, 'TOOL_AUTO_APPROVED', { actionDescription, toolName, riskTier: resolvedRiskTier }, agentIdentity);
        }

        return true; // Approved to proceed
    }

    public static async logAuditTrail(
        userId: string,
        action: string,
        details: Record<string, unknown>,
        agentIdentity?: AgentIdentityCard
    ): Promise<void> {
        const auditRef = collection(db, `users/${userId}/agentAuditTrails`);
        await addDoc(auditRef, {
            action,
            details,
            timestamp: Timestamp.now(),
            // GEAP Agent Identity: Include cryptographic provenance when available
            ...(agentIdentity ? {
                agentIdentity: {
                    instanceId: agentIdentity.instanceId,
                    fingerprint: agentIdentity.fingerprint,
                    agentId: agentIdentity.agentId,
                    agentName: agentIdentity.agentName,
                    attestation: agentIdentity.attestation,
                }
            } : {}),
        });
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
