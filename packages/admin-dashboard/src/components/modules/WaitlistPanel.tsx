import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  FileText,
  History,
  Loader2,
  Mail,
  MailCheck,
  MessageSquare,
  Send,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  inviteNextFoundingArtist,
  queueFoundingArtistMilestoneUpdate,
} from '../../lib/foundingArtistAdmin';
import { getAdminToken } from '../../firebase';

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
  followUpStatus?: string;
  lastContactedAt?: string | null;
  contactCount?: number;
  notes?: string;
}

interface ArtistCommunication {
  id: string;
  artistEmail: string;
  from: string;
  subject: string;
  message: string;
  sentAt: string;
  provider: string;
  status: string;
}

const FOLLOW_UP_STATUSES = [
  { id: 'not_contacted', label: 'Not Contacted', color: 'border-white/10 bg-white/5 text-white/40' },
  { id: 'contacted', label: 'Contacted', color: 'border-[#4bd5ee]/30 bg-[#4bd5ee]/10 text-[#4bd5ee]' },
  { id: 'follow_up_needed', label: 'Follow-Up Needed', color: 'border-amber-400/30 bg-amber-400/10 text-amber-300' },
  { id: 'in_discussion', label: 'In Discussion', color: 'border-purple-400/30 bg-purple-400/10 text-purple-300' },
  { id: 'invited', label: 'Beta Invited', color: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
];

const EMAIL_TEMPLATES = [
  {
    id: 'beta_invite',
    label: 'Beta Invitation',
    subject: 'Your Founding Artist Beta access on indii.music',
    body: () =>
      `Hi,\n\nWe saw you joined the Founding Artist waitlist on indii.music! We're excited to invite you to test the private beta.\n\nLet us know if you have any questions or when you'd like to get started.\n\nBest,\nThe indii Team`,
  },
  {
    id: 'checkin',
    label: 'Follow-Up Check-in',
    subject: 'Checking in from indii.music — how can we support your release?',
    body: () =>
      `Hi,\n\nFounder here at indii.music. Following up to see how your upcoming music releases are shaping up and whether you'd like an early demo of our direct distribution & mastering pipeline.\n\nLooking forward to hearing what you are working on!\n\nBest,\nindii Team`,
  },
  {
    id: 'qa_support',
    label: 'Artist Support / Q&A',
    subject: 'indii.music — Follow-up on your questions',
    body: () =>
      `Hi,\n\nThanks for reaching out to indii.music! We wanted to follow up directly regarding your questions.\n\n[Add your response here]\n\nLet us know how else we can help.\n\nBest,\nindii Team`,
  },
  {
    id: 'custom',
    label: 'Custom',
    subject: '',
    body: () => '',
  },
];

interface WaitlistResponse {
  count: number;
  totalSubmissions: number;
  verifiedCount: number;
  unverifiedCount: number;
  milestoneOptInCount: number;
  verificationEnabled: boolean;
  entries: WaitlistEntry[];
}

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
  const [composeTarget, setComposeTarget] = useState<string | null>(null);
  const [composeAlias, setComposeAlias] = useState<'founder@indii.music' | 'support@indii.music'>('founder@indii.music');
  const [selectedTemplateId, setSelectedTemplateId] = useState('beta_invite');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeStatus, setComposeStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Artist CRM History & Notes Drawer State
  const [historyTarget, setHistoryTarget] = useState<WaitlistEntry | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [artistCommunications, setArtistCommunications] = useState<ArtistCommunication[]>([]);
  const [artistNotes, setArtistNotes] = useState('');
  const [artistFollowUpStatus, setArtistFollowUpStatus] = useState('not_contacted');
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveNotesStatus, setSaveNotesStatus] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = await getAdminToken();
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

  const fetchArtistHistory = async (entry: WaitlistEntry) => {
    setHistoryTarget(entry);
    setHistoryLoading(true);
    setHistoryError(null);
    setSaveNotesStatus(null);
    try {
      const token = await getAdminToken();
      const res = await fetch(`/api/waitlist/artist/history?email=${encodeURIComponent(entry.email)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const json = await res.json();
      setArtistCommunications(json.communications || []);
      setArtistNotes(json.notes || entry.notes || '');
      setArtistFollowUpStatus(json.followUpStatus || entry.followUpStatus || 'not_contacted');
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load artist history.');
      setArtistNotes(entry.notes || '');
      setArtistFollowUpStatus(entry.followUpStatus || 'not_contacted');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!historyTarget) return;
    setSavingNotes(true);
    setSaveNotesStatus(null);
    try {
      const token = await getAdminToken();
      const res = await fetch('/api/waitlist/artist-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: historyTarget.email,
          notes: artistNotes,
          followUpStatus: artistFollowUpStatus,
        }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setSaveNotesStatus('Notes & status saved successfully.');
      setData((current) => current ? {
        ...current,
        entries: current.entries.map((e) => e.email === historyTarget.email
          ? { ...e, notes: artistNotes, followUpStatus: artistFollowUpStatus }
          : e),
      } : current);
      window.setTimeout(() => setSaveNotesStatus(null), 2500);
    } catch (err) {
      setSaveNotesStatus(err instanceof Error ? err.message : 'Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const openComposeForArtist = (email: string, templateId = 'beta_invite') => {
    const tmpl = EMAIL_TEMPLATES.find((t) => t.id === templateId) || EMAIL_TEMPLATES[0];
    setComposeTarget(email);
    setSelectedTemplateId(tmpl.id);
    setComposeSubject(tmpl.subject);
    setComposeBody(tmpl.body());
    setComposeStatus(null);
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;
    if (tmpl.id !== 'custom') {
      setComposeSubject(tmpl.subject);
      setComposeBody(tmpl.body());
    }
  };

  const handleSendDirectEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!composeTarget || !composeSubject.trim() || !composeBody.trim()) return;
    setComposeSending(true);
    setComposeStatus(null);
    try {
      const token = await getAdminToken();
      const response = await fetch('/api/waitlist/send-direct-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to: composeTarget,
          subject: composeSubject.trim(),
          message: composeBody.trim(),
          fromAlias: composeAlias,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setComposeStatus({ success: false, message: result.error || 'Failed to send direct email.' });
      } else {
        setComposeStatus({ success: true, message: `Email delivered to ${composeTarget} from ${result.from || composeAlias}.` });
        await load();
        if (historyTarget && historyTarget.email === composeTarget) {
          fetchArtistHistory(historyTarget);
        }
        window.setTimeout(() => {
          setComposeTarget(null);
          setComposeSubject('');
          setComposeBody('');
          setComposeStatus(null);
        }, 2200);
      }
    } catch (err) {
      setComposeStatus({ success: false, message: err instanceof Error ? err.message : 'Network failure.' });
    } finally {
      setComposeSending(false);
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
                  <Header>Follow-Up</Header>
                  <Header>Invitation</Header>
                  <Header>Submitted</Header>
                  <Header>Attempts</Header>
                  <Header>Actions</Header>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-6 py-4 font-mono text-xs text-[#4bd5ee]">{entry.verificationStatus === 'verified' ? `#${entry.submissionOrder}` : `Legacy #${entry.submissionOrder}`}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-white/90">
                      <div>{entry.email}</div>
                      {entry.notes && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-white/40 truncate max-w-xs" title={entry.notes}>
                          <FileText className="h-3 w-3 shrink-0 text-[#4bd5ee]" />
                          <span className="truncate">{entry.notes}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${entry.verificationStatus === 'verified' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}>
                        {entry.status === 'legacy_unverified' ? 'Unverified' : entry.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const statusObj = FOLLOW_UP_STATUSES.find((s) => s.id === (entry.followUpStatus || 'not_contacted')) || FOLLOW_UP_STATUSES[0];
                        return (
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold w-fit ${statusObj.color}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {statusObj.label}
                            </span>
                            {entry.contactCount && entry.contactCount > 0 ? (
                              <span className="text-[10px] text-white/40">
                                {entry.contactCount} contact{entry.contactCount === 1 ? '' : 's'}
                              </span>
                            ) : null}
                          </div>
                        );
                      })()}
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
                    <td className="px-6 py-4 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void fetchArtistHistory(entry)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80 transition hover:border-[#4bd5ee]/50 hover:bg-[#4bd5ee]/10 hover:text-[#4bd5ee]"
                          title="View CRM history & private notes"
                        >
                          <History className="h-3 w-3 text-[#4bd5ee]" />
                          CRM
                        </button>
                        <button
                          type="button"
                          onClick={() => openComposeForArtist(entry.email)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#4bd5ee]/30 bg-[#4bd5ee]/10 px-2.5 py-1 text-xs font-medium text-[#4bd5ee] transition hover:bg-[#4bd5ee]/20"
                          title={`Direct email to ${entry.email}`}
                        >
                          <Mail className="h-3 w-3" />
                          Email
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Artist CRM History & Notes Modal */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-white/10 bg-[#0d0d0d] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 p-6 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-[#4bd5ee]/30 bg-[#4bd5ee]/10 p-2.5 text-[#4bd5ee]">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold text-white tracking-tight">{historyTarget.email}</h4>
                    <span className="font-mono text-xs text-[#4bd5ee]">#{historyTarget.submissionOrder}</span>
                    <span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase ${historyTarget.verificationStatus === 'verified' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}>
                      {historyTarget.verificationStatus}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">
                    Joined {formatDate(historyTarget.joinedAt)} · Source: {historyTarget.source}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openComposeForArtist(historyTarget.email)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#4bd5ee] px-3.5 py-1.5 text-xs font-bold text-black transition hover:bg-[#7ce4f5]"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Send Email
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTarget(null)}
                  className="rounded-xl p-2 text-white/40 hover:bg-white/5 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Follow-Up Status Picker */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">
                  Follow-Up Stage
                </label>
                <div className="flex flex-wrap gap-2">
                  {FOLLOW_UP_STATUSES.map((status) => {
                    const isSelected = artistFollowUpStatus === status.id;
                    return (
                      <button
                        key={status.id}
                        type="button"
                        onClick={() => setArtistFollowUpStatus(status.id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          isSelected
                            ? `${status.color} ring-1 ring-white/30 scale-[1.02]`
                            : 'border-white/5 bg-white/[0.02] text-white/40 hover:border-white/10 hover:text-white/70'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                        {status.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Private Founder Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#4bd5ee]" />
                    Private Founder Notes
                  </label>
                  {saveNotesStatus && (
                    <span className="text-xs text-emerald-400 font-medium">
                      {saveNotesStatus}
                    </span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={artistNotes}
                  onChange={(e) => setArtistNotes(e.target.value)}
                  placeholder="Add private notes on release timeline, music genre, discussion points, questions..."
                  className="w-full resize-y rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-[#4bd5ee]/60"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSaveNotes()}
                    disabled={savingNotes}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#4bd5ee]/30 bg-[#4bd5ee]/10 px-3.5 py-1.5 text-xs font-bold text-[#8debf8] transition hover:bg-[#4bd5ee]/20 disabled:opacity-40"
                  >
                    {savingNotes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save Notes & Status
                  </button>
                </div>
              </div>

              {/* Communications Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-[#4bd5ee]" />
                    Communications History ({artistCommunications.length})
                  </h5>
                </div>

                {historyLoading ? (
                  <div className="flex items-center justify-center p-8 text-white/40">
                    <Loader2 className="h-5 w-5 animate-spin mr-2 text-[#4bd5ee]" />
                    Loading communications history...
                  </div>
                ) : historyError ? (
                  <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-xs text-red-300">
                    {historyError}
                  </div>
                ) : artistCommunications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/5 bg-white/[0.02] p-8 text-center">
                    <Mail className="h-8 w-8 text-white/20 mb-2" />
                    <p className="text-sm font-semibold text-white/60">No communications recorded yet</p>
                    <p className="text-xs text-white/40 mt-1 max-w-sm">
                      Send a direct email to this artist from founder@indii.music or support@indii.music to start a tracked conversation.
                    </p>
                    <button
                      type="button"
                      onClick={() => openComposeForArtist(historyTarget.email)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#4bd5ee]/30 bg-[#4bd5ee]/10 px-3 py-1.5 text-xs font-bold text-[#8debf8] hover:bg-[#4bd5ee]/20"
                    >
                      <Mail className="h-3 w-3" />
                      Compose first message
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {artistCommunications.map((comm) => (
                      <div
                        key={comm.id}
                        className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md border border-[#4bd5ee]/30 bg-[#4bd5ee]/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#4bd5ee]">
                              {comm.from}
                            </span>
                            <span className="text-xs font-semibold text-white/90">
                              {comm.subject}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-white/40">
                            <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] uppercase font-mono">
                              {comm.provider}
                            </span>
                            <span>{formatDate(comm.sentAt)}</span>
                          </div>
                        </div>
                        <div className="mt-2 text-xs leading-relaxed text-white/70 whitespace-pre-wrap font-sans">
                          {comm.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compose Direct Email Modal */}
      {composeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-[#0d0d0d] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#4bd5ee]" />
                  Direct Email to Artist
                </h4>
                <p className="text-xs text-white/40 mt-0.5">
                  Recipient: <span className="text-white/90 font-mono font-medium">{composeTarget}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposeTarget(null)}
                className="rounded-lg p-1 text-white/40 hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSendDirectEmail} className="space-y-4">
              {/* Sender Alias Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
                  Send From
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setComposeAlias('founder@indii.music')}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs text-left transition ${
                      composeAlias === 'founder@indii.music'
                        ? 'border-[#4bd5ee]/50 bg-[#4bd5ee]/10 text-white'
                        : 'border-white/5 bg-white/[0.02] text-white/50 hover:border-white/10'
                    }`}
                  >
                    <div className={`h-2 w-2 rounded-full ${composeAlias === 'founder@indii.music' ? 'bg-[#4bd5ee]' : 'bg-white/20'}`} />
                    <div>
                      <p className="font-semibold text-white">founder@indii.music</p>
                      <p className="text-[10px] text-white/40">Founder / Executive</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposeAlias('support@indii.music')}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs text-left transition ${
                      composeAlias === 'support@indii.music'
                        ? 'border-[#4bd5ee]/50 bg-[#4bd5ee]/10 text-white'
                        : 'border-white/5 bg-white/[0.02] text-white/50 hover:border-white/10'
                    }`}
                  >
                    <div className={`h-2 w-2 rounded-full ${composeAlias === 'support@indii.music' ? 'bg-[#4bd5ee]' : 'bg-white/20'}`} />
                    <div>
                      <p className="font-semibold text-white">support@indii.music</p>
                      <p className="text-[10px] text-white/40">Artist Support Desk</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Quick Template Chips */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-[#4bd5ee]" />
                    Email Template
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EMAIL_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tmpl.id)}
                      className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                        selectedTemplateId === tmpl.id
                          ? 'border-[#4bd5ee]/40 bg-[#4bd5ee]/10 text-[#4bd5ee] font-semibold'
                          : 'border-white/5 bg-white/[0.02] text-white/40 hover:border-white/10 hover:text-white/70'
                      }`}
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject line"
                  disabled={composeSending}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#4bd5ee]/60 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1">
                  Message
                </label>
                <textarea
                  required
                  rows={6}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Type your message..."
                  disabled={composeSending}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm leading-relaxed text-white outline-none focus:border-[#4bd5ee]/60 disabled:opacity-50 resize-y"
                />
              </div>

              {composeStatus && (
                <p
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    composeStatus.success
                      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                      : 'border-red-400/20 bg-red-400/10 text-red-300'
                  }`}
                >
                  {composeStatus.message}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setComposeTarget(null)}
                  disabled={composeSending}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={composeSending || !composeSubject.trim() || !composeBody.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#4bd5ee] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#7ce4f5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {composeSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Send from {composeAlias}
                </button>
              </div>
            </form>
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
