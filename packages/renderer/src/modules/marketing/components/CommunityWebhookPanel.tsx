import React, { useState, useEffect } from 'react';
import {
    Webhook, Send, CheckCircle, Loader2, AlertCircle,
    ToggleLeft, ToggleRight, MessageSquare
} from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';

interface PlatformConfig {
    name: 'Discord' | 'Telegram';
    icon: string;
    webhookUrl: string;
    chatId?: string; // Telegram only — sendMessage requires a target chat_id
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

const STORAGE_KEY = 'indii_community_webhook_config';

const DISCORD_WEBHOOK_PATTERN = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const TELEGRAM_WEBHOOK_PATTERN = /^https:\/\/api\.telegram\.org\/bot[\w:-]+\/sendMessage$/;

function validateWebhookUrl(platform: PlatformConfig['name'], url: string): string | null {
    if (platform === 'Discord' && !DISCORD_WEBHOOK_PATTERN.test(url)) {
        return 'Not a valid Discord webhook URL (expected https://discord.com/api/webhooks/<id>/<token>).';
    }
    if (platform === 'Telegram' && !TELEGRAM_WEBHOOK_PATTERN.test(url)) {
        return 'Not a valid Telegram bot URL (expected https://api.telegram.org/bot<token>/sendMessage).';
    }
    return null;
}

/**
 * ISSUE-946: sends the actual HTTP request to the provider instead of
 * faking success with a timer. Returns the real outcome so callers can
 * report the provider's actual response rather than an assumed one.
 */
async function dispatchToProvider(platform: PlatformConfig, message: string): Promise<{ ok: boolean; error?: string }> {
    try {
        if (platform.name === 'Discord') {
            const response = await fetch(platform.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: message }),
            });
            if (!response.ok) {
                return { ok: false, error: `Discord responded ${response.status} ${response.statusText}` };
            }
            return { ok: true };
        }

        // Telegram
        if (!platform.chatId?.trim()) {
            return { ok: false, error: 'Telegram requires a Chat ID.' };
        }
        const response = await fetch(platform.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: platform.chatId.trim(), text: message }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.ok === false) {
            return { ok: false, error: body?.description || `Telegram responded ${response.status} ${response.statusText}` };
        }
        return { ok: true };
    } catch (error: unknown) {
        return { ok: false, error: error instanceof Error ? error.message : 'Network request failed' };
    }
}

interface PersistedConfig {
    platforms: Pick<PlatformConfig, 'name' | 'webhookUrl' | 'chatId' | 'enabled'>[];
    messageTemplate: string;
    autoToggles: AutoToggle[];
}

function loadPersistedConfig(): PersistedConfig | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) as PersistedConfig : null;
    } catch (error: unknown) {
        logger.warn('[CommunityWebhookPanel] Failed to load persisted config', error);
        return null;
    }
}

const DEFAULT_PLATFORMS: PlatformConfig[] = [
    { name: 'Discord', icon: '🎮', webhookUrl: '', enabled: true, testing: false, tested: false },
    { name: 'Telegram', icon: '📱', webhookUrl: '', chatId: '', enabled: false, testing: false, tested: false },
];

const DEFAULT_AUTO_TOGGLES: AutoToggle[] = [
    { id: 'new-release', label: 'New Release', enabled: true },
    { id: 'tour-date', label: 'Tour Date', enabled: false },
    { id: 'merch-drop', label: 'Merch Drop', enabled: true },
];

