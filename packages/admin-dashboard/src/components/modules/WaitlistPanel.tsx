import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Clock, Loader2, MailCheck, Send, Users } from 'lucide-react';
import {
  inviteNextFoundingArtist,
  queueFoundingArtistMilestoneUpdate,
} from '../../lib/foundingArtistAdmin';

interface WaitlistEntry {
  id: string;
  email: string;
  joinedAt: string | null;
  source: string;
  submissionCount: number;
  submissionOrder: number;
  verificationStatus: 'verified' | 'unverified';
  status: 'waitlisted' | 'invited' | 'accepted' | 'declined' | 'revoked' | 'legacy_unverified';
  invitationStatus: 'not_queued' | 'queued' | 'sent' | 'failed';
  majorMilestoneUpdates: boolean;
}

interface WaitlistResponse {
  count: number;
  totalSubmissions: number;
  verifiedCount: number;
  unverifiedCount: number;
  milestoneOptInCount: number;
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
  const [action, setAction] = useState<'invite' | 'milestone' | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [milestoneSubject, setMilestoneSubject] = useState('');
  const [milestoneMessage, setMilestoneMessage] = useState('');
  const [milestoneRequestId, setMilestoneRequestId] = useState(() => crypto.randomUUID());

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = getAdminToken();
      const timeoutSignal = AbortSignal.timeout(15000);
      const response = await fetch('/api/waitlist', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
      });

      if (response.status === 401 || response.status === 403) {
        setAuthRequired(true);
        return;
      }
      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      setData((await response.json()) as WaitlistResponse);
      setAuthRequired(false);
      setError(null);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : 'Failed to load waitlist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

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
  const nextInvitable = entries.find((entry) => (
    entry.verificationStatus === 'verified'
    && entry.status === 'waitlisted'
  ));
  const invitationPending = nextInvitable?.invitationStatus === 'queued';

  const handleInviteNext = async () => {
    if (!nextInvitable || action) return;
    const confirmed = window.confirm(
      `Invite #${nextInvitable.submissionOrder} ${nextInvitable.email} to the Founding Artist Beta?`,
    );
    if (!confirmed) return;
    setAction('invite');
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await inviteNextFoundingArtist();
      if (!result.queued) {
        setActionMessage('There is no eligible verified artist waiting for an invitation.');
      } else {
        setActionMessage(
          result.alreadyQueued
            ? `Invitation #${result.queuePosition} is already queued for ${result.email}.`
            : `Invitation queued for #${result.queuePosition} ${result.email}.`,
        );
        setData((current) => current ? {
          ...current,
          entries: current.entries.map((entry) => entry.id === `verified:${result.artistUid}`
            ? { ...entry, invitationStatus: 'queued' }
            : entry),
        } : current);
      }
      await load();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Failed to queue the invitation.');
    } finally {
      setAction(null);
    }
  };

  const handleMilestoneSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (action || !milestoneSubject.trim() || !milestoneMessage.trim()) return;
    const recipientCount = data?.milestoneOptInCount ?? 0;
    const confirmed = window.confirm(
      `Queue this major milestone update for ${recipientCount} opted-in artist${recipientCount === 1 ? '' : 's'}?`,
    );
    if (!confirmed) return;
    setAction('milestone');
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await queueFoundingArtistMilestoneUpdate(
        milestoneSubject.trim(),
        milestoneMessage.trim(),
        milestoneRequestId,
      );
      setActionMessage(
        `${result.alreadyQueued ? 'Milestone was already queued' : 'Milestone queued'} for ${result.recipientCount} opted-in artist${result.recipientCount === 1 ? '' : 's'}.`,
      );
      setMilestoneSubject('');
      setMilestoneMessage('');
      setMilestoneRequestId(crypto.randomUUID());
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Failed to queue the milestone update.');
    } finally {
      setAction(null);
    }
  };

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
        <div className="flex flex-col items-stretch gap-3 md:items-end">
          <div className="flex gap-3 text-center">
            <Metric label="Verified" value={data?.verifiedCount ?? 0} />
            <Metric label="Unverified" value={data?.unverifiedCount ?? 0} />
            <Metric label="Unique" value={data?.count ?? entries.length} />
          </div>
          <button
            type="button"
            onClick={() => void handleInviteNext()}
            disabled={!nextInvitable || invitationPending || action !== null}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4bd5ee] px-4 py-2.5 text-xs font-bold text-black transition hover:bg-[#7ce4f5] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {action === 'invite' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
            {invitationPending
              ? `Invitation pending · #${nextInvitable?.submissionOrder}`
              : nextInvitable
                ? `Invite next · #${nextInvitable.submissionOrder}`
                : 'No verified artist waiting'}
          </button>
        </div>
      </div>

      {(actionMessage || actionError) && (
        <p
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${actionError ? 'border-red-400/20 bg-red-400/5 text-red-200' : 'border-emerald-400/20 bg-emerald-400/5 text-emerald-200'}`}
        >
          {actionError ?? actionMessage}
        </p>
      )}

      {(data?.unverifiedCount ?? 0) > 0 && (
        <div className="flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100/80">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p>Legacy submissions remain unverified. Their original order is visible, but they are not eligible for invitations until the artist completes email verification.</p>
        </div>
      )}

      <form onSubmit={handleMilestoneSubmit} className="space-y-4 rounded-3xl border border-white/5 bg-[#0d0d0d] p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold text-white/90">
              <Send className="h-4 w-4 text-[#4bd5ee]" />
              Major milestone update
            </h4>
            <p className="mt-1 text-xs text-white/40">
              Queues one plain-text update for {data?.milestoneOptInCount ?? 0} verified, opted-in artist{(data?.milestoneOptInCount ?? 0) === 1 ? '' : 's'}. Consent is checked again before delivery.
            </p>
          </div>
        </div>
        <input
          aria-label="Milestone email subject"
          value={milestoneSubject}
          onChange={(event) => setMilestoneSubject(event.target.value)}
          maxLength={120}
          placeholder="Milestone email subject"
          disabled={action !== null}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-[#4bd5ee]/60 disabled:opacity-50"
        />
        <textarea
          aria-label="Milestone email message"
          value={milestoneMessage}
          onChange={(event) => setMilestoneMessage(event.target.value)}
          maxLength={4000}
          rows={5}
          placeholder="Write the major development milestone in plain language."
          disabled={action !== null}
          className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-relaxed text-white outline-none transition focus:border-[#4bd5ee]/60 disabled:opacity-50"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={action !== null || !milestoneSubject.trim() || !milestoneMessage.trim() || (data?.milestoneOptInCount ?? 0) === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-[#4bd5ee]/30 bg-[#4bd5ee]/10 px-4 py-2.5 text-xs font-bold text-[#8debf8] transition hover:bg-[#4bd5ee]/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {action === 'milestone' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Queue major milestone
          </button>
        </div>
      </form>

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
                  <Header>Invitation</Header>
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
                    <td className="px-6 py-4 text-xs text-white/50">
                      {entry.verificationStatus === 'verified'
                        ? entry.invitationStatus.replace('_', ' ')
                        : 'Not eligible'}
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
