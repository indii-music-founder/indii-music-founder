import React, { useState } from 'react';
import {
    Activity, Upload, Database, Save, Loader2, Music, Clock, BarChart2, ShieldCheck, BrainCircuit, Globe, AlertTriangle, HelpCircle, Target, Waves, CheckCircle2, XCircle, Video, ImageIcon, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModuleDashboard } from '@/components/layout/ModuleDashboard';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/core/context/ToastContext';
import { TagMatrix } from './components/TagMatrix';
import { AudioIntelligenceProfile } from '@/services/audio/types';
import { audioAnalysisService } from '@/services/audio/AudioAnalysisService';
import { AudioWaveformViewer } from '@/components/shared/AudioWaveformViewer';
import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const DEFAULT_TAGS = {
    'Mood': ['Energetic', 'Dark', 'Chill', 'Happy', 'Melancholic', 'Aggressive', 'Ethereal'],
    'Genre': ['Techno', 'House', 'Ambient', 'Hip Hop', 'Rock', 'Jazz', 'Experimental'],
    'Instruments': ['Synth', 'Drums', 'Bass', 'Guitar', 'Piano', 'Vocals', 'Orchestra'],
    'Vibe': ['Virality', 'Cinematic', 'Club', 'Radio', 'Underground', 'Raw', 'Polished']
};

