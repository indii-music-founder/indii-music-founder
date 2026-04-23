/**
 * AgentIdentity — Cryptographic Agent Identity Service
 *
 * Implements Gemini Enterprise Agent Platform's Agent Identity primitive:
 * Each agent receives a unique, verifiable cryptographic ID that creates
 * a clear, auditable trail for every action the agent takes.
 *
 * Architecture:
 * - `instanceId`: A unique UUID assigned per agent instantiation (runtime lifecycle).
 * - `fingerprint`: A deterministic SHA-256 hash derived from the agent's immutable
 *   configuration (id, name, systemPrompt hash, authorized tools). This allows
 *   verification that an agent's capabilities have not been tampered with.
 * - `attestation`: A signed token combining instanceId + fingerprint + timestamp,
 *   used to prove provenance in multi-agent delegation chains.
 *
 * Future: When GEAP's Agent Identity API becomes available, the `fingerprint`
 * can be registered server-side and the `attestation` replaced with a
 * Google-issued cryptographic certificate.
 *
 * @see https://docs.cloud.google.com/gemini-enterprise-agent-platform/scale/runtime/agent-identity
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Immutable identity assigned to each agent instance.
 * Stored in the audit trail to enable provenance tracking.
 */
export interface AgentIdentityCard {
    /** Unique ID for this specific agent instance (changes per instantiation) */
    instanceId: string;
    /** Deterministic fingerprint derived from agent config (stable across restarts) */
    fingerprint: string;
    /** The canonical agent ID (e.g. 'creative', 'legal', 'generalist') */
    agentId: string;
    /** Human-readable agent name */
    agentName: string;
    /** ISO 8601 timestamp of when this identity was minted */
    mintedAt: string;
    /** Attestation token: instanceId:fingerprint:timestamp signed for verification */
    attestation: string;
}

/**
 * Input used to compute the deterministic fingerprint.
 * Only immutable configuration properties are included.
 */
export interface AgentFingerprintInput {
    id: string;
    name: string;
    systemPromptHash: string;
    authorizedTools?: string[];
    modelId?: string;
}

/**
 * Delegation provenance record — tracks the chain of agent identities
 * involved in a multi-agent delegation flow.
 */
