import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Music, FileText, CheckCircle, Clock, AlertCircle, Search, DollarSign, XCircle, type LucideIcon } from 'lucide-react';
import {
    MechanicalRoyaltyService,
    type MechanicalLicense,
    type MechanicalLicenseStatus,
} from '@/services/publishing/MechanicalRoyaltyService';
import { useToast } from '@/core/context/ToastContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/shared/EmptyState';

/**
 * Item 311: Mechanical Royalty Panel
 *
 * Displays mechanical license status for cover tracks in a release,
 * allows searching the HFA/Songfile catalogue, and submitting license requests.
 */

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MechanicalLicenseStatus, {
    label: string;
    icon: LucideIcon;
    color: string;
    bg: string;
}> = {
    pending_search:     { label: 'Pending Search',    icon: Clock,         color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    rights_located:     { label: 'Rights Located',    icon: Search,        color: 'text-blue-400',   bg: 'bg-blue-400/10'   },
    license_requested:  { label: 'Requested',         icon: Clock,         color: 'text-orange-400', bg: 'bg-orange-400/10' },
    license_active:     { label: 'Licensed',          icon: CheckCircle,   color: 'text-green-400',  bg: 'bg-green-400/10'  },
    license_denied:     { label: 'Denied',            icon: XCircle,       color: 'text-red-400',    bg: 'bg-red-400/10'    },
    not_required:       { label: 'Not Required',      icon: CheckCircle,   color: 'text-gray-400',   bg: 'bg-gray-400/10'   },
};

function StatusBadge({ status }: { status: MechanicalLicenseStatus }) {
    const cfg = STATUS_CONFIG[status];
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
            <Icon size={11} />
            {cfg.label}
        </span>
    );
}

// ── AddCoverTrackForm ─────────────────────────────────────────────────────────

interface AddCoverFormProps {
    releaseId: string;
    onAdded: () => void;
    onCancel: () => void;
}

function AddCoverTrackForm({ releaseId, onAdded, onCancel }: AddCoverFormProps) {
    const [trackTitle, setTrackTitle] = useState('');
    const [writer, setWriter] = useState('');
    const [isrc, setIsrc] = useState('');
    const [copies, setCopies] = useState('1000');
    const [searching, setSearching] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const toast = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trackTitle.trim()) return;

        setSearching(true);
        try {
            const composition = await MechanicalRoyaltyService.searchComposition(trackTitle.trim(), writer.trim() || undefined);

            setSearching(false);
            setSubmitting(true);

            await MechanicalRoyaltyService.createLicense({
                releaseId,
                trackTitle: trackTitle.trim(),
                isrc: isrc.trim() || undefined,
                composition: composition ?? {
                    title: trackTitle.trim(),
                    writers: writer ? [writer.trim()] : [],
                    publishers: [],
                    controlled: false,
                },
                distributionCopies: parseInt(copies, 10) || 1000,
            });

            toast.success(`License record created for "${trackTitle}"`);
            onAdded();
        } catch (err: unknown) {
            toast.error('Failed to create license record');
        } finally {
            setSearching(false);
            setSubmitting(false);
        }
    };

    return (
        <motion.form
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4"
        >
            <h4 className="text-sm font-bold text-white">Add Cover Track</h4>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="ml-track-title" className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
                        Track Title *
                    </label>
                    <input
                        id="ml-track-title"
                        type="text"
                        value={trackTitle}
                        onChange={e => setTrackTitle(e.target.value)}
                        placeholder="e.g. Bohemian Rhapsody"
                        required
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                </div>
                <div>
                    <label htmlFor="ml-writer" className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
                        Original Writer
                    </label>
                    <input
                        id="ml-writer"
                        type="text"
                        value={writer}
                        onChange={e => setWriter(e.target.value)}
                        placeholder="e.g. Freddie Mercury"
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="ml-isrc" className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
                        ISRC (optional)
                    </label>
                    <input
                        id="ml-isrc"
                        type="text"
                        value={isrc}
                        onChange={e => setIsrc(e.target.value.toUpperCase())}
                        placeholder="USRC17607839"
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 font-mono"
                    />
                </div>
                <div>
                    <label htmlFor="ml-copies" className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
                        Distribution Copies
                    </label>
                    <input
                        id="ml-copies"
                        type="number"
                        min="1"
                        value={copies}
                        onChange={e => setCopies(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                </div>
            </div>

            <p className="text-xs text-gray-500">
                Statutory mechanical rate: <span className="text-gray-300 font-mono">$0.091 / copy</span> — estimated fee:{' '}
                <span className="text-white font-semibold">
                    ${((parseInt(copies, 10) || 0) * 0.091).toFixed(2)}
                </span>
            </p>

            <div className="flex gap-3 pt-1">
                <button
                    type="submit"
                    disabled={searching || submitting || !trackTitle.trim()}
                    className="px-4 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    {searching ? (
                        <><Search size={14} className="animate-pulse" /> Searching HFA…</>
                    ) : submitting ? (
                        <><Clock size={14} className="animate-spin" /> Creating…</>
                    ) : (
                        <><FileText size={14} /> Create License Record</>
                    )}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 bg-white/5 text-gray-300 text-sm font-medium rounded-lg hover:bg-white/10 border border-white/10 transition-colors"
                >
                    Cancel
                </button>
            </div>
        </motion.form>
    );
}

// ── LicenseRow ────────────────────────────────────────────────────────────────

