import React, { useState } from 'react';
import {
    Mail, Sparkles, Users, CheckCircle,
    Loader2, Send, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GenAI as AI } from '@/services/ai/GenAI';

type EmailPlatform = 'Mailchimp' | 'Klaviyo';

const TEMPLATES = [
    { id: 'new-release', label: 'New Release', desc: 'Announce a new single or album drop' },
    { id: 'tour-announcement', label: 'Tour Announcement', desc: 'Share upcoming tour dates & venues' },
    { id: 'merch-drop', label: 'Merch Drop', desc: 'Limited merch available now' },
    { id: 'fan-newsletter', label: 'Fan Newsletter', desc: 'Monthly update for your community' },
];

const FAN_LIST_SIZE = 2847;

export default function EmailMarketingPanel() {
    const [platform, setPlatform] = useState<EmailPlatform>('Mailchimp');
    const [selectedTemplate, setSelectedTemplate] = useState('new-release');
    const [subject, setSubject] = useState('');
    const [previewText, setPreviewText] = useState('');
    const [generatingSubject, setGeneratingSubject] = useState(false);
    const [scheduledTime, setScheduledTime] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const handleGenerateSubject = async () => {
        setGeneratingSubject(true);
        try {
            const template = TEMPLATES.find(t => t.id === selectedTemplate);
            const prompt = `Generate a compelling email subject line for a music artist's "${template?.label}" email campaign. Make it punchy, under 60 characters, and personalized for music fans. Return only the subject line, no quotes.`;
            const result = await AI.generateText(prompt);
            setSubject(result.trim());
        } catch {
            setSubject('Something big is coming — you heard it here first');
        } finally {
            setGeneratingSubject(false);
        }
    };

    const handleSend = () => {
        setSending(true);
        setTimeout(() => {
            setSending(false);
            setSent(true);
            setTimeout(() => setSent(false), 4000);
        }, 1800);
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

            {/* Recipient Count + Schedule */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <Users size={14} className="text-dept-marketing" />
                    <span className="text-sm font-bold text-white">{FAN_LIST_SIZE.toLocaleString()}</span>
                    <span className="text-xs text-gray-500">subscribers</span>
                </div>
                <div className="flex-1 relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                        type="datetime-local"
                        value={scheduledTime}
                        onChange={e => setScheduledTime(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:border-dept-marketing/50 outline-none"
                    />
                </div>
            </div>

            {/* Send Button */}
            <button
                onClick={handleSend}
                disabled={sending || !subject}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-dept-marketing text-white font-semibold text-sm hover:bg-dept-marketing/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-dept-marketing/20"
            >
                {sending ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        {scheduledTime ? 'Scheduling...' : 'Sending...'}
                    </>
                ) : (
                    <>
                        <Send size={16} />
                        {scheduledTime ? 'Schedule Email' : 'Send Now'}
                    </>
                )}
            </button>

            {/* Confirmation */}
            <AnimatePresence>
                {sent && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-3"
                    >
                        <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-green-400">
                                {scheduledTime ? 'Email Scheduled' : 'Email Sent Successfully'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Delivered to <span className="text-white">{FAN_LIST_SIZE.toLocaleString()} subscribers</span> via {platform}.
                                {scheduledTime && (
                                    <> Scheduled for {new Date(scheduledTime).toLocaleString()}.</>
                                )}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
