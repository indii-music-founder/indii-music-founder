import { VertexRoutingError } from './vertexRouting';

export type SpecialistFailureCategory =
  | 'routing_misconfiguration'
  | 'specialist_unavailable'
  | 'provider_outage';

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
        nextActions: ['retry_later', 'select_qualified_specialist'],
      },
    };
  }
}

export function classifySpecialistFailure(error: unknown): SpecialistUnavailableError {
  if (error instanceof SpecialistUnavailableError) return error;
  if (error instanceof VertexRoutingError) {
    return new SpecialistUnavailableError('routing_misconfiguration', false, error);
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/NOT_FOUND|404|not found|does not exist|was not found/i.test(message)) {
    return new SpecialistUnavailableError('specialist_unavailable', true, error);
  }

  return new SpecialistUnavailableError('provider_outage', true, error);
}
