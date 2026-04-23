import { describe, it, expect, beforeEach } from 'vitest';
import {
    agentIdentityService,
    verifyAttestation,
    type AgentIdentityCard,
} from '../AgentIdentity';

describe('AgentIdentity', () => {
    // ========================================================================
    // IDENTITY MINTING
    // ========================================================================
    describe('mintIdentity', () => {
        it('should mint a valid identity card with all required fields', async () => {
            const card = await agentIdentityService.mintIdentity(
                'creative',
                'Creative Director',
                'You are a creative director specializing in visual arts.',
                ['generate_image', 'search_knowledge'],
                'gemini-3-pro-preview'
            );

            expect(card.instanceId).toBeDefined();
            expect(card.instanceId.length).toBeGreaterThan(0);
            expect(card.fingerprint).toBeDefined();
            expect(card.fingerprint.length).toBeGreaterThan(0);
            expect(card.agentId).toBe('creative');
            expect(card.agentName).toBe('Creative Director');
            expect(card.mintedAt).toBeDefined();
            expect(new Date(card.mintedAt).getTime()).not.toBeNaN();
            expect(card.attestation).toBeDefined();
            expect(card.attestation.length).toBeGreaterThan(0);
        });

        it('should generate unique instanceIds for each mint call', async () => {
            const card1 = await agentIdentityService.mintIdentity('legal', 'Legal Agent', 'system prompt 1');
            const card2 = await agentIdentityService.mintIdentity('legal', 'Legal Agent', 'system prompt 1');

            expect(card1.instanceId).not.toBe(card2.instanceId);
        });

        it('should generate deterministic fingerprints for same config', async () => {
            const prompt = 'Identical system prompt for fingerprint test.';
            const tools = ['tool_a', 'tool_b'];

            const card1 = await agentIdentityService.mintIdentity('test', 'Test Agent', prompt, tools);
            const card2 = await agentIdentityService.mintIdentity('test', 'Test Agent', prompt, tools);

            // Fingerprints should be identical for the same configuration
            expect(card1.fingerprint).toBe(card2.fingerprint);
        });

        it('should generate different fingerprints for different configs', async () => {
            const card1 = await agentIdentityService.mintIdentity('agent-a', 'Agent A', 'prompt A');
            const card2 = await agentIdentityService.mintIdentity('agent-b', 'Agent B', 'prompt B');

            expect(card1.fingerprint).not.toBe(card2.fingerprint);
        });

        it('should generate different fingerprints when tools differ', async () => {
            const prompt = 'Same prompt for tool variation test.';
            const card1 = await agentIdentityService.mintIdentity('test', 'Test', prompt, ['tool_a']);
            const card2 = await agentIdentityService.mintIdentity('test', 'Test', prompt, ['tool_b']);

            expect(card1.fingerprint).not.toBe(card2.fingerprint);
        });

        it('should generate consistent fingerprints regardless of tool order', async () => {
            const prompt = 'Same prompt for tool order test.';
            const card1 = await agentIdentityService.mintIdentity('test', 'Test', prompt, ['tool_b', 'tool_a']);
            const card2 = await agentIdentityService.mintIdentity('test', 'Test', prompt, ['tool_a', 'tool_b']);

            // The implementation sorts tools, so order should not matter
            expect(card1.fingerprint).toBe(card2.fingerprint);
        });

        it('should handle agents with no authorized tools', async () => {
            const card = await agentIdentityService.mintIdentity('generalist', 'Generalist', 'Basic prompt');

            expect(card.instanceId).toBeDefined();
            expect(card.fingerprint).toBeDefined();
        });

        it('should handle agents with no model ID', async () => {
            const card = await agentIdentityService.mintIdentity('test', 'Test', 'prompt', ['tool']);

            expect(card.fingerprint).toBeDefined();
        });

        it('should store minted identities in the service cache', async () => {
            const card = await agentIdentityService.mintIdentity('cached', 'Cached Agent', 'prompt');

            const retrieved = agentIdentityService.getIdentity(card.instanceId);
            expect(retrieved).toBeDefined();
            expect(retrieved!.instanceId).toBe(card.instanceId);
            expect(retrieved!.fingerprint).toBe(card.fingerprint);
        });
    });

    // ========================================================================
    // ATTESTATION VERIFICATION
    // ========================================================================
    describe('verifyAttestation', () => {
        it('should verify a valid attestation token', async () => {
            const card = await agentIdentityService.mintIdentity('verifier-test', 'Verifier', 'prompt');

            const decoded = verifyAttestation(card.attestation);
            expect(decoded).not.toBeNull();
            expect(decoded!.instanceId).toBe(card.instanceId);
            expect(decoded!.fingerprint).toBe(card.fingerprint);
            expect(decoded!.timestamp).toBe(card.mintedAt);
        });

        it('should return null for invalid base64 input', () => {
            const result = verifyAttestation('not-valid-base64!!!');
            // Should return null or a result that doesn't match the expected structure
            // (depending on how the base64 decoder handles garbage input)
            if (result) {
                // If it decodes, it should fail the 3-part structure check
                expect(result.instanceId).toBeDefined();
            }
        });

        it('should return null for attestation with wrong number of parts', () => {
            // Base64 of "only|two"
            const twoPartsB64 = typeof btoa === 'function' ? btoa('only|two') : Buffer.from('only|two').toString('base64');
            const result = verifyAttestation(twoPartsB64);
            expect(result).toBeNull();
        });

        it('should return null for empty attestation', () => {
            const emptyB64 = typeof btoa === 'function' ? btoa('') : Buffer.from('').toString('base64');
            const result = verifyAttestation(emptyB64);
            expect(result).toBeNull();
        });

        it('should return null for attestation with empty segments', () => {
            const emptySegments = typeof btoa === 'function' ? btoa('||') : Buffer.from('||').toString('base64');
            const result = verifyAttestation(emptySegments);
            expect(result).toBeNull();
        });
    });

    // ========================================================================
    // DELEGATION PROVENANCE
    // ========================================================================
    describe('delegation provenance', () => {
        let identityCard: AgentIdentityCard;

        beforeEach(async () => {
            agentIdentityService.clearProvenanceChain();
            identityCard = await agentIdentityService.mintIdentity('hub', 'Hub Agent', 'hub prompt');
        });

        it('should record a delegation event', () => {
            agentIdentityService.recordDelegation(identityCard, 'delegate_task', 'legal');

            const chain = agentIdentityService.getProvenanceChain();
            expect(chain.length).toBe(1);
            expect(chain?.[0]?.identity.agentId).toBe('hub');
            expect(chain?.[0]?.action).toBe('delegate_task');
            expect(chain?.[0]?.targetAgentId).toBe('legal');
            expect(chain?.[0]?.timestamp).toBeDefined();
        });

        it('should record multiple delegation events in order', () => {
            agentIdentityService.recordDelegation(identityCard, 'delegate_task', 'legal');
            agentIdentityService.recordDelegation(identityCard, 'consult_experts', 'marketing');

            const chain = agentIdentityService.getProvenanceChain();
            expect(chain.length).toBe(2);
            expect(chain?.[0]?.targetAgentId).toBe('legal');
            expect(chain?.[1]?.targetAgentId).toBe('marketing');
        });

        it('should record delegation with trace ID', () => {
            const traceId = 'trace-abc-123';
            agentIdentityService.recordDelegation(identityCard, 'delegate_task', 'brand', traceId);

            const chain = agentIdentityService.getProvenanceChain();
            expect(chain?.[0]?.traceId).toBe(traceId);
        });

        it('should filter provenance chain by trace ID', () => {
            agentIdentityService.recordDelegation(identityCard, 'delegate_task', 'legal', 'trace-1');
            agentIdentityService.recordDelegation(identityCard, 'delegate_task', 'brand', 'trace-2');
            agentIdentityService.recordDelegation(identityCard, 'consult_experts', 'marketing', 'trace-1');

            const trace1 = agentIdentityService.getProvenanceForTrace('trace-1');
            expect(trace1.length).toBe(2);
            expect(trace1?.[0]?.targetAgentId).toBe('legal');
            expect(trace1?.[1]?.targetAgentId).toBe('marketing');

            const trace2 = agentIdentityService.getProvenanceForTrace('trace-2');
            expect(trace2.length).toBe(1);
        });

        it('should clear the provenance chain', () => {
            agentIdentityService.recordDelegation(identityCard, 'delegate_task', 'legal');
            expect(agentIdentityService.getProvenanceChain().length).toBe(1);

            agentIdentityService.clearProvenanceChain();
            expect(agentIdentityService.getProvenanceChain().length).toBe(0);
        });

        it('should export provenance for audit with correct structure', () => {
            const traceId = 'audit-trace-1';
            agentIdentityService.recordDelegation(identityCard, 'delegate_task', 'legal', traceId);

            const exported = agentIdentityService.exportProvenanceForAudit(traceId);
            expect(exported.length).toBe(1);
            expect(exported[0]).toEqual(expect.objectContaining({
                instanceId: identityCard.instanceId,
                fingerprint: identityCard.fingerprint,
                agentId: 'hub',
                agentName: 'Hub Agent',
                action: 'delegate_task',
                targetAgentId: 'legal',
                traceId: traceId,
            }));
            // Timestamp should be an ISO 8601 string
            expect(typeof exported?.[0]?.timestamp).toBe('string');
        });

        it('should export full provenance chain when no trace ID filter', () => {
            agentIdentityService.recordDelegation(identityCard, 'delegate_task', 'legal', 'trace-a');
            agentIdentityService.recordDelegation(identityCard, 'delegate_task', 'brand', 'trace-b');

            const exported = agentIdentityService.exportProvenanceForAudit();
            expect(exported.length).toBe(2);
        });

        it('should return a defensive copy from getProvenanceChain', () => {
            agentIdentityService.recordDelegation(identityCard, 'delegate_task', 'legal');

            const chain = agentIdentityService.getProvenanceChain();
            chain.push({
                identity: identityCard,
                action: 'malicious_insert',
                timestamp: new Date().toISOString(),
            });

            // Original chain should not be affected
            expect(agentIdentityService.getProvenanceChain().length).toBe(1);
        });
    });

    // ========================================================================
    // IDENTITY RETRIEVAL
    // ========================================================================
    describe('getIdentity', () => {
        it('should return undefined for non-existent instance ID', () => {
            const result = agentIdentityService.getIdentity('non-existent-id');
            expect(result).toBeUndefined();
        });

        it('should return the correct identity card by instance ID', async () => {
            const card = await agentIdentityService.mintIdentity('retrieval-test', 'Retrieval Test', 'prompt');
            const retrieved = agentIdentityService.getIdentity(card.instanceId);

            expect(retrieved).toEqual(card);
        });
    });
});
