import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, MailCheck, Users } from 'lucide-react';

interface WaitlistEntry {
  id: string;
  email: string;
  joinedAt: string | null;
  source: string;
  submissionCount: number;
  submissionOrder: number;
  verificationStatus: 'verified' | 'unverified';
  status: 'waitlisted' | 'invited' | 'accepted' | 'declined' | 'revoked' | 'legacy_unverified';
}

interface WaitlistResponse {
  count: number;
  totalSubmissions: number;
  verifiedCount: number;
  unverifiedCount: number;
  verificationEnabled: boolean;
  entries: WaitlistEntry[];
}

const getAdminToken = (): string | null => {
  try {
    return localStorage.getItem('indii_admin_token');
  } catch {
    return null;
  }
};

export const WaitlistPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [data, setData] = useState<WaitlistResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const token = getAdminToken();
        const response = await fetch('/api/waitlist', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: AbortSignal.timeout(15000),
        });

        if (response.status === 401 || response.status === 403) {
          if (!cancelled) setAuthRequired(true);
          return;
        }
        if (!response.ok) throw new Error(`Server returned ${response.status}`);

        const result = (await response.json()) as WaitlistResponse;
        if (!cancelled) setData(result);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Failed to load waitlist');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-3xl border border-white/5 bg-[#0d0d0d]" />;
  }

  if (authRequired) {
    return <Notice title="Admin authentication required" detail="Sign in with an @indii.music administrator account to view waitlist email addresses." />;
  }

  if (error) {
    return <Notice title="Couldn't load the waitlist" detail={error} />;
  }

  const entries = Array.isArray(data?.entries) ? data.entries : [];

  return (
    <section className="space-y-6" aria-labelledby="waitlist-panel-title">
      <div className="flex flex-col gap-4 rounded-3xl border border-[#4bd5ee]/20 bg-[#071014] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 id="waitlist-panel-title" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <MailCheck className="h-6 w-6 text-[#4bd5ee]" />
            Founding Artist Waitlist
          </h3>
          <p className="mt-1 text-sm text-white/40">Landing-page submissions, deduplicated by email and ordered by first submission.</p>
        </div>
        <div className="flex gap-3 text-center">
          <Metric label="Verified" value={data?.verifiedCount ?? 0} />
          <Metric label="Unverified" value={data?.unverifiedCount ?? 0} />
          <Metric label="Unique" value={data?.count ?? entries.length} />
        </div>
      </div>

      {(data?.unverifiedCount ?? 0) > 0 && (
        <div className="flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100/80">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p>Legacy submissions remain unverified. Their original order is visible, but they are not eligible for invitations until the artist completes email verification.</p>
        </div>
      )}

      {entries.length === 0 ? (
        <Notice title="No waitlist submissions yet" detail="New landing-page submissions will appear here without invented or sample records." />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#0d0d0d]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <Header>Order</Header>
                  <Header>Email</Header>
                  <Header>Status</Header>
                  <Header>Submitted</Header>
                  <Header>Attempts</Header>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-6 py-4 font-mono text-xs text-[#4bd5ee]">{entry.verificationStatus === 'verified' ? `#${entry.submissionOrder}` : `Legacy #${entry.submissionOrder}`}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-white/90">{entry.email}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${entry.verificationStatus === 'verified' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}>
                        {entry.status === 'legacy_unverified' ? 'Unverified' : entry.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-white/40">
                      <span className="flex items-center gap-2"><Clock className="h-3 w-3" />{formatDate(entry.joinedAt)}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-white/40">{entry.submissionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

const formatDate = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const Header: React.FC<React.PropsWithChildren> = ({ children }) => (
  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white/40">{children}</th>
);

const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="min-w-24 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
    <p className="text-xl font-bold text-white">{value}</p>
    <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{label}</p>
  </div>
);

const Notice: React.FC<{ title: string; detail: string }> = ({ title, detail }) => (
  <div className="flex min-h-48 flex-col items-center justify-center rounded-3xl border border-dashed border-white/5 bg-white/[0.02] p-8 text-center">
    <Users className="mb-4 h-6 w-6 text-white/30" />
    <p className="font-semibold text-white/80">{title}</p>
    <p className="mt-2 max-w-md text-sm text-white/40">{detail}</p>
  </div>
);
