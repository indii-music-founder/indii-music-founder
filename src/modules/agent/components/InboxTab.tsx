/**
 * InboxTab — Full-featured email inbox integrated into the Agent Dashboard.
 *
 * Features:
 *   - Gmail and Outlook account connection via OAuth
 *   - Real-time message list with unread indicators
 *   - Search and filter (all / unread / starred)
 *   - Click to view full message
 *   - Compose new email
 *   - Reply, star, trash actions
 *   - Pull-to-refresh / manual sync
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mail,
    Inbox,
    Star,
    Trash2,
    RefreshCw,
    Plus,
    Search,
    ChevronRight,
    Paperclip,
    AlertCircle,
    Check,
    X,
    Loader2,
    Send,
    Reply,
    ArrowLeft,
} from 'lucide-react';
import { useStore, type StoreState } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import type { EmailMessage, EmailProvider, ComposeEmailData } from '@/services/email/types';

// ---------------------------------------------------------------------------
// Utility: Format relative time
// ---------------------------------------------------------------------------

function formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

/** Provider connection card */
const ConnectCard: React.FC<{
    provider: EmailProvider;
    label: string;
    icon: string;
    gradient: string;
    onConnect: () => void;
    isLoading: boolean;
}> = ({ provider, label, icon, gradient, onConnect, isLoading }) => (
    <button
        onClick={onConnect}
        disabled={isLoading}
        className={`flex items-center gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/50
                    hover:border-cyan-800 hover:bg-slate-900 transition-all group w-full text-left
                    disabled:opacity-50 disabled:cursor-not-allowed`}
    >
        <div className={`w-10 h-10 rounded-lg ${gradient} flex items-center justify-center text-lg shrink-0`}>
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors">
                Connect {label}
            </p>
            <p className="text-xs text-slate-500">
                {provider === 'gmail' ? 'Google Workspace / personal accounts' : 'Microsoft 365 / Hotmail'}
            </p>
        </div>
        {isLoading ? (
            <Loader2 size={16} className="text-cyan-400 animate-spin" />
        ) : (
            <ChevronRight size={16} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
        )}
    </button>
);

/** Single message row in the list */
const MessageRow: React.FC<{
    message: EmailMessage;
    isSelected: boolean;
    onSelect: () => void;
    onStar: () => void;
    onTrash: () => void;
}> = ({ message, isSelected, onSelect, onStar, onTrash }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        onClick={onSelect}
        className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer group
                    ${isSelected
                ? 'bg-cyan-950/30 border-cyan-800'
                : message.isRead
                    ? 'bg-slate-900/30 border-transparent hover:border-slate-800 hover:bg-slate-900/50'
                    : 'bg-slate-900 border-slate-800 hover:border-cyan-900'}`}
    >
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                        ${message.isRead ? 'bg-slate-800 text-slate-500' : 'bg-cyan-900/50 text-cyan-400'}`}>
            {message.from.name?.[0]?.toUpperCase() || message.from.email[0]?.toUpperCase() || '?'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
                <p className={`text-sm truncate ${message.isRead ? 'text-slate-300' : 'font-semibold text-white'}`}>
                    {message.from.name || message.from.email}
                </p>
                <span className="text-[10px] text-slate-600 shrink-0 tabular-nums">
                    {formatRelativeTime(message.date)}
                </span>
            </div>
            <p className={`text-xs truncate ${message.isRead ? 'text-slate-500' : 'text-slate-300 font-medium'}`}>
                {message.subject || '(no subject)'}
            </p>
            <p className="text-[11px] text-slate-600 truncate mt-0.5 leading-relaxed">
                {message.snippet}
            </p>

            {/* Indicators */}
            <div className="flex items-center gap-2 mt-1">
                {message.attachments.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
                        <Paperclip size={10} /> {message.attachments.length}
                    </span>
                )}
                {message.provider === 'outlook' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/50 text-blue-400 font-medium">
                        Outlook
                    </span>
                )}
                {message.provider === 'gmail' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950/50 text-red-400 font-medium">
                        Gmail
                    </span>
                )}
            </div>
        </div>

        {/* Actions (visible on hover) */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {!message.isRead && (
                <div className="w-2 h-2 bg-cyan-400 rounded-full" />
            )}
            <button
                onClick={(e) => { e.stopPropagation(); onStar(); }}
                className="p-1 rounded hover:bg-slate-800 transition-colors"
                title={message.isStarred ? 'Unstar' : 'Star'}
            >
                <Star size={12} className={message.isStarred ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onTrash(); }}
                className="p-1 rounded hover:bg-red-950/50 transition-colors"
                title="Trash"
            >
                <Trash2 size={12} className="text-slate-600 hover:text-red-400" />
            </button>
        </div>
    </motion.div>
);

