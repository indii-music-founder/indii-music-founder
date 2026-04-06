import React, { useState } from 'react';
import { X, Send, CheckCircle2, Loader2, XCircle, ChevronRight } from 'lucide-react';
import { distributionService } from '@/services/distribution/DistributionService';
import { useToast } from '@/core/context/ToastContext';
import type { DDEXMetadata } from '@/types/distribution';

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
    const { success: toastSuccess, error: toastError } = useToast();

    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [label, setLabel] = useState('Indii Records');
    const [releaseDate, setRelDate] = useState('');
    const [artworkUrl, setArtwork] = useState('');
    const [trackTitle, setTrkTitle] = useState('');
    const [isrc, setIsrc] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
    const [overallProgress, setOverallProgress] = useState(0);

    const formValid = title.trim() && artist.trim() && trackTitle.trim();

    const updateStep = (id: string, patch: Partial<PipelineStep>) => {
        setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    };

    const reset = () => {
        setSteps(INITIAL_STEPS);
        setOverallProgress(0);
        setDone(false);
        setSubmitting(false);
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

        setSubmitting(true);
        setDone(false);
        setSteps(INITIAL_STEPS);
        setOverallProgress(0);

        const releaseData: DDEXMetadata = {
            releaseId: `release-${Date.now()}`,
            title: title.trim(),
            artist: artist.trim(),
            artists: [artist.trim()],
            label: label.trim() || 'Indii Records',
            release_date: releaseDate || undefined,
            releaseDate: releaseDate || undefined,
            artwork_url: artworkUrl || undefined,
            artworkUrl: artworkUrl || undefined,
            cover_filename: 'cover.jpg', // Default for now
            tracks: [{
                title: trackTitle.trim(),
                isrc: isrc.trim() || undefined,
                artist: artist.trim(),
            }],
        };

        try {
            await distributionService.submitRelease(releaseData, (evt) => {
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
            toastSuccess('Release submitted successfully!');
            // Wait for user to click Done button, which triggers onSubmitted via handleClose
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Submission failed';
            toastError(msg);
            // Mark any running step as error
            setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error', detail: msg } : s));
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" data-testid="metadata-modal">
            <div className="relative w-full max-w-xl mx-4 bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-black text-white uppercase tracking-tighter italic">Submit Release</h2>
                        <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase mt-0.5">
                            QC → ISRC → DDEX → DSP Delivery
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
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
                                </div>
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
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Artwork URL</label>
                                <input
                                    data-testid="release-artwork-input"
                                    value={artworkUrl}
                                    onChange={e => setArtwork(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-distribution/50 transition-colors"
                                />
                            </div>
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
                                        Release delivered to distributor
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
