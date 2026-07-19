import React, { useState } from 'react';
import {
    MessageSquare, Users, Send,
    Loader2, AlertCircle, Info
} from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { smsMarketingService, type SMSMember } from '@/services/marketing/SMSMarketingService';
import { isProviderUnavailable } from '@/services/marketing/providerErrors';

const SMS_LIMIT = 160;

// ISSUE-665: no fan phone list with SMS consent is wired into indii yet, so
// there is no real audience to send to. We keep the composer usable for
// drafting, state that plainly, and never fabricate recipient counts,
// sender verification, or delivery confirmations.
const AUDIENCE: SMSMember[] = [];

export default function SMSMarketingPanel() {
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const toast = useToast();

    const charCount = message.length;
    const overLimit = charCount > SMS_LIMIT;
    const hasAudience = AUDIENCE.length > 0;

    const handleSend = async () => {
        if (!message || overLimit || !hasAudience || sending) return;
        setSending(true);
        try {
            const sentCount = await smsMarketingService.broadcastSMS(AUDIENCE, {
                id: `sms_${Date.now()}`,
                text: message,
            });
            toast.success(`SMS blast accepted by Twilio for ${sentCount.toLocaleString('en-US')} superfans.`);
        } catch (e) {
            toast.error(isProviderUnavailable(e)
                ? e.message
                : 'SMS blast failed — no messages were sent.');
        } finally {
            setSending(false);
        }
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

            {/* Honest availability state */}
            {!hasAudience && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
                    <Info size={16} className="text-dept-marketing mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-white">No SMS audience connected yet</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Sending requires a fan phone list with SMS consent, which isn't wired into
                            indii yet. You can draft your message now — sending stays disabled until an
                            audience is connected.
                        </p>
                    </div>
                </div>
            )}

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

            {/* Real audience summary — honest count only */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 w-fit">
                <Users size={14} className="text-dept-marketing" />
                <span className="text-sm font-bold text-white">{AUDIENCE.length.toLocaleString('en-US')}</span>
                <span className="text-xs text-gray-500">reachable superfans</span>
            </div>

            {/* Send Button */}
            <button
                onClick={handleSend}
                disabled={sending || !message || overLimit || !hasAudience}
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
                        {hasAudience
                            ? `Send Blast to ${AUDIENCE.length.toLocaleString('en-US')} superfans`
                            : 'Send Blast (no audience connected)'}
                    </>
                )}
            </button>
        </div>
    );
}
