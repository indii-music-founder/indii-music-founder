import React, { useState } from 'react';
import {
    Activity, Upload, Database, Save, Loader2, Music, Hash, Clock, BarChart2, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { audioAnalysisService, DeepAudioFeatures } from '@/services/audio/AudioAnalysisService';
import { ModuleDashboard } from '@/components/layout/ModuleDashboard';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/core/context/ToastContext';
import { TagMatrix } from './components/TagMatrix';

const DEFAULT_TAGS = {
    'Mood': ['Energetic', 'Dark', 'Chill', 'Happy', 'Melancholic', 'Aggressive', 'Ethereal'],
    'Genre': ['Techno', 'House', 'Ambient', 'Hip Hop', 'Rock', 'Jazz', 'Experimental'],
    'Instruments': ['Synth', 'Drums', 'Bass', 'Guitar', 'Piano', 'Vocals', 'Orchestra'],
    'Vibe': ['Virality', 'Cinematic', 'Club', 'Radio', 'Underground', 'Raw', 'Polished']
};

const AudioAnalyzer: React.FC = () => {
    const toast = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isFromCache, setIsFromCache] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    
    const [fullAnalysis, setFullAnalysis] = useState<DeepAudioFeatures | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        setFile(uploadedFile);
        setTags([]);
        setFullAnalysis(null);
        await runAnalysis(uploadedFile);
    };

    const runAnalysis = async (audioFile: File) => {
        setIsAnalyzing(true);
        setIsFromCache(false);
        const toastId = toast.loading("Executing compliance extraction protocol...");

        try {
            const analysisResult = await audioAnalysisService.analyze(audioFile);
            const result = analysisResult.features;
            const fromCache = analysisResult.fromCache;

            setFullAnalysis(result);
            setIsFromCache(fromCache);

            if (!fromCache) {
                toast.dismiss(toastId);
                toast.success("Extraction Complete: Neural Network inference successful");
            } else {
                toast.dismiss(toastId);
            }

            // Smart Auto-Tagging based on Sonic DNA
            const newTags: string[] = [];
            if (result.genre) {
                const entries = Object.entries(result.genre);
                if (entries.length > 0) {
                    const topGenre = entries.sort((a, b) => b[1] - a[1])[0];
                    if (topGenre && topGenre[1] > 0.3) newTags.push(topGenre[0]);
                }
            }

            if (result.moods) {
                if (result.moods.happy > 0.6) newTags.push('Happy');
                if (result.moods.sad > 0.6) newTags.push('Sad');
                if (result.moods.aggressive > 0.6) newTags.push('Aggressive');
                if (result.moods.relaxed > 0.6) newTags.push('Relaxed');
            }

            if (result.energy > 0.8) newTags.push('High Voltage');
            else if (result.energy > 0.6) newTags.push('High Energy');
            
            if (result.bpm > 135) newTags.push('High Tempo');
            else if (result.bpm < 95) newTags.push('Downtempo');
            else newTags.push('Mid-tempo');

            setTags(Array.from(new Set(newTags)));
        } catch (error) {
            console.error("Deep Extraction Failed", error);
            toast.dismiss(toastId);
            toast.error("Deep Extraction failed. Try another file.");
            setIsAnalyzing(false);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSaveAnalysis = async () => {
        if (!file || !fullAnalysis || isAnalyzing) return;
        setIsSaving(true);
        const toastId = toast.loading("Logging compliance audit to Knowledge Graph...");

        try {
            await audioAnalysisService.saveAnalysisToFirestore(fullAnalysis, file.name);

            const fileHash = await audioAnalysisService.generateFileHash(file);
            const featuresToSave = {
                bpm: fullAnalysis.bpm,
                key: fullAnalysis.key,
                scale: fullAnalysis.scale || 'major',
                energy: fullAnalysis.energy,
                duration: fullAnalysis.duration,
                danceability: fullAnalysis.danceability,
                loudness: fullAnalysis.loudness || -1,
                valence: fullAnalysis.valence || 0.5
            };
            const { musicLibraryService } = await import('@/services/music/MusicLibraryService');
            await musicLibraryService.saveAnalysis(fileHash, file.name, featuresToSave, fileHash);

            setIsFromCache(true);
            toast.dismiss(toastId);
            toast.success("Compliance Audit logged to Database & Library.");
        } catch (error) {
            console.error("Save failed", error);
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
        <ModuleDashboard title="Distribution Intelligence Tracker" description="Extract sonic DNA for Agents, Marketing, and DDEX Requirements" icon={<Activity className="text-primary" />}>
            <div className="flex flex-col h-full p-6 gap-6 overflow-y-auto custom-scrollbar">

                {/* Top Actions */}
                <div className="flex items-center justify-between bg-card glass-panel rounded-2xl p-6 border border-white/5">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <ShieldCheck className="text-green-400" size={24} />
                            Ingestion & Data Extraction
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">Upload an audio master to extract precise metadata for DDEX distribution and agent context.</p>
                    </div>
                    <label className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                        {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                        {isAnalyzing ? "Extracting Data..." : "Load Audio Master"}
                        <input type="file" accept="audio/*" className="sr-only" onChange={handleFileUpload} />
                    </label>
                </div>

                {/* Data Readout Matrix */}
                {fullAnalysis && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-card glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                <Clock size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Duration</span>
                            </div>
                            <span className="text-3xl font-mono text-white">{formatTime(fullAnalysis.duration)}</span>
                        </div>
                        <div className="bg-card glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                <Activity size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">BPM (Tempo)</span>
                            </div>
                            <span className="text-3xl font-mono text-white">{Math.round(fullAnalysis.bpm)}</span>
                        </div>
                        <div className="bg-card glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                <Music size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Key & Scale</span>
                            </div>
                            <span className="text-3xl font-mono text-white">{fullAnalysis.key} {fullAnalysis.scale}</span>
                        </div>
                        <div className="bg-card glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                <BarChart2 size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Energy Index</span>
                            </div>
                            <span className="text-3xl font-mono text-white">{(fullAnalysis.energy * 100).toFixed(0)}%</span>
                        </div>
                    </div>
                )}

                {/* Bottom Matrix: Tagging and DB Log */}
                {fullAnalysis && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        {/* Tagging */}
                        <div className="lg:col-span-8 bg-card glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Metadata Tags (For Agents)</span>
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
                        <div className="lg:col-span-4 bg-gradient-to-br from-black/40 to-primary/10 rounded-2xl border border-white/5 flex flex-col p-6 justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Database className="text-primary" size={18} />
                                        <h3 className="text-sm font-bold text-primary uppercase">Knowledge Graph</h3>
                                    </div>
                                    {isFromCache && <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary-foreground border-none">CACHED</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                                    Logging this data into the Knowledge Graph provides your AI agents (Creative Director, Marketing, Video Producer) with the structural context needed to create assets that perfectly match the song's energy and rhythm. It is also packaged for DDEX distribution.
                                </p>
                            </div>

                            <Button
                                className="w-full bg-primary hover:bg-primary/80 shadow-[0_0_15px_rgba(var(--primary),0.3)] text-primary-foreground font-bold py-6 text-sm"
                                disabled={isSaving}
                                onClick={handleSaveAnalysis}
                            >
                                {isSaving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
                                Push Data to Agents
                            </Button>
                        </div>
                    </div>
                )}

            </div>
        </ModuleDashboard>
    );
};

export default AudioAnalyzer;
