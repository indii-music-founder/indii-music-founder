import * as admin from 'firebase-admin';

export type AIProviderTelemetryMode = 'evaluation' | 'shadow' | 'live';
export type AIProviderTelemetryStatus = 'success' | 'error' | 'timeout' | 'fallback';

export interface AIProviderTelemetryEvent {
  provider: string;
  model: string;
  feature: string;
  mode: AIProviderTelemetryMode;
  status: AIProviderTelemetryStatus;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  requestId?: string;
}

const COLLECTION = 'ai_provider_usage_events';
const MAX_LABEL_LENGTH = 128;

function safeLabel(value: string, field: string): string {
  const clean = value.trim();
  if (!clean || clean.length > MAX_LABEL_LENGTH) {
    throw new Error(`Invalid AI provider telemetry ${field}.`);
  }
  return clean;
}

function safeNonNegative(value: number | undefined, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid AI provider telemetry ${field}.`);
  }
  return value;
}

/**
 * Durable, payload-free provider observability for the founder dashboard.
 *
 * Never pass prompts, user text, document IDs, emails, API keys, response
 * bodies, or other customer content here. This collection is operational
 * metadata only and is server-authoritative.
 */
export async function recordAIProviderEvent(event: AIProviderTelemetryEvent): Promise<void> {
  const record: Record<string, unknown> = {
    provider: safeLabel(event.provider, 'provider'),
    model: safeLabel(event.model, 'model'),
    feature: safeLabel(event.feature, 'feature'),
    mode: event.mode,
    status: event.status,
    durationMs: safeNonNegative(event.durationMs, 'durationMs'),
    occurredAt: new Date(),
  };

  const inputTokens = safeNonNegative(event.inputTokens, 'inputTokens');
  const outputTokens = safeNonNegative(event.outputTokens, 'outputTokens');
  const estimatedCostUsd = safeNonNegative(event.estimatedCostUsd, 'estimatedCostUsd');
  if (inputTokens !== undefined) record.inputTokens = inputTokens;
  if (outputTokens !== undefined) record.outputTokens = outputTokens;
  if (estimatedCostUsd !== undefined) record.estimatedCostUsd = estimatedCostUsd;
  if (event.requestId?.trim()) record.requestId = event.requestId.trim().slice(0, MAX_LABEL_LENGTH);

  await admin.firestore().collection(COLLECTION).add(record);
}
