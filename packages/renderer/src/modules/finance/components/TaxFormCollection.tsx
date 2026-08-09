import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { FileText, Upload, Mail, Lock, CheckCircle, Clock, AlertCircle, Download, Trash2, X, type LucideIcon } from 'lucide-react';
import { TaxFormService, type TaxCollaborator, type TaxFormStatus } from '@/services/finance/TaxFormService';
import { AddTaxCollaboratorDialog } from '@/components/ui/AddTaxCollaboratorDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { normalizeExternalHttpUrl } from '@/utils/safeExternalUrl';

/* ================================================================== */
/*  Item 155 — Automated W-9/W-8BEN Collection (ISSUE-1118)           */
/* ================================================================== */

const STATUS_CONFIG: Record<TaxFormStatus, { label: string; color: string; bg: string; icon: LucideIcon }> = {
    reviewed: { label: 'Reviewed', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: CheckCircle },
    on_file: { label: 'On File', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: FileText },
    requested: { label: 'Requested', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: Clock },
    needed: { label: 'Needed', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: AlertCircle },
};

export function TaxFormCollection() {
    const [collaborators, setCollaborators] = useState<TaxCollaborator[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
    const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

    useEffect(() => {
        const unsubscribe = TaxFormService.subscribeCollaborators(
            setCollaborators,
            (err) => setError(err.message)
        );
        return unsubscribe;
    }, []);

    const withBusy = useCallback(async (id: string, action: () => Promise<void>) => {
        setBusyIds((prev) => new Set(prev).add(id));
        setError(null);
        try {
            await action();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Action failed.');
        } finally {
            setBusyIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }, []);

    async function handleAddCollaborator() {
        const result = await AddTaxCollaboratorDialog.call({});
        if (!result) return;
        try {
            await TaxFormService.addCollaborator(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add collaborator.');
        }
    }

    function handleRequestForm(id: string) {
        void withBusy(id, () => TaxFormService.requestForm(id));
    }

    function handleFileChange(id: string, e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        void withBusy(id, () => TaxFormService.uploadForm(id, file));
    }

    function handleMarkReviewed(id: string) {
        void withBusy(id, () => TaxFormService.markReviewed(id));
    }

    async function handleDownload(storagePath: string) {
        try {
            const url = await TaxFormService.getDownloadUrl(storagePath);
            const safeUrl = normalizeExternalHttpUrl(url);
            if (!safeUrl) throw new Error('The download service returned an invalid URL.');
            window.open(safeUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch download link.');
        }
    }

    async function handleDeleteFile(id: string) {
        const confirmed = await ConfirmDialog.call({
            message: 'Delete this uploaded form? The collaborator will be marked as "Needed" again.',
        });
        if (!confirmed) return;
        void withBusy(id, () => TaxFormService.deleteUploadedFile(id));
    }

    async function handleRemoveCollaborator(id: string) {
        const confirmed = await ConfirmDialog.call({
            message: 'Remove this collaborator and any uploaded tax form? This cannot be undone.',
        });
        if (!confirmed) return;
        void withBusy(id, () => TaxFormService.removeCollaborator(id));
    }

    const reviewedCount = collaborators.filter((c) => c.status === 'reviewed').length;
    const totalCount = collaborators.length;
    const progressPercent = totalCount === 0 ? 0 : (reviewedCount / totalCount) * 100;

    return (
        <div className="space-y-4">
            {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <AlertCircle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-300/80 leading-relaxed flex-1">{error}</p>
                    <button onClick={() => setError(null)} aria-label="Dismiss error" className="text-red-400/60 hover:text-red-400">
                        <X size={12} />
                    </button>
                </div>
            )}
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <FileText size={14} className="text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">Tax Form Collection</h2>
                        <p className="text-[10px] text-gray-500">W-9 (domestic) · W-8BEN (international)</p>
                    </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                    <span className="text-xs font-bold text-amber-400">{reviewedCount}/{totalCount} Reviewed</span>
                </div>
            </div>

            {/* Progress */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Forms reviewed</span>
                    <span className="text-xs font-bold text-white">{reviewedCount}/{totalCount}</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-linear-to-r from-amber-500 to-orange-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.8 }}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/5 overflow-hidden">
                {collaborators.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center">
                        <FileText size={24} className="text-gray-600 mb-3" />
                        <h3 className="text-sm font-bold text-white mb-1">No Collaborators Added</h3>
                        <p className="text-xs text-gray-500 max-w-[250px] mb-4">
                            Add payment partners to request and collect W-9 or W-8BEN tax forms.
                        </p>
                        <button
                            onClick={handleAddCollaborator}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/20 transition-colors"
                        >
                            Add Collaborator
                        </button>
                    </div>
                ) : (
                    <>
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.02]">
                                    <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Collaborator</th>
                                    <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Country</th>
                                    <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Form</th>
                                    <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Status</th>
                                    <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {collaborators.map((collab, i) => {
                                    const cfg = STATUS_CONFIG[collab.status];
                                    const StatusIcon = cfg.icon;
                                    const isBusy = busyIds.has(collab.id);

                                    return (
                                        <motion.tr
                                            key={collab.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: i * 0.04 }}
                                            className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                                        >
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-linear-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-[9px] font-bold text-amber-400">
                                                            {collab.name.split(' ').map((n) => n[0]).join('')}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-white truncate">{collab.name}</p>
                                                        {collab.status === 'needed' && (
                                                            <div className="flex items-center gap-1 mt-0.5">
                                                                <Lock size={9} className="text-red-400" />
                                                                <span className="text-[9px] text-red-400">Payout locked</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-gray-400 hidden sm:table-cell">
                                                {collab.country}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${collab.formType === 'W-9'
                                                        ? 'text-blue-400 bg-blue-500/10'
                                                        : 'text-green-400 bg-green-500/10'
                                                    }`}>
                                                    {collab.formType}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.bg} ${cfg.color}`}>
                                                    <StatusIcon size={9} />
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                    {(collab.status === 'needed' || collab.status === 'requested') && (
                                                        <button
                                                            onClick={() => handleRequestForm(collab.id)}
                                                            disabled={isBusy}
                                                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 text-amber-400 text-[10px] font-bold transition-colors"
                                                        >
                                                            <Mail size={9} />
                                                            {collab.status === 'requested' ? 'Re-request' : 'Request'}
                                                        </button>
                                                    )}

                                                    {(collab.status === 'needed' || collab.status === 'requested') && (
                                                        <>
                                                            <button
                                                                onClick={() => fileRefs.current[collab.id]?.click()}
                                                                disabled={isBusy}
                                                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 text-gray-400 text-[10px] transition-colors"
                                                            >
                                                                <Upload size={9} />
                                                                Upload
                                                            </button>
                                                            <input
                                                                ref={(el) => { fileRefs.current[collab.id] = el; }}
                                                                type="file"
                                                                accept=".pdf,.jpg,.jpeg,.png"
                                                                className="hidden"
                                                                aria-label={`Upload tax form for ${collab.name}`}
                                                                onChange={(e) => handleFileChange(collab.id, e)}
                                                            />
                                                        </>
                                                    )}

                                                    {(collab.status === 'on_file' || collab.status === 'reviewed') && collab.storagePath && (
                                                        <button
                                                            onClick={() => handleDownload(collab.storagePath as string)}
                                                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] transition-colors"
                                                            title={collab.fileName ?? 'Download form'}
                                                        >
                                                            <Download size={9} />
                                                            {collab.fileName ?? 'File'}
                                                        </button>
                                                    )}

                                                    {collab.status === 'on_file' && (
                                                        <button
                                                            onClick={() => handleMarkReviewed(collab.id)}
                                                            disabled={isBusy}
                                                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 hover:bg-green-500/20 disabled:opacity-40 text-green-400 text-[10px] font-bold transition-colors"
                                                        >
                                                            <CheckCircle size={9} />
                                                            Mark Reviewed
                                                        </button>
                                                    )}

                                                    {(collab.status === 'on_file' || collab.status === 'reviewed') && (
                                                        <button
                                                            onClick={() => handleDeleteFile(collab.id)}
                                                            disabled={isBusy}
                                                            aria-label={`Delete uploaded form for ${collab.name}`}
                                                            className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-white/5 hover:bg-red-500/10 disabled:opacity-40 text-gray-500 hover:text-red-400 text-[10px] transition-colors"
                                                        >
                                                            <Trash2 size={9} />
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => handleRemoveCollaborator(collab.id)}
                                                        disabled={isBusy}
                                                        aria-label={`Remove collaborator ${collab.name}`}
                                                        className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-white/5 hover:bg-red-500/10 disabled:opacity-40 text-gray-500 hover:text-red-400 text-[10px] transition-colors"
                                                    >
                                                        <X size={9} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="p-2 border-t border-white/5">
                            <button
                                onClick={handleAddCollaborator}
                                className="w-full px-3 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/5 text-gray-400 text-[10px] font-bold transition-colors"
                            >
                                + Add Collaborator
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-[10px] text-gray-500">
                <div className="flex items-center gap-1.5">
                    <Lock size={10} className="text-red-400" />
                    <span>Payout locked until form received</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <CheckCircle size={10} className="text-green-400" />
                    <span>Reviewed forms unlock payouts</span>
                </div>
            </div>
        </div>
    );
}
