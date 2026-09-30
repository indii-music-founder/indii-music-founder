/**
 * Structured JSON logger for Node.js Cloud Functions.
 * Emits a single line JSON record to stdout (console.log), which is captured by Cloud Logging.
 * Logging options are optional; undefined fields are omitted.
 */

export enum Severity {
  DEFAULT = 'DEFAULT',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  NOTICE = 'NOTICE',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
  ALERT = 'ALERT',
  EMERGENCY = 'EMERGENCY',
}

export interface LogOptions {
  /** Optional severity level – defaults to DEFAULT */
  severity?: Severity;
  /** Optional trace identifier for cross‑service correlation */
  traceId?: string;
  /** Arbitrary additional payload fields */
  payload?: Record<string, unknown>;
}

/**
 * Write a structured JSON log entry.
 *
 * The function is deliberately side‑effect‑only (writes to console) and does not depend on a runtime SDK.
 * It can be used in unknown Cloud Function or server‑side environment.
 */
export function logJson(message: string, opts: LogOptions = {}): void {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    severity: opts.severity ?? Severity.DEFAULT,
    message,
    traceId: opts.traceId,
    ...(opts.payload ?? {}),
  };
  const cleaned = Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined));
  console.log(JSON.stringify(cleaned));
}

export default { logJson, Severity };
