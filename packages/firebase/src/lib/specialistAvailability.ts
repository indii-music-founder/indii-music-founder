import { VertexRoutingError } from './vertexRouting';

export type SpecialistFailureCategory =
  | 'routing_misconfiguration'
  | 'specialist_unavailable'
  | 'provider_outage'
  | 'provider_rejected'
  | 'provider_unknown';

export interface SpecialistUnavailablePayload {
  error: {
    code: 'SPECIALIST_UNAVAILABLE';
    message: string;
    retryable: boolean;
    category: SpecialistFailureCategory;
    nextActions: Array<'retry_later' | 'select_qualified_specialist'>;
  };
}

export class SpecialistUnavailableError extends Error {
  readonly code = 'SPECIALIST_UNAVAILABLE';

  constructor(
    readonly category: SpecialistFailureCategory,
    readonly retryable: boolean,
    readonly cause: unknown,
  ) {
    super('This specialist is temporarily unavailable. Your request was not processed by another model.');
    this.name = 'SpecialistUnavailableError';
  }

  toPublicPayload(): SpecialistUnavailablePayload {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        category: this.category,
        nextActions: this.retryable ? ['retry_later', 'select_qualified_specialist'] : ['select_qualified_specialist'],
      },
    };
  }
}

/** Allowlisted fields only: provider errors may contain prompts, credentials, or URLs. */
export function specialistFailureDiagnostics(error: unknown): { providerStatus?: number; providerCode?: string } {
  if (!error || typeof error !== 'object') return {};
  const record = error as Record<string, unknown>;
  const status = [record.status, record.statusCode, record.code].find(value =>
    typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599);
  const codes = ['INVALID_ARGUMENT', 'UNAUTHENTICATED', 'PERMISSION_DENIED', 'NOT_FOUND', 'RESOURCE_EXHAUSTED', 'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'INTERNAL'];
  const code = typeof record.code === 'string' && codes.includes(record.code) ? record.code : undefined;
  return {
    ...(typeof status === 'number' ? { providerStatus: status } : {}),
    ...(code ? { providerCode: code } : {}),
  };
}

export function classifySpecialistFailure(error: unknown): SpecialistUnavailableError {
  if (error instanceof SpecialistUnavailableError) return error;
  if (error instanceof VertexRoutingError) {
    return new SpecialistUnavailableError('routing_misconfiguration', false, error);
  }

  const { providerStatus: status, providerCode: code } = specialistFailureDiagnostics(error);
  const message = error instanceof Error ? error.message : '';
  if ([400, 401, 403].includes(status ?? 0) ||
      ['INVALID_ARGUMENT', 'UNAUTHENTICATED', 'PERMISSION_DENIED'].includes(code ?? '')) {
    return new SpecialistUnavailableError('provider_rejected', false, error);
  }
  if (status === 404 || code === 'NOT_FOUND' || /NOT_FOUND|\b404\b|not found|does not exist|was not found/i.test(message)) {
    return new SpecialistUnavailableError('specialist_unavailable', true, error);
  }
  if (status === 429 || (status !== undefined && status >= 500) ||
      ['RESOURCE_EXHAUSTED', 'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'INTERNAL'].includes(code ?? '') ||
      /\b(?:429|5\d\d)\b|timed out|timeout|UNAVAILABLE|DEADLINE_EXCEEDED/i.test(message)) {
    return new SpecialistUnavailableError('provider_outage', true, error);
  }
  return new SpecialistUnavailableError('provider_unknown', false, error);
}
