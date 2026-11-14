import type { FounderPrerequisiteId } from './types';

export const PREREQUISITE_STORAGE_KEY = 'indii_founder_readiness_prerequisites_v1';

export const PREREQUISITE_IDS: readonly FounderPrerequisiteId[] = [
  'isrc_prefix', 'upc_prefix', 'ddex_dpid', 'pro_affiliation',
  'mlc_membership', 'soundexchange', 'usco_org',
];

/** Browser checklists record statements, never independent provider evidence. */
export interface PrerequisiteReport {
  value: string;
  completed: boolean;
  provenance: 'user_reported';
}

export type PrerequisiteReports = Partial<Record<FounderPrerequisiteId, PrerequisiteReport>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function reportPrerequisite(value: string, completed: boolean): PrerequisiteReport {
  return { value, completed: completed && value.trim().length > 0, provenance: 'user_reported' };
}

/** Changing an identifier invalidates the completion statement for the old one. */
export function editPrerequisite(report: PrerequisiteReport | undefined, value: string): PrerequisiteReport {
  return reportPrerequisite(value, report?.value === value && report.completed);
}

export function parsePrerequisiteReports(raw: string | null): PrerequisiteReports {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const versioned = Object.hasOwn(parsed, 'schemaVersion');
    if (versioned && parsed.schemaVersion !== 2) return {};
    const records = versioned ? parsed.reports : parsed;
    if (!isRecord(records)) return {};
    const reports: PrerequisiteReports = {};
    for (const id of PREREQUISITE_IDS) {
      const entry = records[id];
      if (!isRecord(entry) || typeof entry.value !== 'string') continue;
      // Legacy `verified` was a local checkbox, not provider verification.
      reports[id] = reportPrerequisite(entry.value, versioned
        ? entry.completed === true
        : entry.verified === true);
    }
    return reports;
  } catch {
    return {};
  }
}

export function serializePrerequisiteReports(reports: PrerequisiteReports): string {
  const normalized: PrerequisiteReports = {};
  for (const id of PREREQUISITE_IDS) {
    const report = reports[id];
    if (report) normalized[id] = reportPrerequisite(report.value, report.completed);
  }
  return JSON.stringify({ schemaVersion: 2, reports: normalized });
}
