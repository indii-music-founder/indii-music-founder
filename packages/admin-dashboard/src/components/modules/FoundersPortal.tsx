import React, { useEffect, useState } from 'react';
import { Users, Crown, Clock, AlertTriangle } from 'lucide-react';

/**
 * Founders Portal.
 *
 * Shows the REAL founders roster from the `founders` Firestore collection
 * (written by activateFounderPass). No mock data: while loading we show
 * skeletons, on error an honest card, and when no founders have activated yet
 * an empty state with the live seat count — never invented users.
 */

interface Founder {
  seat: number | null;
  name: string;
  joinedAt: string | null;
  uid: string;
  agreementVersion: string | null;
}

interface FoundersResponse {
  maxSeats: number;
  count: number;
  founders: Founder[];
}

const getAdminToken = (): string | null => {
  try {
    return localStorage.getItem('indii_admin_token');
  } catch {
    return null;
  }
};

export const FoundersPortal: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [data, setData] = useState<FoundersResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setAuthRequired(false);
      try {
        const token = getAdminToken();
        const res = await fetch('/api/founders', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.status === 401 || res.status === 403) {
          if (!cancelled) setAuthRequired(true);
          return;
        }
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const json = (await res.json()) as FoundersResponse;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load founders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxSeats = data?.maxSeats ?? 10;
  const count = data?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#121214] border border-white/5 p-6 rounded-3xl">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="text-orange-400 w-6 h-6" />
            Founders Portal
          </h3>
          <p className="text-sm text-white/40 mt-1">Live founders roster from the activation ledger.</p>
        </div>
      </div>

      {authRequired ? (
        <Panel
          icon={<AlertTriangle className="w-6 h-6 text-orange-400" />}
          title="Admin authentication required"
          subtitle="The founders API requires an @indii.music admin token. Store a valid Firebase ID token under localStorage key 'indii_admin_token'."
        />
      ) : error ? (
        <Panel
          icon={<AlertTriangle className="w-6 h-6 text-red-400" />}
          title="Couldn't load founders"
          subtitle={error}
        />
      ) : loading ? (
        <div className="bg-[#121214] border border-white/5 rounded-3xl p-8 h-64 animate-pulse" />
      ) : (
        <>
          {/* Seat count — real */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-[#1A1A1D] border border-white/5 p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <Crown className="w-5 h-5 text-orange-400" />
                <h4 className="font-bold text-white/70">Founders activated</h4>
              </div>
              <p className="text-3xl font-bold text-white">{count}</p>
              <p className="text-xs text-white/40 mt-1">of {maxSeats} seats</p>
            </div>
            <div className="bg-[#1A1A1D] border border-white/5 p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-white/70">Seats remaining</h4>
              </div>
              <p className="text-3xl font-bold text-white">{Math.max(0, maxSeats - count)}</p>
              <p className="text-xs text-white/40 mt-1">Available for activation</p>
            </div>
          </div>

          {/* Roster — real, or honest empty state */}
          {count === 0 ? (
            <Panel
              icon={<Users className="w-6 h-6 text-orange-400" />}
              title="No founders activated yet"
              subtitle="Founders will appear here the moment they activate a Founders Pass. Nothing here is placeholder data."
            />
          ) : (
            <div className="bg-[#121214] border border-white/5 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h4 className="text-lg font-bold tracking-tight">Roster</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Seat</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Name</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">UID</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data!.founders.map((f) => (
                      <tr key={f.uid} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-orange-500/10 text-orange-400 rounded text-[10px] font-bold border border-orange-500/20">
                            #{f.seat ?? '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-sm text-white/90">{f.name}</td>
                        <td className="px-6 py-4 text-white/50 text-xs font-mono truncate max-w-[200px]">{f.uid}</td>
                        <td className="px-6 py-4 text-xs text-white/40 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {f.joinedAt ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Panel: React.FC<{ icon: React.ReactNode; title: string; subtitle: string }> = ({ icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center text-center h-64 border border-white/5 bg-white/[0.02] rounded-3xl border-dashed p-8">
    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 mb-4">{icon}</div>
    <p className="text-white/80 font-semibold">{title}</p>
    <p className="text-white/40 text-sm mt-2 max-w-md">{subtitle}</p>
  </div>
);
