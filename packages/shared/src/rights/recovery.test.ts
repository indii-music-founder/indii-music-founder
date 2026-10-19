/** Pure contract tests, not a live artist or external filing journey. */
import { describe, expect, it } from 'vitest';
import type { RightsCase } from './contracts.js';
import { publicRightsSession, restoreRightsCase, restoreRightsReceiptReport } from './recovery.js';

const now = 10_000_000;
const hash = 'a'.repeat(64);
const target = { caseId: 'case-1', filingId: 'case-1_r2', revision: 2, manifestHash: hash };
const report = { schemaVersion: 1, ...target, source: 'user_report', evidence: { evidenceId: 'report-1', kind: 'user_report', externalId: 'reported-number', observedAt: '2026-01-01T00:00:00.000Z' } };
const session = { ownerUid: 'owner', ...target, state: 'connected', control: 'none', expiresAtMs: now + 60_000,
  workerHeartbeatAtMs: now, lastActivityAtMs: now, executionId: 'd740c869-80a1-4863-b9b7-235ae5592ef8', cloudExecutionId: 'execution-1', executionSecretHash: 'private', operationName: 'private', storageState: { private: true } };
describe('filing recovery boundaries', () => {
  it('restores the exact evidence ID and timestamp for an idempotent retry', () => {
    expect(restoreRightsReceiptReport(JSON.parse(JSON.stringify(report)), target).evidence).toEqual(report.evidence);
  });
  it('rejects reports for another case, filing, revision or manifest', () => {
    for (const other of [{ caseId: 'other' }, { filingId: 'other' }, { revision: 3 }, { manifestHash: 'b'.repeat(64) }]) {
      expect(() => restoreRightsReceiptReport(report, { ...target, ...other })).toThrow('another filing revision');
    }
  });
  it('never upgrades a downloaded report to official evidence or accepts extra capabilities', () => {
    expect(() => restoreRightsReceiptReport({ ...report, source: 'official' }, target)).toThrow();
    expect(() => restoreRightsReceiptReport({ ...report, evidence: { ...report.evidence, kind: 'submission_receipt' } }, target)).toThrow();
    expect(() => restoreRightsReceiptReport({ ...report, script: 'execute' }, target)).toThrow();
  });
  it('projects only safe session metadata for the authenticated owner', () => {
    const projected = publicRightsSession('owner', 'session-1', session, now);
    expect(projected).toEqual({ sessionId: 'session-1', caseId: 'case-1', filingId: 'case-1_r2', manifestHash: hash, state: 'connected', control: 'none', expiresAtMs: now + 60_000, canReconnect: true });
    expect(publicRightsSession('another-owner', 'session-1', session, now)).toBeUndefined();
  });
  it('never reconnects an expired, lost, unclaimed or ending browser', () => {
    for (const changes of [{ expiresAtMs: now }, { lastActivityAtMs: now - 15 * 60_000 }, { lastActivityAtMs: undefined }, { workerHeartbeatAtMs: now - 90_000 }, { executionId: undefined }, { executionId: '' }, { cloudExecutionId: undefined }, { state: 'termination_pending' }, { state: 'ended' }, { state: 'queued' }]) {
      expect(publicRightsSession('owner', 'session-1', { ...session, ...changes }, now)?.canReconnect).toBe(false);
    }
  });
  it('rejects malformed public sessions', () => {
    expect(publicRightsSession('owner', 'session-1', { ...session, state: 'invented' }, now)).toBeUndefined();
    expect(publicRightsSession('owner', 'session-1', { ...session, manifestHash: 'invalid' }, now)).toBeUndefined();
  });
  it('restores the saved revision without manufacturing the next revision or filing ID', () => {
    const manifest: RightsCase = {
      schemaVersion: 2, caseId: 'case-1', revision: 2, applicationKind: 'standard', claimScope: 'composition',
      parties: [{ entityId: 'author-1', legalName: 'Contract Fixture', address: 'Fixture address', citizenshipOrDomicile: 'Fixture nation' }],
      works: [{ entityId: 'work-1', trackIds: ['track-1'], kind: 'musical_work', title: 'Contract fixture', authorIds: ['author-1'], claimantIds: ['author-1'], yearOfCreation: 2025, workForHire: false, exclusions: [], publication: { status: 'unpublished' }, deposit: { bucket: 'fixture', path: 'fixture.pdf', generation: '1', sha256: hash, filename: 'fixture.pdf', mimeType: 'application/pdf', byteSize: 1 } }],
      certifierPartyId: 'author-1', authority: 'author',
    };
    const saved = { ownerUid: 'owner', manifest, filingId: target.filingId, manifestHash: hash };
    expect(restoreRightsCase(saved, 'owner').manifest.revision).toBe(2);
    expect(restoreRightsCase(saved, 'owner').filingId).toBe('case-1_r2');
    expect(() => restoreRightsCase(saved, 'other-owner')).toThrow('account and revision');
    expect(() => restoreRightsCase({ ...saved, filingId: 'case-1_r3' }, 'owner')).toThrow('account and revision');
  });
  it('does not restore malformed saved cases', () => {
    expect(() => restoreRightsCase({ ownerUid: 'owner', manifest: {}, filingId: 'case-1_r2', manifestHash: hash }, 'owner')).toThrow();
  });
});
