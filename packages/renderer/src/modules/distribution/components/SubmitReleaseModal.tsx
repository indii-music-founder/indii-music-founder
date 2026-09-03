import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle2, Loader2, XCircle, ChevronRight, AlertCircle } from 'lucide-react';
import { distributionService } from '@/services/distribution/DistributionService';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import type { IngestionMetadata } from '@/types/distribution';
import { trackLibrary } from '@/services/metadata/TrackLibraryService';
import { canonicalCoverArtService } from '@/services/distribution/CanonicalCoverArtService';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { BrandAsset } from '@/types/User';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/services/firebase';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface PipelineStep {
    id: string;
    label: string;
    status: 'idle' | 'running' | 'done' | 'error';
    detail?: string;
}

const INITIAL_STEPS: PipelineStep[] = [
    { id: 'qc', label: 'QC Validation', status: 'idle' },
    { id: 'isrc', label: 'ISRC Assignment', status: 'idle' },
    { id: 'ddex', label: 'DDEX XML Build', status: 'idle' },
    { id: 'sftp', label: 'DSP Delivery', status: 'idle' },
];

interface Props {
    open: boolean;
    onClose: () => void;
    onSubmitted?: () => void;
}

export const SubmitReleaseModal: React.FC<Props> = ({ open, onClose, onSubmitted }) => {
    const dialogRef = useModalAccessibility(open, onClose);
    const { success: toastSuccess, error: toastError } = useToast();
    const { userProfile, generatedHistory } = useStore(useShallow(state => ({
        userProfile: state.userProfile,
        generatedHistory: state.generatedHistory,
    })));

    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [label, setLabel] = useState('Indii Records');
    const [releaseDate, setRelDate] = useState('');
    const [trackTitle, setTrkTitle] = useState('');
    const [isrc, setIsrc] = useState('');
    const [genre, setGenre] = useState('Electronic');

    // ISSUE-969: audio and cover art must reference a real, already-processed
    // asset (an immutable canonical master / an uploaded brand asset) rather than
    // freeform, unverifiable text fields the QC step never checked existed.
    const [availableTracks, setAvailableTracks] = useState<ExtendedGoldenMetadata[]>([]);
    const [loadingTracks, setLoadingTracks] = useState(false);
    const [selectedMasterFingerprint, setSelectedMasterFingerprint] = useState('');
    const [selectedCoverUrl, setSelectedCoverUrl] = useState('');
    const [coverRepairMessage, setCoverRepairMessage] = useState<string | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [founderIsrcVerified] = useState(() => {
        const ownerId = userProfile?.uid || userProfile?.id;
        if (!ownerId) return false;
        try {
            const raw = localStorage.getItem(`indii_founder_readiness_prerequisites_v1_${ownerId}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                return !!parsed.isrc_prefix?.verified;
            }
        } catch {
            // Ignore
        }
        return false;
    });
    const [founderIsrcPrefix] = useState(() => {
        const ownerId = userProfile?.uid || userProfile?.id;
        if (!ownerId) return '';
        try {
            const raw = localStorage.getItem(`indii_founder_readiness_prerequisites_v1_${ownerId}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                return parsed.isrc_prefix?.value || '';
            }
        } catch {
            // Ignore
        }
        return '';
    });

    const coverAssets: BrandAsset[] = [
        ...(userProfile?.brandKit?.brandAssets || []),
        ...(userProfile?.brandKit?.referenceImages || []),
        ...(generatedHistory || [])
            .filter(item => (
                item.type === 'image' &&
                item.origin === 'generated' &&
                item.distributorCompliance?.valid === true &&
                item.generationProvenance !== undefined
            ))
            .map(item => ({
                id: item.id,
                url: item.url,
                description: `Generated cover — ${item.generationProvenance!.model}`,
                generationProvenance: item.generationProvenance,
            })),
    ].filter((asset, index, assets) => assets.findIndex(candidate => candidate.url === asset.url) === index);

    useEffect(() => {
        if (open && userProfile) {
            const release = userProfile.brandKit?.releaseDetails;
            setTitle(prev => prev || release?.title || '');
            setArtist(prev => prev || userProfile.displayName || release?.artists || '');
            setTrkTitle(prev => prev || release?.title || '');
            setGenre(prev => prev || release?.genre || 'Electronic');
        }
    }, [open, userProfile]);

    useEffect(() => {
        if (!open) return;
        setLoadingTracks(true);
        trackLibrary.list()
            .then(tracks => setAvailableTracks(tracks.filter(track => (
                !!track.masterFingerprint && !!track.masterAsset?.audioProperties
            ))))
            .catch(() => toastError('Failed to load your track library.'))
            .finally(() => setLoadingTracks(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- toastError is a stable useCallback from ToastContext
    }, [open]);
    const [done, setDone] = useState(false);
    const [deliveryState, setDeliveryState] = useState<'idle' | 'delivered' | 'ready_for_manual' | 'skipped'>('idle');
    const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
    const [overallProgress, setOverallProgress] = useState(0);

    // ISSUE-969: metadata alone can no longer pass — a real hashed master
    // and a real staged cover asset are required before submission.
    const formValid = title.trim() && artist.trim() && trackTitle.trim() && selectedMasterFingerprint && selectedCoverUrl;

    const updateStep = (id: string, patch: Partial<PipelineStep>) => {
        setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    };

    const reset = () => {
        setSteps(INITIAL_STEPS);
        setOverallProgress(0);
        setDone(false);
        setDeliveryState('idle');
        setSubmitting(false);
        setSelectedMasterFingerprint('');
        setSelectedCoverUrl('');
        setCoverRepairMessage(null);
    };

    const handleClose = () => {
        if (submitting) return;
        if (done) {
            onSubmitted?.();
        } else {
            onClose();
        }
        reset();
    };

    const handleSubmit = async () => {
        if (!formValid || submitting) return;

        const selectedTrack = availableTracks.find(track => (
            track.masterFingerprint === selectedMasterFingerprint
        ));
        const masterAsset = selectedTrack?.masterAsset;
        const audioProperties = masterAsset?.audioProperties;
        if (!selectedTrack || !masterAsset || !audioProperties) {
            toastError('Select a delivery-ready canonical master with measured audio properties.');
            return;
        }

        const ownerId = userProfile?.uid || userProfile?.id;
        if (!ownerId) {
            toastError('An authenticated owner is required before submitting a release.');
            return;
        }
        const selectedCover = coverAssets.find(asset => asset.url === selectedCoverUrl);

        setSubmitting(true);
        setDone(false);
        setCoverRepairMessage(null);
        setSteps(INITIAL_STEPS);
        setOverallProgress(0);

        try {
            const coverAsset = await canonicalCoverArtService.persistFromUrl(selectedCoverUrl, {
                userId: ownerId,
                originalFileName: selectedCover?.description,
                generationProvenance: selectedCover?.generationProvenance,
            });
            const releaseData: IngestionMetadata = {
                releaseId: `release-${crypto.randomUUID()}`,
                title: title.trim(),
                artist: artist.trim(),
                artists: [artist.trim()],
                label: label.trim() || 'Indii Records',
                genre: genre,
                release_date: releaseDate || undefined,
                artwork_url: coverAsset.download_url,
                cover_asset: coverAsset,
                tracks: [{
                    title: trackTitle.trim(),
                    isrc: isrc.trim() || undefined,
                    artist: artist.trim(),
                    artists: [artist.trim()],
                    filename: masterAsset.originalFileName,
                    duration: selectedTrack.durationSeconds,
                    bit_depth: audioProperties.bitDepth,
                    channels: audioProperties.channels,
                    codec: audioProperties.codec,
                    sample_rate: audioProperties.sampleRate,
                    master_asset: {
                        content_hash: masterAsset.contentHash,
                        download_url: masterAsset.downloadUrl,
                        master_fingerprint: masterAsset.masterFingerprint,
                        mime_type: masterAsset.mimeType,
                        original_file_name: masterAsset.originalFileName,
                        size_bytes: masterAsset.sizeBytes,
                        storage_path: masterAsset.storagePath,
                    },
                }],
            };
            // The desktop pipeline has its own local package builder, but it
            // must first establish the same durable release/audit evidence as
            // the browser publishing wizard. Only canonical references—not
            // credentials or mutable download URLs—are persisted here.
            const releaseRef = doc(db, 'proprietaryIngestionReleases', releaseData.releaseId);
            await setDoc(releaseRef, {
                userId: ownerId,
                title: releaseData.title,
                status: 'cover_art_audit_pending',
                coverArtStoragePath: coverAsset.storage_path,
                coverArtContentHash: coverAsset.content_hash,
                coverArtGenerationProvenance: coverAsset.generation_provenance,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            const audit = httpsCallable<{ releaseId: string }, { status: 'compliant' | 'non_compliant' | 'unknown' }>(functions, 'auditReleaseArtworkForDelivery');
            const audited = await audit({ releaseId: releaseData.releaseId });
            if (audited.data.status !== 'compliant') {
                await setDoc(releaseRef, {
                    status: 'cover_art_audit_failed',
                    updatedAt: serverTimestamp(),
                }, { merge: true });
                throw new Error(`Cover art needs repair: server conformance status is ${audited.data.status}. Replace or re-export the artwork before delivery.`);
            }
            const result = await distributionService.submitRelease(releaseData, (evt) => {
                if (evt.progress !== undefined) {
                    setOverallProgress(evt.progress);
                }
                if (evt.step && evt.status) {
                    if (evt.status === 'running') {
                        updateStep(evt.step, { status: 'running', detail: evt.detail });
                    } else if (evt.status === 'done') {
                        updateStep(evt.step, { status: 'done', detail: evt.detail });
                    } else if (evt.status === 'error') {
                        updateStep(evt.step, { status: 'error', detail: evt.detail });
                    }
                }
            });

            setDone(true);
            setOverallProgress(100);

            // Determine delivery state from result
            if (result?.sftp_skipped) {
                setDeliveryState('ready_for_manual');
                toastSuccess('Metadata package ready — manual delivery required');
            } else {
                setDeliveryState('delivered');
                toastSuccess('Release delivered to distributor!');
            }
            // Wait for user to click Done button, which triggers onSubmitted via handleClose
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Submission failed';
            toastError(msg);
            setCoverRepairMessage(msg);
            // Mark any running step as error
            setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error', detail: msg } : s));
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="submit-release-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" data-testid="metadata-modal">
            <div className="relative w-full max-w-xl mx-4 bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div>
                        <h2 id="submit-release-title" className="text-lg font-black text-white uppercase tracking-tighter italic">Submit Release</h2>
                        <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase mt-0.5">
                            QC → ISRC → DDEX → DSP Delivery
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        aria-label="Close release submission"
                        disabled={submitting}
                        className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Form */}
                    {!submitting && !done && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Release Title *</label>
                                    <input
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        data-testid="release-title-input"
                                        placeholder="Album or single title"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-distribution/50 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Primary Artist *</label>
                                    <input
                                        value={artist}
                                        onChange={e => setArtist(e.target.value)}
                                        data-testid="release-artist-input"
                                        placeholder="Artist name"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-distribution/50 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Track Title *</label>
                                    <input
                                        value={trackTitle}
                                        onChange={e => setTrkTitle(e.target.value)}
                                        data-testid="release-track-title-input"
                                        placeholder="Track name"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-distribution/50 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                        ISRC <span className="text-gray-600 normal-case font-medium">(auto-assigned if blank)</span>
                                    </label>
                                    <input
                                        value={isrc}
                                        onChange={e => setIsrc(e.target.value)}
                                        placeholder="US-XXX-25-XXXXX"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-dept-distribution/50 transition-colors"
                                    />
                                    {founderIsrcVerified ? (
                                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 mt-1" data-testid="isrc-verified-badge">
                                            <CheckCircle2 size={12} />
                                            Verified US ISRC Registrant: {founderIsrcPrefix || 'Active'}
                                        </div>
                                    ) : (
                                        <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-200/90 flex items-start gap-2" data-testid="isrc-prerequisite-notice">
                                            <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-bold text-amber-300">Commercial Authority Notice:</span>
                                                {' '}No verified US ISRC Agency prefix found. Deliveries without an official registrant prefix will use a provisional draft code.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                    Master Track *
                                    <span className="text-gray-600 normal-case font-medium"> (from your upload-once catalog)</span>
                                </label>
                                <select
                                    value={selectedMasterFingerprint}
                                    onChange={e => setSelectedMasterFingerprint(e.target.value)}
                                    data-testid="release-track-select"
                                    disabled={loadingTracks}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dept-distribution/50 transition-colors appearance-none disabled:opacity-40"
                                >
                                    <option value="">
                                        {loadingTracks ? 'Loading canonical masters…' : availableTracks.length === 0 ? 'No canonical masters found — ingest one first' : 'Select an upload-once master track'}
                                    </option>
                                    {availableTracks.map(track => (
                                        <option key={track.id ?? track.masterFingerprint} value={track.masterFingerprint}>
                                            {track.trackTitle} ({Math.round(track.durationSeconds || 0)}s)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Label</label>
                                    <input
                                        data-testid="release-label-input"
                                        value={label}
                                        onChange={e => setLabel(e.target.value)}
                                        placeholder="Label name"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-distribution/50 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Release Date</label>
                                    <input
                                        data-testid="release-date-input"
                                        type="date"
                                        value={releaseDate}
                                        onChange={e => setRelDate(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-distribution/50 transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Primary Genre *</label>
                                <select
                                    value={genre}
                                    onChange={e => setGenre(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dept-distribution/50 transition-colors appearance-none"
                                >
                                    <option value="Electronic">Electronic</option>
                                    <option value="Hip-Hop">Hip-Hop</option>
                                    <option value="Pop">Pop</option>
                                    <option value="Rock">Rock</option>
                                    <option value="Jazz">Jazz</option>
                                    <option value="Classical">Classical</option>
                                    <option value="Ambient">Ambient</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                    Cover Art *
                                    <span className="text-gray-600 normal-case font-medium"> (from your uploaded brand assets)</span>
                                </label>
                                <select
                                    value={selectedCoverUrl}
                                    onChange={e => setSelectedCoverUrl(e.target.value)}
                                    data-testid="release-artwork-select"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dept-distribution/50 transition-colors appearance-none"
                                >
                                    <option value="">
                                        {coverAssets.length === 0 ? 'No brand assets found — upload one first' : 'Select a staged cover asset'}
                                    </option>
                                    {coverAssets.map((asset, idx) => (
                                        <option key={`${asset.url}-${idx}`} value={asset.url}>
                                            {asset.description || `Asset ${idx + 1}`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {coverRepairMessage && (
                                <div data-testid="cover-art-repair" className="rounded-lg border border-dept-marketing/30 bg-dept-marketing/10 p-3">
                                    <p className="text-xs font-bold text-dept-marketing">Cover art needs repair before delivery.</p>
                                    <p className="mt-1 text-[11px] text-gray-300">Your release draft is preserved. Choose a replacement from your brand assets, then submit again.</p>
                                    <button
                                        type="button"
                                        data-testid="choose-replacement-cover"
                                        onClick={() => {
                                            setSelectedCoverUrl('');
                                            setCoverRepairMessage(null);
                                        }}
                                        className="mt-2 text-[10px] font-black uppercase tracking-widest text-white underline underline-offset-4"
                                    >
                                        Choose replacement cover
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pipeline Progress */}
                    {(submitting || done) && (
                        <div className="space-y-3">
                            {steps.map((step, i) => (
                                <div key={step.id} className="flex items-start gap-3">
                                    {/* Step icon */}
                                    <div className="mt-0.5 w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                        {step.status === 'idle' && (
                                            <div className="w-3 h-3 rounded-full border border-white/20 bg-white/5" />
                                        )}
                                        {step.status === 'running' && (
                                            <Loader2 className="w-4 h-4 text-dept-distribution animate-spin" />
                                        )}
                                        {step.status === 'done' && (
                                            <CheckCircle2 className="w-4 h-4 text-dept-publishing" />
                                        )}
                                        {step.status === 'error' && (
                                            <XCircle className="w-4 h-4 text-dept-marketing" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold uppercase tracking-widest ${step.status === 'idle' ? 'text-gray-600' :
                                                step.status === 'running' ? 'text-white' :
                                                    step.status === 'done' ? 'text-dept-publishing' :
                                                        'text-dept-marketing'
                                                }`}>
                                                {step.label}
                                            </span>
                                            {i < steps.length - 1 && step.status === 'idle' && (
                                                <ChevronRight className="w-3 h-3 text-gray-700" />
                                            )}
                                        </div>
                                        {step.detail && (
                                            <p className={`text-[10px] mt-0.5 font-medium truncate ${step.status === 'error' ? 'text-dept-marketing/70' : 'text-gray-500'
                                                }`}>
                                                {step.detail}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Progress bar */}
                            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-4">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-dept-publishing' : 'bg-dept-distribution'}`}
                                    style={{ width: `${overallProgress}%` }}
                                />
                            </div>

                            {done && (
                                <div className="flex items-center gap-2 p-3 bg-dept-publishing/10 border border-dept-publishing/20 rounded-lg">
                                    <CheckCircle2 className="w-4 h-4 text-dept-publishing flex-shrink-0" />
                                    <span className="text-xs font-bold text-dept-publishing uppercase tracking-widest">
                                        {deliveryState === 'ready_for_manual'
                                            ? 'Metadata ready — manual delivery required'
                                            : 'Release delivered to distributor'}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                    {!submitting && !done && (
                        <p className="text-[10px] text-gray-600 font-medium">
                            SFTP config is set in the Transfer tab
                        </p>
                    )}
                    {(submitting || done) && (
                        <p className="text-[10px] text-gray-600 font-medium tabular-nums">
                            {overallProgress.toFixed(0)}% complete
                        </p>
                    )}

                    <div className="flex items-center gap-3 ml-auto">
                        {done ? (
                            <button
                                onClick={handleClose}
                                data-testid="release-done-button"
                                className="px-5 py-2 bg-dept-publishing text-white font-black text-xs uppercase tracking-widest rounded-lg hover:bg-dept-publishing/80 transition-colors"
                            >
                                Done
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleClose}
                                    disabled={submitting}
                                    className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white uppercase tracking-widest transition-colors disabled:opacity-30"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!formValid || submitting}
                                    data-testid="release-submit-button"
                                    className="px-5 py-2 bg-white text-black font-black text-xs uppercase tracking-widest rounded-lg hover:bg-gray-200 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5" />
                                    )}
                                    {submitting ? 'Submitting…' : 'Submit Release'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
