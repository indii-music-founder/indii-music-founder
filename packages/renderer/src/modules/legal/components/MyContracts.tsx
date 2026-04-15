import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Download, Eye, Trash2, Clock, ChevronRight, Loader2, FilePlus, AlertTriangle, Send, X } from 'lucide-react';
import { LegalService } from '@/services/legal/LegalService';
import { ContractPDFService } from '@/services/legal/ContractPDFService';
import { ResendEmailService } from '@/services/email/ResendEmailService';
import type { LegalContract } from '@/modules/legal/types';
import { ContractStatus } from '@/modules/legal/types';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';
import { cn } from '@/lib/utils';

/* ================================================================== */
/*  My Contracts — Live contract list with PDF export & management      */
/* ================================================================== */

interface MyContractsProps {
    /** Callback when user clicks "New Contract" */
    onNewContract?: () => void;
}

export function MyContracts({ onNewContract }: MyContractsProps) {
    const toast = useToast();
    const [contracts, setContracts] = useState<LegalContract[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [sendingId, setSendingId] = useState<string | null>(null);
    const [emailDialog, setEmailDialog] = useState<{ contract: LegalContract; recipientEmail: string; message: string } | null>(null);
    const emailInputRef = useRef<HTMLInputElement>(null);

    // Load contracts on mount
    const loadContracts = useCallback(async () => {
        setLoading(true);
        try {
            const results = await LegalService.getContracts();
            setContracts(results);
        } catch (err) {
            logger.error('[MyContracts] Failed to load contracts:', err);
            toast.error('Failed to load contracts.');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadContracts();
    }, [loadContracts]);

    const handleDownloadPDF = async (contract: LegalContract) => {
        setDownloadingId(contract.id);
        try {
            ContractPDFService.download({
                title: contract.title,
                content: contract.content,
                subtitle: contract.status === ContractStatus.DRAFT ? 'DRAFT — For Review Only' : undefined,
                filename: `${contract.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}`,
            });
            toast.success(`Downloaded: ${contract.title}.pdf`);
        } catch (err) {
            logger.error('[MyContracts] PDF generation failed:', err);
            toast.error('Failed to generate PDF.');
        } finally {
            setDownloadingId(null);
        }
    };

    const handlePreviewPDF = (contract: LegalContract) => {
        try {
            ContractPDFService.preview({
                title: contract.title,
                content: contract.content,
                subtitle: contract.status === ContractStatus.DRAFT ? 'DRAFT — For Review Only' : undefined,
            });
        } catch (err) {
            logger.error('[MyContracts] PDF preview failed:', err);
            toast.error('Failed to preview PDF.');
        }
    };

    const handleDelete = async (contract: LegalContract) => {
        if (!confirm(`Delete "${contract.title}"? This cannot be undone.`)) return;
        try {
            await LegalService.updateContract(contract.id, { status: ContractStatus.DRAFT });
            setContracts(prev => prev.filter(c => c.id !== contract.id));
            toast.success(`Deleted: ${contract.title}`);
        } catch (err) {
            logger.error('[MyContracts] Delete failed:', err);
            toast.error('Failed to delete contract.');
        }
    };

    const openSendDialog = (contract: LegalContract) => {
        setEmailDialog({ contract, recipientEmail: '', message: '' });
        // Focus the email input after the dialog renders
        setTimeout(() => emailInputRef.current?.focus(), 100);
    };

    const handleSendEmail = async () => {
        if (!emailDialog) return;
        const { contract, recipientEmail, message } = emailDialog;

        if (!recipientEmail.trim() || !recipientEmail.includes('@')) {
            toast.error('Please enter a valid email address.');
            return;
        }

        setSendingId(contract.id);
        try {
            // Generate PDF as Base64
            const pdfBase64 = ContractPDFService.toBase64({
                title: contract.title,
                content: contract.content,
                subtitle: contract.status === ContractStatus.DRAFT ? 'DRAFT — For Review Only' : undefined,
            });

            const filename = `${contract.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}.pdf`;

            const result = await ResendEmailService.sendContract({
                to: recipientEmail.trim(),
                contractType: contract.type || contract.title,
                parties: 'As specified in the attached document',
                pdfBase64,
                filename,
                message: message.trim() || undefined,
            });

            if (result.success) {
                toast.success(`Contract sent to ${recipientEmail}`);
                setEmailDialog(null);
            } else {
                toast.error(result.error || 'Failed to send email.');
            }
        } catch (err) {
            logger.error('[MyContracts] Email send failed:', err);
            toast.error('Failed to send contract via email.');
        } finally {
            setSendingId(null);
        }
    };

    const statusColors: Record<ContractStatus, { bg: string; text: string; label: string }> = {
        [ContractStatus.DRAFT]: { bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-400', label: 'Draft' },
        [ContractStatus.REVIEW]: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', label: 'In Review' },
        [ContractStatus.FINAL]: { bg: 'bg-green-500/10 border-green-500/20', text: 'text-green-400', label: 'Final' },
        [ContractStatus.SIGNED]: { bg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-400', label: 'Signed' },
    };

    // ── Loading state ──────────────────────────────────────────────
    if (loading) {
        return (
            <div className="h-64 flex flex-col items-center justify-center">
                <Loader2 size={32} className="text-blue-500 animate-spin mb-4" />
                <p className="text-sm text-gray-400 animate-pulse">Loading contracts…</p>
            </div>
        );
    }

    // ── Empty state ────────────────────────────────────────────────
    if (contracts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                    <FileText size={28} className="text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">No Contracts Yet</h3>
                <p className="text-sm text-gray-400 max-w-sm mb-6">
                    Contracts you draft via the AI chat or templates will appear here.
                    Each one can be downloaded as a PDF or previewed.
                </p>
                {onNewContract && (
                    <button
                        onClick={onNewContract}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                        <FilePlus size={14} />
                        Draft a Contract
                    </button>
                )}
                <div className="mt-8 rounded-xl bg-amber-500/5 border border-amber-500/10 p-4 max-w-sm">
                    <div className="flex items-start gap-2 text-xs text-amber-300/70">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        <span>Tip: Use the chat below to say "Draft a DJ performance agreement for…" and the AI will generate and save a contract here automatically.</span>
                    </div>
                </div>
            </div>
        );
    }

    // ── Contract list ──────────────────────────────────────────────
    return (
        <div className="space-y-3 p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-bold text-white">My Contracts</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">{contracts.length} document{contracts.length !== 1 ? 's' : ''}</p>
                </div>
                {onNewContract && (
                    <button
                        onClick={onNewContract}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-colors"
                    >
                        <FilePlus size={11} />
                        New
                    </button>
                )}
            </div>

            {/* Contract Cards */}
            {contracts.map(contract => {
                const status = statusColors[contract.status] ?? statusColors[ContractStatus.DRAFT];
                const isExpanded = expandedId === contract.id;
                const isDownloading = downloadingId === contract.id;
                const createdDate = contract.createdAt
                    ? (typeof contract.createdAt === 'number'
                        ? new Date(contract.createdAt)
                        : contract.createdAt.toDate())
                    : null;

                return (
                    <div
                        key={contract.id}
                        className="rounded-xl bg-white/2 border border-white/5 hover:border-white/10 transition-all overflow-hidden"
                    >
                        {/* Row: Title + Status + Actions */}
                        <div
                            className="flex items-center gap-3 p-3 cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : contract.id)}
                        >
                            {/* Icon */}
                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                <FileText size={16} className="text-blue-400" />
                            </div>

                            {/* Title + meta */}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white truncate">{contract.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', status.bg, status.text)}>
                                        {status.label}
                                    </span>
                                    {createdDate && (
                                        <span className="flex items-center gap-1 text-[10px] text-gray-600">
                                            <Clock size={9} />
                                            {createdDate.toLocaleDateString()}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-gray-600">{contract.type}</span>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                <button
                                    onClick={() => openSendDialog(contract)}
                                    disabled={sendingId === contract.id}
                                    className="p-1.5 rounded-lg hover:bg-purple-500/10 text-gray-500 hover:text-purple-400 transition-colors"
                                    title="Send via Email"
                                    aria-label={`Send ${contract.title} via email`}
                                    data-testid={`send-contract-${contract.id}`}
                                >
                                    {sendingId === contract.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                </button>
                                <button
                                    onClick={() => handleDownloadPDF(contract)}
                                    disabled={isDownloading}
                                    className="p-1.5 rounded-lg hover:bg-blue-500/10 text-gray-500 hover:text-blue-400 transition-colors"
                                    title="Download PDF"
                                    aria-label={`Download ${contract.title} as PDF`}
                                >
                                    {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                </button>
                                <button
                                    onClick={() => handlePreviewPDF(contract)}
                                    className="p-1.5 rounded-lg hover:bg-green-500/10 text-gray-500 hover:text-green-400 transition-colors"
                                    title="Preview PDF"
                                    aria-label={`Preview ${contract.title}`}
                                >
                                    <Eye size={14} />
                                </button>
                                <button
                                    onClick={() => handleDelete(contract)}
                                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                                    title="Delete"
                                    aria-label={`Delete ${contract.title}`}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            {/* Expand chevron */}
                            <ChevronRight
                                size={14}
                                className={cn(
                                    'text-gray-600 transition-transform shrink-0',
                                    isExpanded && 'rotate-90'
                                )}
                            />
                        </div>

                        {/* Expanded: Contract preview */}
                        {isExpanded && (
                            <div className="border-t border-white/5 p-4 bg-black/20">
                                <div className="prose prose-invert prose-sm max-w-none text-xs text-gray-300 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {contract.content.slice(0, 3000)}
                                    {contract.content.length > 3000 && (
                                        <p className="text-blue-400 font-medium mt-4">
                                            … Content truncated. Download PDF for full document.
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                                    <button
                                        onClick={() => openSendDialog(contract)}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg transition-colors"
                                    >
                                        <Send size={11} />
                                        Send via Email
                                    </button>
                                    <button
                                        onClick={() => handleDownloadPDF(contract)}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-colors"
                                    >
                                        <Download size={11} />
                                        Download PDF
                                    </button>
                                    <button
                                        onClick={() => handlePreviewPDF(contract)}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold rounded-lg transition-colors"
                                    >
                                        <Eye size={11} />
                                        Preview
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* ── Email Send Dialog ──────────────────────────────────── */}
            {emailDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div
                        className="bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 fade-in duration-200"
                        role="dialog"
                        aria-label="Send Contract via Email"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <Send size={14} className="text-purple-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Send Contract</h4>
                                    <p className="text-[10px] text-gray-500 truncate max-w-[250px]">{emailDialog.contract.title}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEmailDialog(null)}
                                className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
                                aria-label="Close dialog"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Recipient Email */}
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Recipient Email *</label>
                            <input
                                ref={emailInputRef}
                                type="email"
                                value={emailDialog.recipientEmail}
                                onChange={e => setEmailDialog(prev => prev ? { ...prev, recipientEmail: e.target.value } : null)}
                                onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
                                placeholder="recipient@example.com"
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                                data-testid="send-contract-email-input"
                            />
                        </div>

                        {/* Optional Message */}
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Message (optional)</label>
                            <textarea
                                value={emailDialog.message}
                                onChange={e => setEmailDialog(prev => prev ? { ...prev, message: e.target.value } : null)}
                                placeholder="Add a personal note..."
                                rows={3}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-none"
                                data-testid="send-contract-message-input"
                            />
                        </div>

                        {/* Info note */}
                        <div className="flex items-start gap-2 text-[10px] text-gray-500 px-1">
                            <AlertTriangle size={10} className="shrink-0 mt-0.5 text-amber-400/50" />
                            <span>The contract will be attached as a PDF. Recipient will receive an email from noreply@indiios.com.</span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setEmailDialog(null)}
                                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendEmail}
                                disabled={!emailDialog.recipientEmail.trim() || sendingId === emailDialog.contract.id}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-bold rounded-xl transition-colors"
                                data-testid="send-contract-submit"
                            >
                                {sendingId === emailDialog.contract.id ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin" />
                                        Sending…
                                    </>
                                ) : (
                                    <>
                                        <Send size={12} />
                                        Send Contract
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
