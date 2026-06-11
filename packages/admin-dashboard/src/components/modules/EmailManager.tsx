import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Plus, Trash2, Edit2, ShieldAlert, ArrowLeft, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';

interface Message {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isAiDraft: boolean;
  draftText?: string;
}

const getAdminToken = (): string | null => {
  try {
    return localStorage.getItem('indii_admin_token');
  } catch {
    return null;
  }
};

export const EmailManager: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'drafts' | 'aliases'>('inbox');
  const [approving, setApproving] = useState<string | null>(null);

  const aliases = [
    { email: 'admin@indii.music', destination: 'the.walking.agency.det@gmail.com', status: 'Active', type: 'Core' },
    { email: 'support@indii.music', destination: 'the.walking.agency.det@gmail.com', status: 'Active', type: 'Core' },
    { email: 'info@indii.music', destination: 'the.walking.agency.det@gmail.com', status: 'Pending DNS', type: 'Routing' },
    { email: 'agent@indii.music', destination: 'Webhook (server.ts)', status: 'Active', type: 'System' },
  ];

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAdminToken();
      const res = await fetch('/api/messaging/inbox', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Messaging server returned ${res.status}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query message storage');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.resolve();
      fetchInbox();
    };
    init();
  }, [fetchInbox]);

  const handleApproveDraft = async (id: string) => {
    setApproving(id);
    try {
      const token = getAdminToken();
      const res = await fetch('/api/messaging/approve-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        if (selectedMsg && selectedMsg.id === id) {
          setSelectedMsg({ ...selectedMsg, isAiDraft: false });
        }
        await fetchInbox();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to approve draft');
      }
    } catch {
      alert('Network request failed');
    } finally {
      setApproving(null);
    }
  };

  const filteredMessages = messages.filter((m) => {
    if (activeTab === 'drafts') return m.isAiDraft;
    if (activeTab === 'inbox') return !m.isAiDraft;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex items-center justify-between bg-[#121214] border border-white/5 p-6 rounded-3xl">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="text-purple-400 w-6 h-6" />
            Consolidated Messaging Hub
          </h3>
          <p className="text-sm text-white/40 mt-1">Monitor corporate routing rules, mail logs, and verify AI agent drafts.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchInbox}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all cursor-pointer text-white/60 hover:text-white"
            title="Refresh Inbox"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)] cursor-pointer">
            <Plus className="w-4 h-4" />
            New Alias
          </button>
        </div>
      </div>

      {/* Tab selectors */}
      <div className="flex bg-[#121214]/50 border border-white/5 rounded-2xl p-1 max-w-sm">
        {[
          { id: 'inbox', label: 'Inbox Logs' },
          { id: 'drafts', label: 'AI Review Queue' },
          { id: 'aliases', label: 'Email Aliases' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as 'inbox' | 'drafts' | 'aliases');
              setSelectedMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative z-10 ${
              activeTab === tab.id ? 'text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl -z-10 shadow-sm" />
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 bg-red-500/5 border border-red-500/10 rounded-2xl p-4 text-xs text-red-400">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Content Body */}
      {selectedMsg ? (
        <div className="bg-[#121214] border border-white/5 rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <button 
              onClick={() => setSelectedMsg(null)}
              className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to list
            </button>
            <span className="text-xs text-white/30 font-mono">
              {new Date(selectedMsg.date).toLocaleString()}
            </span>
          </div>

          <div className="space-y-1">
            <h4 className="text-lg font-bold text-white">{selectedMsg.subject}</h4>
            <p className="text-xs text-white/50 font-mono">From: {selectedMsg.from}</p>
          </div>

          <div className="p-6 bg-white/[0.01] border border-white/5 rounded-2xl">
            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
              {selectedMsg.draftText || selectedMsg.snippet}
            </p>
          </div>

          {selectedMsg.isAiDraft && (
            <div className="p-6 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-between gap-6 animate-pulse-subtle">
              <div className="space-y-1">
                <p className="text-sm font-bold text-purple-400">Human-In-The-Loop Verification</p>
                <p className="text-xs text-purple-300/70">
                  This response was drafted by the indii Conductor agent. Approve to transmit this message.
                </p>
              </div>
              <button
                onClick={() => handleApproveDraft(selectedMsg.id)}
                disabled={approving !== null}
                className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer shrink-0"
              >
                {approving === selectedMsg.id ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                Approve &amp; Send Message
              </button>
            </div>
          )}
        </div>
      ) : activeTab === 'aliases' ? (
        <div className="bg-[#121214] border border-white/5 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Alias</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Destination</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Type</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Status</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {aliases.map((alias, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-white/90">{alias.email}</span>
                    </td>
                    <td className="px-6 py-4 text-white/50 text-sm">
                      {alias.destination}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-white/5 rounded text-[10px] font-bold text-white/40 border border-white/5">
                        {alias.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${alias.status === 'Active' ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`} />
                        <span className={`text-xs font-bold ${alias.status === 'Active' ? 'text-green-500' : 'text-orange-500'}`}>
                          {alias.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors cursor-pointer">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 hover:bg-red-500/20 rounded-lg text-white/40 hover:text-red-400 transition-colors cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-[#121214] border border-white/5 rounded-3xl overflow-hidden min-h-[300px] flex flex-col justify-between">
          {loading ? (
            <div className="flex-1 flex items-center justify-center p-20">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-20">
              <Mail className="w-12 h-12 text-white/10 mb-4" />
              <p className="text-white/60 font-semibold">No messages in queue</p>
              <p className="text-xs text-white/30 mt-1">All queues currently cleared</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredMessages.map((msg) => (
                <div 
                  key={msg.id}
                  onClick={() => setSelectedMsg(msg)}
                  className="p-6 hover:bg-white/[0.01] cursor-pointer transition-colors flex items-start justify-between group"
                >
                  <div className="space-y-1.5 min-w-0 flex-1 pr-6">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-white/60 truncate max-w-[200px]">{msg.from}</span>
                      {msg.isAiDraft && (
                        <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded text-[9px] font-bold">
                          Awaiting Approval
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-white/90 group-hover:text-white transition-colors truncate">{msg.subject}</p>
                    <p className="text-xs text-white/40 truncate">{msg.snippet}</p>
                  </div>
                  <div className="shrink-0 text-right space-y-2 flex flex-col items-end">
                    <span className="text-[10px] text-white/30 font-mono">
                      {new Date(msg.date).toLocaleDateString()}
                    </span>
                    {msg.isAiDraft && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApproveDraft(msg.id);
                        }}
                        className="py-1 px-2.5 bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/20 rounded-lg text-[10px] font-bold text-purple-400 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Quick Approve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'aliases' && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-6 flex items-start gap-4">
          <ShieldAlert className="w-6 h-6 text-orange-400 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-orange-400 mb-1">DNS Propagation Warning</h4>
            <p className="text-sm text-orange-400/80">
              Google Workspace MX records are still propagating globally. Email routing may experience up to 48 hours of intermittent delays. Wait for propagation to complete before relying on these aliases for production critical flows.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

