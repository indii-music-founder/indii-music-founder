import React, { useCallback, useEffect, useState } from 'react';
import { History, RefreshCw, ShieldCheck } from 'lucide-react';

/**
 * Access Log module.
 *
 * Displays the REAL access audit recorded by the backend: every @indii.music
 * identity that entered this dashboard, when, and from where (throttled to one
 * entry per identity per 30 minutes). There is no mock data: skeletons while
 * loading, an honest error card on failure, and a truthful empty state — never
 * invented entries.
 */

interface AccessEntry {
  id: string;
  uid?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  // Firestore serverTimestamp reaches the client as either an ISO-ish string or
  // a { seconds, nanoseconds } shape depending on serialization — accept both.
  at?: string | { seconds?: number; nanoseconds?: number } | null;
}

/** Read an admin token (Firebase ID token) if one has been stored for API auth. */
const getAdminToken = (): string | null => {
  try {
    return localStorage.getItem('indii_admin_token');
  } catch {
    return null;
  }
};

const toDate = (value: AccessEntry['at']): Date | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return null;
};

const formatDate = (d: Date): string =>
  d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export const AccessLog: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<AccessEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAdminToken();
      const res = await fetch('/api/admin/access-log', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        throw new Error(`Access log returned ${res.status}`);
      }
      const data = (await res.json()) as { entries?: AccessEntry[] };
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the access log.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred like the sibling modules: keeps setState out of the effect body.
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ffb800]/10 border border-[#ffb800]/20 flex items-center justify-center">
            <History className="w-5 h-5 text-[#ffb800]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Dashboard Access Log</h3>
            <p className="text-white/40 text-xs mt-0.5">
              Every @indii.music sign-in session, newest first. One entry per identity per 30 minutes.
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white/70 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="border border-white/5 bg-white/[0.02] rounded-2xl p-8 text-center text-white/30 text-sm animate-pulse">
          Loading access trail…
        </div>
      ) : error ? (
        <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-6 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-300">Could not load the access log</p>
            <p className="text-white/40 text-xs mt-1">{error}</p>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="border border-dashed border-white/10 bg-white/[0.02] rounded-2xl p-8 text-center">
          <p className="text-white/40 text-sm">No access recorded yet.</p>
          <p className="text-white/25 text-xs mt-1">The log fills automatically the moment someone signs in.</p>
        </div>
      ) : (
        <div className="border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/5">
                <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-extrabold text-white/30">Identity</th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-extrabold text-white/30">Last Entry</th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-extrabold text-white/30">IP</th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-extrabold text-white/30 hidden md:table-cell">Device / Agent</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const at = toDate(entry.at);
                return (
                  <tr key={entry.id} className="border-b border-white/[0.03] last:border-none hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-white">{entry.email || entry.uid || 'Unknown'}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-white/60 font-mono">
                      {at ? formatDate(at) : '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-white/60 font-mono">{entry.ip || '—'}</td>
                    <td className="px-6 py-4 text-xs text-white/35 font-mono max-w-xs truncate hidden md:table-cell" title={entry.userAgent}>
                      {entry.userAgent || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