/** Full email view */
const EmailDetailView: React.FC<{
    message: EmailMessage;
    onBack: () => void;
    onReply: () => void;
    onStar: () => void;
    onTrash: () => void;
}> = ({ message, onBack, onReply, onStar, onTrash }) => {
    const [fullMessage, setFullMessage] = useState<EmailMessage>(message);
    const [isLoadingBody, setIsLoadingBody] = useState(!message.bodyHtml && !message.bodyText);

    useEffect(() => {
        // Load full message body if not available
        if (!message.bodyHtml && !message.bodyText) {
            setIsLoadingBody(true);
            import('@/services/email/EmailService').then(async ({ EmailService }) => {
                try {
                    const full = await EmailService.getMessage(message.provider, message.providerMessageId);
                    setFullMessage(full);
                } catch {
                    // Keep snippet as fallback
                } finally {
                    setIsLoadingBody(false);
                }
            });
        }
    }, [message]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute inset-0 flex flex-col bg-slate-950"
        >
            {/* Header */}
            <div className="flex items-center gap-2 p-4 border-b border-slate-800">
                <button
                    onClick={onBack}
                    className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                >
                    <ArrowLeft size={16} className="text-slate-400" />
                </button>
                <div className="flex-1" />
                <button onClick={onReply} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors" title="Reply">
                    <Reply size={16} />
                </button>
                <button onClick={onStar} className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors" title="Star">
                    <Star size={16} className={fullMessage.isStarred ? 'text-amber-400 fill-amber-400' : 'text-slate-400'} />
                </button>
                <button onClick={onTrash} className="p-1.5 rounded-lg hover:bg-red-950/50 text-slate-400 hover:text-red-400 transition-colors" title="Trash">
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Message Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                <h2 className="text-lg font-semibold text-white leading-snug">
                    {fullMessage.subject || '(no subject)'}
                </h2>

                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-900/50 flex items-center justify-center text-sm font-bold text-cyan-400 shrink-0">
                        {fullMessage.from.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{fullMessage.from.name}</p>
                        <p className="text-xs text-slate-500">{fullMessage.from.email}</p>
                    </div>
                    <span className="text-xs text-slate-600 ml-auto shrink-0">
                        {new Date(fullMessage.date).toLocaleString()}
                    </span>
                </div>

                {fullMessage.to.length > 0 && (
                    <p className="text-xs text-slate-600">
                        To: {fullMessage.to.map(a => a.email).join(', ')}
                    </p>
                )}

                {/* Attachments */}
                {fullMessage.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {fullMessage.attachments.map(att => (
                            <div key={att.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                                <Paperclip size={12} className="text-slate-500" />
                                <span className="text-slate-300">{att.filename}</span>
                                <span className="text-slate-600">{(att.size / 1024).toFixed(0)}KB</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Body */}
                <div className="border-t border-slate-800/50 pt-4">
                    {isLoadingBody ? (
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Loader2 size={14} className="animate-spin" /> Loading message...
                        </div>
                    ) : fullMessage.bodyHtml ? (
                        <div
                            className="prose prose-invert prose-sm max-w-none
                                       prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
                                       prose-p:text-slate-300 prose-headings:text-white"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(fullMessage.bodyHtml, {
                                ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'blockquote', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
                                ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
                                FORCE_BODY: true,
                                FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
                                ADD_ATTR: ['target'],
                                ALLOW_UNKNOWN_PROTOCOLS: false,
                            }) }}
                        />
                    ) : (
                        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                            {fullMessage.bodyText || fullMessage.snippet}
                        </pre>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

/** Compose email modal */
const ComposeModal: React.FC<{
    onClose: () => void;
    onSend: (data: ComposeEmailData) => Promise<boolean>;
    replyTo?: EmailMessage;
    accounts: Array<{ id: string; provider: EmailProvider; email: string }>;
}> = ({ onClose, onSend, replyTo, accounts }) => {
    const [to, setTo] = useState(replyTo ? replyTo.from.email : '');
    const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
    const [body, setBody] = useState(replyTo
        ? `\n\n---\nOn ${new Date(replyTo.date).toLocaleString()}, ${replyTo.from.name} wrote:\n> ${replyTo.snippet}`
        : ''
    );
    const [accountId, setAccountId] = useState(accounts[0]?.id || '');
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        if (!to.trim() || !subject.trim()) return;
        setIsSending(true);

        const success = await onSend({
            to: to.split(',').map(s => s.trim()).filter(Boolean),
            subject,
            body,
            accountId,
            inReplyTo: replyTo?.providerMessageId,
            threadId: replyTo?.threadId,
        });

        setIsSending(false);
        if (success) onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 flex flex-col bg-slate-950 z-10"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-white">
                    {replyTo ? 'Reply' : 'New Email'}
                </h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSend}
                        disabled={isSending || !to.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500
                                   text-white text-xs font-medium transition-colors disabled:opacity-40"
                    >
                        {isSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        Send
                    </button>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Fields */}
            <div className="p-4 space-y-3 border-b border-slate-800/50">
                {accounts.length > 1 && (
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 w-12">From</label>
                        <select
                            value={accountId}
                            onChange={(e) => setAccountId(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white"
                        >
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.email}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 w-12">To</label>
                    <input
                        type="text"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        placeholder="recipient@example.com"
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white
                                   placeholder:text-slate-600 focus:border-cyan-800 focus:outline-none"
                        autoFocus={!replyTo}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 w-12">Subject</label>
                    <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Subject"
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white
                                   placeholder:text-slate-600 focus:border-cyan-800 focus:outline-none"
                    />
                </div>
            </div>

            {/* Body */}
            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message..."
                className="flex-1 bg-transparent p-4 text-sm text-slate-200 resize-none
                           placeholder:text-slate-600 focus:outline-none leading-relaxed"
                autoFocus={!!replyTo}
            />
        </motion.div>
    );
};

// ---------------------------------------------------------------------------
// Main InboxTab Component
// ---------------------------------------------------------------------------

const InboxTab: React.FC = () => {
    const {
        emailAccounts,
        emailMessages,
        emailSelectedMessage,
        emailIsLoading,
        emailIsSyncing,
        emailError,
        emailSearchQuery,
        emailFilter,
        emailIsComposing,
        emailConnect,
        emailDisconnect,
        emailSync,
        emailSend,
        emailSelectMessage,
        emailSetSearchQuery,
        emailSetFilter,
        emailSetComposing,
        emailMarkAsRead,
        emailToggleStar,
        emailRemoveMessage,
        emailFilteredMessages,
        emailUnreadCount,
        emailSetAccounts,
    } = useStore(useShallow((s: StoreState) => ({
        emailAccounts: s.emailAccounts as import('@/services/email/types').EmailAccount[],
        emailMessages: s.emailMessages as import('@/services/email/types').EmailMessage[],
        emailSelectedMessage: s.emailSelectedMessage as import('@/services/email/types').EmailMessage | null,
        emailIsLoading: s.emailIsLoading as boolean,
        emailIsSyncing: s.emailIsSyncing as boolean,
        emailError: s.emailError as string | null,
        emailSearchQuery: s.emailSearchQuery as string,
        emailFilter: s.emailFilter as 'all' | 'unread' | 'starred',
        emailIsComposing: s.emailIsComposing as boolean,
        emailConnect: s.emailConnect as (provider: EmailProvider) => Promise<void>,
        emailDisconnect: s.emailDisconnect as (provider: EmailProvider) => Promise<void>,
        emailSync: s.emailSync as (provider?: EmailProvider) => Promise<void>,
        emailSend: s.emailSend as (data: ComposeEmailData) => Promise<boolean>,
        emailSelectMessage: s.emailSelectMessage as (message: EmailMessage | null) => void,
        emailSetSearchQuery: s.emailSetSearchQuery as (query: string) => void,
        emailSetFilter: s.emailSetFilter as (filter: 'all' | 'unread' | 'starred') => void,
        emailSetComposing: s.emailSetComposing as (composing: boolean) => void,
        emailMarkAsRead: s.emailMarkAsRead as (messageId: string) => void,
        emailToggleStar: s.emailToggleStar as (messageId: string) => void,
        emailRemoveMessage: s.emailRemoveMessage as (messageId: string) => void,
        emailFilteredMessages: s.emailFilteredMessages as () => EmailMessage[],
        emailUnreadCount: s.emailUnreadCount as () => number,
        emailSetAccounts: s.emailSetAccounts as (accounts: import('@/services/email/types').EmailAccount[]) => void,
    })));

    const { showToast } = useToast();
    const [replyTarget, setReplyTarget] = useState<EmailMessage | null>(null);
    const [connectingProvider, setConnectingProvider] = useState<EmailProvider | null>(null);
    const hasAccounts = emailAccounts.length > 0;

    // Load connected accounts on mount
    useEffect(() => {
        import('@/services/email/EmailService').then(async ({ EmailService }) => {
            const accounts = await EmailService.getConnectedAccounts();
            emailSetAccounts(accounts);

            // Auto-sync if accounts exist
            if (accounts.length > 0) {
                emailSync();
            }
        }).catch(() => {
            // Service not available
        });
    }, [emailSetAccounts, emailSync]);

    // Auto-sync every 5 minutes when tab is active
    useEffect(() => {
        if (!hasAccounts) return;
        const interval = setInterval(() => emailSync(), 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [hasAccounts, emailSync]);

    const handleConnect = useCallback(async (provider: EmailProvider) => {
        setConnectingProvider(provider);
        try {
            await emailConnect(provider);
            showToast(`${provider === 'gmail' ? 'Gmail' : 'Outlook'} connected successfully!`, 'success');
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : 'Connection failed', 'error');
        } finally {
            setConnectingProvider(null);
        }
    }, [emailConnect, showToast]);

    const handleSelectMessage = useCallback(async (msg: EmailMessage) => {
        emailSelectMessage(msg);
        if (!msg.isRead) {
            emailMarkAsRead(msg.id);
            try {
                const { EmailService } = await import('@/services/email/EmailService');
                await EmailService.markAsRead(msg.provider, msg.providerMessageId);
            } catch {
                // Optimistic update is fine even if API call fails
            }
        }
    }, [emailSelectMessage, emailMarkAsRead]);

    const handleStar = useCallback(async (msg: EmailMessage) => {
        emailToggleStar(msg.id);
        try {
            const { EmailService } = await import('@/services/email/EmailService');
            await EmailService.toggleStar(msg.provider, msg.providerMessageId, !msg.isStarred);
        } catch {
            // Revert optimistic update
            emailToggleStar(msg.id);
        }
    }, [emailToggleStar]);

    const handleTrash = useCallback(async (msg: EmailMessage) => {
        emailRemoveMessage(msg.id);
        if (emailSelectedMessage?.id === msg.id) {
            emailSelectMessage(null);
        }
        try {
            const { EmailService } = await import('@/services/email/EmailService');
            await EmailService.trashMessage(msg.provider, msg.providerMessageId);
            showToast('Message moved to trash', 'success');
        } catch {
            showToast('Failed to trash message', 'error');
        }
    }, [emailRemoveMessage, emailSelectedMessage, emailSelectMessage, showToast]);

    const handleSendEmail = useCallback(async (data: ComposeEmailData) => {
        const success = await emailSend(data);
        if (success) {
            showToast('Email sent!', 'success');
        } else {
            showToast('Failed to send email', 'error');
        }
        return success;
    }, [emailSend, showToast]);

    const filteredMessages = useMemo(() => emailFilteredMessages(), [emailFilteredMessages]);
    const unreadCount = useMemo(() => emailUnreadCount(), [emailUnreadCount]);

    // -----------------------------------------------------------------------
    // Render: Email Detail View
    // -----------------------------------------------------------------------
    if (emailSelectedMessage) {
        return (
            <AnimatePresence mode="wait">
                <EmailDetailView
                    key={emailSelectedMessage.id}
                    message={emailSelectedMessage}
                    onBack={() => emailSelectMessage(null)}
                    onReply={() => {
                        setReplyTarget(emailSelectedMessage);
                        emailSetComposing(true);
                    }}
                    onStar={() => handleStar(emailSelectedMessage)}
                    onTrash={() => handleTrash(emailSelectedMessage)}
                />
            </AnimatePresence>
        );
    }

    // -----------------------------------------------------------------------
    // Render: Compose Modal
    // -----------------------------------------------------------------------
    if (emailIsComposing) {
        return (
            <AnimatePresence mode="wait">
                <ComposeModal
                    key="compose"
                    onClose={() => {
                        emailSetComposing(false);
                        setReplyTarget(null);
                    }}
                    onSend={handleSendEmail}
                    replyTo={replyTarget || undefined}
                    accounts={emailAccounts.map(a => ({ id: a.id, provider: a.provider as EmailProvider, email: a.email }))}
                />
            </AnimatePresence>
        );
    }

    // -----------------------------------------------------------------------
    // Render: Main Inbox View
    // -----------------------------------------------------------------------
    return (
        <div className="absolute inset-0 flex flex-col">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Mail size={18} className="text-cyan-400" /> Inbox
                        {unreadCount > 0 && (
                            <span className="bg-cyan-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                                {unreadCount}
                            </span>
                        )}
                    </h2>
                    <div className="flex items-center gap-1.5">
                        {hasAccounts && (
                            <>
                                <button
                                    onClick={() => emailSync()}
                                    disabled={emailIsSyncing}
                                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors"
                                    title="Sync"
                                >
                                    <RefreshCw size={14} className={emailIsSyncing ? 'animate-spin' : ''} />
                                </button>
                                <button
                                    onClick={() => emailSetComposing(true)}
                                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors"
                                    title="Compose"
                                >
                                    <Plus size={14} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Search + Filters */}
                {hasAccounts && (
                    <>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                            <input
                                type="text"
                                value={emailSearchQuery}
                                onChange={(e) => emailSetSearchQuery(e.target.value)}
                                placeholder="Search emails..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white
                                           placeholder:text-slate-600 focus:border-cyan-800 focus:outline-none transition-colors"
                            />
                        </div>

                        <div className="flex gap-1">
                            {(['all', 'unread', 'starred'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => emailSetFilter(f)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                                               ${emailFilter === f
                                            ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-800'
                                            : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
                                >
                                    {f === 'all' ? 'All' : f === 'unread' ? `Unread (${unreadCount})` : 'Starred'}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Error Banner */}
            {emailError && (
                <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/50 border border-red-900/50">
                    <AlertCircle size={14} className="text-red-400 shrink-0" />
                    <p className="text-xs text-red-300 flex-1">{emailError}</p>
                    <button onClick={() => useStore.getState().emailSetError(null)} className="text-red-400 hover:text-red-300">
                        <X size={12} />
                    </button>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
                {!hasAccounts ? (
                    // ---- Empty State: No Accounts Connected ----
                    <div className="flex flex-col items-center justify-center h-full">
                        <div className="w-full max-w-sm space-y-4">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-900/50 to-cyan-950/30
                                                border border-cyan-800/30 flex items-center justify-center mb-4">
                                    <Inbox size={28} className="text-cyan-400" />
                                </div>
                                <h3 className="text-base font-semibold text-white mb-1">Connect Your Email</h3>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    Aggregate your inbox here. See venue responses, label confirmations,
                                    and distribution updates — all in one place.
                                </p>
                            </div>

                            <ConnectCard
                                provider="gmail"
                                label="Gmail"
                                icon="📧"
                                gradient="bg-gradient-to-br from-red-600 to-orange-500"
                                onConnect={() => handleConnect('gmail')}
                                isLoading={connectingProvider === 'gmail'}
                            />
                            <ConnectCard
                                provider="outlook"
                                label="Outlook"
                                icon="📬"
                                gradient="bg-gradient-to-br from-blue-600 to-blue-400"
                                onConnect={() => handleConnect('outlook')}
                                isLoading={connectingProvider === 'outlook'}
                            />

                            <p className="text-center text-[10px] text-slate-700 mt-4">
                                🔒 Tokens are stored securely. We never store your password.
                            </p>
                        </div>
                    </div>
                ) : emailIsLoading ? (
                    // ---- Loading State ----
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 size={24} className="text-cyan-400 animate-spin" />
                            <p className="text-sm text-slate-400">Loading inbox...</p>
                        </div>
                    </div>
                ) : filteredMessages.length === 0 ? (
                    // ---- Empty Results ----
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <Mail size={28} className="text-slate-700 mb-3" />
                        <p className="text-sm text-slate-400 font-medium">
                            {emailSearchQuery ? 'No matching emails' : emailFilter === 'unread' ? 'All caught up!' : 'No emails yet'}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                            {emailSearchQuery ? 'Try a different search term' : 'New messages will appear here'}
                        </p>
                    </div>
                ) : (
                    // ---- Message List ----
                    <div className="space-y-1">
                        <AnimatePresence>
                            {filteredMessages.map(msg => (
                                <MessageRow
                                    key={msg.id}
                                    message={msg}
                                    isSelected={(emailSelectedMessage as EmailMessage | null)?.id === msg.id}
                                    onSelect={() => handleSelectMessage(msg)}
                                    onStar={() => handleStar(msg)}
                                    onTrash={() => handleTrash(msg)}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Connected Accounts Footer */}
            {hasAccounts && (
                <div className="px-4 py-2 border-t border-slate-800/50 flex items-center gap-3">
                    {emailAccounts.map(acc => (
                        <div key={acc.id} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                            <div className={`w-1.5 h-1.5 rounded-full ${acc.isConnected ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                            <span>{acc.email}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default InboxTab;
