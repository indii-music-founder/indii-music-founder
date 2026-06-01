import React, { useEffect, useState } from 'react';
import { BarChart3, Cpu, Users, DollarSign, Activity, AlertTriangle } from 'lucide-react';

/**
 * Token Usage / AI Cost module.
 *
 * Displays REAL per-user AI spend aggregated by the backend from the
 * `user_usage_stats` Firestore collection. There is no mock data: while loading
 * we show skeletons, on error an honest error card, and when there is genuinely
 * no usage in the window we show an empty state — never invented numbers.
 */

interface ModelTotal {
  model: string;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  costUsd: number;
}

interface UserTotal {
  userId: string;
  tokensUsed: number;
  requestCount: number;
  costUsd: number;
}

interface UsageSummary {
  start: string;
  end: string;
  totalCostUsd: number;
  totalTokens: number;
  totalRequests: number;
  activeUsers: number;
  averageCostPerUserUsd: number;
  byModel: ModelTotal[];
  byUser: UserTotal[];
}

const usd = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });

const compact = (n: number): string => n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** Read an admin token (Firebase ID token) if one has been stored for API auth. */
const getAdminToken = (): string | null => {
  try {
    return localStorage.getItem('indii_admin_token');
  } catch {
    return null;
  }
};

export const TokenUsage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [data, setData] = useState<UsageSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setAuthRequired(false);
      try {
        const token = getAdminToken();
        const res = await fetch('/api/usage/summary', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.status === 401 || res.status === 403) {
          if (!cancelled) setAuthRequired(true);
          return;
        }
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const json = (await res.json()) as UsageSummary;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load usage data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Auth required (honest — the API gates on an @indii.music admin token) ──
  if (authRequired) {
    return (
      <Panel
        icon={<AlertTriangle className="w-6 h-6 text-orange-400" />}
        title="Admin authentication required"
        subtitle="The usage API requires an @indii.music admin token. Store a valid Firebase ID token under localStorage key 'indii_admin_token' to view real spend."
      />
    );
  }

  // ── Error ──
  if (error) {
    return (
      <Panel
        icon={<AlertTriangle className="w-6 h-6 text-red-400" />}
        title="Couldn't load usage data"
        subtitle={error}
      />
    );
  }

  // ── Loading skeletons ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#1A1A1D] border border-white/5 p-6 rounded-2xl">
              <div className="h-4 w-20 bg-white/10 rounded animate-pulse mb-4" />
              <div className="h-8 w-28 bg-white/10 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="bg-[#121214] border border-white/5 rounded-3xl p-8 h-64 animate-pulse" />
      </div>
    );
  }

  // ── Empty state (genuinely no usage in the window) ──
  if (!data || data.totalRequests === 0) {
    return (
      <Panel
        icon={<Activity className="w-6 h-6 text-blue-400" />}
        title="No AI usage recorded yet"
        subtitle={
          data
            ? `No activity between ${data.start} and ${data.end}. Numbers will appear here as soon as users start running AI tasks.`
            : 'Usage will appear here as soon as users start running AI tasks.'
        }
      />
    );
  }

  const maxModelCost = Math.max(...data.byModel.map((m) => m.costUsd), 0.0000001);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#121214] border border-white/5 p-6 rounded-3xl">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="text-blue-400 w-6 h-6" />
            AI Token Usage &amp; Cost
          </h3>
          <p className="text-sm text-white/40 mt-1">
            Real spend from {data.start} to {data.end}. Estimated from token counts — reconcile against GCP Billing for ground truth.
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-6">
        <Stat icon={<DollarSign className="w-5 h-5" />} label="Total cost" value={usd(data.totalCostUsd)} accent="text-green-400" />
        <Stat icon={<Cpu className="w-5 h-5" />} label="Total tokens" value={compact(data.totalTokens)} accent="text-blue-400" />
        <Stat icon={<Activity className="w-5 h-5" />} label="Requests" value={compact(data.totalRequests)} accent="text-purple-400" />
        <Stat icon={<Users className="w-5 h-5" />} label="Avg / user" value={usd(data.averageCostPerUserUsd)} accent="text-orange-400" />
      </div>

      {/* Cost by model */}
      <div className="bg-[#121214] border border-white/5 rounded-3xl p-8">
        <h4 className="text-lg font-bold tracking-tight mb-6 flex items-center gap-2">
          <Cpu className="text-blue-400 w-5 h-5" />
          Cost by model
        </h4>
        <div className="space-y-4">
          {data.byModel.map((m) => (
            <div key={m.model} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-white/70">{m.model}</span>
                <span className="font-bold text-green-400">{usd(m.costUsd)}</span>
              </div>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                  style={{ width: `${Math.max(2, (m.costUsd / maxModelCost) * 100)}%` }}
                />
              </div>
              <div className="flex items-center gap-4 text-[11px] text-white/30 font-mono">
                <span>{compact(m.inputTokens)} in</span>
                <span>{compact(m.outputTokens)} out</span>
                <span>{compact(m.requestCount)} reqs</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Spend by user */}
      <div className="bg-[#121214] border border-white/5 rounded-3xl p-8">
        <h4 className="text-lg font-bold tracking-tight mb-6 flex items-center gap-2">
          <Users className="text-orange-400 w-5 h-5" />
          Spend by user
        </h4>
        <div className="space-y-2">
          {data.byUser.map((u) => (
            <div
              key={u.userId}
              className="flex items-center gap-6 p-4 hover:bg-white/5 rounded-2xl transition-colors border border-transparent hover:border-white/5"
            >
              <div className="flex-1 font-mono text-sm text-white/70 truncate">{u.userId}</div>
              <div className="w-24 text-right text-xs text-white/30 font-mono">{compact(u.tokensUsed)} tok</div>
              <div className="w-20 text-right text-xs text-white/30 font-mono">{compact(u.requestCount)} req</div>
              <div className="w-24 text-right text-sm font-bold text-green-400">{usd(u.costUsd)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; accent: string }> = ({
  icon,
  label,
  value,
  accent,
}) => (
  <div className="bg-[#1A1A1D] border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-white/10 transition-all">
    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-[40px] pointer-events-none" />
    <div className={`flex items-center gap-2 ${accent} mb-3 relative z-10`}>
      {icon}
      <span className="text-xs font-bold uppercase tracking-widest text-white/40">{label}</span>
    </div>
    <div className="text-2xl font-bold tracking-tight relative z-10">{value}</div>
  </div>
);

const Panel: React.FC<{ icon: React.ReactNode; title: string; subtitle: string }> = ({ icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center text-center h-64 border border-white/5 bg-white/[0.02] rounded-3xl border-dashed p-8">
    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 mb-4">
      {icon}
    </div>
    <p className="text-white/80 font-semibold">{title}</p>
    <p className="text-white/40 text-sm mt-2 max-w-md">{subtitle}</p>
  </div>
);
