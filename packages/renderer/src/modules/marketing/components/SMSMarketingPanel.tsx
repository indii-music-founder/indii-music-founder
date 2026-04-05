import React, { useState } from 'react';
import {
    MessageSquare, Phone, Users, Clock, Send,
    CheckCircle, Loader2, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Segment = 'All Fans' | 'Superfans' | 'VIPs';

const SEGMENT_SIZES: Record<Segment, number> = {
    'All Fans': 3142,
    'Superfans': 847,
    'VIPs': 234,
};

const SMS_LIMIT = 160;

export default function SMSMarketingPanel() {
    const [senderNumber, setSenderNumber] = useState('');
    const [verified, setVerified] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [message, setMessage] = useState('');
    const [segment, setSegment] = useState<Segment>('All Fans');
    const [scheduledTime, setScheduledTime] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const charCount = message.length;
    const overLimit = charCount > SMS_LIMIT;
    const recipientCount = SEGMENT_SIZES[segment];

    const handleVerify = () => {
        if (!senderNumber) return;
        setVerifying(true);
        setTimeout(() => {
            setVerified(true);
            setVerifying(false);
        }, 1500);
    };

    const handleSend = () => {
        if (!message || overLimit || !verified) return;
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
                    <MessageSquare size={18} className="text-dept-marketing" />
                    SMS Marketing Engine
                </h2>
                <p className="text-xs text-gray-500 mt-1">Send targeted SMS blasts to fans via Twilio.</p>
            </div>

            {/* Sender Verification */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Phone size={10} /> Twilio Sender Number
                </label>
                <div className="flex gap-2">
                    <input
                        type="tel"
                        value={senderNumber}
                        onChange={e => setSenderNumber(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        disabled={verified}
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:border-dept-marketing/50 outline-none disabled:opacity-50"
                    />
                    {verified ? (
                        <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
                            <CheckCircle size={13} />
                            Verified
                        </div>
                    ) : (
                        <button
                            onClick={handleVerify}
                            disabled={verifying || !senderNumber}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-dept-marketing/10 border border-dept-marketing/20 text-dept-marketing text-xs font-medium hover:bg-dept-marketing/20 transition-all disabled:opacity-40"
                        >
                            {verifying ? <Loader2 size={13} className="animate-spin" /> : <Phone size={13} />}
                            Verify
                        </button>
                    )}
                </div>
            </div>

            {/* Message Composer */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Message
                    </label>
                    <span className={`text-xs font-mono font-bold ${overLimit ? 'text-red-400' : charCount > 140 ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {charCount}/{SMS_LIMIT}
                    </span>
                </div>
                <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Hey [Fan Name]! 🔥 New drop out now — stream it here: indii.vip/..."
                    rows={4}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:border-dept-marketing/50 outline-none resize-none leading-relaxed"
                />
                {overLimit && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle size={11} /> Message exceeds 160-character SMS limit.
                    </p>
                )}
            </div>

            {/* Segment Picker */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Users size={10} /> Recipient Segment
                </label>
                <div className="flex gap-2">
                    {(Object.keys(SEGMENT_SIZES) as Segment[]).map(s => (
                        <button
                            key={s}
                            onClick={() => setSegment(s)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                                segment === s
                                    ? 'bg-dept-marketing/15 border border-dept-marketing/30 text-dept-marketing'
                                    : 'bg-white/[0.03] border border-white/5 text-gray-400 hover:border-white/10'
                            }`}
                        >
                            <span className="block">{s}</span>
                            <span className="block text-[10px] font-normal mt-0.5 opacity-70">
                                {SEGMENT_SIZES[s].toLocaleString()} recipients
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Scheduled Send */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Clock size={10} /> Schedule Send (optional)
                </label>
                <input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:border-dept-marketing/50 outline-none"
                />
            </div>

            {/* Send Button */}
            <button
                onClick={handleSend}
                disabled={sending || !message || overLimit || !verified}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-dept-marketing text-white font-semibold text-sm hover:bg-dept-marketing/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-dept-marketing/20"
            >
                {sending ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Sending Blast...
                    </>
                ) : (
                    <>
                        <Send size={16} />
                        Send Blast to {recipientCount.toLocaleString()} {segment}
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
                            <p className="text-sm font-semibold text-green-400">SMS Blast Sent</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Delivered to <span className="text-white">{recipientCount.toLocaleString()} {segment}</span> via Twilio.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
