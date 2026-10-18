import { z } from 'zod';
import { RightsCaseSchema, RightsId, Sha256, SessionStateSchema, SessionControlSchema, RIGHTS_LIMITS } from './contracts.js';
import { RIGHTS_RECOVERY, RightsBrowserExecutionSchema } from './sessionLifecycle.js';

const SavedCase = z.object({ ownerUid: z.string(), manifest: RightsCaseSchema, filingId: RightsId, manifestHash: Sha256 });
/** Only server-owned snapshots can restore a saved approval reference. */
export function restoreRightsCase(raw: unknown, ownerUid: string) {
  const record = SavedCase.parse(raw);
  if (record.ownerUid !== ownerUid || record.filingId !== `${record.manifest.caseId}_r${record.manifest.revision}`) throw new Error('Saved filing identity does not match this account and revision.');
  return record;
}

export const RightsReceiptReportSchema = z.object({
  schemaVersion: z.literal(1), caseId: RightsId, filingId: RightsId, revision: z.number().int().positive(), manifestHash: Sha256,
  source: z.literal('user_report'),
  evidence: z.object({ evidenceId: RightsId, kind: z.literal('user_report'), externalId: z.string().trim().min(1).max(500), observedAt: z.string().datetime() }).strict(),
}).strict();
export type RightsReceiptReport = z.infer<typeof RightsReceiptReportSchema>;
export function restoreRightsReceiptReport(raw: unknown, target: { caseId: string; filingId: string; revision: number; manifestHash: string }): RightsReceiptReport {
  const report = RightsReceiptReportSchema.parse(raw);
  if (report.caseId !== target.caseId || report.filingId !== target.filingId || report.revision !== target.revision || report.manifestHash !== target.manifestHash) throw new Error('This report belongs to another filing revision. Load its saved filing first.');
  return report;
}

export const PublicRightsSessionSchema = z.object({
  sessionId: RightsId, caseId: RightsId, filingId: RightsId, manifestHash: Sha256,
  state: SessionStateSchema, control: SessionControlSchema, expiresAtMs: z.number().int().positive(), canReconnect: z.boolean(),
}).strict();
export type PublicRightsSession = z.infer<typeof PublicRightsSessionSchema>;
/** Explicit projection: execution secrets, operations, cookie state and arbitrary fields never leave the server. */
export function publicRightsSession(ownerUid: string, sessionId: string, raw: Record<string, unknown>, now: number): PublicRightsSession | undefined {
  if (raw.ownerUid !== ownerUid) return undefined;
  const canReconnect = ['connected', 'paused', 'reconnecting'].includes(String(raw.state))
    && RightsBrowserExecutionSchema.safeParse({ executionId: raw.executionId, cloudExecutionId: raw.cloudExecutionId, taskAttempt: 0 }).success
    && Number(raw.expiresAtMs) > now && Number(raw.lastActivityAtMs) > now - RIGHTS_LIMITS.idleMs && Number(raw.workerHeartbeatAtMs) > now - RIGHTS_RECOVERY.heartbeatGraceMs;
  const parsed = PublicRightsSessionSchema.safeParse({ sessionId, caseId: raw.caseId, filingId: raw.filingId, manifestHash: raw.manifestHash,
    state: raw.state, control: raw.control, expiresAtMs: raw.expiresAtMs, canReconnect });
  return parsed.success ? parsed.data : undefined;
}
