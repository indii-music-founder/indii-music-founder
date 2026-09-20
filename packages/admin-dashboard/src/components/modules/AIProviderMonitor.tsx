import React, { useCallback, useEffect, useState } from 'react';
import { BrainCircuit, Clock3, DollarSign, RefreshCw, ShieldCheck, Activity } from 'lucide-react';

interface ProviderAggregate {
  provider: string;
  calls: number;
  successfulCalls: number;
  failedCalls: number;
  averageLatencyMs: number;
  estimatedCostUsd: number;
  modes: Array<'evaluation' | 'shadow' | 'live'>;
  features: string[];
  lastUsedAt: string | null;
}

interface ProviderEvent {
  id: string;
  provider: string;
  model: string;
  feature: string;
  mode: 'evaluation' | 'shadow' | 'live';
  status: 'success' | 'error' | 'timeout' | 'fallback';
  durationMs: number;
  estimatedCostUsd?: number;
  occurredAt: string;
}

interface ProviderSummary {
  windowDays: number;
  totalCalls: number;
  successfulCalls: number;
  successRate: number;
  averageLatencyMs: number;
  estimatedCostUsd: number;
  providers: ProviderAggregate[];
  recentEvents: ProviderEvent[];
}

const getAdminToken = (): string | null => {
  try {
    return localStorage.getItem('indii_admin_token');
  } catch {
    return null;
  }
};

const money = (value: number): string =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });

const latency = (value: number): string => value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;

const statusClass = (status: ProviderEvent['status']): string => {
  if (status === 'success') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (status === 'fallback') return 'text-[#ffb800] bg-[#ffb800]/10 border-[#ffb800]/20';
  return 'text-red-400 bg-red-500/10 border-red-500/20';
};

export const AIProviderMonitor: React.FC = () => {
  const [data, setData] = useState<ProviderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAdminToken();
      const response = await fetch('/api/ai-providers/summary', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`AI provider telemetry returned ${response.status}`);
      setData((await response.json()) as ProviderSummary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load AI provider telemetry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (loading) {
    return <div className="border border-white/5 bg-white/[0.02] rounded-3xl p-10 text-center text-white/30 animate-pulse">Loading provider telemetry…</div>;
  }

  if (error) {
    return (
      <div className="border border-red-500/20 bg-red-500/5 rounded-3xl p-8">
        <p className="text-red-300 font-semibold">Could not load AI provider telemetry</p>
        <p className="text-white/40 text-sm mt-2">{error}</p>
        <button onClick={() => void load()} className="mt-4 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm">Retry</button>
      </div>
    );
  }

  const summary = data ?? {
    windowDays: 30,
    totalCalls: 0,
    successfulCalls: 0,
    successRate: 0,
    averageLatencyMs: 0,
    estimatedCostUsd: 0,
    providers: [],
    recentEvents: [],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-[#0d0d0d] border border-white/5 p-6 rounded-3xl">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-violet-400" />
            AI Provider Activity
          </h3>
          <p className="text-sm text-white/40 mt-1">
            Which external AI providers indii actually used in the last {summary.windowDays} days. Operational metadata only — no prompts or customer content.
          </p>
        </div>
        <button onClick={() => void load()} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {summary.totalCalls === 0 ? (
        <div className="border border-dashed border-white/10 bg-white/[0.02] rounded-3xl p-10 text-center">
          <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
          <p className="text-white/80 font-semibold">No application provider calls recorded</p>
          <p className="text-white/40 text-sm mt-2 max-w-xl mx-auto">
            TypeSafe is not currently participating in normal indii app traffic. Evaluation-only tests that do not opt into durable telemetry remain outside this dashboard.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-6">
            <Stat icon={<Activity className="w-5 h-5" />} label="Provider calls" value={summary.totalCalls.toLocaleString()} />
            <Stat icon={<ShieldCheck className="w-5 h-5" />} label="Success rate" value={`${(summary.successRate * 100).toFixed(1)}%`} />
            <Stat icon={<Clock3 className="w-5 h-5" />} label="Avg latency" value={latency(summary.averageLatencyMs)} />
            <Stat icon={<DollarSign className="w-5 h-5" />} label="Estimated cost" value={money(summary.estimatedCostUsd)} />
          </div>

          <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl p-8">
            <h4 className="text-lg font-bold mb-5">Providers</h4>
            <div className="space-y-3">
              {summary.providers.map((provider) => (
                <div key={provider.provider} className="grid grid-cols-[1.1fr_0.7fr_0.8fr_1.4fr] gap-4 items-center p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                  <div>
                    <p className="font-mono text-sm text-white/90">{provider.provider}</p>
                    <p className="text-[11px] text-white/30 mt-1">{provider.features.join(', ')}</p>
                  </div>
                  <div className="text-sm text-white/60">{provider.calls} calls</div>
                  <div className="text-sm text-white/60">{latency(provider.averageLatencyMs)}</div>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {provider.modes.map((mode) => (
                      <span key={mode} className="px-2 py-1 rounded-lg text-[10px] uppercase tracking-wider border border-white/10 bg-white/5 text-white/50">{mode}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl p-8">
            <h4 className="text-lg font-bold mb-5">Recent provider calls</h4>
            <div className="space-y-2">
              {summary.recentEvents.map((event) => (
                <div key={event.id} className="grid grid-cols-[0.8fr_1.4fr_0.7fr_0.7fr_1fr] gap-4 items-center py-3 border-b border-white/[0.04] last:border-none text-xs">
                  <span className="font-mono text-white/70">{event.provider}</span>
                  <span className="text-white/50 truncate" title={event.feature}>{event.feature}</span>
                  <span className="text-white/40 uppercase">{event.mode}</span>
                  <span className={`justify-self-start px-2 py-1 rounded-lg border ${statusClass(event.status)}`}>{event.status}</span>
                  <span className="text-right text-white/35 font-mono">{new Date(event.occurredAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="bg-[#1f222a] border border-white/5 p-6 rounded-2xl">
    <div className="flex items-center gap-2 text-violet-400 mb-3">
      {icon}
      <span className="text-xs font-bold uppercase tracking-widest text-white/40">{label}</span>
    </div>
    <div className="text-2xl font-bold tracking-tight">{value}</div>
  </div>
);
