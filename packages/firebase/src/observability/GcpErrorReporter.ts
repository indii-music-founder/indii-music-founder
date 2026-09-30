import { ErrorReporting } from '@google-cloud/error-reporting';

let client: ErrorReporting | null = null;

function getClient(): ErrorReporting {
  if (!client) {
    client = new ErrorReporting({ projectId: process.env.GCLOUD_PROJECT });
  }
  return client;
}

/** Options for reporting an error */
export interface GcpErrorReporterOptions {
  /** Optional custom message, defaults to error.message */
  message?: string;
  /** Optional trace identifier */
  traceId?: string;
  /** Optional severity (e.g., 'WARNING', 'INFO'); 'ERROR' is the default and omitted */
  severity?: string;
}

/** Report an error to GCP Error Reporting */
export function reportError(error: unknown, options: GcpErrorReporterOptions = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const client = getClient();
  let customMessage = options.message ?? err.message;
  if (options.traceId) {
    customMessage = `[traceId:${options.traceId}] ${customMessage}`;
  }
  if (options.severity && options.severity !== 'ERROR') {
    customMessage = `[severity:${options.severity}] ${customMessage}`;
  }
  // Manual reporting: (err, request?, customMessage?, callback?)
  client.report(err, undefined, customMessage);
}