function LicenseRow({ license, onRequestLicense }: {
    license: MechanicalLicense;
    onRequestLicense: (id: string) => void;
}) {
    const [requesting, setRequesting] = useState(false);

    const canRequest =
        license.status === 'pending_search' ||
        license.status === 'rights_located';

    const handleRequest = async () => {
        setRequesting(true);
        try {
            await onRequestLicense(license.id);
        } finally {
            setRequesting(false);
        }
    };

    return (
        <div className="flex items-center gap-4 py-4 border-b border-white/5 last:border-0">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <Music size={14} className="text-gray-500" />
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{license.trackTitle}</p>
                <p className="text-xs text-gray-500 truncate">
                    {license.composition.writers.join(', ') || 'Unknown writer'}
                    {license.composition.hfaCode && (
                        <span className="ml-2 font-mono">HFA: {license.composition.hfaCode}</span>
                    )}
                </p>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
                {license.status !== 'not_required' && (
                    <span className="text-xs text-gray-400 font-mono">
                        ${license.totalFee.toFixed(2)}
                    </span>
                )}

                <StatusBadge status={license.status} />

                {canRequest && (
                    <button
                        onClick={handleRequest}
                        disabled={requesting}
                        className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white transition-colors disabled:opacity-50"
                    >
                        {requesting ? 'Requesting…' : 'Request License'}
                    </button>
                )}

                {license.licenseNumber && (
                    <span className="text-xs font-mono text-green-400/80">#{license.licenseNumber}</span>
                )}
            </div>
        </div>
    );
}

// ── MechanicalRoyaltyPanel ────────────────────────────────────────────────────

interface Props {
    releaseId?: string;
}

export function MechanicalRoyaltyPanel({ releaseId = 'default' }: Props) {
    const [licenses, setLicenses] = useState<MechanicalLicense[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const toast = useToast();

    const loadLicenses = useCallback(async () => {
        setLoading(true);
        try {
            const data = await MechanicalRoyaltyService.getLicenses(releaseId);
            setLicenses(data);
        } catch {
            toast.error('Failed to load license records');
        } finally {
            setLoading(false);
        }
    }, [releaseId, toast]);

    useEffect(() => {
        loadLicenses();
    }, [loadLicenses]);

    const handleRequestLicense = async (licenseId: string) => {
        try {
            await MechanicalRoyaltyService.requestLicense(licenseId);
            toast.success('License request submitted to HFA/Songfile');
            await loadLicenses();
        } catch {
            toast.error('License request failed — check your connection');
        }
    };

    const totalFee = MechanicalRoyaltyService.computeTotalFee(licenses);
    const pendingCount = licenses.filter(l =>
        l.status !== 'license_active' && l.status !== 'not_required'
    ).length;
    const activeCount = licenses.filter(l => l.status === 'license_active' || l.status === 'not_required').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <FileText size={20} className="text-purple-400" />
                        Mechanical Licenses
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                        Required for cover songs distributed to DSPs. US statutory rate: $0.091/copy.
                    </p>
                </div>
                <button
                    onClick={() => setShowAddForm(v => !v)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-gray-300 rounded-xl transition-colors"
                >
                    + Add Cover Track
                </button>
            </div>

            {/* Summary cards */}
            {licenses.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Tracks</p>
                        <p className="text-2xl font-bold text-white">{licenses.length}</p>
                    </div>
                    <div className={`bg-black/30 border rounded-2xl p-4 ${pendingCount > 0 ? 'border-yellow-500/30' : 'border-white/10'}`}>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pending Licenses</p>
                        <p className={`text-2xl font-bold ${pendingCount > 0 ? 'text-yellow-400' : 'text-white'}`}>
                            {pendingCount}
                        </p>
                    </div>
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Est. Total Fee</p>
                        <p className="text-2xl font-bold text-white flex items-center gap-1">
                            <DollarSign size={16} className="text-gray-400" />
                            {totalFee.toFixed(2)}
                        </p>
                    </div>
                </div>
            )}

            {/* Clearance gate warning */}
            {pendingCount > 0 && (
                <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                    <AlertCircle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-yellow-200">
                        {pendingCount} cover track{pendingCount > 1 ? 's' : ''} need{pendingCount === 1 ? 's' : ''} a mechanical license before distribution.
                        Request each license below, or ensure you hold a statutory license through your distributor.
                    </p>
                </div>
            )}

            {activeCount === licenses.length && licenses.length > 0 && (
                <div className="flex items-center gap-2 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                    <CheckCircle size={16} className="text-green-400" />
                    <p className="text-sm text-green-300">All cover tracks are licensed — release cleared for distribution.</p>
                </div>
            )}

            {/* Add form */}
            <AnimatePresence>
                {showAddForm && (
                    <AddCoverTrackForm
                        releaseId={releaseId}
                        onAdded={() => { setShowAddForm(false); loadLicenses(); }}
                        onCancel={() => setShowAddForm(false)}
                    />
                )}
            </AnimatePresence>

            {/* License list */}
            <div className="bg-black/20 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">License Registry</h3>
                    <span className="text-xs text-gray-500">Powered by HFA / Songfile</span>
                </div>

                {loading ? (
                    <div className="p-6 space-y-3">
                        {[0, 1, 2].map(i => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                ) : licenses.length === 0 ? (
                    <EmptyState
                        icon="music"
                        title="No cover tracks added"
                        description="If this release contains original compositions only, no mechanical licenses are required. Add any cover songs here to manage their licenses."
                        action={{ label: 'Add Cover Track', onClick: () => setShowAddForm(true) }}
                        compact
                    />
                ) : (
                    <div className="px-6">
                        {licenses.map(license => (
                            <LicenseRow
                                key={license.id}
                                license={license}
                                onRequestLicense={handleRequestLicense}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
