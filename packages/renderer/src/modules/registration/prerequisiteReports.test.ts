import { describe, expect, it } from 'vitest';
import { editPrerequisite, parsePrerequisiteReports, reportPrerequisite, serializePrerequisiteReports } from './prerequisiteReports';

describe('prerequisite report format (pure data, no account/provider fixtures)', () => {
  it('migrates legacy checkmarks as user reports, never provider verification', () => {
    const reports = parsePrerequisiteReports(JSON.stringify({
      pro_affiliation: { value: 'identifier', verified: true },
    }));
    expect(reports.pro_affiliation).toEqual({ value: 'identifier', completed: true, provenance: 'user_reported' });
    expect(serializePrerequisiteReports(reports)).not.toContain('verified');
  });

  it('round-trips the versioned report format without adding authority', () => {
    const reports = { mlc_membership: reportPrerequisite('identifier', true) };
    expect(parsePrerequisiteReports(serializePrerequisiteReports(reports))).toEqual(reports);
  });

  it('does not preserve a claimed provider provenance or verification field', () => {
    const reports = parsePrerequisiteReports(JSON.stringify({ schemaVersion: 2, reports: {
      isrc_prefix: { value: 'identifier', completed: true, verified: true, provenance: 'provider_verified' },
    } }));
    expect(reports.isrc_prefix?.provenance).toBe('user_reported');
    expect(reports.isrc_prefix).not.toHaveProperty('verified');
  });

  it('requires a nonblank identifier and a literal completion boolean', () => {
    const reports = parsePrerequisiteReports(JSON.stringify({
      isrc_prefix: { value: '  ', verified: true },
      upc_prefix: { value: 'identifier', verified: 'true' },
    }));
    expect(reports.isrc_prefix?.completed).toBe(false);
    expect(reports.upc_prefix?.completed).toBe(false);
  });

  it('invalidates completion when an identifier changes', () => {
    expect(editPrerequisite(reportPrerequisite('original', true), 'replacement').completed).toBe(false);
    expect(editPrerequisite(reportPrerequisite('original', true), 'original').completed).toBe(true);
  });

  it('does not count unknown keys or accept malformed identifiers', () => {
    expect(parsePrerequisiteReports(JSON.stringify({
      unknown: { value: 'identifier', verified: true },
      isrc_prefix: { value: 123, verified: true },
    }))).toEqual({});
  });

  it.each([null, '', 'invalid', 'null', '[]', '{"schemaVersion":3,"reports":{}}', '{"schemaVersion":2,"reports":[]}'])(
    'fails closed for an unsupported or malformed document: %s', raw => {
      expect(parsePrerequisiteReports(raw)).toEqual({});
    },
  );
});