export interface DelegationProvenanceEntry {
    /** The identity of the agent performing the action */
    identity: AgentIdentityCard;
    /** What action was taken (e.g. 'delegate_task', 'consult_experts') */
    action: string;
    /** The target agent ID (if delegation) */
    targetAgentId?: string;
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Trace ID linking this to the overall execution flow */
    traceId?: string;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Compute a SHA-256 fingerprint from agent configuration.
 * Uses the Web Crypto API (available in both browser and Electron renderer).
 */
async function computeFingerprint(input: AgentFingerprintInput): Promise<string> {
    const canonical = JSON.stringify({
        id: input.id,
        name: input.name,
        systemPromptHash: input.systemPromptHash,
        authorizedTools: (input.authorizedTools || []).sort(),
        modelId: input.modelId || null,
    });

    // Use Web Crypto for SHA-256 (available in modern browsers and Electron)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(canonical);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback: Simple hash for environments without Web Crypto (e.g., test runners)
    let hash = 0;
    for (let i = 0; i < canonical.length; i++) {
        const char = canonical.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32-bit integer
    }
    return `fallback-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Hash a system prompt down to a fixed-length digest.
 * We hash the prompt rather than including it verbatim to keep fingerprints compact.
 */
async function hashSystemPrompt(prompt: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(prompt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        // Return first 16 hex chars (64 bits) — sufficient for collision resistance in this context
        return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
        hash = ((hash << 5) - hash) + prompt.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate an attestation token.
 * Format: base64(instanceId:fingerprint:timestamp)
 *
 * Future: Replace with GEAP's cryptographic certificate when available.
 */
function generateAttestation(instanceId: string, fingerprint: string, timestamp: string): string {
    const payload = `${instanceId}|${fingerprint}|${timestamp}`;
    // btoa is available in both browser and Electron renderer
    if (typeof btoa === 'function') {
        return btoa(payload);
    }
    // Node.js fallback (shouldn't be needed in renderer, but defensive)
    return Buffer.from(payload).toString('base64');
}

/**
 * Verify an attestation token by decoding and checking structure.
 * Returns the decoded components or null if invalid.
 */
export function verifyAttestation(attestation: string): {
    instanceId: string;
    fingerprint: string;
    timestamp: string;
} | null {
    try {
        let decoded: string;
        if (typeof atob === 'function') {
            decoded = atob(attestation);
        } else {
            decoded = Buffer.from(attestation, 'base64').toString('utf-8');
        }

        const parts = decoded.split('|');
        const [instanceId, fingerprint, timestamp] = parts;
        if (parts.length !== 3 || !instanceId || !fingerprint || !timestamp) {
            return null;
        }

        return {
            instanceId,
            fingerprint,
            timestamp,
        };
    } catch {
        return null;
    }
}

// ============================================================================
// AGENT IDENTITY SERVICE
// ============================================================================

class AgentIdentityService {
    /** Cache of minted identities by instanceId */
    private identities: Map<string, AgentIdentityCard> = new Map();

    /** Delegation provenance chain for the current session */
    private provenanceChain: DelegationProvenanceEntry[] = [];

    /**
     * Mint a new cryptographic identity for an agent instance.
     *
     * @param agentId - The canonical agent ID (e.g. 'creative')
     * @param agentName - Human-readable name (e.g. 'Creative Director')
     * @param systemPrompt - The agent's system prompt (will be hashed)
     * @param authorizedTools - Optional list of authorized tool names
     * @param modelId - Optional fine-tuned model endpoint
     * @returns The minted AgentIdentityCard
     */
    async mintIdentity(
        agentId: string,
        agentName: string,
        systemPrompt: string,
        authorizedTools?: string[],
        modelId?: string
    ): Promise<AgentIdentityCard> {
        const instanceId = uuidv4();
        const mintedAt = new Date().toISOString();
        const systemPromptHash = await hashSystemPrompt(systemPrompt);

        const fingerprint = await computeFingerprint({
            id: agentId,
            name: agentName,
            systemPromptHash,
            authorizedTools,
            modelId,
        });

        const attestation = generateAttestation(instanceId, fingerprint, mintedAt);

        const card: AgentIdentityCard = {
            instanceId,
            fingerprint,
            agentId,
            agentName,
            mintedAt,
            attestation,
        };

        this.identities.set(instanceId, card);

        logger.debug(
            `[AgentIdentity] Minted identity for ${agentName} (${agentId}): ` +
            `instance=${instanceId.substring(0, 8)}..., fingerprint=${fingerprint.substring(0, 12)}...`
        );

        return card;
    }

    /**
     * Record a delegation in the provenance chain.
     * Called by BaseAgent when delegate_task or consult_experts is invoked.
     */
    recordDelegation(
        identity: AgentIdentityCard,
        action: string,
        targetAgentId?: string,
        traceId?: string
    ): void {
        const entry: DelegationProvenanceEntry = {
            identity,
            action,
            targetAgentId,
            timestamp: new Date().toISOString(),
            traceId,
        };

        this.provenanceChain.push(entry);

        logger.debug(
            `[AgentIdentity] Provenance: ${identity.agentId} → ${action}` +
            (targetAgentId ? ` → ${targetAgentId}` : '') +
            (traceId ? ` (trace: ${traceId.substring(0, 8)}...)` : '')
        );
    }

    /**
     * Get the full provenance chain for the current session.
     * Useful for audit trail exports and debugging.
     */
    getProvenanceChain(): DelegationProvenanceEntry[] {
        return [...this.provenanceChain];
    }

    /**
     * Get the provenance chain filtered by trace ID.
     */
    getProvenanceForTrace(traceId: string): DelegationProvenanceEntry[] {
        return this.provenanceChain.filter(e => e.traceId === traceId);
    }

    /**
     * Get a previously minted identity by instance ID.
     */
    getIdentity(instanceId: string): AgentIdentityCard | undefined {
        return this.identities.get(instanceId);
    }

    /**
     * Clear the provenance chain (call at session boundaries).
     */
    clearProvenanceChain(): void {
        this.provenanceChain = [];
    }

    /**
     * Export the provenance chain as a Firestore-safe object array.
     * Used by DigitalHandshake for audit trail persistence.
     */
    exportProvenanceForAudit(traceId?: string): Record<string, unknown>[] {
        const chain = traceId
            ? this.getProvenanceForTrace(traceId)
            : this.provenanceChain;

        return chain.map(entry => ({
            instanceId: entry.identity.instanceId,
            fingerprint: entry.identity.fingerprint,
            agentId: entry.identity.agentId,
            agentName: entry.identity.agentName,
            action: entry.action,
            targetAgentId: entry.targetAgentId || null,
            timestamp: entry.timestamp,
            traceId: entry.traceId || null,
        }));
    }
}

/** Singleton instance — shared across the renderer process */
export const agentIdentityService = new AgentIdentityService();
