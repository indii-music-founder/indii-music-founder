/**
 * PitchDraftingModal — Item 120 (PRODUCTION_200)
 * AI-powered pitch email drafting for publicist contacts.
 * Uses GenAI.generateText() to stream a personalized pitch
 * based on the selected contact + optional campaign context.
 */
import React, { useState } from 'react';
import { X, Sparkles, Copy, Send, RefreshCw, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Contact, Campaign } from '../types';
import { GenAI as AI } from '@/services/ai/GenAI';
import { useToast } from '@/core/context/ToastContext';

interface PitchDraftingModalProps {
    isOpen: boolean;
    onClose: () => void;
    contact: Contact | null;
    campaign?: Campaign | null;
}

export function PitchDraftingModal({ isOpen, onClose, contact, campaign }: PitchDraftingModalProps) {
    const { showToast } = useToast();
    const [draft, setDraft] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    // Early return if no contact — Modal guard below also checks this,
    // but this satisfies TypeScript's null narrowing for the rest of the component.
    if (!contact) {
        return null;
    }

    const buildPrompt = () => {
        if (!contact) return '';
        const campaignContext = campaign
            ? `The release is "${campaign.title}" by ${campaign.artist} (${campaign.type}, releasing ${campaign.releaseDate}).`
            : 'The artist has a new release they would like to pitch.';
        return `
You are a senior music publicist drafting a personalized pitch email.

Recipient:
- Name: ${contact.name}
- Outlet: ${contact.outlet}
- Role: ${contact.role}
- Tier: ${contact.tier}
- Relationship: ${contact.relationshipStrength}

${campaignContext}

Write a concise, warm, and professional pitch email (under 200 words).
Use the recipient's name. Reference their outlet naturally.
End with a clear call-to-action (listen link / interview request).
Do not include a subject line — just the email body.
        `.trim();
    };

    const handleGenerate = async () => {
        if (!contact || isGenerating) return;
        setIsGenerating(true);
        setDraft('');
        try {
            const result = await AI.generateText(buildPrompt());
            setDraft(result);
        } catch {
            showToast('Failed to generate pitch. Try again.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = async () => {
        if (!draft) return;
        await navigator.clipboard.writeText(draft);
        setCopied(true);
        showToast('Pitch copied to clipboard!', 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} titleId="pitch-modal-title">
                    <div>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-dept-marketing/20 border border-dept-marketing/30 flex items-center justify-center">
                                    <Sparkles size={14} className="text-dept-marketing-glow" />
                                </div>
                                <div>
                                    <h3 id="pitch-modal-title" className="text-sm font-bold text-white">AI Pitch Drafter</h3>
                                    <p className="text-[10px] text-slate-500">
                                        Pitching <span className="text-slate-300">{contact?.name}</span> @ {contact?.outlet}
                                    </p>
                                </div>
                            </div>
                            <button onClick={onClose} aria-label="Close pitch drafter" className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Campaign Context Badge */}
                        {campaign && (
                            <div className="px-6 py-3 bg-white/[0.02] border-b border-white/5 flex items-center gap-2">
                                <Mail size={12} className="text-dept-marketing opacity-70" />
                                <span className="text-xs text-slate-400">
                                    Campaign: <span className="text-white font-medium">{campaign.title}</span>
                                    <span className="mx-2 text-slate-600">·</span>
                                    <span className="text-slate-500">{campaign.type} · {campaign.releaseDate}</span>
                                </span>
                            </div>
                        )}

                        {/* Draft Area */}
                        <div className="p-6">
                            <div className="relative min-h-[220px] bg-black/30 border border-white/5 rounded-xl p-4 mb-4">
                                {isGenerating && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 size={20} className="text-dept-marketing-glow animate-spin" />
                                            <span className="text-xs text-slate-400 animate-pulse">Crafting your pitch...</span>
                                        </div>
                                    </div>
                                )}
                                {!draft && !isGenerating && (
                                    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                                        <Sparkles size={24} className="text-slate-700 mb-3" />
                                        <p className="text-sm text-slate-500 mb-1">Click "Generate Pitch" to draft a personalized email.</p>
                                        <p className="text-xs text-slate-600">Tailored to {contact?.name}'s outlet and relationship strength.</p>
                                    </div>
                                )}
                                {draft && !isGenerating && (
                                    <textarea
                                        value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                        className="w-full h-full min-h-[200px] bg-transparent text-sm text-slate-300 leading-relaxed resize-none focus:outline-none"
                                    />
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="flex items-center gap-2 px-4 py-2 bg-dept-marketing/20 border border-dept-marketing/30 text-dept-marketing-glow rounded-lg text-xs font-bold hover:bg-dept-marketing/30 transition-all disabled:opacity-50"
                                >
                                    {isGenerating ? (
                                        <Loader2 size={13} className="animate-spin" />
                                    ) : draft ? (
                                        <RefreshCw size={13} />
                                    ) : (
                                        <Sparkles size={13} />
                                    )}
                                    {draft ? 'Regenerate' : 'Generate Pitch'}
                                </button>

                                {draft && (
                                    <>
                                        <button
                                            onClick={handleCopy}
                                            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-lg text-xs font-bold hover:bg-white/10 transition-all"
                                        >
                                            {copied ? <CheckCircle2 size={13} className="text-green-400" /> : <Copy size={13} />}
                                            {copied ? 'Copied!' : 'Copy'}
                                        </button>
                                        <a
                                            href={`mailto:${contact?.name?.toLowerCase().replace(' ', '.')}@${contact?.outlet?.toLowerCase().replace(' ', '')}.com?body=${encodeURIComponent(draft)}`}
                                            className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-xs font-bold hover:bg-slate-200 transition-all ml-auto"
                                        >
                                            <Send size={13} />
                                            Open in Mail
                                        </a>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
        </Modal>
    );
}
