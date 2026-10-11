import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  Mail,
  MailCheck,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { getAdminToken } from '../../firebase';

export interface ProspectAssessment {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
  clientSessionId: string;
  artistName: string | null;
  email: string | null;
  hasEmail: boolean;
  careerStage: string;
  genre: string;
  proAffiliation: string;
  mlcRegistered: string;
  distributor: string;
  releaseStatus: string;
  goals: string[];
  marketingConsent: boolean;
  assessmentConsent: boolean;
  claimedByUid: string | null;
  claimedAt: string | null;
  source: string;
  rightsGaps: string[];
  followUpStatus: string;
  lastContactedAt: string | null;
  contactCount: number;
  notes: string;
}

export interface ProspectsSummary {
  totalAssessments: number;
  emailCapturedCount: number;
  assessmentCopyRequestedCount: number;
  claimedAccountCount: number;
  rightsGapsCount: number;
}

export interface ProspectsResponse {
  summary: ProspectsSummary;
  prospects: ProspectAssessment[];
}

export interface ArtistCommunication {
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
    id: 'diagnostic_copy',
    label: 'Diagnostic Summary & Copy',
    subject: () =>
      `Your Artist Passport Diagnostic Summary — indii.music`,
    body: (p?: ProspectAssessment) => {
      const name = p?.artistName || 'there';
      const gaps = p?.rightsGaps && p.rightsGaps.length > 0
        ? `\nKey Royalty & Rights Observations:\n${p.rightsGaps.map((g) => `• ${g}`).join('\n')}\n`
        : '';
      return `Hi ${name},\n\nThanks for completing your Artist Passport diagnostic assessment on indii.music! Here is the confirmed record of your diagnostic profile:\n\n• Career Stage: ${p?.careerStage || 'Unspecified'}\n• Genre: ${p?.genre || 'Unspecified'}\n• PRO Affiliation: ${p?.proAffiliation || 'None'}\n• The MLC Status: ${p?.mlcRegistered || 'Unregistered'}\n• Distribution: ${p?.distributor || 'None'}\n• Target Release Window: ${p?.releaseStatus || 'Unspecified'}\n• Primary Goals: ${p?.goals?.join(', ') || 'Independent growth'}\n${gaps}\nIf you would like a personal walk-through of how indii can automate your royalty collection and distribution pipeline, feel free to reply directly to this email.\n\nBest regards,\nThe indii Team`;
    },
  },
  {
    id: 'rights_gap',
    label: 'Royalty & Rights Gap Advisory',
    subject: () =>
      `Protecting your uncollected royalties — indii.music diagnostic follow-up`,
    body: (p?: ProspectAssessment) => {
      const name = p?.artistName || 'there';
      const gapDetails = p?.rightsGaps && p.rightsGaps.length > 0
        ? p.rightsGaps.join(' and ')
        : 'uncollected mechanical streaming royalties';
      return `Hi ${name},\n\nFounder here at indii.music. I reviewed your recent Artist Passport diagnostic and wanted to follow up directly regarding your rights and royalty setup.\n\nYour diagnostic indicated: ${gapDetails}.\n\nWithout direct registrations, up to 15-20% of your global streaming revenue and mechanicals sit in distributor or DSP black boxes indefinitely. indii is built specifically to automate mechanical claims and ensure you keep 100% of your earnings.\n\nWould you be open to a 10-minute demo this week to see how we can plug those gaps for your upcoming releases?\n\nBest,\nindii Team`;
    },
  },
  {
    id: 'beta_invite',
    label: 'Beta Access & Demo Invitation',
    subject: () =>
      `Your indii.music Studio Beta Access`,
    body: (p?: ProspectAssessment) => {
      const name = p?.artistName || 'there';
      return `Hi ${name},\n\nWe saw you completed your Artist Passport diagnostic on indii.music! Based on your target goals (${p?.goals?.join(', ') || 'independent releases'}), we would love to invite you to test our private studio beta.\n\nLet us know if you'd like us to set up an onboarding session or if you have any questions.\n\nBest,\nThe indii Team`;
    },
  },
  {
    id: 'custom',
    label: 'Custom Message',
    subject: () => '',
    body: () => '',
  },
];

