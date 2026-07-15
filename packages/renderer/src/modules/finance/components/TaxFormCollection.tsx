import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Upload, Mail, Lock, CheckCircle, Clock, AlertCircle, type LucideIcon } from 'lucide-react';

/* ================================================================== */
/*  Item 155 — Automated W-9/W-8BEN Collection                        */
/* ================================================================== */

type TaxFormType = 'W-9' | 'W-8BEN';
type FormStatus = 'needed' | 'submitted' | 'verified';

interface TaxCollaborator {
    id: number;
    name: string;
    country: string;
    formType: TaxFormType;
    status: FormStatus;
    email: string;
}

const INITIAL_COLLABORATORS: TaxCollaborator[] = [];

const STATUS_CONFIG: Record<FormStatus, { label: string; color: string; bg: string; icon: LucideIcon }> = {
    verified: { label: 'Verified', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: CheckCircle },
    submitted: { label: 'Under Review', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: Clock },
    needed: { label: 'Needed', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: AlertCircle },
};

export function TaxFormCollection() {
    const [collaborators, setCollaborators] = useState<TaxCollaborator[]>(INITIAL_COLLABORATORS);
    const [sentNotifs, setSentNotifs] = useState<Set<number>>(new Set());
    const [uploadedFiles, setUploadedFiles] = useState<Record<number, string>>({});
    const [error, setError] = useState<string | null>(null);
    const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

    const verifiedCount = collaborators.filter((c) => c.status === 'verified').length;
    const totalCount = collaborators.length;
    const progressPercent = totalCount === 0 ? 0 : (verifiedCount / totalCount) * 100;

    function handleRequestForm(id: number) {
        setError("Tax form collection requires the backend secure upload service. No request was sent.");
    }

    function handleFileChange(id: number, e: React.ChangeEvent<HTMLInputElement>) {
        setError("Secure upload requires configured Firebase Storage rules and backend processing. No file was uploaded.");
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <AlertCircle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-300/80 leading-relaxed">{error}</p>
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
                    <span className="text-xs font-bold text-amber-400">{verifiedCount}/{totalCount} Collected</span>
                </div>
            </div>

            {/* Progress */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Forms collected</span>
                    <span className="text-xs font-bold text-white">{verifiedCount}/{totalCount}</span>
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
                            Connect payment partners to request and collect W-9 or W-8BEN tax forms.
                        </p>
                        <button
                            disabled
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20 opacity-50 cursor-not-allowed"
                            title="Collaborator management requires backend integration"
                        >
                            Add Collaborators
                        </button>
                    </div>
                ) : (
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
                                const notifSent = sentNotifs.has(collab.id);
                                const uploadedFile = uploadedFiles[collab.id];

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
                                            <div className="flex items-center justify-center gap-1.5">
                                                {/* Request Form button */}
                                                {collab.status === 'needed' && (
                                                    <button
                                                        onClick={() => handleRequestForm(collab.id)}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-bold transition-colors"
                                                    >
                                                        <Mail size={9} />
                                                        <AnimatePresence mode="wait">
                                                            <motion.span
                                                                key={notifSent ? 'sent' : 'request'}
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                exit={{ opacity: 0 }}
                                                            >
                                                                {notifSent ? 'Sent!' : 'Request'}
                                                            </motion.span>
                                                        </AnimatePresence>
                                                    </button>
                                                )}

                                                {/* Upload Form */}
                                                <button
                                                    onClick={() => fileRefs.current[collab.id]?.click()}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] transition-colors"
                                                    title={uploadedFile ?? 'Upload form'}
                                                >
                                                    <Upload size={9} />
                                                    {uploadedFile ? 'Uploaded' : 'Upload'}
                                                </button>
                                                <input
                                                    ref={(el) => { fileRefs.current[collab.id] = el; }}
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    className="hidden"
                                                    onChange={(e) => handleFileChange(collab.id, e)}
                                                />
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
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
                    <span>Verified forms unlock payouts</span>
                </div>
            </div>
        </div>
    );
}
