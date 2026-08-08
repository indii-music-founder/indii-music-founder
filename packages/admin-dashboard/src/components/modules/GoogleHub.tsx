import React, { useState, useEffect, useCallback } from 'react';
import { 
  Globe, 
  Mail, 
  Calendar as CalendarIcon, 
  FolderOpen, 
  RefreshCw, 
  Plus, 
  Send, 
  AlertTriangle,
  ExternalLink,
  FileText,
  Clock,
  ArrowRight
} from 'lucide-react';

interface Email {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isAiDraft: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const requireArrayField = (
  body: unknown,
  field: 'messages' | 'events' | 'files',
  label: string
): Record<string, unknown>[] => {
  const value = isRecord(body) ? body[field] : undefined;
  if (!Array.isArray(value)) throw new Error(`${label} response was invalid`);
  return value.filter(isRecord);
};

const parseWorkspaceAuthorization = (body: unknown): boolean => {
  if (!isRecord(body) || typeof body.authorized !== 'boolean') {
    throw new Error('Workspace status response was invalid');
  }
  return body.authorized;
};

const parseEmails = (body: unknown): Email[] =>
  requireArrayField(body, 'messages', 'Gmail')
    .map((message) => ({
      id: asString(message.id),
      from: asString(message.from),
      subject: asString(message.subject),
      snippet: asString(message.snippet),
      date: asString(message.date),
      isAiDraft: message.isAiDraft === true,
    }))
    .filter((message) => message.id !== '');

const parseEvents = (body: unknown): CalendarEvent[] =>
  requireArrayField(body, 'events', 'Calendar')
    .map((event) => ({
      id: asString(event.id),
      title: asString(event.title),
      start: asString(event.start),
      end: asString(event.end),
      description: asString(event.description),
    }))
    .filter((event) => event.id !== '');

const parseFiles = (body: unknown): DriveFile[] =>
  requireArrayField(body, 'files', 'Drive')
    .map((file) => ({
      id: asString(file.id),
      name: asString(file.name),
      mimeType: asString(file.mimeType),
      size: asString(file.size),
      modifiedTime: asString(file.modifiedTime),
    }))
    .filter((file) => file.id !== '');

const getAdminToken = (): string | null => {
  try {
    return localStorage.getItem('indii_admin_token');
  } catch {
    return null;
  }
};

export const GoogleHub: React.FC = () => {
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  // Distinct from `authorized`: false means the status check itself failed, so
  // we genuinely do not know whether a Workspace is linked. Never render the
  // "Not Linked" prompt on an unknown — that would be an assertion we can't back.
  const [linkStatusKnown, setLinkStatusKnown] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'gmail' | 'calendar' | 'drive'>('gmail');
  
  // Data States
  const [emails, setEmails] = useState<Email[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  
  // Loading & Error States
  const [loadingData, setLoadingData] = useState(false);
  const [dataUnavailable, setDataUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modals & Forms
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventDesc, setEventDesc] = useState('');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadContent, setUploadContent] = useState('');

  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  // Check auth status
  const checkAuthStatus = async () => {
    setCheckingAuth(true);
    try {
      const token = getAdminToken();
      const res = await fetch('/api/google/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        // A failed status check is NOT the same as "not linked" — surface it,
        // otherwise a broken backend renders as a connect prompt and the
        // operator reconnects an account that was never disconnected.
        throw new Error(
          res.status === 401 || res.status === 403
            ? 'Admin authentication required to read Workspace link status.'
            : `Workspace status check returned ${res.status}`
        );
      }
      setAuthorized(parseWorkspaceAuthorization(await res.json()));
      setLinkStatusKnown(true);
      setDataUnavailable(false);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch auth status:', err);
      setAuthorized(false);
      setLinkStatusKnown(false);
      setDataUnavailable(false);
      setError(err instanceof Error ? err.message : 'Could not determine Workspace link status');
    } finally {
      setCheckingAuth(false);
    }
  };

  // Trigger Google OAuth authorization flow redirect
  const handleLinkAccount = async () => {
    try {
      const token = getAdminToken();
      const res = await fetch('/api/google/oauth/url', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const body: unknown = await res.json();
        const url = isRecord(body) ? asString(body.url) : '';
        if (!url || new URL(url).protocol !== 'https:') {
          throw new Error('OAuth endpoint returned an invalid redirect URL');
        }
        window.location.assign(url);
      } else {
        setError('Failed to generate OAuth redirect URL');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failure starting OAuth consent flow');
    }
  };

  // Fetch relevant Workspace data depending on active tab
  const fetchTabData = useCallback(async () => {
    // Nothing to fetch until the Workspace is actually linked — the connect
    // prompt is what renders in that case.
    if (!authorized) return;

    setLoadingData(true);
    setDataUnavailable(false);
    setError(null);
    const token = getAdminToken();
    const endpoint = {
      gmail: { url: '/api/google/gmail/list', label: 'Gmail' },
      calendar: { url: '/api/google/calendar/events', label: 'Calendar' },
      drive: { url: '/api/google/drive/files', label: 'Drive' },
    }[activeSubTab];

    try {
      const res = await fetch(endpoint.url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      // 412 = the OAuth token went away between the status check and this read.
      // Fall back to the connect prompt rather than reporting it as an error.
      if (res.status === 412) {
        setAuthorized(false);
        setLinkStatusKnown(true);
        setSelectedEmail(null);
        setEmails([]);
        setEvents([]);
        setFiles([]);
        setDataUnavailable(false);
        setError(null);
        return;
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          'Admin authentication required — store a valid @indii.music Firebase ID token under localStorage key "indii_admin_token".'
        );
      }
      if (!res.ok) throw new Error(`${endpoint.label} API returned ${res.status}`);

      const data: unknown = await res.json();
      if (activeSubTab === 'gmail') setEmails(parseEmails(data));
      else if (activeSubTab === 'calendar') setEvents(parseEvents(data));
      else setFiles(parseFiles(data));
      setDataUnavailable(false);
    } catch (err) {
      if (activeSubTab === 'gmail') {
        setEmails([]);
        setSelectedEmail(null);
      } else if (activeSubTab === 'calendar') {
        setEvents([]);
      } else {
        setFiles([]);
      }
      setDataUnavailable(true);
      setError(err instanceof Error ? err.message : 'API communications failure');
    } finally {
      setLoadingData(false);
    }
  }, [activeSubTab, authorized]);

  useEffect(() => {
    const init = async () => {
      await Promise.resolve();
      checkAuthStatus();
    };
    init();
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.resolve();
      fetchTabData();
    };
    init();
  }, [fetchTabData]);

  // Handle Send Email
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo || !composeSubject || !composeBody) return;
    setError(null);
    try {
      const token = getAdminToken();
      const res = await fetch('/api/google/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
        }),
      });
      if (res.ok) {
        setShowComposeModal(false);
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
        fetchTabData();
      } else {
        if (res.status === 412) {
          setShowComposeModal(false);
          setAuthorized(false);
          setLinkStatusKnown(true);
          return;
        }
        const data: unknown = await res.json();
        setError(isRecord(data) && typeof data.error === 'string' ? data.error : 'Failed to dispatch email');
      }
    } catch {
      setError('Failed to transmit outbound mail');
    }
  };

  // Handle Add Calendar Event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle || !eventStart || !eventEnd) return;
    setError(null);
    try {
      const token = getAdminToken();
      const res = await fetch('/api/google/calendar/events/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: eventTitle,
          start: eventStart,
          end: eventEnd,
          description: eventDesc,
        }),
      });
      if (res.ok) {
        setShowEventModal(false);
        setEventTitle('');
        setEventStart('');
        setEventEnd('');
        setEventDesc('');
        fetchTabData();
      } else {
        if (res.status === 412) {
          setShowEventModal(false);
          setAuthorized(false);
          setLinkStatusKnown(true);
          return;
        }
        const data: unknown = await res.json();
        setError(isRecord(data) && typeof data.error === 'string' ? data.error : 'Failed to insert calendar event');
      }
    } catch {
      setError('Calendar write request failed');
    }
  };

  // Handle Drive File Upload
  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadName || !uploadContent) return;
    setError(null);
    try {
      const token = getAdminToken();
      const res = await fetch('/api/google/drive/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: uploadName,
          content: uploadContent,
          mimeType: 'text/plain',
        }),
      });
      if (res.ok) {
        setShowUploadModal(false);
        setUploadName('');
        setUploadContent('');
        fetchTabData();
      } else {
        if (res.status === 412) {
          setShowUploadModal(false);
          setAuthorized(false);
          setLinkStatusKnown(true);
          return;
        }
        const data: unknown = await res.json();
        setError(isRecord(data) && typeof data.error === 'string' ? data.error : 'Upload rejected by Drive service');
      }
    } catch {
      setError('File upload failed');
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-[#121214]/80 border border-white/5 rounded-3xl">
        <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex items-center justify-between bg-[#121214]/80 backdrop-blur-md border border-white/5 p-6 rounded-3xl">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="text-cyan-400 w-6 h-6 animate-pulse-subtle" />
            Google Workspace Business Hub
          </h3>
          <p className="text-sm text-white/40 mt-1">Direct integration with indii.music corporate Workspace resources.</p>
        </div>
        <div className="flex items-center gap-4">
          {!linkStatusKnown ? (
            <div className="flex items-center gap-2.5 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-xs font-bold text-orange-400">Status unknown</span>
            </div>
          ) : authorized ? (
            <div className="flex items-center gap-2.5 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold text-cyan-400">Workspace Connected</span>
            </div>
          ) : (
            <button 
              onClick={handleLinkAccount}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.35)] flex items-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              Link Workspace Account
            </button>
          )}
        </div>
      </div>

      {/* Subtab selection headers */}
      <div className="flex bg-[#121214]/50 border border-white/5 rounded-2xl p-1 max-w-md">
        {[
          { id: 'gmail', label: 'Gmail Client', icon: <Mail className="w-4 h-4" /> },
          { id: 'calendar', label: 'Google Calendar', icon: <CalendarIcon className="w-4 h-4" /> },
          { id: 'drive', label: 'Drive Files', icon: <FolderOpen className="w-4 h-4" /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveSubTab(tab.id as 'gmail' | 'calendar' | 'drive');
              setSelectedEmail(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative z-10 ${
              activeSubTab === tab.id ? 'text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab.icon}
            {tab.label}
            {activeSubTab === tab.id && (
              <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl -z-10 shadow-sm" />
            )}
          </button>
        ))}
      </div>

      {/* Main module contents */}
      <div className="bg-[#121214]/80 backdrop-blur-md border border-white/5 rounded-3xl p-8 min-h-[400px] relative">
        {/* Error Alert Banner */}
        {error && (
          <div className="mb-6 flex items-start gap-2.5 bg-red-500/5 border border-red-500/10 rounded-2xl p-4 text-xs text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Operation Error</p>
              <p className="opacity-80">{error}</p>
            </div>
          </div>
        )}

        {/* Loader Overlays */}
        {loadingData && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center rounded-3xl z-10">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        )}

        {!linkStatusKnown ? (
          <div className="flex flex-col items-center justify-center text-center py-16 min-h-[300px]">
            <AlertTriangle className="w-12 h-12 text-orange-400/40 mb-4" />
            <p className="text-white/85 font-semibold text-base">Workspace link status unavailable</p>
            <p className="text-white/40 text-xs mt-2 max-w-md leading-relaxed">
              The backend could not be reached to check whether a Google Workspace account is
              connected. This is not the same as being disconnected — nothing has been unlinked.
            </p>
            <button
              onClick={checkAuthStatus}
              className="mt-6 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry status check
            </button>
          </div>
        ) : !authorized ? (
          <div className="flex flex-col items-center justify-center text-center py-16 min-h-[300px]">
            <Globe className="w-12 h-12 text-cyan-400/30 mb-4" />
            <p className="text-white/85 font-semibold text-base">Google Workspace Not Linked</p>
            <p className="text-white/40 text-xs mt-2 max-w-md leading-relaxed">
              Please link your corporate admin Workspace account to retrieve live Gmail messages, Calendar agenda schedules, and Drive document catalogs.
            </p>
            <button 
              onClick={handleLinkAccount}
              className="mt-6 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] flex items-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Link Workspace Account
            </button>
          </div>
        ) : dataUnavailable ? (
          <div className="flex flex-col items-center justify-center text-center py-16 min-h-[300px]">
            <AlertTriangle className="w-12 h-12 text-red-400/40 mb-4" />
            <p className="text-white/85 font-semibold text-base">Workspace data unavailable</p>
            <p className="text-white/40 text-xs mt-2 max-w-md leading-relaxed">
              The selected Workspace service did not return a valid result. No empty-state claim is
              being made until the request succeeds.
            </p>
            <button
              onClick={fetchTabData}
              className="mt-6 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry data request
            </button>
          </div>
        ) : (
          <>
            {/* 1. Gmail Tab */}
            {activeSubTab === 'gmail' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h4 className="text-lg font-bold tracking-tight">Active Mailboxes</h4>
                  <button 
                    onClick={() => setShowComposeModal(true)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Compose Mail
                  </button>
                </div>

                {selectedEmail ? (
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div>
                        <h5 className="font-bold text-base text-white">{selectedEmail.subject}</h5>
                        <p className="text-xs text-white/50 mt-1 font-mono">From: {selectedEmail.from}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedEmail(null)}
                        className="text-xs text-white/40 hover:text-white transition-colors cursor-pointer"
                      >
                        Back to Inbox
                      </button>
                    </div>
                    <p className="text-sm text-white/80 whitespace-pre-line leading-relaxed">{selectedEmail.snippet}</p>
                    {selectedEmail.isAiDraft && (
                      <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                        <p className="text-xs font-bold text-purple-400 mb-2 uppercase tracking-wider">AI Compose Draft Preview</p>
                        <p className="text-xs text-white/70">{selectedEmail.snippet}</p>
                      </div>
                    )}
                  </div>
                ) : emails.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-20 border border-white/5 bg-white/[0.01] rounded-2xl border-dashed">
                    <Mail className="w-10 h-10 text-white/20 mb-4" />
                    <p className="text-sm font-semibold text-white/60">No messages found</p>
                    <p className="text-xs text-white/30 mt-1">Inbox workspace query returned zero records</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5 border border-white/5 rounded-2xl overflow-hidden bg-black/10">
                    {emails.map((email) => (
                      <div 
                        key={email.id}
                        onClick={() => setSelectedEmail(email)}
                        className="p-5 hover:bg-white/[0.02] cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div className="space-y-1 min-w-0 flex-1 pr-6">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-xs text-white/90 truncate max-w-[200px]">{email.from}</span>
                            {email.isAiDraft && (
                              <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded text-[9px] font-bold">
                                Draft
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-white/80 group-hover:text-white transition-colors truncate">{email.subject}</p>
                          <p className="text-xs text-white/40 truncate">{email.snippet}</p>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-2">
                          <span className="text-[10px] text-white/30 font-mono">
                            {new Date(email.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. Calendar Tab */}
            {activeSubTab === 'calendar' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h4 className="text-lg font-bold tracking-tight">Agenda Timeline</h4>
                  <button 
                    onClick={() => setShowEventModal(true)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Schedule Event
                  </button>
                </div>

                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-20 border border-white/5 bg-white/[0.01] rounded-2xl border-dashed">
                    <CalendarIcon className="w-10 h-10 text-white/20 mb-4" />
                    <p className="text-sm font-semibold text-white/60">No upcoming events scheduled</p>
                    <p className="text-xs text-white/30 mt-1">Calendar schedules are empty for the next 30 days</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {events.map((evt) => (
                      <div 
                        key={evt.id}
                        className="p-5 bg-white/[0.01] border border-white/5 hover:border-white/10 rounded-2xl transition-all flex items-start justify-between"
                      >
                        <div className="space-y-2">
                          <h5 className="font-bold text-sm text-white">{evt.title}</h5>
                          {evt.description && (
                            <p className="text-xs text-white/50">{evt.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-[10px] text-white/30 font-mono">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Start: {new Date(evt.start).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              End: {new Date(evt.end).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. Drive Tab */}
            {activeSubTab === 'drive' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h4 className="text-lg font-bold tracking-tight">Shared Documents Directory</h4>
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Upload Document
                  </button>
                </div>

                {files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-20 border border-white/5 bg-white/[0.01] rounded-2xl border-dashed">
                    <FolderOpen className="w-10 h-10 text-white/20 mb-4" />
                    <p className="text-sm font-semibold text-white/60">Drive catalog empty</p>
                    <p className="text-xs text-white/30 mt-1">No digital files uploaded in this folder context</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-6">
                    {files.map((file) => (
                      <div 
                        key={file.id}
                        className="p-5 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl transition-all relative group flex flex-col justify-between h-40"
                      >
                        <div className="space-y-2">
                          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                            <FileText className="w-5 h-5 text-cyan-400" />
                          </div>
                          <h5 className="font-bold text-xs text-white/90 truncate" title={file.name}>
                            {file.name}
                          </h5>
                          <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono">
                            <span>{file.size}</span>
                            <span>•</span>
                            <span>{new Date(file.modifiedTime).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Compose Email Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSendEmail} className="bg-[#121214] border border-white/10 rounded-3xl p-8 max-w-xl w-full space-y-6 relative overflow-hidden">
            <h4 className="text-lg font-bold tracking-tight">Compose Outbound Correspondence</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Recipient Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="recipient@domain.com"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 focus:border-white/10 outline-none rounded-xl text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Subject</label>
                <input 
                  type="text" 
                  required
                  placeholder="Re: Licensing negotiations"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 focus:border-white/10 outline-none rounded-xl text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Message Body</label>
                <textarea 
                  required
                  rows={6}
                  placeholder="Draft your communication content here..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 focus:border-white/10 outline-none rounded-xl text-sm text-white resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setShowComposeModal(false)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Transmit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Schedule Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateEvent} className="bg-[#121214] border border-white/10 rounded-3xl p-8 max-w-xl w-full space-y-6 relative overflow-hidden">
            <h4 className="text-lg font-bold tracking-tight">Schedule Calendar Event</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Event Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="EP Distribution Release Sync"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 focus:border-white/10 outline-none rounded-xl text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Start Date & Time</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={eventStart}
                    onChange={(e) => setEventStart(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 focus:border-white/10 outline-none rounded-xl text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">End Date & Time</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={eventEnd}
                    onChange={(e) => setEventEnd(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 focus:border-white/10 outline-none rounded-xl text-sm text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Description (Optional)</label>
                <textarea 
                  rows={3}
                  placeholder="Meeting agenda items, details..."
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 focus:border-white/10 outline-none rounded-xl text-sm text-white resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setShowEventModal(false)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Event
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload File Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleUploadFile} className="bg-[#121214] border border-white/10 rounded-3xl p-8 max-w-xl w-full space-y-6 relative overflow-hidden">
            <h4 className="text-lg font-bold tracking-tight">Upload Metadata Document</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Document Filename</label>
                <input 
                  type="text" 
                  required
                  placeholder="distribution_metadata.xml"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 focus:border-white/10 outline-none rounded-xl text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Text Data Contents</label>
                <textarea 
                  required
                  rows={6}
                  placeholder="Paste or write the document text contents..."
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 focus:border-white/10 outline-none rounded-xl text-sm text-white font-mono resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Upload
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
