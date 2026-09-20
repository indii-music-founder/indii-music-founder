export type ProviderMode = 'evaluation' | 'shadow' | 'live';
export type ProviderStatus = 'success' | 'error' | 'timeout' | 'fallback';

export interface ProviderUsageEvent {
  id: string;
  provider: string;
  model: string;
  feature: string;
  mode: ProviderMode;
  status: ProviderStatus;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  requestId?: string;
  occurredAt: string;
}

export interface ProviderAggregate {
  provider: string;
  calls: number;
  successfulCalls: number;
  failedCalls: number;
  averageLatencyMs: number;
  estimatedCostUsd: number;
  modes: ProviderMode[];
  features: string[];
  lastUsedAt: string | null;
}

export interface ProviderUsageSummary {
  windowDays: number;
  totalCalls: number;
  successfulCalls: number;
  successRate: number;
  averageLatencyMs: number;
  estimatedCostUsd: number;
  providers: ProviderAggregate[];
  recentEvents: ProviderUsageEvent[];
}

const ALLOWED_MODES = new Set<ProviderMode>(['evaluation', 'shadow', 'live']);
const ALLOWED_STATUSES = new Set<ProviderStatus>(['success', 'error', 'timeout', 'fallback']);

function asFiniteNonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function asIso(value: unknown): string | null {
  try {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    if (value && typeof value === 'object' && 'toDate' in value) {
      const maybeDate = (value as { toDate?: () => Date }).toDate?.();
      return maybeDate instanceof Date && !Number.isNaN(maybeDate.getTime()) ? maybeDate.toISOString() : null;
    }
    if (value && typeof value === 'object' && 'seconds' in value) {
      const seconds = (value as { seconds?: unknown }).seconds;
      return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function normalizeProviderEvent(
  id: string,
  raw: Record<string, unknown>,
): ProviderUsageEvent | null {
  const provider = typeof raw.provider === 'string' ? raw.provider.trim() : '';
  const model = typeof raw.model === 'string' ? raw.model.trim() : '';
  const feature = typeof raw.feature === 'string' ? raw.feature.trim() : '';
  const mode = raw.mode as ProviderMode;
  const status = raw.status as ProviderStatus;
  const durationMs = asFiniteNonNegative(raw.durationMs);
  const occurredAt = asIso(raw.occurredAt);

  if (!provider || !model || !feature || !ALLOWED_MODES.has(mode) || !ALLOWED_STATUSES.has(status)) return null;
  if (durationMs === undefined || !occurredAt) return null;

  return {
    id,
    provider,
    model,
    feature,
    mode,
    status,
    durationMs,
    inputTokens: asFiniteNonNegative(raw.inputTokens),
    outputTokens: asFiniteNonNegative(raw.outputTokens),
    estimatedCostUsd: asFiniteNonNegative(raw.estimatedCostUsd),
    requestId: typeof raw.requestId === 'string' && raw.requestId.trim() ? raw.requestId.trim() : undefined,
    occurredAt,
  };
}

export function aggregateProviderUsage(events: ProviderUsageEvent[]): ProviderUsageSummary {
  const byProvider = new Map<string, {
    calls: number;
    successfulCalls: number;
    failedCalls: number;
    latencyTotal: number;
    cost: number;
    modes: Set<ProviderMode>;
    features: Set<string>;
    lastUsedAt: string | null;
  }>();

  let successfulCalls = 0;
  let latencyTotal = 0;
  let estimatedCostUsd = 0;

  for (const event of events) {
    const success = event.status === 'success';
    if (success) successfulCalls += 1;
    latencyTotal += event.durationMs;
    estimatedCostUsd += event.estimatedCostUsd ?? 0;

    const current = byProvider.get(event.provider) ?? {
      calls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      latencyTotal: 0,
      cost: 0,
      modes: new Set<ProviderMode>(),
      features: new Set<string>(),
      lastUsedAt: null,
    };
    current.calls += 1;
    current.successfulCalls += success ? 1 : 0;
    current.failedCalls += success ? 0 : 1;
    current.latencyTotal += event.durationMs;
    current.cost += event.estimatedCostUsd ?? 0;
    current.modes.add(event.mode);
    current.features.add(event.feature);
    if (!current.lastUsedAt || event.occurredAt > current.lastUsedAt) current.lastUsedAt = event.occurredAt;
    byProvider.set(event.provider, current);
  }

  const totalCalls = events.length;
  return {
    windowDays: 30,
    totalCalls,
    successfulCalls,
    successRate: totalCalls > 0 ? successfulCalls / totalCalls : 0,
    averageLatencyMs: totalCalls > 0 ? latencyTotal / totalCalls : 0,
    estimatedCostUsd,
    providers: Array.from(byProvider.entries())
      .map(([provider, value]) => ({
        provider,
        calls: value.calls,
        successfulCalls: value.successfulCalls,
        failedCalls: value.failedCalls,
        averageLatencyMs: value.calls > 0 ? value.latencyTotal / value.calls : 0,
        estimatedCostUsd: value.cost,
        modes: Array.from(value.modes).sort(),
        features: Array.from(value.features).sort(),
        lastUsedAt: value.lastUsedAt,
      }))
      .sort((a, b) => b.calls - a.calls || a.provider.localeCompare(b.provider)),
    recentEvents: [...events]
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 50),
  };
}
