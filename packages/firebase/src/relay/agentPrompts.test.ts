import { describe, it, expect } from 'vitest';
import { getAgentPrompt, VALID_AGENT_IDS } from './agentPrompts';

describe('getAgentPrompt — judgment layer execution contract', () => {
    it.each(VALID_AGENT_IDS)('carries the EXECUTION CONTRACT and capability grounding for agent "%s"', (agentId) => {
        const { prompt } = getAgentPrompt(agentId);
        expect(prompt).toContain('## EXECUTION CONTRACT');
        expect(prompt).toContain('ZERO TOLERANCE FOR FABRICATING ENGINEERING ROADMAPS');
    });

    it('falls back to generalist for an unknown agent id and still carries the contract', () => {
        const { resolvedAgentId, prompt } = getAgentPrompt('not-a-real-agent');
        expect(resolvedAgentId).toBe('generalist');
        expect(prompt).toContain('## EXECUTION CONTRACT');
        expect(prompt).toContain('ZERO TOLERANCE FOR FABRICATING ENGINEERING ROADMAPS');
    });

    it('generalist conductor prompt requires evidence-bound status without a hard-coded department count', () => {
        const { prompt } = getAgentPrompt('generalist');
        expect(prompt).toContain('registered specialist departments');
        expect(prompt).toContain('current registry/runtime evidence');
        expect(prompt).toContain('Capability & Status Grounding (Zero Hallucination)');
        expect(prompt).toContain('configured, implemented, tested, live-verified, degraded, blocked, and unverified');
        expect(prompt).not.toContain('across all 23 departments');
        expect(prompt).not.toContain('All 23 departments are fully implemented');
    });
});

// ---------------------------------------------------------------------------
// Issue #330 — canonical/relay registry parity guard
//
// The cloud relay's prompt registry must never drift from the canonical
// department registry: a department head selectable in Studio must resolve to
// its own bounded specialist prompt here, not silently degrade to the
// generalist. Cross-package import is not possible under the firebase
// functions rootDir, so the canonical registry is read from source via the
// same fs pattern DepartmentRoutingSynchronization.test.ts uses.
// ---------------------------------------------------------------------------
import * as fs from 'fs';
import * as path from 'path';

function readCanonicalHeadIds(): string[] {
    const candidates = [
        path.resolve(process.cwd(), 'packages/renderer/src/services/agent/departments.ts'),
        path.resolve(process.cwd(), '../../packages/renderer/src/services/agent/departments.ts'),
    ];
    const sourcePath = candidates.find(p => fs.existsSync(p));
    expect(sourcePath, 'Could not locate packages/renderer/src/services/agent/departments.ts').toBeDefined();
    const source = fs.readFileSync(sourcePath!, 'utf-8');
    return [...source.matchAll(/headId:\s*'([^']+)'/g)].map(match => match[1]);
}

describe('canonical department-head ↔ cloud-relay parity (#330)', () => {
    it('recognizes every canonical department head in the relay registry', () => {
        const headIds = readCanonicalHeadIds();
        expect(headIds.length, 'departments.ts must register department heads').toBeGreaterThan(0);

        const missing = headIds.filter(id => !VALID_AGENT_IDS.includes(id));
        expect(
            missing,
            `Department heads selectable in Studio but missing from the cloud relay registry (they would silently become the generalist): ${missing.join(', ')}. Add a bounded relay prompt in packages/firebase/src/relay/agentPrompts.ts.`
        ).toEqual([]);
    });

    it.each(readCanonicalHeadIds())('resolves head "%s" to itself — never to a generalist fallback', (headId) => {
        const { resolvedAgentId } = getAgentPrompt(headId);
        expect(resolvedAgentId).toBe(headId);
    });

    it('keeps legacy aliases out of the relay registry (renderer hardening parity)', () => {
        expect(VALID_AGENT_IDS).not.toContain('creative-director');
        expect(VALID_AGENT_IDS).not.toContain('road-manager');
    });

    it('declares the cloud-advisory runtime boundary in the registry contract', () => {
        const { prompt } = getAgentPrompt('finance');
        expect(prompt).toContain('## EXECUTION CONTRACT');
    });
});