export default function CommunityWebhookPanel() {
    const { showToast } = useToast();

    const [platforms, setPlatforms] = useState<PlatformConfig[]>(() => {
        const persisted = loadPersistedConfig();
        if (!persisted) return DEFAULT_PLATFORMS;
        return DEFAULT_PLATFORMS.map(defaultPlatform => {
            const saved = persisted.platforms.find(p => p.name === defaultPlatform.name);
            return saved
                ? { ...defaultPlatform, webhookUrl: saved.webhookUrl, chatId: saved.chatId, enabled: saved.enabled }
                : defaultPlatform;
        });
    });

    const [messageTemplate, setMessageTemplate] = useState(() => loadPersistedConfig()?.messageTemplate ?? DEFAULT_MESSAGE);

    const [autoToggles, setAutoToggles] = useState<AutoToggle[]>(() => loadPersistedConfig()?.autoToggles ?? DEFAULT_AUTO_TOGGLES);

    const [sending, setSending] = useState(false);

    // ISSUE-946: previously nothing persisted at all — every toggle, URL,
    // and template reset on remount/refresh. This survives a browser
    // refresh (not yet cross-device Firestore sync — see ledger).
    useEffect(() => {
        try {
            const toPersist: PersistedConfig = {
                platforms: platforms.map(({ name, webhookUrl, chatId, enabled }) => ({ name, webhookUrl, chatId, enabled })),
                messageTemplate,
                autoToggles,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
        } catch (error: unknown) {
            logger.warn('[CommunityWebhookPanel] Failed to persist config', error);
        }
    }, [platforms, messageTemplate, autoToggles]);

    const updatePlatform = (idx: number, update: Partial<PlatformConfig>) => {
        setPlatforms(prev => prev.map((p, i) => (i === idx ? { ...p, ...update } : p)));
    };

    const handleTestWebhook = async (idx: number) => {
        const p = platforms[idx]!;
        if (!p.webhookUrl) {
            showToast('Please enter a webhook URL first.', 'error');
            return;
        }

        const validationError = validateWebhookUrl(p.name, p.webhookUrl);
        if (validationError) {
            showToast(validationError, 'error');
            return;
        }

        updatePlatform(idx, { testing: true, tested: false });

        const result = await dispatchToProvider(p, 'indii.music test message — your webhook is connected.');

        if (result.ok) {
            updatePlatform(idx, { testing: false, tested: true });
            showToast(`Test message sent to ${p.name} successfully.`, 'success');
        } else {
            updatePlatform(idx, { testing: false, tested: false });
            logger.error(`[CommunityWebhookPanel] ${p.name} test failed`, result.error);
            showToast(`${p.name} test failed: ${result.error}`, 'error');
        }
    };

    const toggleAutoAnnounce = (id: string) => {
        setAutoToggles(prev =>
            prev.map(t => (t.id === id ? { ...t, enabled: !t.enabled } : t))
        );
    };

    const insertVariable = (variable: string) => {
        setMessageTemplate(prev => prev + ' ' + variable);
    };

    const handleSendAnnouncement = async () => {
        const activePlatforms = platforms.filter(p => p.enabled && p.webhookUrl);
        if (activePlatforms.length === 0) {
            showToast('Enable at least one platform with a webhook URL.', 'error');
            return;
        }

        setSending(true);

        const results = await Promise.all(
            activePlatforms.map(async p => ({ platform: p.name, ...(await dispatchToProvider(p, messageTemplate)) }))
        );

        setSending(false);

        const succeeded = results.filter(r => r.ok).map(r => r.platform);
        const failed = results.filter(r => !r.ok);

        if (succeeded.length > 0) {
            showToast(`Announcement sent to ${succeeded.join(' & ')}!`, 'success');
        }
        failed.forEach(f => {
            logger.error(`[CommunityWebhookPanel] Send failed for ${f.platform}`, f.error);
            showToast(`Failed to send to ${f.platform}: ${f.error}`, 'error');
        });
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
                        {p.name === 'Telegram' && (
                            <input
                                type="text"
                                value={p.chatId ?? ''}
                                onChange={e => updatePlatform(idx, { chatId: e.target.value, tested: false })}
                                placeholder="Chat ID (required for Telegram — e.g. -100123456789)"
                                disabled={!p.enabled}
                                className="mt-2 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-700 focus:border-dept-marketing/50 outline-none disabled:opacity-40"
                            />
                        )}
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
                <p className="text-[10px] text-gray-600 mt-1">
                    Variable tokens are inserted as literal text — replace them by hand before sending; there is no automatic substitution.
                </p>
            </div>

            {/* Auto-Announce Toggles */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    Auto-Announce
                    <span className="text-[9px] normal-case font-normal text-amber-500/80 tracking-normal">Not yet wired to release/tour/drop events</span>
                </label>
                <div className="space-y-2 opacity-60">
                    {autoToggles.map(t => (
                        <div
                            key={t.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5"
                        >
                            <span className="text-sm text-gray-400">{t.label}</span>
                            <button
                                onClick={() => toggleAutoAnnounce(t.id)}
                                disabled
                                className="cursor-not-allowed"
                                title="Auto-announce is not yet wired to real release/tour/drop events"
                            >
                                {t.enabled
                                    ? <ToggleRight size={20} className="text-gray-600" />
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
