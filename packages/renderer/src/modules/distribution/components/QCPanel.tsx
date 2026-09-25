import React, { useState, useRef } from 'react';
import {
    Loader2, AlertTriangle, CheckCircle, XCircle, FileText, Youtube,
    Activity, Upload, Database, Save, Music, Clock, BarChart2, ShieldCheck,
    BrainCircuit, Globe, Target, Waves, CheckCircle2, Video, ImageIcon, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { distributionService } from '@/services/distribution/DistributionService';
import { audioAnalysisService, type LocalOnlyAudioAnalysisReport } from '@/services/audio/AudioAnalysisService';
import { AudioWaveformViewer } from '@/components/shared/AudioWaveformViewer';
import { TagMatrix } from '@/modules/tools/components/TagMatrix';
// ISSUE-1440: shared disclosure primitive for metadata-tab secondaries.
import SectionCard from '@/components/ui/SectionCard';
import type { AudioIntelligenceProfile } from '@/services/audio/types';
import type { ValidationReport } from '@/types/distribution';
import { logger } from '@/utils/logger';
import { cn } from '@/lib/utils';

const DEFAULT_TAGS = {
    'Mood': ['Energetic', 'Dark', 'Chill', 'Happy', 'Melancholic', 'Aggressive', 'Ethereal'],
    'Genre': ['Techno', 'House', 'Ambient', 'Hip Hop', 'Rock', 'Jazz', 'Experimental'],
    'Instruments': ['Synth', 'Drums', 'Bass', 'Guitar', 'Piano', 'Vocals', 'Orchestra'],
    'Vibe': ['Virality', 'Cinematic', 'Club', 'Radio', 'Underground', 'Raw', 'Polished']
};

export const QCPanel: React.FC = () => {
    const toast = useToast();
    const setModule = useStore(state => state.setModule);
    const setPendingPrompt = useStore(state => state.setPendingPrompt);

    // Active sub-tab state
    const [activeSubTab, setActiveSubTab] = useState<'acoustic' | 'metadata'>('acoustic');

    // ── Acoustic & DSP Analysis State ──────────────────────────────
    const [file, setFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    const [profile, setProfile] = useState<AudioIntelligenceProfile | null>(null);
    const [localReport, setLocalReport] = useState<LocalOnlyAudioAnalysisReport | null>(null);
    const [analysisMode, setAnalysisMode] = useState<'connected' | 'local-only'>('connected');
    const abortControllerRef = useRef<AbortController | null>(null);
    const technicalFeatures = profile?.technical ?? localReport?.features;

    // Lossless Master Formats
    const LOSSLESS_MIME_TYPES = new Set([
        'audio/wav', 'audio/x-wav', 'audio/wave',
        'audio/flac', 'audio/x-flac',
    ]);
    const LOSSLESS_EXTENSIONS = new Set(['.wav', '.flac']);
    const LOSSLESS_ACCEPT = '.wav,.flac';

    const isLosslessFormat = (f: File): boolean => {
        if (f.type && LOSSLESS_MIME_TYPES.has(f.type.toLowerCase())) return true;
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        return LOSSLESS_EXTENSIONS.has(ext);
    };

    const isVerifiedDesktopLosslessCodec = (codec?: string): boolean => {
        const normalized = codec?.toLowerCase() || '';
        return normalized === 'flac' || normalized.startsWith('pcm_');
    };

    const handleLoadClick = async (e: React.MouseEvent<HTMLLabelElement>) => {
        if (window.electronAPI && analysisMode === 'connected') {
            e.preventDefault();
            if (isAnalyzing) return;

            try {
                const filePath = await window.electronAPI.selectFile({
                    title: 'Select Lossless Master Track',
                    filters: [{ name: 'Canonical Master Audio', extensions: ['wav', 'flac'] }]
                });

                if (filePath) {
                    const pathStr = filePath as string;
                    const ext = '.' + pathStr.split('.').pop()?.toLowerCase();
                    if (!LOSSLESS_EXTENSIONS.has(ext)) {
                        toast.error(
                            `${ext.toUpperCase()} files are not accepted. This canonical-master workflow currently accepts measured WAV or FLAC only.`
                        );
                        return;
                    }

                    const probe = await window.electronAPI.audio.analyze(pathStr);
                    const audioStream = probe.streams?.find(stream => stream.codec_type === 'audio');
                    if (probe.status !== 'success' || !isVerifiedDesktopLosslessCodec(audioStream?.codec_name)) {
                        const codec = audioStream?.codec_name?.toUpperCase() || 'unknown';
                        toast.error(
                            `Desktop codec check rejected this master (${codec}). This canonical-master workflow accepts PCM WAV or FLAC only.`
                        );
                        return;
                    }

                    const filename = pathStr.split(/[/\\]/).pop() || 'audio';
                    const mockFile = {
                        name: filename,
                        path: pathStr,
                        type: 'audio/wav'
                    } as unknown as File;

                    setFile(mockFile);

                    if (audioUrl) {
                        URL.revokeObjectURL(audioUrl);
                    }
                    setAudioUrl(`safe-file://${filePath}`);
                    setTags([]);
                    setProfile(null);
                    setLocalReport(null);

                    await runAnalysis(mockFile);
                }
            } catch (err) {
                logger.error("File selection failed", err);
                toast.error("File selection failed.");
            }
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        if (!isLosslessFormat(uploadedFile)) {
            const ext = uploadedFile.name.split('.').pop()?.toUpperCase() || 'unknown';
            toast.error(
                `${ext} files are not accepted. This canonical-master workflow accepts measured WAV or FLAC only. Please re-export your track as WAV or FLAC.`
            );
            e.target.value = '';
            return;
        }

        setFile(uploadedFile);
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        setAudioUrl(URL.createObjectURL(uploadedFile));
        setTags([]);
        setProfile(null);
        setLocalReport(null);
        await runAnalysis(uploadedFile);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isAnalyzing) {
            setIsDragOver(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (isAnalyzing) return;

        const droppedFile = e.dataTransfer?.files?.[0];
        if (!droppedFile) return;

        if (!isLosslessFormat(droppedFile)) {
            const ext = droppedFile.name.split('.').pop()?.toUpperCase() || 'unknown';
            toast.error(
                `${ext} files are not accepted. This canonical-master workflow accepts measured WAV or FLAC only. Please re-export your track as WAV or FLAC.`
            );
            return;
        }

        setFile(droppedFile);
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        setAudioUrl(URL.createObjectURL(droppedFile));
        setTags([]);
        setProfile(null);
        setLocalReport(null);
        await runAnalysis(droppedFile);
    };

    const runAnalysis = async (audioFile: File | string) => {
        setIsAnalyzing(true);
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        const extractToastId = toast.loading(analysisMode === 'local-only'
            ? 'Running local-only technical scan…'
            : 'Estimating technical & semantic audio profile…');

        try {
            if (analysisMode === 'local-only') {
                if (typeof audioFile === 'string') {
                    throw new Error('Local-only analysis requires an in-memory audio file. Select the file with the file picker.');
                }
                const report = await audioAnalysisService.analyzeLocalOnly(audioFile);
                if (signal.aborted) throw new DOMException('Analysis cancelled', 'AbortError');
                setLocalReport(report);
                setProfile(null);
                setTags([]);
                toast.dismiss(extractToastId);
                toast.success('Local-only technical scan complete. No upload, AI, or saved profile was used.');
                return;
            }

            const { audioIntelligence } = await import('@/services/audio/AudioIntelligenceService');

            let resultProfile: AudioIntelligenceProfile;
            if (window.electronAPI) {
                resultProfile = await audioIntelligence.analyze(audioFile, signal);
            } else {
                if (typeof audioFile === 'string') {
                    throw new Error('Browser audio analysis requires a File, not a path.');
                }
                const { auth } = await import('@/services/firebase');
                const userId = auth.currentUser?.uid;
                if (!userId) {
                    throw new Error('You must be signed in to analyze a master in the browser.');
                }
                const [{ fingerprintService }, { masterAudioService }] = await Promise.all([
                    import('@/services/audio/FingerprintService'),
                    import('@/services/audio/MasterAudioService'),
                ]);
                const masterFingerprint = await fingerprintService.generateFingerprint(audioFile);
                toast.updateProgress(extractToastId, 20, 'Uploading canonical master…');
                const masterAsset = await masterAudioService.persist(audioFile, { userId, masterFingerprint, signal });
                toast.updateProgress(
                    extractToastId,
                    50,
                    'Waiting for the server analysis receipt — this can take a few minutes…',
                );
                resultProfile = await audioIntelligence.analyzeCanonicalMaster(masterAsset, userId, signal);
            }

            const newTags: Set<string> = new Set();
            resultProfile.semantic.mood?.forEach(m => newTags.add(m));
            resultProfile.semantic.genre?.forEach(g => newTags.add(g));
            resultProfile.semantic.instruments?.forEach(i => newTags.add(i));
            resultProfile.semantic.marketingHooks?.keywords?.forEach(k => newTags.add(k));

            setTags(Array.from(newTags));
            setProfile(resultProfile);
            setLocalReport(null);

            toast.dismiss(extractToastId);
            toast.success("Extraction Complete: Deep acoustic profile generated.");

        } catch (error: unknown) {
            logger.error("Deep Extraction Failed", error);
            toast.dismiss(extractToastId);
            if (error instanceof DOMException && error.name === 'AbortError') {
                toast.error("Analysis cancelled by user.");
                setFile(null);
                setAudioUrl(null);
                return;
            }
            toast.error(error instanceof Error
                ? error.message
                : "Deep Extraction failed. Autonomous service limits or connectivity issues detected.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSaveAnalysis = async () => {
        if (!file || !profile || isAnalyzing) return;
        setIsSaving(true);
        const toastId = toast.loading("Pushing distribution metadata to Knowledge Graph...");

        try {
            await audioAnalysisService.saveAnalysisToFirestore(profile.technical, file.name, { ...profile.semantic });
            toast.dismiss(toastId);
            toast.success("Estimated technical profile saved.");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.error("Save failed", error);
            toast.dismiss(toastId);
            toast.error(`Failed to save analysis: ${message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // ── Metadata & Rights Validation State ─────────────────────────
    const [metadata, setMetadata] = useState({
        title: '',
        artist: '',
        artwork_url: '',
        version: '',
        isrc: '',
        upc: ''
    });
    const [rights, setRights] = useState({
        exclusiveRights: false,
        label: '',
        matchPolicy: '' as '' | 'monetize' | 'track' | 'block',
        territories: ''
    });
    const [loading, setLoading] = useState<'qc' | 'cid' | null>(null);
    const [qcResult, setQcResult] = useState<ValidationReport | null>(null);
    const [csvOutput, setCsvOutput] = useState<string | null>(null);
    // ISSUE-1440: only Title/Artist are required for Run QC — everything else is a
    // secondary disclosure. The rights attestation auto-opens when CID generation
    // fails validation so the failing fields are exactly where the user is looking.
    const [optionalFieldsOpen, setOptionalFieldsOpen] = useState(false);
    const [rightsOpen, setRightsOpen] = useState(false);

    const handleValidate = async () => {
        setLoading('qc');
        setQcResult(null);
        try {
            if (!metadata.title.trim() || !metadata.artist.trim()) {
                throw new Error('Track title and artist name are required for QC validation.');
            }

            const ddexMetadata: import('@/types/distribution').IngestionMetadata = {
                releaseId: `qc-${Date.now()}`,
                title: metadata.title,
                artists: [metadata.artist],
                tracks: [{
                    title: metadata.title,
                    artist: metadata.artist,
                    duration: 180,
                    explicit: false,
                    isrc: metadata.isrc
                }],
                label: 'Indii Records',
                artwork_url: metadata.artwork_url
            };
            const report = await distributionService.validateReleaseMetadata(ddexMetadata);
            setQcResult(report);
            if (report.valid) {
                toast.success('Metadata passed QC validation');
            } else {
                toast.error(`QC Failed: ${report.errors.length} error(s)`);
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'QC validation failed');
        } finally {
            setLoading(null);
        }
    };

    const handleGenerateCID = async () => {
        setLoading('cid');
        setCsvOutput(null);
        try {
            if (!metadata.title.trim() || !metadata.isrc.trim() || !metadata.artist.trim() || !metadata.upc.trim()) {
                throw new Error('Track title, artist, a real ISRC, and UPC are required before generating a Content ID CSV.');
            }
            if (!rights.exclusiveRights) {
                throw new Error('You must confirm exclusive rights before generating a Content ID CSV.');
            }
            if (!rights.label.trim()) {
                throw new Error('A real rights-holder label is required — there is no default.');
            }
            if (!rights.matchPolicy) {
                throw new Error('A match policy (Monetize / Track / Block) is required.');
            }
            const territories = rights.territories.split(',').map(t => t.trim()).filter(Boolean);
            if (territories.length === 0) {
                throw new Error('At least one explicit territory is required — there is no default "Worldwide".');
            }

            const cidPayload: import('@/types/distribution').ContentIdData = {
                tracks: [{
                    title: metadata.title,
                    isrc: metadata.isrc,
                    asset_id: `ASSET-${Date.now()}`
                }],
                upc: metadata.upc,
                artist: metadata.artist,
                rights_attestation: {
                    exclusive_rights: true,
                    label: rights.label,
                    match_policy: rights.matchPolicy,
                    territories
                }
            };
            const csvData = await distributionService.generateContentIdAssets(cidPayload);
            setCsvOutput(csvData);
            toast.success('YouTube Content ID CSV generated');
        } catch (error: unknown) {
            // ISSUE-1440: reveal the attestation section when its fields are why CID failed.
            setRightsOpen(true);
            toast.error(error instanceof Error ? error.message : 'CID generation failed');
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="space-y-6" data-testid="qc-panel">
            {/* Header with Sub-Tab Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Activity className="text-dept-distribution" size={24} />
                        Pre-Flight Audio & Acoustic QC
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                        Comprehensive lossless audio inspection, LUFS mastering compliance, DDEX metadata validation, and YouTube Content ID rights attestation.
                    </p>
                </div>

                {/* Sub-tab Pills */}
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
                    <button
                        data-testid="qc-subtab-acoustic"
                        onClick={() => setActiveSubTab('acoustic')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeSubTab === 'acoustic'
                                ? 'bg-dept-distribution text-white shadow-md'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Waves size={14} />
                        <span>Acoustic DSP & Targets</span>
                    </button>
                    <button
                        data-testid="qc-subtab-metadata"
                        onClick={() => setActiveSubTab('metadata')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeSubTab === 'metadata'
                                ? 'bg-dept-distribution text-white shadow-md'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <FileText size={14} />
                        <span>Metadata & Content ID</span>
                    </button>
                </div>
            </div>

            {/* ── Sub-tab 1: Acoustic DSP & Platform Targets ──────────
                ISSUE-1440: conditionally mounted (was CSS-hidden) so the heavy
                acoustic analysis DOM is not kept alive while metadata is active. */}
            {activeSubTab === 'acoustic' && (
            <div className="space-y-6">
                {/* Upload & Ingestion Gate with Drag-and-Drop */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    data-testid="qc-audio-dropzone"
                    className={cn(
                        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel rounded-2xl p-6 border transition-all duration-200",
                        isDragOver
                            ? "bg-primary/15 border-primary shadow-[0_0_30px_rgba(59,130,246,0.35)] ring-2 ring-primary/40 scale-[1.01]"
                            : "bg-white/5 border-white/10 hover:border-white/20"
                    )}
                >
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <ShieldCheck className={isDragOver ? "text-primary animate-bounce" : "text-green-400"} size={22} />
                            Ingestion & Master Audio Fingerprint
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {isDragOver
                                ? "Release to drop and analyze lossless master audio..."
                                : "Lossless WAV / FLAC pre-flight scan for Spotify, Apple Music, and YouTube loudness compliance. Drag & drop or select audio file."}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <label
                            onClick={handleLoadClick}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-2.5 text-xs shadow-md"
                        >
                            {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                            {isAnalyzing ? "Deep Analysis Running..." : "Load Audio Master"}
                            <input
                                type="file"
                                accept={LOSSLESS_ACCEPT}
                                className="sr-only"
                                onChange={handleFileUpload}
                                disabled={isAnalyzing}
                                data-testid="import-track-input"
                            />
                        </label>
                        {isAnalyzing && (
                            <Button
                                variant="destructive"
                                onClick={() => abortControllerRef.current?.abort()}
                                className="font-bold rounded-xl text-xs"
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Audio analysis mode">
                    <span className="text-xs font-semibold text-muted-foreground">Analysis mode</span>
                    <Button
                        type="button"
                        variant={analysisMode === 'connected' ? 'default' : 'outline'}
                        aria-pressed={analysisMode === 'connected'}
                        data-testid="connected-audio-analysis-mode"
                        disabled={isAnalyzing}
                        onClick={() => {
                            setAnalysisMode('connected');
                            setProfile(null);
                            setLocalReport(null);
                            setTags([]);
                        }}
                    >
                        Full connected analysis
                    </Button>
                    <Button
                        type="button"
                        variant={analysisMode === 'local-only' ? 'default' : 'outline'}
                        aria-pressed={analysisMode === 'local-only'}
                        data-testid="local-only-audio-analysis-mode"
                        disabled={isAnalyzing}
                        onClick={() => {
                            setAnalysisMode('local-only');
                            setProfile(null);
                            setLocalReport(null);
                            setTags([]);
                        }}
                    >
                        Local-only technical scan
                    </Button>
                    {analysisMode === 'local-only' && (
                        <span className="text-xs text-muted-foreground">
                            Runs on this device; does not upload, call AI, cache, or save results.
                        </span>
                    )}
                </div>

                {localReport && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-emerald-100" data-testid="local-only-analysis-report">
                        <div className="font-bold">Local-only technical report · {localReport.provenance.state}</div>
                        <p className="mt-1 text-emerald-100/80">
                            Measurements and estimates only. No semantic profile, identity match, rights, registration, or clearance decision was produced.
                        </p>
                        <p className="mt-1 break-all font-mono text-emerald-100/60">File fingerprint: {localReport.id}</p>
                    </div>
                )}

                {/* Master Audio Waveform Preview */}
                {audioUrl && (
                    <div className="bg-white/5 glass-panel rounded-2xl p-6 border border-white/10 animate-in fade-in slide-in-from-bottom-3 duration-400">
                        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">Master Audio Preview</h4>
                        <AudioWaveformViewer audioUrl={audioUrl} height={80} />
                    </div>
                )}

                {/* Acoustic Readout Matrix */}
                {technicalFeatures && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white/5 glass-panel rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
                                <Clock size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Duration</span>
                            </div>
                            <span className="text-2xl font-mono text-white">{formatTime(technicalFeatures.duration)}</span>
                        </div>
                        <div className="bg-white/5 glass-panel rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
                                <Activity size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">BPM (Tempo)</span>
                            </div>
                            <span className="text-2xl font-mono text-white">{Math.round(technicalFeatures.bpm)}</span>
                        </div>
                        <div className="bg-white/5 glass-panel rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
                                <Music size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Key & Scale</span>
                            </div>
                            <span className="text-2xl font-mono text-white">{technicalFeatures.key} {technicalFeatures.scale}</span>
                        </div>
                        <div className="bg-white/5 glass-panel rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
                                <BarChart2 size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Energy Index</span>
                            </div>
                            <span className="text-2xl font-mono text-white">{(technicalFeatures.energy * 100).toFixed(0)}%</span>
                        </div>
                    </div>
                )}

                {/* Platform Target Audit (LUFS & True Peak) */}
                {technicalFeatures?.audit && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Integrated Loudness */}
                        <div className="bg-white/5 glass-panel rounded-2xl p-6 border border-white/10 flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-5">
                                <Waves size={100} />
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                <Target size={16} className="text-dept-publishing" />
                                <span className="text-xs font-bold uppercase tracking-wider">Integrated Loudness (Estimated LUFS)</span>
                            </div>
                            <div className="flex items-end gap-3 mb-4">
                                <span className="text-4xl font-mono text-white tracking-tighter">
                                    {technicalFeatures.audit.integratedLoudness.toFixed(1)}
                                </span>
                                <span className="text-lg text-white/50 pb-0.5">LUFS</span>
                            </div>
                            <div className="space-y-2 mt-auto text-xs">
                                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                                    <span className="text-white font-medium">Spotify Target (-14 LUFS)</span>
                                    {technicalFeatures.audit.integratedLoudness > -12 ? (
                                        <Badge variant="destructive" className="flex items-center gap-1"><XCircle size={12} /> Penalized</Badge>
                                    ) : technicalFeatures.audit.integratedLoudness < -16 ? (
                                        <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">Too Quiet</Badge>
                                    ) : (
                                        <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1"><CheckCircle2 size={12} /> Optimal</Badge>
                                    )}
                                </div>
                                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                                    <span className="text-white font-medium">Apple Music Target (-16 LUFS)</span>
                                    {technicalFeatures.audit.integratedLoudness > -14 ? (
                                        <Badge variant="destructive" className="flex items-center gap-1"><XCircle size={12} /> Penalized</Badge>
                                    ) : technicalFeatures.audit.integratedLoudness < -18 ? (
                                        <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">Too Quiet</Badge>
                                    ) : (
                                        <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1"><CheckCircle2 size={12} /> Optimal</Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* True Peak */}
                        <div className="bg-white/5 glass-panel rounded-2xl p-6 border border-white/10 flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-5">
                                <Activity size={100} />
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                <Activity size={16} className="text-dept-publishing" />
                                <span className="text-xs font-bold uppercase tracking-wider">True Peak (Approximation)</span>
                            </div>
                            <div className="flex items-end gap-3 mb-4">
                                <span className="text-4xl font-mono text-white tracking-tighter">
                                    {technicalFeatures.audit.peakLevel.toFixed(2)}
                                </span>
                                <span className="text-lg text-white/50 pb-0.5">dBTP</span>
                            </div>
                            <div className="space-y-2 mt-auto text-xs">
                                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                                    <span className="text-white font-medium">DSP Target (-1.0 dBTP max)</span>
                                    {technicalFeatures.audit.peakLevel > -0.5 ? (
                                        <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle size={12} /> Clipping Risk</Badge>
                                    ) : (
                                        <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1"><CheckCircle2 size={12} /> Optimal</Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Distribution DDEX Spec & Creative Intelligence */}
                {profile && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-5 duration-600">
                        <div className="bg-white/5 glass-panel border border-white/10 rounded-2xl p-6">
                            <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-4">
                                <Globe size={14} className="text-blue-400" />
                                Distribution Spec
                            </h4>
                            <div className="space-y-3 text-xs">
                                <div>
                                    <span className="text-[10px] text-muted-foreground uppercase">Primary Genre</span>
                                    <p className="text-sm font-bold text-white">{profile.semantic.ddexGenre}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] text-muted-foreground uppercase">Sub-Genre</span>
                                    <p className="text-sm font-bold text-white">{profile.semantic.ddexSubGenre}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] text-muted-foreground uppercase">Language</span>
                                    <p className="text-sm font-bold text-white uppercase">{profile.semantic.language}</p>
                                </div>
                                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                                    <span className="text-xs font-bold text-white">Explicit Content</span>
                                    {profile.semantic.isExplicit ? (
                                        <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle size={12} /> YES</Badge>
                                    ) : (
                                        <Badge className="bg-green-500/20 text-green-400">CLEAN</Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-linear-to-br from-indigo-900/20 to-green-900/20 border border-indigo-500/20 rounded-2xl p-6">
                            <h4 className="text-xs font-bold text-indigo-100 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <BrainCircuit size={14} className="text-indigo-400" />
                                Creative Intelligence Prompts
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-[10px] text-indigo-300 uppercase">Visual Imagery & Vibe</span>
                                    <p className="text-xs font-medium leading-relaxed text-indigo-100 mt-1">"{profile.semantic.visualImagery?.abstract}"</p>
                                </div>
                                <div>
                                    <span className="text-[10px] text-indigo-300 uppercase">Marketing One-Liner</span>
                                    <p className="text-xs font-mono text-indigo-300/80 bg-black/40 p-2.5 rounded-lg border border-white/5 mt-1">
                                        {profile.semantic.marketingHooks?.oneLiner}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2.5 mt-5 pt-4 border-t border-indigo-500/20">
                                <Button
                                    data-testid="send-to-video-studio-btn"
                                    size="sm"
                                    className="bg-linear-to-r from-green-600 to-indigo-600 hover:from-green-500 hover:to-indigo-500 text-white font-bold text-xs"
                                    onClick={() => {
                                        setPendingPrompt(profile.semantic.targetPrompts.veo);
                                        setModule('creative');
                                        toast.success('Video prompt loaded into Creative Studio');
                                    }}
                                >
                                    <Video size={14} className="mr-1.5" />
                                    Send to Video Studio
                                    <ArrowRight size={12} className="ml-1 opacity-60" />
                                </Button>
                                <Button
                                    data-testid="send-to-creative-studio-btn"
                                    size="sm"
                                    variant="outline"
                                    className="border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/10 font-bold text-xs"
                                    onClick={() => {
                                        setPendingPrompt(profile.semantic.targetPrompts.image);
                                        setModule('creative');
                                        toast.success('Image prompt loaded into Creative Studio');
                                    }}
                                >
                                    <ImageIcon size={14} className="mr-1.5" />
                                    Send to Creative Studio
                                    <ArrowRight size={12} className="ml-1 opacity-60" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Metadata Tags & Push to Knowledge Graph */}
                {profile && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="lg:col-span-8 bg-white/5 glass-panel rounded-2xl border border-white/10 overflow-hidden">
                            <TagMatrix
                                tags={tags}
                                onAddTag={(tag) => setTags([...tags, tag])}
                                onRemoveTag={(tag) => setTags(tags.filter(t => t !== tag))}
                                suggestions={DEFAULT_TAGS}
                            />
                        </div>

                        <div className="lg:col-span-4 bg-linear-to-br from-black/40 to-primary/10 rounded-2xl border border-white/10 flex flex-col p-6 justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Database className="text-primary" size={16} />
                                    <h4 className="text-xs font-bold text-primary uppercase">Knowledge Graph</h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                                    Persisting this profile ensures distribution metadata and acoustic telemetry are available to all autonomous agents (Marketer, Director).
                                </p>
                            </div>

                            <Button
                                className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-bold py-5 text-xs shadow-md"
                                disabled={isSaving}
                                data-testid="save-analysis-button"
                                onClick={handleSaveAnalysis}
                            >
                                {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
                                Push Verified Data to Agents
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            )}

            {/* ── Sub-tab 2: Release Metadata & Content ID Compliance ──
                ISSUE-1440: conditionally mounted (was CSS-hidden). */}
            {activeSubTab === 'metadata' && (
            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Input Panel */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-dept-distribution mb-4">
                            <FileText className="w-5 h-5" />
                            <span className="font-bold uppercase tracking-wider text-sm">Release Metadata Intake</span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Track/Release Title</label>
                                <input
                                    data-testid="qc-input-title"
                                    type="text"
                                    value={metadata.title}
                                    onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Enter title (avoid feat/prod in title)"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-dept-distribution/50 transition-colors placeholder:text-zinc-600 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Primary Artist</label>
                                <input
                                    data-testid="qc-input-artist"
                                    type="text"
                                    value={metadata.artist}
                                    onChange={(e) => setMetadata(prev => ({ ...prev, artist: e.target.value }))}
                                    placeholder="Avoid generic names (Chill Beats, etc.)"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-dept-distribution/50 transition-colors placeholder:text-zinc-600 text-sm"
                                />
                            </div>

                            {/* ISSUE-1440: ISRC/Artwork/UPC are optional for Run QC (only
                                Title + Artist are validated) — collapsed by default. */}
                            <SectionCard
                                title="Optional & Content ID fields"
                                isOpen={optionalFieldsOpen}
                                onToggle={() => setOptionalFieldsOpen(open => !open)}
                            >
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">ISRC (Optional)</label>
                                    <input
                                        data-testid="qc-input-isrc"
                                        type="text"
                                        value={metadata.isrc}
                                        onChange={(e) => setMetadata(prev => ({ ...prev, isrc: e.target.value }))}
                                        placeholder="US-XXX-25-XXXXX (Leave empty to auto-generate)"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-dept-distribution/50 transition-colors placeholder:text-zinc-600 font-mono text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Artwork URL</label>
                                    <input
                                        data-testid="qc-input-artwork"
                                        type="text"
                                        value={metadata.artwork_url}
                                        onChange={(e) => setMetadata(prev => ({ ...prev, artwork_url: e.target.value }))}
                                        placeholder="https://..."
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-dept-distribution/50 transition-colors placeholder:text-zinc-600 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">UPC (required for Content ID)</label>
                                    <input
                                        data-testid="qc-input-upc"
                                        type="text"
                                        value={metadata.upc}
                                        onChange={(e) => setMetadata(prev => ({ ...prev, upc: e.target.value }))}
                                        placeholder="123456789012"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-dept-distribution/50 transition-colors placeholder:text-zinc-600 font-mono text-sm"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard
                                title="Content ID Rights Attestation"
                                isOpen={rightsOpen}
                                onToggle={() => setRightsOpen(open => !open)}
                            >
                                <div className="border border-dept-marketing/20 bg-dept-marketing/5 rounded-lg p-4 space-y-3">
                                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                        <input
                                            data-testid="qc-input-exclusive-rights"
                                            type="checkbox"
                                            checked={rights.exclusiveRights}
                                            onChange={(e) => setRights(prev => ({ ...prev, exclusiveRights: e.target.checked }))}
                                        />
                                        I confirm exclusive rights to this recording — no sample/loop or third-party admin conflicts.
                                    </label>
                                    <input
                                        data-testid="qc-input-rights-label"
                                        type="text"
                                        value={rights.label}
                                        onChange={(e) => setRights(prev => ({ ...prev, label: e.target.value }))}
                                        placeholder="Real rights-holder label (no default)"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-dept-marketing/50 transition-colors placeholder:text-zinc-600"
                                    />
                                    <select
                                        data-testid="qc-input-match-policy"
                                        value={rights.matchPolicy}
                                        onChange={(e) => setRights(prev => ({ ...prev, matchPolicy: e.target.value as typeof prev.matchPolicy }))}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-dept-marketing/50 transition-colors"
                                    >
                                        <option value="">-- Select Match Policy --</option>
                                        <option value="monetize">Monetize</option>
                                        <option value="track">Track</option>
                                        <option value="block">Block</option>
                                    </select>
                                    <input
                                        data-testid="qc-input-territories"
                                        type="text"
                                        value={rights.territories}
                                        onChange={(e) => setRights(prev => ({ ...prev, territories: e.target.value }))}
                                        placeholder="Territories, comma-separated (e.g. US, CA) — no default Worldwide"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-dept-marketing/50 transition-colors placeholder:text-zinc-600"
                                    />
                                </div>
                            </SectionCard>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    data-testid="qc-run-analysis"
                                    onClick={handleValidate}
                                    disabled={loading === 'qc'}
                                    className="bg-dept-distribution hover:bg-dept-distribution/80 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer text-sm"
                                >
                                    {loading === 'qc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    Run QC
                                </button>
                                <button
                                    data-testid="qc-generate-cid"
                                    onClick={handleGenerateCID}
                                    disabled={loading === 'cid'}
                                    className="bg-dept-marketing hover:bg-dept-marketing/80 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer text-sm"
                                >
                                    {loading === 'cid' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Youtube className="w-4 h-4" />}
                                    Gen CID CSV
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Output Panel */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 relative overflow-hidden backdrop-blur-sm">
                        {!qcResult && !csvOutput ? (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4 min-h-[300px]">
                                <div className="p-4 rounded-full bg-white/5">
                                    <FileText className="w-8 h-8 opacity-20" />
                                </div>
                                <p className="text-sm font-medium">Awaiting Validation/Generation</p>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {qcResult && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                            <span
                                                data-testid={qcResult.valid ? "qc-passed-badge" : "qc-failed-badge"}
                                                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                    qcResult.valid
                                                        ? 'bg-dept-licensing/10 text-dept-licensing border border-dept-licensing/20'
                                                        : 'bg-dept-marketing/10 text-dept-marketing border border-dept-marketing/20'
                                                }`}
                                            >
                                                {qcResult.valid ? 'PASSED' : 'FAILED'}
                                            </span>
                                            <span className="text-xs text-gray-500">{qcResult.summary}</span>
                                        </div>

                                        {qcResult.errors.length > 0 && (
                                            <div className="space-y-2">
                                                <span className="text-xs font-bold text-dept-marketing uppercase tracking-widest">Errors</span>
                                                {qcResult.errors.map((err, i) => (
                                                    <div key={i} className="flex items-start gap-2 p-3 bg-dept-marketing/10 border border-dept-marketing/20 rounded-lg">
                                                        <XCircle className="w-4 h-4 text-dept-marketing mt-0.5 flex-shrink-0" />
                                                        <span className="text-xs text-dept-marketing/80">{err}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {(qcResult.warnings?.length ?? 0) > 0 && (
                                            <div className="space-y-2">
                                                <span className="text-xs font-bold text-dept-royalties uppercase tracking-widest">Warnings</span>
                                                {qcResult.warnings?.map((warn, i) => (
                                                    <div key={i} className="flex items-start gap-2 p-3 bg-dept-royalties/10 border border-dept-royalties/20 rounded-lg">
                                                        <AlertTriangle className="w-4 h-4 text-dept-royalties mt-0.5 flex-shrink-0" />
                                                        <span className="text-xs text-dept-royalties/80">{warn}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {csvOutput && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-dept-marketing uppercase tracking-widest">YouTube Content ID CSV</span>
                                            <button
                                                data-testid="qc-copy-cid"
                                                onClick={() => navigator.clipboard.writeText(csvOutput)}
                                                className="text-xs text-gray-500 hover:text-white transition-colors cursor-pointer"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                        <pre
                                            data-testid="qc-cid-output"
                                            className="p-4 bg-black/40 rounded-lg overflow-x-auto text-xs text-dept-licensing font-mono max-h-48 overflow-y-auto custom-scrollbar"
                                        >
                                            {csvOutput}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            )}
        </div>
    );
};
