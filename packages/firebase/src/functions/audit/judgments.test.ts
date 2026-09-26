import { beforeEach, describe, expect, it, vi } from 'vitest';

// No TYPESAFE_API_KEY in the unit-test environment — the secret-bound path is
// exercised via injected clients; the absent-key path is the real one here.
vi.mock('../../config/secrets', () => ({
    typesafeApiKey: { value: () => '' },
}));

import {
    applySeverityTriage,
    heuristicAuditTriage,
    triageAuditFindings,
    __resetAuditJudgmentCooldownForTests,
    type AuditTriageVerdict,
} from './judgments.js';
import type { TypesafeClient } from '../intelligence/typesafeClient.js';
import type { DeterministicFinding } from './catalogAudit.js';

const findings: DeterministicFinding[] = [
    { taskType: 'IDENTIFIER_ISRC_WITHOUT_ISWC', severity: 'warning', findings: [] },
    { taskType: 'SPLIT_SUM_MASTER', severity: 'blocking', findings: [] },
    { taskType: 'SPLIT_IPI_MISSING', severity: 'critical', findings: [] },
];

const jevVerdict = (partial: Partial<AuditTriageVerdict>): AuditTriageVerdict => ({
    releaseBlocking: true,
    priority: 'SPLITS',
    suppress: false,
    source: 'jev',
    confidence: 0.9,
    ...partial,
});

function mockClient(answers: Record<string, unknown>): TypesafeClient {
    return {
        model: 'jev-latest',
        judge: vi.fn().mockResolvedValue({ answers }),
    };
}

describe('heuristicAuditTriage (deterministic baseline)', () => {
    it('classifies blocking work as release-blocking and never suppresses', () => {
        const verdict = heuristicAuditTriage(findings);
        expect(verdict).toMatchObject({ releaseBlocking: true, source: 'heuristic', suppress: false });
        expect(verdict.priority).toBe('REGISTRATION'); // identifier findings outrank
    });

    it('routes split-only findings to SPLITS and empty audits to MONITOR_ONLY', () => {
        expect(heuristicAuditTriage([{ taskType: 'SPLIT_IPI_MISSING', severity: 'critical', findings: [] }]).priority).toBe('SPLITS');
        expect(heuristicAuditTriage([{ taskType: 'METADATA_MANDATORY_FIELD', severity: 'warning', findings: [] }]).priority).toBe('METADATA');
        expect(heuristicAuditTriage([]).priority).toBe('MONITOR_ONLY');
    });
});

describe('triageAuditFindings (Jev refinement, fallback-first)', () => {
    beforeEach(() => {
        __resetAuditJudgmentCooldownForTests();
    });

    it('falls back to the heuristic when the API key is absent (no client injected)', async () => {
        const verdict = await triageAuditFindings({ entityTypes: ['release'], findingsSummary: [] });
        expect(verdict.source).toBe('heuristic');
    });

    it('adopts confident Jev answers', async () => {
        const client = mockClient({ priority: { choice: 'SPLITS' }, release_blocking: 0.92 });
        const verdict = await triageAuditFindings(
            { entityTypes: ['release'], findingsSummary: [{ taskType: 'SPLIT_SUM_MASTER', severity: 'blocking', count: 1 }] },
            { client },
        );
        expect(verdict).toMatchObject({ source: 'jev', releaseBlocking: true, priority: 'SPLITS', confidence: 0.92 });
    });

    it('keeps the heuristic in the ambiguous band (0.40–0.70)', async () => {
        const client = mockClient({ priority: { choice: 'METADATA' }, release_blocking: 0.55 });
        const verdict = await triageAuditFindings(
            { entityTypes: ['release'], findingsSummary: [{ taskType: 'SPLIT_SUM_MASTER', severity: 'blocking', count: 1 }] },
            { client },
        );
        expect(verdict.releaseBlocking).toBe(true); // heuristic said blocking; band is too close to call
        expect(verdict.priority).toBe('METADATA'); // the choice itself was valid — adopted
    });

    it('never suppresses when deterministic blocking findings exist', async () => {
        const client = mockClient({ priority: { choice: 'MONITOR_ONLY' }, release_blocking: 0.05 });
        const verdict = await triageAuditFindings(
            { entityTypes: ['release'], findingsSummary: [{ taskType: 'SPLIT_SUM_MASTER', severity: 'blocking', count: 1 }] },
            { client },
        );
        expect(verdict.suppress).toBe(false);
    });

    it('opens a failure cooldown and falls back on upstream errors', async () => {
        const failing: TypesafeClient = {
            model: 'jev-latest',
            judge: vi.fn().mockRejectedValue(new Error('upstream down')),
        };
        const first = await triageAuditFindings({ entityTypes: ['release'], findingsSummary: [] }, { client: failing });
        expect(first.source).toBe('heuristic');

        // Even a healthy client is skipped while the cooldown is active:
        const healthy = mockClient({ priority: { choice: 'SPLITS' }, release_blocking: 0.95 });
        const second = await triageAuditFindings({ entityTypes: ['release'], findingsSummary: [] }, { client: healthy });
        expect(second.source).toBe('heuristic');
        expect(healthy.judge).not.toHaveBeenCalled();
    });

    it('keeps the heuristic on malformed answers', async () => {
        const client = mockClient({ priority: 42, release_blocking: 'not-a-number' });
        const verdict = await triageAuditFindings({ entityTypes: ['release'], findingsSummary: [] }, { client });
        expect(verdict.source).toBe('heuristic');
    });
});

describe('applySeverityTriage (severity policy)', () => {
    it('suppression demotes non-blocking findings to info but never touches blocking', () => {
        const out = applySeverityTriage(findings, jevVerdict({ suppress: true }));
        expect(out.find((r) => r.taskType === 'IDENTIFIER_ISRC_WITHOUT_ISWC')?.severity).toBe('info');
        expect(out.find((r) => r.taskType === 'SPLIT_SUM_MASTER')?.severity).toBe('blocking');
    });

    it('confident release-blocking escalates critical→blocking and warning→critical', () => {
        const out = applySeverityTriage(findings, jevVerdict({ releaseBlocking: true, source: 'jev' }));
        expect(out.find((r) => r.taskType === 'SPLIT_IPI_MISSING')?.severity).toBe('blocking');
        expect(out.find((r) => r.taskType === 'IDENTIFIER_ISRC_WITHOUT_ISWC')?.severity).toBe('critical');
    });

    it('heuristic verdicts never escalate (Jev-only escalation policy)', () => {
        const out = applySeverityTriage(findings, { ...jevVerdict({ source: 'heuristic' }) });
        expect(out.find((r) => r.taskType === 'SPLIT_IPI_MISSING')?.severity).toBe('critical');
    });
});