const AudioAnalyzer: React.FC = () => {
    const toast = useToast();
    const setModule = useStore(state => state.setModule);
    const setPendingPrompt = useStore(state => state.setPendingPrompt);
    const [file, setFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [tags, setTags] = useState<string[]>([]);

    const [profile, setProfile] = useState<AudioIntelligenceProfile | null>(null);

    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            animate: true,
            steps: [
                { element: '#tour-audio-tabs', popover: { title: 'Distribution QC & Optimization', description: 'Switch between distribution-ready metadata extraction and mastering target optimization.' } },
                { element: '#tour-audio-upload', popover: { title: 'Ingestion & Data Extraction', description: 'Upload a master track here to instantly extract the acoustic fingerprint and prepare distribution metadata.' } },
                { element: '#tour-audio-knowledge', popover: { title: 'Knowledge Graph', description: 'Once scanned, verify the metadata and push the payload directly into the system for other agents to use.' } },
            ]
        });
        driverObj.drive();
    };

    /**
     * Lossless format enforcement — distributors (DistroKid, TuneCore, CD Baby,
     * UnitedMasters) universally require lossless masters (WAV/FLAC/AIFF).
     * MP3/AAC/OGG are lossy and will be rejected at QC.
     */
    const LOSSLESS_MIME_TYPES = new Set([
        'audio/wav', 'audio/x-wav', 'audio/wave',
        'audio/flac', 'audio/x-flac',
        'audio/aiff', 'audio/x-aiff',
        'audio/x-m4a', 'audio/mp4', // ALAC containers
        'audio/alac',
    ]);
    const LOSSLESS_EXTENSIONS = new Set(['.wav', '.flac', '.aif', '.aiff', '.m4a', '.alac']);
    const LOSSLESS_ACCEPT = '.wav,.flac,.aif,.aiff,.m4a';

    const isLosslessFormat = (f: File): boolean => {
        // Check MIME type first
        if (f.type && LOSSLESS_MIME_TYPES.has(f.type.toLowerCase())) return true;
        // Fallback: check file extension (some browsers don't set MIME for FLAC/AIFF)
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        return LOSSLESS_EXTENSIONS.has(ext);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        // Gate: Reject lossy formats
        if (!isLosslessFormat(uploadedFile)) {
            const ext = uploadedFile.name.split('.').pop()?.toUpperCase() || 'unknown';
            toast.error(
                `${ext} files are not accepted. Distributors require lossless masters (WAV, FLAC, or AIFF). Please re-export your track in a lossless format.`
            );
            // Reset the input so the same file can be re-selected after conversion
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
        await runAnalysis(uploadedFile);
    };

    const runAnalysis = async (audioFile: File) => {
        setIsAnalyzing(true);
        const extractToastId = toast.loading("Executing full technical and semantic audio scan...");

        try {
            const { audioIntelligence } = await import('@/services/audio/AudioIntelligenceService');

            // This runs the full local audio analysis + remote AI deep analysis
            const resultProfile = await audioIntelligence.analyze(audioFile);

            // Populate tags from the semantic output
            const newTags: Set<string> = new Set();
            resultProfile.semantic.mood?.forEach(m => newTags.add(m));
            resultProfile.semantic.genre?.forEach(g => newTags.add(g));
            resultProfile.semantic.instruments?.forEach(i => newTags.add(i));
            resultProfile.semantic.marketingHooks?.keywords?.forEach(k => newTags.add(k));

            setTags(Array.from(newTags));
            setProfile(resultProfile); // Set profile ONLY after semantic is validated/processed

            toast.dismiss(extractToastId);
            toast.success("Extraction Complete: Deep AI acoustic fingerprint generated.");

        } catch (error: unknown) {
            logger.error("Deep Extraction Failed", error);
            toast.dismiss(extractToastId);
            toast.error("Deep Extraction failed. AI service limits or connectivity issues detected.");
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
            toast.success("Distribution standards and acoustic profile saved.");
        } catch (error: unknown) {
            logger.error("Save failed", error);
            toast.dismiss(toastId);
            toast.error("Failed to log audit.");
        } finally {
            setIsSaving(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <ModuleDashboard title="Audio Distribution Hub" description="Music Data Audits, Delivery Optimization & Asset Generation" icon={<Activity className="text-primary" />}>
            <div className="flex flex-col h-full bg-black/10">
                <Tabs defaultValue="compliance" className="flex-1 flex flex-col overflow-hidden">
                    <div id="tour-audio-tabs" className="px-6 border-b border-white/5 flex-shrink-0 bg-card/50 flex justify-between items-center">
                        <TabsList className="bg-transparent gap-8 p-0 h-14 inline-flex">
                            <TabsTrigger value="compliance" className="text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 h-full font-black transition-all text-xs uppercase tracking-widest whitespace-nowrap">
                                Distribution QC
                            </TabsTrigger>
                            <TabsTrigger value="optimize" className="text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 h-full font-black transition-all text-xs uppercase tracking-widest whitespace-nowrap">
                                Release Optimization
                            </TabsTrigger>
                        </TabsList>
                        <button onClick={startTour} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Take a Tour">
                            <HelpCircle size={16} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        {/* Tab 1: Compliance */}
                        <TabsContent value="compliance" className="mt-0 border-none outline-none flex flex-col gap-6">
                            {/* Top Actions */}
                            <div id="tour-audio-upload" className="flex items-center justify-between bg-card glass-panel rounded-2xl p-6 border border-white/5">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <ShieldCheck className="text-green-400" size={24} />
                                        Ingestion & Data Extraction
                                    </h2>
                                    <p className="text-sm text-muted-foreground mt-1">Upload an audio master to extract precise metadata via AI-powered acoustic analysis.</p>
                                </div>
                                <label className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                                    {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                                    {isAnalyzing ? "Deep Analysis Running..." : "Load Audio Master"}
                                    <input type="file" accept={LOSSLESS_ACCEPT} className="sr-only" onChange={handleFileUpload} disabled={isAnalyzing} data-testid="import-track-input" />
                                </label>
                            </div>

                            {/* Audio Waveform Viewer Feature */}
                            {audioUrl && (
                                <div className="bg-card glass-panel rounded-2xl p-6 border border-white/5 animate-in fade-in slide-in-from-bottom-3 duration-400">
                                    <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">Master Audio Preview</h3>
                                    <AudioWaveformViewer audioUrl={audioUrl} height={80} />
                                </div>
                            )}

                            {/* Data Readout Matrix */}
                            {profile && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-card glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
                                        <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                            <Clock size={16} />
                                            <span className="text-xs font-bold uppercase tracking-wider">Duration</span>
                                        </div>
                                        <span className="text-3xl font-mono text-white">{formatTime(profile.technical.duration)}</span>
                                    </div>
                                    <div className="bg-card glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
                                        <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                            <Activity size={16} />
                                            <span className="text-xs font-bold uppercase tracking-wider">BPM (Tempo)</span>
                                        </div>
                                        <span className="text-3xl font-mono text-white">{Math.round(profile.technical.bpm)}</span>
                                    </div>
                                    <div className="bg-card glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
                                        <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                            <Music size={16} />
                                            <span className="text-xs font-bold uppercase tracking-wider">Key & Scale</span>
                                        </div>
                                        <span className="text-3xl font-mono text-white">{profile.technical.key} {profile.technical.scale}</span>
                                    </div>
                                    <div className="bg-card glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
                                        <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                            <BarChart2 size={16} />
                                            <span className="text-xs font-bold uppercase tracking-wider">Energy Index</span>
                                        </div>
                                        <span className="text-3xl font-mono text-white">{(profile.technical.energy * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                            )}

                            {/* AI Deep Analysis & Distribution Spec */}
                            {profile && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-5 duration-600">

                                    {/* Box 1: Distribution Spec */}
                                    <div className="bg-card glass-panel border border-white/5 rounded-2xl p-6">
                                        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-6">
                                            <Globe size={16} className="text-blue-400" />
                                            Distribution Spec
                                        </h3>
                                        <div className="space-y-4">
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
                                            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                                                <span className="text-xs font-bold text-white">Explicit Content</span>
                                                {profile.semantic.isExplicit ?
                                                    <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle size={12} /> YES</Badge> :
                                                    <Badge className="bg-green-500/20 text-green-400">CLEAN</Badge>
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    {/* Box 2: Visual & Agent Hooks */}
                                    <div className="lg:col-span-2 bg-linear-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/20 rounded-2xl p-6">
                                        <h3 className="text-sm font-bold text-indigo-100 uppercase tracking-widest flex items-center gap-2 mb-6">
                                            <BrainCircuit size={16} className="text-indigo-400" />
                                            Creative Intelligence
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <div>
                                                    <span className="text-[10px] text-indigo-300 uppercase">Visual Imagery & Vibe</span>
                                                    <p className="text-sm font-medium leading-relaxed text-indigo-100 mt-1">"{profile.semantic.visualImagery.abstract}"</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-indigo-300 uppercase">Marketing One-Liner</span>
                                                    <p className="text-sm font-mono text-indigo-300/80 bg-black/40 p-3 rounded-lg border border-white/5 mt-1">
                                                        {profile.semantic.marketingHooks.oneLiner}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <span className="text-[10px] text-indigo-300 uppercase block mb-2">AI Image Prompt</span>
                                                    <div className="bg-black/30 p-2 rounded text-xs text-indigo-200/70 border border-indigo-500/10 custom-scrollbar overflow-x-auto whitespace-nowrap">
                                                        {profile.semantic.targetPrompts.image}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-indigo-300 uppercase block mb-2">AI Video Prompt</span>
                                                    <div className="bg-black/30 p-2 rounded text-xs text-indigo-200/70 border border-indigo-500/10 custom-scrollbar overflow-x-auto whitespace-nowrap">
                                                        {profile.semantic.targetPrompts.veo}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ⚡ Action Buttons: Send prompts directly to generation studios */}
                                        <div className="flex flex-wrap gap-3 mt-6 pt-5 border-t border-indigo-500/20">
                                            <Button
                                                data-testid="send-to-video-studio-btn"
                                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-500/20 transition-all duration-200 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98]"
                                                onClick={() => {
                                                    setPendingPrompt(profile.semantic.targetPrompts.veo);
                                                    setModule('video');
                                                    toast.success('Video prompt loaded into Video Studio');
                                                }}
                                            >
                                                <Video size={16} className="mr-2" />
                                                Send to Video Studio
                                                <ArrowRight size={14} className="ml-1.5 opacity-60" />
                                            </Button>
                                            <Button
                                                data-testid="send-to-creative-studio-btn"
                                                variant="outline"
                                                className="border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/10 hover:border-indigo-400/50 font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                                onClick={() => {
                                                    setPendingPrompt(profile.semantic.targetPrompts.image);
                                                    setModule('creative');
                                                    toast.success('Image prompt loaded into Creative Studio');
                                                }}
                                            >
                                                <ImageIcon size={16} className="mr-2" />
                                                Send to Creative Studio
                                                <ArrowRight size={14} className="ml-1.5 opacity-60" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Bottom Matrix: Tagging and DB Log */}
                            {profile && (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-10">
                                    {/* Tagging */}
                                    <div className="lg:col-span-8 bg-card glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                                        <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Metadata Tags</span>
                                            <Badge variant="outline" className="text-[10px] h-5 border-white/10">{tags.length} TAGS</Badge>
                                        </div>
                                        <TagMatrix
                                            tags={tags}
                                            onAddTag={(tag) => setTags([...tags, tag])}
                                            onRemoveTag={(tag) => setTags(tags.filter(t => t !== tag))}
                                            suggestions={DEFAULT_TAGS}
                                        />
                                    </div>

                                    {/* Audit Logging */}
                                    <div id="tour-audio-knowledge" className="lg:col-span-4 bg-linear-to-br from-black/40 to-primary/10 rounded-2xl border border-white/5 flex flex-col p-6 justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Database className="text-primary" size={18} />
                                                    <h3 className="text-sm font-bold text-primary uppercase">Knowledge Graph</h3>
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                                                Pushing this profile persists distribution metadata and generated prompt payloads to the system. Other agents (Marketer, Director) will inherit this context automatically.
                                            </p>
                                        </div>

                                        <Button
                                            className="w-full bg-primary hover:bg-primary/80 shadow-[0_0_15px_rgba(var(--primary),0.3)] text-primary-foreground font-bold py-6 text-sm"
                                            disabled={isSaving}
                                            data-testid="save-analysis-button"
                                            onClick={handleSaveAnalysis}
                                        >
                                            {isSaving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
                                            Push Verified Data to Agents
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Tab 3: Optimize */}
                        <TabsContent value="optimize" className="mt-0 border-none outline-none min-h-[500px] flex flex-col gap-6">
                            {!profile ? (
                                <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground bg-card glass-panel rounded-2xl border border-white/5 p-12 text-center animate-in fade-in duration-500">
                                    <ShieldCheck size={48} className="mb-6 opacity-30 text-green-400" />
                                    <h2 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">Target Mastering Audit</h2>
                                    <p className="text-sm max-w-md mx-auto leading-relaxed mb-8">
                                        Analyze LUFS, True Peak, and frequency spectrum distribution against specific platform targets (Spotify, Apple Music) before delivery.
                                    </p>
                                    <label className="border border-dept-publishing/50 text-dept-publishing hover:bg-dept-publishing/10 cursor-pointer inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors">
                                        <Upload size={16} className="mr-2" /> Upload Master for Audit
                                        <input type="file" accept={LOSSLESS_ACCEPT} className="sr-only" onChange={handleFileUpload} disabled={isAnalyzing} />
                                    </label>
                                </div>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center justify-between bg-card glass-panel rounded-2xl p-6 border border-white/5 mb-6">
                                        <div>
                                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                <Target className="text-dept-publishing" size={24} />
                                                DSP Compliance Report
                                            </h2>
                                            <p className="text-sm text-muted-foreground mt-1">Loudness Penalty and True Peak analysis for Spotify/Apple Music targets.</p>
                                        </div>
                                        <label className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-xl cursor-pointer transition-all flex items-center gap-3">
                                            <Upload size={18} /> Re-Audit New File
                                            <input type="file" accept={LOSSLESS_ACCEPT} className="sr-only" onChange={handleFileUpload} disabled={isAnalyzing} />
                                        </label>
                                    </div>

                                    {profile.technical.audit && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* LUFS Metric */}
                                            <div className="bg-card glass-panel rounded-2xl p-6 border border-white/5 flex flex-col relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-6 opacity-5">
                                                    <Waves size={100} />
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground mb-6">
                                                    <span className="text-sm font-bold uppercase tracking-wider">Integrated Loudness (LUFS)</span>
                                                </div>
                                                <div className="flex items-end gap-3 mb-4">
                                                    <span className="text-5xl font-mono text-white tracking-tighter">{profile.technical.audit.integratedLoudness.toFixed(1)}</span>
                                                    <span className="text-xl text-white/50 pb-1">LUFS</span>
                                                </div>

                                                <div className="space-y-3 mt-auto">
                                                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                                                        <span className="text-xs font-bold text-white flex items-center gap-2">Spotify Target (-14 LUFS)</span>
                                                        {profile.technical.audit.integratedLoudness > -12 ? (
                                                            <Badge variant="destructive" className="flex items-center gap-1"><XCircle size={12} /> Penalyzed</Badge>
                                                        ) : profile.technical.audit.integratedLoudness < -16 ? (
                                                            <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">Too Quiet</Badge>
                                                        ) : (
                                                            <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1"><CheckCircle2 size={12} /> Optimal</Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                                                        <span className="text-xs font-bold text-white flex items-center gap-2">Apple Music Target (-16 LUFS)</span>
                                                        {profile.technical.audit.integratedLoudness > -14 ? (
                                                            <Badge variant="destructive" className="flex items-center gap-1"><XCircle size={12} /> Penalyzed</Badge>
                                                        ) : profile.technical.audit.integratedLoudness < -18 ? (
                                                            <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">Too Quiet</Badge>
                                                        ) : (
                                                            <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1"><CheckCircle2 size={12} /> Optimal</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* True Peak Metric */}
                                            <div className="bg-card glass-panel rounded-2xl p-6 border border-white/5 flex flex-col relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-6 opacity-5">
                                                    <Activity size={100} />
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground mb-6">
                                                    <span className="text-sm font-bold uppercase tracking-wider">True Peak (Approximation)</span>
                                                </div>
                                                <div className="flex items-end gap-3 mb-4">
                                                    <span className="text-5xl font-mono text-white tracking-tighter">{profile.technical.audit.peakLevel.toFixed(2)}</span>
                                                    <span className="text-xl text-white/50 pb-1">dB</span>
                                                </div>

                                                <div className="space-y-3 mt-auto">
                                                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                                                        <span className="text-xs font-bold text-white flex items-center gap-2">DSP Target (-1.0 dBTP max)</span>
                                                        {profile.technical.audit.peakLevel > -0.5 ? (
                                                            <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle size={12} /> Clipping Risk</Badge>
                                                        ) : (
                                                            <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1"><CheckCircle2 size={12} /> Optimal</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </ModuleDashboard>
    );
};

export default AudioAnalyzer;