export const ProspectsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [data, setData] = useState<ProspectsResponse | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'email_only' | 'copy_requested' | 'gaps_only' | 'claimed' | 'unclaimed'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Drawer / Detail modal
  const [selectedProspect, setSelectedProspect] = useState<ProspectAssessment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [prospectNotes, setProspectNotes] = useState('');
  const [prospectFollowUpStatus, setProspectFollowUpStatus] = useState('not_contacted');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesFeedback, setNotesFeedback] = useState<string | null>(null);
  const [communications, setCommunications] = useState<ArtistCommunication[]>([]);

  // Email Composer Modal
  const [composeTarget, setComposeTarget] = useState<ProspectAssessment | null>(null);
  const [composeAlias, setComposeAlias] = useState<'founder@indii.music' | 'support@indii.music'>('founder@indii.music');
  const [selectedTemplateId, setSelectedTemplateId] = useState('diagnostic_copy');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeFeedback, setComposeFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setAuthRequired(false);
    try {
      const token = await getAdminToken();
      const timeoutSignal = AbortSignal.timeout(15000);
      const res = await fetch('/api/prospects', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
      });

      if (res.status === 401 || res.status === 403) {
        setAuthRequired(true);
        return;
      }
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);

      const json = (await res.json()) as ProspectsResponse;
      setData(json);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load prospect assessments');
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

  const openDetailDrawer = async (prospect: ProspectAssessment) => {
    setSelectedProspect(prospect);
    setProspectNotes(prospect.notes || '');
    setProspectFollowUpStatus(prospect.followUpStatus || 'not_contacted');
    setNotesFeedback(null);
    setCommunications([]);

    if (prospect.email) {
      setDetailLoading(true);
      try {
        const token = await getAdminToken();
        const res = await fetch(`/api/waitlist/artist/history?email=${encodeURIComponent(prospect.email)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          setCommunications(json.communications || []);
          if (json.notes && !prospect.notes) setProspectNotes(json.notes);
          if (json.followUpStatus && prospect.followUpStatus === 'not_contacted') {
            setProspectFollowUpStatus(json.followUpStatus);
          }
        }
      } catch {
        // Ignore secondary history lookup errors
      } finally {
        setDetailLoading(false);
      }
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedProspect) return;
    setSavingNotes(true);
    setNotesFeedback(null);
    try {
      const token = await getAdminToken();
      const res = await fetch('/api/prospects/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          assessmentId: selectedProspect.id,
          email: selectedProspect.email || undefined,
          notes: prospectNotes,
          followUpStatus: prospectFollowUpStatus,
        }),
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setNotesFeedback('Notes and follow-up status updated.');

      // Update local state
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          prospects: prev.prospects.map((p) =>
            p.id === selectedProspect.id
              ? { ...p, notes: prospectNotes, followUpStatus: prospectFollowUpStatus }
              : p,
          ),
        };
      });
      setSelectedProspect((prev) =>
        prev ? { ...prev, notes: prospectNotes, followUpStatus: prospectFollowUpStatus } : prev,
      );

      window.setTimeout(() => setNotesFeedback(null), 2500);
    } catch (err) {
      setNotesFeedback(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const openComposeModal = (prospect: ProspectAssessment, templateId = 'diagnostic_copy') => {
    if (!prospect.email) return;
    const tmpl = EMAIL_TEMPLATES.find((t) => t.id === templateId) || EMAIL_TEMPLATES[0];
    setComposeTarget(prospect);
    setSelectedTemplateId(tmpl.id);
    setComposeSubject(tmpl.subject());
    setComposeBody(tmpl.body(prospect));
    setComposeFeedback(null);
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl || !composeTarget) return;
    if (tmpl.id !== 'custom') {
      setComposeSubject(tmpl.subject());
      setComposeBody(tmpl.body(composeTarget));
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTarget?.email || !composeSubject.trim() || !composeBody.trim()) return;
    setComposeSending(true);
    setComposeFeedback(null);
    try {
      const token = await getAdminToken();
      const res = await fetch('/api/waitlist/send-direct-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to: composeTarget.email,
          subject: composeSubject.trim(),
          message: composeBody.trim(),
          fromAlias: composeAlias,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setComposeFeedback({ success: false, message: json.error || 'Failed to deliver email.' });
      } else {
        setComposeFeedback({
          success: true,
          message: `Email dispatched to ${composeTarget.email} from ${json.from || composeAlias}.`,
        });
        await load();
        window.setTimeout(() => {
          setComposeTarget(null);
          setComposeFeedback(null);
        }, 2200);
      }
    } catch (err) {
      setComposeFeedback({ success: false, message: err instanceof Error ? err.message : 'Network error.' });
    } finally {
      setComposeSending(false);
    }
  };

  const allProspects = data?.prospects ?? [];

  // Filter prospects
  const filteredProspects = allProspects.filter((p) => {
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.artistName?.toLowerCase().includes(q);
      const matchEmail = p.email?.toLowerCase().includes(q);
      const matchGenre = p.genre.toLowerCase().includes(q);
      const matchDist = p.distributor.toLowerCase().includes(q);
      const matchPro = p.proAffiliation.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchGenre && !matchDist && !matchPro) return false;
    }

    // View filter
    if (viewFilter === 'email_only' && !p.hasEmail) return false;
    if (viewFilter === 'copy_requested' && !p.assessmentConsent) return false;
    if (viewFilter === 'gaps_only' && p.rightsGaps.length === 0) return false;
    if (viewFilter === 'claimed' && !p.claimedByUid) return false;
    if (viewFilter === 'unclaimed' && p.claimedByUid) return false;

    // Follow-up status filter
    if (statusFilter !== 'all' && (p.followUpStatus || 'not_contacted') !== statusFilter) return false;

    return true;
  });

  const summary = data?.summary ?? {
    totalAssessments: 0,
    emailCapturedCount: 0,
    assessmentCopyRequestedCount: 0,
    claimedAccountCount: 0,
    rightsGapsCount: 0,
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-3xl border border-white/5 bg-[#0d0d0d]" />;
  }

  if (authRequired) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-white/5 bg-white/[0.02] rounded-3xl border-dashed p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-[#ffb800] mb-3" />
        <h4 className="text-white/90 font-bold text-base">Admin authentication required</h4>
        <p className="text-white/40 text-xs mt-1 max-w-md">
          Sign in with an @indii.music administrator account to access Artist Passport diagnostic leads.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-white/5 bg-white/[0.02] rounded-3xl border-dashed p-8 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
        <h4 className="text-white/90 font-bold text-base">Couldn't load prospect assessments</h4>
        <p className="text-white/40 text-xs mt-1 max-w-md">{error}</p>
        <button
          onClick={() => void load()}
          className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-white/80 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-6" aria-labelledby="passport-leads-title">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 rounded-3xl foil-gold-border p-6 md:flex-row md:items-center md:justify-between bg-[#0a0a0c]">
        <div>
          <h3 id="passport-leads-title" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Compass className="h-6 w-6 text-[#ffb800]" />
            <span className="foil-sheen-text">Artist Passport Diagnostic Leads</span>
          </h3>
          <p className="mt-1 text-sm text-white/40">
            Real intake data from the /passport funnel, rights gap diagnostic findings, and email copy confirmations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void load()}
            title="Refresh leads"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[#ffb800]" />
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-white/5">
          <div className="flex items-center gap-2 text-white/40 text-xs font-semibold mb-1">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#ffb800]" />
            <span>Assessments</span>
          </div>
          <div className="text-2xl font-bold text-white">{summary.totalAssessments}</div>
          <div className="text-[11px] text-white/30 mt-0.5">Completed funnels</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-white/5">
          <div className="flex items-center gap-2 text-white/40 text-xs font-semibold mb-1">
            <Mail className="w-3.5 h-3.5 text-[#4bd5ee]" />
            <span>Emails Captured</span>
          </div>
          <div className="text-2xl font-bold text-[#4bd5ee]">{summary.emailCapturedCount}</div>
          <div className="text-[11px] text-white/30 mt-0.5">
            {summary.totalAssessments > 0
              ? `${Math.round((summary.emailCapturedCount / summary.totalAssessments) * 100)}% lead capture`
              : '0% lead capture'}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-white/5">
          <div className="flex items-center gap-2 text-white/40 text-xs font-semibold mb-1">
            <MailCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Copy Requested</span>
          </div>
          <div className="text-2xl font-bold text-amber-300">{summary.assessmentCopyRequestedCount}</div>
          <div className="text-[11px] text-white/30 mt-0.5">Waiting for diagnostic</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-white/5">
          <div className="flex items-center gap-2 text-white/40 text-xs font-semibold mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Rights Gaps</span>
          </div>
          <div className="text-2xl font-bold text-rose-300">{summary.rightsGapsCount}</div>
          <div className="text-[11px] text-white/30 mt-0.5">Missing PRO or MLC</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0d0d0d] border border-white/5 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 text-white/40 text-xs font-semibold mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Claimed UIDs</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">{summary.claimedAccountCount}</div>
          <div className="text-[11px] text-white/30 mt-0.5">Created member account</div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setViewFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewFilter === 'all'
                ? 'bg-[#ffb800]/20 text-[#ffb800] border border-[#ffb800]/40'
                : 'bg-white/5 text-white/50 border border-white/5 hover:text-white'
            }`}
          >
            All ({allProspects.length})
          </button>
          <button
            onClick={() => setViewFilter('copy_requested')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewFilter === 'copy_requested'
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                : 'bg-white/5 text-white/50 border border-white/5 hover:text-white'
            }`}
          >
            Copy Requested ({summary.assessmentCopyRequestedCount})
          </button>
          <button
            onClick={() => setViewFilter('email_only')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewFilter === 'email_only'
                ? 'bg-[#4bd5ee]/20 text-[#4bd5ee] border border-[#4bd5ee]/40'
                : 'bg-white/5 text-white/50 border border-white/5 hover:text-white'
            }`}
          >
            Has Email ({summary.emailCapturedCount})
          </button>
          <button
            onClick={() => setViewFilter('gaps_only')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewFilter === 'gaps_only'
                ? 'bg-rose-400/20 text-rose-300 border border-rose-400/40'
                : 'bg-white/5 text-white/50 border border-white/5 hover:text-white'
            }`}
          >
            Rights Gaps ({summary.rightsGapsCount})
          </button>
          <button
            onClick={() => setViewFilter('claimed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewFilter === 'claimed'
                ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                : 'bg-white/5 text-white/50 border border-white/5 hover:text-white'
            }`}
          >
            Claimed ({summary.claimedAccountCount})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search artist, email, genre..."
              className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-[#ffb800]/50 focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white/80 focus:border-[#ffb800]/50 focus:outline-none cursor-pointer"
          >
            <option value="all">All Follow-Up Statuses</option>
            {FOLLOW_UP_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Prospect Assessment Roster Table */}
      {filteredProspects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 border border-white/5 bg-[#0d0d0d] rounded-3xl p-8 text-center">
          <Compass className="w-8 h-8 text-white/20 mb-3" />
          <h4 className="text-white/80 font-semibold text-sm">No prospect assessments matching criteria</h4>
          <p className="text-white/40 text-xs mt-1 max-w-sm">
            {allProspects.length === 0
              ? 'Leads will appear here automatically as visitors complete the /passport diagnostic on the landing site.'
              : 'Try clearing your search query or switching the view filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#0d0d0d]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white/40">Artist & Contact</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white/40">Profile & Genre</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white/40">Royalties & Rights</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white/40">Distributor & Release</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white/40">Account Claim</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white/40">Follow-Up</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-white/40 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredProspects.map((p) => {
                  const statusObj =
                    FOLLOW_UP_STATUSES.find((s) => s.id === (p.followUpStatus || 'not_contacted')) ||
                    FOLLOW_UP_STATUSES[0];

                  return (
                    <tr key={p.id} className="transition-colors hover:bg-white/[0.02]">
                      {/* Artist & Email */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="font-semibold text-sm text-white/90">
                            {p.artistName || <span className="text-white/40 italic">Anonymous Artist</span>}
                          </div>
                          {p.email ? (
                            <div className="flex items-center gap-1.5 text-xs text-[#4bd5ee]">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="font-mono">{p.email}</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-white/30 italic">No email provided</div>
                          )}

                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {p.assessmentConsent && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400/10 text-amber-300 border border-amber-400/30">
                                <MailCheck className="w-2.5 h-2.5" />
                                Copy Requested
                              </span>
                            )}
                            {p.marketingConsent && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-400/10 text-purple-300 border border-purple-400/30">
                                Opt-in
                              </span>
                            )}
                            <span className="text-[10px] text-white/30 flex items-center gap-1 ml-1">
                              <Clock className="w-2.5 h-2.5" />
                              {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Recent'}
                            </span>
                          </div>

                          {p.notes && (
                            <div
                              className="mt-1 flex items-center gap-1 text-[11px] text-white/40 truncate max-w-xs"
                              title={p.notes}
                            >
                              <FileText className="w-3 h-3 text-[#ffb800] shrink-0" />
                              <span className="truncate">{p.notes}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Profile & Genre */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-white/80">{p.genre}</span>
                          <span className="text-[10px] text-white/40 uppercase tracking-wider font-mono">
                            Stage: {p.careerStage}
                          </span>
                          {p.goals && p.goals.length > 0 && (
                            <div className="text-[10px] text-white/50 truncate max-w-[180px]" title={p.goals.join(', ')}>
                              🎯 {p.goals.join(', ')}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Royalties & Rights Status */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-white/40 text-[10px]">PRO:</span>
                            <span className={`font-semibold ${p.proAffiliation === 'None' || p.proAffiliation === 'Unsure' ? 'text-amber-400' : 'text-white/80'}`}>
                              {p.proAffiliation}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-white/40 text-[10px]">MLC:</span>
                            <span className={`font-semibold ${p.mlcRegistered === 'No' || p.mlcRegistered === 'Unsure' ? 'text-rose-400' : 'text-white/80'}`}>
                              {p.mlcRegistered === 'Yes' ? 'Registered' : 'Not Registered'}
                            </span>
                          </div>

                          {p.rightsGaps.length > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 w-fit">
                              <ShieldAlert className="w-3 h-3" />
                              <span>{p.rightsGaps.length} Rights Gap{p.rightsGaps.length === 1 ? '' : 's'}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Distributor & Release Window */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="text-white/80 font-medium">
                            {p.distributor === 'None' ? (
                              <span className="text-white/40 italic">None active</span>
                            ) : (
                              p.distributor
                            )}
                          </div>
                          <div className="text-[10px] text-white/40">
                            Release: {p.releaseStatus}
                          </div>
                        </div>
                      </td>

                      {/* Account Claim Status */}
                      <td className="px-5 py-4">
                        {p.claimedByUid ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 w-fit">
                              <CheckCircle2 className="w-3 h-3" />
                              Claimed Member
                            </span>
                            <span className="font-mono text-[9px] text-white/30 truncate max-w-[120px]" title={p.claimedByUid}>
                              UID: {p.claimedByUid}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-white/40 border border-white/10 w-fit">
                            Unclaimed Lead
                          </span>
                        )}
                      </td>

                      {/* Follow-up status */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold w-fit ${statusObj.color}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {statusObj.label}
                          </span>
                          {p.contactCount > 0 && (
                            <span className="text-[10px] text-white/40">
                              {p.contactCount} contact{p.contactCount === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void openDetailDrawer(p)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80 transition hover:border-[#ffb800]/50 hover:bg-[#ffb800]/10 hover:text-[#ffb800]"
                            title="View diagnostic details & private CRM notes"
                          >
                            <History className="h-3 w-3 text-[#ffb800]" />
                            CRM
                          </button>
                          {p.email ? (
                            <button
                              type="button"
                              onClick={() => openComposeModal(p)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#4bd5ee]/30 bg-[#4bd5ee]/10 px-2.5 py-1 text-xs font-medium text-[#4bd5ee] transition hover:bg-[#4bd5ee]/20"
                              title={`Direct email to ${p.email}`}
                            >
                              <Mail className="h-3 w-3" />
                              Email
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1 text-xs font-medium text-white/20 cursor-not-allowed"
                              title="No email address was provided by this visitor"
                            >
                              <Mail className="h-3 w-3" />
                              No Email
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail & CRM Notes Modal / Drawer */}
      {selectedProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0d0d0d] p-6 shadow-2xl space-y-6">
            <div className="flex items-start justify-between border-b border-white/5 pb-4">
              <div>
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#ffb800]" />
                  {selectedProspect.artistName || 'Anonymous Prospect'}
                </h4>
                <p className="text-xs text-white/40 mt-0.5">
                  Assessment ID: <span className="font-mono">{selectedProspect.id}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedProspect(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Diagnostic Answers Matrix */}
            <div className="space-y-3">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-white/40">Diagnostic Profile</h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] text-white/40">Career Stage</div>
                  <div className="text-xs font-semibold text-white/90 mt-0.5 capitalize">{selectedProspect.careerStage}</div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] text-white/40">Primary Genre</div>
                  <div className="text-xs font-semibold text-white/90 mt-0.5">{selectedProspect.genre}</div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] text-white/40">Distribution</div>
                  <div className="text-xs font-semibold text-white/90 mt-0.5">{selectedProspect.distributor}</div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] text-white/40">PRO Affiliation</div>
                  <div className={`text-xs font-semibold mt-0.5 ${selectedProspect.proAffiliation === 'None' ? 'text-amber-300' : 'text-white/90'}`}>
                    {selectedProspect.proAffiliation}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] text-white/40">The MLC Registered</div>
                  <div className={`text-xs font-semibold mt-0.5 ${selectedProspect.mlcRegistered === 'Yes' ? 'text-emerald-400' : 'text-rose-300'}`}>
                    {selectedProspect.mlcRegistered}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] text-white/40">Release Timeline</div>
                  <div className="text-xs font-semibold text-white/90 mt-0.5">{selectedProspect.releaseStatus}</div>
                </div>
              </div>

              {selectedProspect.rightsGaps.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Identified Rights Gaps: </span>
                    {selectedProspect.rightsGaps.join(', ')}.
                    <span className="block text-[11px] text-rose-300/80 mt-0.5">
                      Prime candidate for indii direct distribution & publishing collection.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Private Notes & CRM Management */}
            <div className="space-y-3 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-white/40">Founder Notes & Follow-Up Status</h5>
                <select
                  value={prospectFollowUpStatus}
                  onChange={(e) => setProspectFollowUpStatus(e.target.value)}
                  className="bg-black border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white/90 focus:border-[#ffb800]/50 focus:outline-none cursor-pointer"
                >
                  {FOLLOW_UP_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={prospectNotes}
                onChange={(e) => setProspectNotes(e.target.value)}
                rows={4}
                placeholder="Write private founder observations, outreach history, or release plans..."
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/30 focus:border-[#ffb800]/50 focus:outline-none resize-none"
              />

              <div className="flex items-center justify-between">
                {notesFeedback ? (
                  <span className="text-xs font-medium text-emerald-400">{notesFeedback}</span>
                ) : (
                  <span className="text-[11px] text-white/30">Visible only to @indii.music administrators</span>
                )}
                <div className="flex items-center gap-2">
                  {selectedProspect.email && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedProspect;
                        setSelectedProspect(null);
                        openComposeModal(target);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#4bd5ee]/30 bg-[#4bd5ee]/10 text-xs font-bold text-[#4bd5ee] hover:bg-[#4bd5ee]/20 transition-colors"
                    >
                      Compose Email
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSaveNotes()}
                    disabled={savingNotes}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#ffb800] text-black font-bold text-xs hover:bg-[#ffb800]/90 transition-colors disabled:opacity-50"
                  >
                    {savingNotes && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save Notes
                  </button>
                </div>
              </div>
            </div>

            {/* Past Communications Timeline */}
            {selectedProspect.email && (
              <div className="space-y-3 pt-3 border-t border-white/5">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-white/40">Communication Log</h5>
                {detailLoading ? (
                  <div className="h-16 animate-pulse bg-white/[0.02] rounded-xl" />
                ) : communications.length === 0 ? (
                  <p className="text-xs text-white/30 italic">No emails dispatched to this artist yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {communications.map((c) => (
                      <div key={c.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                        <div className="flex items-center justify-between text-white/40 text-[10px]">
                          <span>From: {c.from}</span>
                          <span>{new Date(c.sentAt).toLocaleString()}</span>
                        </div>
                        <div className="font-semibold text-white/90 mt-1">{c.subject}</div>
                        <p className="text-white/60 text-[11px] mt-0.5 line-clamp-2">{c.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Direct Email Outreach Modal */}
      {composeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-[#0d0d0d] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-white/5 pb-3">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#4bd5ee]" />
                  Direct Email Outreach
                </h4>
                <p className="text-xs text-white/40 mt-0.5">
                  Sending to <span className="text-[#4bd5ee] font-mono">{composeTarget.email}</span>
                </p>
              </div>
              <button
                onClick={() => setComposeTarget(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">
                    Sender Alias
                  </label>
                  <select
                    value={composeAlias}
                    onChange={(e) => setComposeAlias(e.target.value as typeof composeAlias)}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#4bd5ee]/50 focus:outline-none cursor-pointer"
                  >
                    <option value="founder@indii.music">founder@indii.music</option>
                    <option value="support@indii.music">support@indii.music</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">
                    Template
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#4bd5ee]/50 focus:outline-none cursor-pointer"
                  >
                    {EMAIL_TEMPLATES.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject line..."
                  required
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#4bd5ee]/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">
                  Message Body
                </label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={8}
                  placeholder="Write your email message..."
                  required
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white font-sans leading-relaxed focus:border-[#4bd5ee]/50 focus:outline-none resize-y"
                />
              </div>

              {composeFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    composeFeedback.success
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                  }`}
                >
                  {composeFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{composeFeedback.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setComposeTarget(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/70 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={composeSending || !composeSubject.trim() || !composeBody.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#4bd5ee] text-black font-bold text-xs hover:bg-[#4bd5ee]/90 transition-colors disabled:opacity-50"
                >
                  {composeSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
