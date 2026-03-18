import React, { useState } from 'react';
import {
    Webhook, Send, CheckCircle, Loader2, AlertCircle,
    ToggleLeft, ToggleRight, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';

interface PlatformConfig {
    name: 'Discord' | 'Telegram';
    icon: string;
    webhookUrl: string;
    enabled: boolean;
    testing: boolean;
    tested: boolean;
}

interface AutoToggle {
    id: string;
    label: string;
    enabled: boolean;
}

const DEFAULT_MESSAGE = 'Hey {artist} community! 🎵 "{release_title}" drops on {release_date}. Stream it now and spread the word!';

const VARIABLES = ['{artist}', '{release_title}', '{release_date}'];

export default function CommunityWebhookPanel() {
    const { showToast } = useToast();

    const [platforms, setPlatforms] = useState<PlatformConfig[]>([
        { name: 'Discord', icon: '🎮', webhookUrl: '', enabled: true, testing: false, tested: false },
        { name: 'Telegram', icon: '📱', webhookUrl: '', enabled: false, testing: false, tested: false },
    ]);

    const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE);

    const [autoToggles, setAutoToggles] = useState<AutoToggle[]>([
        { id: 'new-release', label: 'New Release', enabled: true },
        { id: 'tour-date', label: 'Tour Date', enabled: false },
        { id: 'merch-drop', label: 'Merch Drop', enabled: true },
    ]);

    const [sending, setSending] = useState(false);

    const updatePlatform = (idx: number, update: Partial<PlatformConfig>) => {
        setPlatforms(prev => prev.map((p, i) => (i === idx ? { ...p, ...update } : p)));
    };

    const handleTestWebhook = (idx: number) => {
        const p = platforms[idx]!;
        if (!p.webhookUrl) {
            showToast('Please enter a webhook URL first.', 'error');
            return;
        }
        updatePlatform(idx, { testing: true, tested: false });
        setTimeout(() => {
            updatePlatform(idx, { testing: false, tested: true });
            showToast(`Test message sent to ${p.name} successfully.`, 'success');
        }, 1200);
    };

    const toggleAutoAnnounce = (id: string) => {
        setAutoToggles(prev =>
            prev.map(t => (t.id === id ? { ...t, enabled: !t.enabled } : t))
        );
    };

    const insertVariable = (variable: string) => {
        setMessageTemplate(prev => prev + ' ' + variable);
    };

    const handleSendAnnouncement = () => {
        const activePlatforms = platforms.filter(p => p.enabled && p.webhookUrl);
        if (activePlatforms.length === 0) {
            showToast('Enable at least one platform with a webhook URL.', 'error');
            return;
        }
        setSending(true);
        setTimeout(() => {
            setSending(false);
            showToast(`Announcement sent to ${activePlatforms.map(p => p.name).join(' & ')}!`, 'success');
        }, 1500);
    };

    return (
        <div className="flex flex-col gap-6 p-6 max-w-2xl">
            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Webhook size={18} className="text-dept-marketing" />
                    Community Chat Webhook
                </h2>
                <p className="text-xs text-gray-500 mt-1">Send automated announcements to Discord and Telegram communities.</p>
            </div>

            {/* Platform Cards */}
            <div className="space-y-3">
                {platforms.map((p, idx) => (
                    <div
                        key={p.name}
                        className={`p-4 rounded-xl border transition-all ${
                            p.enabled
                                ? 'bg-white/[0.04] border-dept-marketing/20'
                                : 'bg-white/[0.02] border-white/5'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{p.icon}</span>
                                <span className="text-sm font-semibold text-white">{p.name}</span>
                            </div>
                            <button
                                onClick={() => updatePlatform(idx, { enabled: !p.enabled })}
                                className="text-gray-500 hover:text-dept-marketing transition-colors"
                            >
                                {p.enabled
                                    ? <ToggleRight size={22} className="text-dept-marketing" />
                                    : <ToggleLeft size={22} />
                                }
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="url"
                                value={p.webhookUrl}
                                onChange={e => updatePlatform(idx, { webhookUrl: e.target.value, tested: false })}
                                placeholder={p.name === 'Discord'
                                    ? 'https://discord.com/api/webhooks/...'
                                    : 'https://api.telegram.org/bot.../sendMessage'
                                }
                                disabled={!p.enabled}
                                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-700 focus:border-dept-marketing/50 outline-none disabled:opacity-40"
                            />
                            <button
                                onClick={() => handleTestWebhook(idx)}
                                disabled={!p.enabled || p.testing || !p.webhookUrl}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                {p.testing ? (
                                    <Loader2 size={12} className="animate-spin" />
                                ) : p.tested ? (
                                    <CheckCircle size={12} className="text-green-400" />
                                ) : (
                                    <AlertCircle size={12} />
                                )}
                                {p.tested ? 'OK' : 'Test'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Message Template */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <MessageSquare size={10} /> Message Template
                    </label>
                    <div className="flex gap-1">
                        {VARIABLES.map(v => (
                            <button
                                key={v}
                                onClick={() => insertVariable(v)}
                                className="px-2 py-0.5 rounded bg-dept-marketing/15 text-dept-marketing text-[10px] font-mono hover:bg-dept-marketing/25 transition-all"
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
                <textarea
                    value={messageTemplate}
                    onChange={e => setMessageTemplate(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:border-dept-marketing/50 outline-none resize-none leading-relaxed"
                />
            </div>

            {/* Auto-Announce Toggles */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                    Auto-Announce
                </label>
                <div className="space-y-2">
                    {autoToggles.map(t => (
                        <div
                            key={t.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all"
                        >
                            <span className="text-sm text-gray-300">{t.label}</span>
                            <button
                                onClick={() => toggleAutoAnnounce(t.id)}
                                className="transition-colors"
                            >
                                {t.enabled
                                    ? <ToggleRight size={20} className="text-dept-marketing" />
                                    : <ToggleLeft size={20} className="text-gray-600" />
                                }
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Send Announcement */}
            <button
                onClick={handleSendAnnouncement}
                disabled={sending}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-dept-marketing text-white font-semibold text-sm hover:bg-dept-marketing/90 transition-all disabled:opacity-50 shadow-lg shadow-dept-marketing/20"
            >
                {sending ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Sending Announcement...
                    </>
                ) : (
                    <>
                        <Send size={16} />
                        Send Announcement
                    </>
                )}
            </button>
        </div>
    );
}
