import React, { useState } from 'react';
import {
    Mail, Sparkles, Users, Loader2, Send, Info
} from 'lucide-react';
import { AutonomousIntelligence as AI } from '@/services/intelligence/AutonomousIntelligence';
import { useToast } from '@/core/context/ToastContext';
import { emailMarketingService, type EmailProvider } from '@/services/marketing/EmailMarketingService';
import { isProviderUnavailable } from '@/services/marketing/providerErrors';

type EmailPlatform = 'Mailchimp' | 'Klaviyo';

const PROVIDER_IDS: Record<EmailPlatform, EmailProvider> = {
    Mailchimp: 'mailchimp',
    Klaviyo: 'klaviyo',
};

const TEMPLATES = [
    { id: 'new-release', label: 'New Release', desc: 'Announce a new single or album drop' },
    { id: 'tour-announcement', label: 'Tour Announcement', desc: 'Share upcoming tour dates & venues' },
    { id: 'merch-drop', label: 'Merch Drop', desc: 'Limited merch available now' },
    { id: 'fan-newsletter', label: 'Fan Newsletter', desc: 'Monthly update for your community' },
];

// ISSUE-665: no Mailchimp/Klaviyo account or subscriber list is linked to
// indii yet, so there is no real list to deploy to. The composer stays usable
// for drafting; we say that plainly and never fabricate subscriber counts or
// delivery confirmations.
const CONNECTED_LIST_ID: string | null = null;

export default function EmailMarketingPanel() {
    const [platform, setPlatform] = useState<EmailPlatform>('Mailchimp');
    const [selectedTemplate, setSelectedTemplate] = useState('new-release');
    const [subject, setSubject] = useState('');
    const [previewText, setPreviewText] = useState('');
    const [generatingSubject, setGeneratingSubject] = useState(false);
    const [sending, setSending] = useState(false);
    const toast = useToast();

    const hasList = CONNECTED_LIST_ID !== null;

    const handleGenerateSubject = async () => {
        setGeneratingSubject(true);
        try {
            const template = TEMPLATES.find(t => t.id === selectedTemplate);
            const prompt = `Generate a compelling email subject line for a music artist's "${template?.label}" email campaign. Make it punchy, under 60 characters, and personalized for music fans. Return only the subject line, no quotes.`;
            const result = await AI.generateText(prompt);
            setSubject(result.trim());
        } catch {
            // Honest failure — don't plant a canned line and present it as generated.
            toast.error('Subject generation failed — try again or write your own.');
        } finally {
            setGeneratingSubject(false);
        }
    };

    const handleSend = async () => {
        if (!subject || CONNECTED_LIST_ID === null || sending) return;
        setSending(true);
        try {
            const template = TEMPLATES.find(t => t.id === selectedTemplate);
            const campaignId = await emailMarketingService.deployCampaign(
                {
                    id: selectedTemplate,
                    name: template?.label ?? selectedTemplate,
                    subject,
                    htmlContent: previewText,
                },
                CONNECTED_LIST_ID,
                PROVIDER_IDS[platform]
            );
            toast.success(`Campaign ${campaignId} accepted by ${platform} for sending.`);
        } catch (e) {
            toast.error(isProviderUnavailable(e)
                ? e.message
                : `Campaign deploy failed — nothing was sent via ${platform}.`);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6 max-w-2xl">
            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Mail size={18} className="text-dept-marketing" />
                    Email Marketing Integration
                </h2>
                <p className="text-xs text-gray-500 mt-1">Deploy HTML newsletter campaigns via Mailchimp & Klaviyo.</p>
            </div>

            {/* Honest availability state */}
            {!hasList && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
                    <Info size={16} className="text-dept-marketing mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-white">No subscriber list connected yet</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Sending requires a linked {platform} account with a subscriber list, which
                            isn't wired into indii yet. You can draft your campaign now — sending stays
                            disabled until a list is connected.
                        </p>
                    </div>
                </div>
            )}

            {/* Platform Toggle */}
            <div className="flex gap-2">
                {(['Mailchimp', 'Klaviyo'] as const).map(p => (
                    <button
                        key={p}
                        onClick={() => setPlatform(p)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            platform === p
                                ? 'bg-dept-marketing text-white shadow-lg shadow-dept-marketing/20'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        {p}
                    </button>
                ))}
            </div>

            {/* Template Picker */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                    Email Template
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {TEMPLATES.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setSelectedTemplate(t.id)}
                            className={`p-3 rounded-xl text-left transition-all ${
                                selectedTemplate === t.id
                                    ? 'bg-dept-marketing/10 border border-dept-marketing/30 text-white'
                                    : 'bg-white/[0.03] border border-white/5 text-gray-400 hover:border-white/10'
                            }`}
                        >
                            <p className="text-sm font-semibold">{t.label}</p>
                            <p className="text-[10px] mt-0.5 text-gray-500">{t.desc}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Subject Line */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                    Subject Line
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        placeholder="Your email subject line..."
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:border-dept-marketing/50 outline-none"
                    />
                    <button
                        onClick={handleGenerateSubject}
                        disabled={generatingSubject}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dept-marketing/10 border border-dept-marketing/20 text-dept-marketing text-xs font-medium hover:bg-dept-marketing/20 transition-all disabled:opacity-50"
                        title="Generate with AI"
                    >
                        {generatingSubject ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        AI
                    </button>
                </div>
            </div>

            {/* Preview Text */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                    Preview Text
                </label>
                <input
                    type="text"
                    value={previewText}
                    onChange={e => setPreviewText(e.target.value)}
                    placeholder="Short preview shown in inbox..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:border-dept-marketing/50 outline-none"
                />
            </div>

            {/* Real audience summary — honest state only */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 w-fit">
                <Users size={14} className="text-dept-marketing" />
                <span className="text-xs text-gray-500">
                    {hasList ? `List ${CONNECTED_LIST_ID} connected` : 'No subscriber list connected'}
                </span>
            </div>

            {/* Send Button */}
            <button
                onClick={handleSend}
                disabled={sending || !subject || !hasList}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-dept-marketing text-white font-semibold text-sm hover:bg-dept-marketing/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-dept-marketing/20"
            >
                {sending ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Sending...
                    </>
                ) : (
                    <>
                        <Send size={16} />
                        {hasList ? 'Send Now' : 'Send Now (no list connected)'}
                    </>
                )}
            </button>
        </div>
    );
}
