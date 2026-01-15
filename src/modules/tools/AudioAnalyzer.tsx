import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import {
    Activity, Play, Pause, Upload, Volume2, Mic2, Tag,
    Database, Fingerprint, Save, RotateCcw, Scissors
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { fingerprintService } from '@/services/audio/FingerprintService';
import { audioAnalysisService } from '@/services/audio/AudioAnalysisService';
import { SonicRadar } from './components/SonicRadar';
import { TagMatrix } from './components/TagMatrix';
import { ModuleDashboard } from '@/components/layout/ModuleDashboard';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/core/context/ToastContext';

const DEFAULT_TAGS = {
    'Mood': ['Energetic', 'Dark', 'Chill', 'Happy', 'Melancholic', 'Aggressive', 'Ethereal'],
    'Genre': ['Techno', 'House', 'Ambient', 'Hip Hop', 'Rock', 'Jazz', 'Experimental'],
    'Instruments': ['Synth', 'Drums', 'Bass', 'Guitar', 'Piano', 'Vocals', 'Orchestra'],
    'Vibe': ['Virality', 'Cinematic', 'Club', 'Radio', 'Underground', 'Raw', 'Polished']
};

const AudioAnalyzer: React.FC = () => {
    const toast = useToast();
    // --- State ---
    const [file, setFile] = useState<File | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [selectedRegion, setSelectedRegion] = useState<{ start: number, end: number } | null>(null);

    // Audio Features
    const [features, setFeatures] = useState({
        bpm: 0,
        key: '?',
        energy: 0,
        danceability: 0,
        happiness: 0,
        acousticness: 0,
        instrumentalness: 0,
        duration: 0
    });
    const [regionFeatures, setRegionFeatures] = useState<typeof features | null>(null);

    // Refs
    const waveformContainerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const regionsPluginRef = useRef<RegionsPlugin | null>(null);

    // --- Initialization & Audio Handling ---

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        setFile(uploadedFile);
        setTags([]);
        setSelectedRegion(null);

        // Initialize WaveSurfer with the new file
        initWaveSurfer(uploadedFile);

        // Run Analysis
        await runAnalysis(uploadedFile);
    };

    const initWaveSurfer = (audioFile: File) => {
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
        }

        if (!waveformContainerRef.current) return;

        const url = URL.createObjectURL(audioFile);

        const ws = WaveSurfer.create({
            container: waveformContainerRef.current,
            waveColor: 'rgba(255, 255, 255, 0.4)', // Increased contrast
            progressColor: '#facc15',
            cursorColor: '#ffffff',
            barWidth: 2,
            barGap: 3,
            height: 100, // Slightly more compact
            normalize: true,
            backend: 'WebAudio',
            minPxPerSec: 50,
            dragToSeek: true,
        });

        // Initialize Regions Plugin
        const wsRegions = RegionsPlugin.create();
        regionsPluginRef.current = wsRegions;
        ws.registerPlugin(wsRegions);

        // Events
        ws.load(url);

        ws.on('ready', () => {
            setDuration(ws.getDuration());
            // Add a default region for demo purposes
            wsRegions.addRegion({
                start: ws.getDuration() * 0.2, // 20% in
                end: ws.getDuration() * 0.4,   // 40% in
                content: 'Viral Segment',
                color: 'rgba(250, 204, 21, 0.2)', // Primary with opacity
                drag: true,
                resize: true
            });
        });

        ws.on('audioprocess', (time) => setCurrentTime(time));
        ws.on('finish', () => setIsPlaying(false));
        ws.on('play', () => setIsPlaying(true));
        ws.on('pause', () => setIsPlaying(false));

        // Region Events
        wsRegions.on('region-updated', (region: Region) => {
            setSelectedRegion({ start: region.start, end: region.end });
        });

        wsRegions.on('region-clicked', (region: Region, e: MouseEvent) => {
            e.stopPropagation(); // Prevent seek
            region.play();
        });

        wavesurferRef.current = ws;
    };

    const runAnalysis = async (audioFile: File) => {
        setIsAnalyzing(true);
        try {
            // Run Analysis
            const result = await audioAnalysisService.analyze(audioFile);
            setFeatures({
                bpm: result.bpm,
                key: `${result.key} ${result.scale}`,
                energy: result.energy,
                danceability: result.danceability || 0.5,
                happiness: result.valence || 0.5,
                acousticness: 0.3,
                instrumentalness: 0.7,
                duration: result.duration
            });

            // Smart Auto-Tagging based on Sonic DNA
            const newTags: string[] = [];

            // Mood Tags
            if ((result.valence || 0.5) > 0.75) newTags.push('Euphoric', 'Positive');
            else if ((result.valence || 0.5) > 0.6) newTags.push('Happy');
            else if ((result.valence || 0.5) < 0.3) newTags.push('Melancholic', 'Dark');
            else if ((result.valence || 0.5) < 0.45) newTags.push('Moody');

            // Energy Tags
            if (result.energy > 0.8) newTags.push('High Voltage', 'Intense');
            else if (result.energy > 0.6) newTags.push('Driving');
            else if (result.energy < 0.3) newTags.push('Chill', 'Ambient');

            // Rhythm Tags
            if (result.bpm > 135) newTags.push('High Tempo');
            else if (result.bpm < 90) newTags.push('Downtempo');
            if ((result.danceability || 0) > 0.75) newTags.push('Club Ready', 'Groovy');

            setTags(newTags);
        } catch (error) {
            console.error("Deep Analysis Failed", error);
            toast.error("Analysis failed. Try another file.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const togglePlay = () => {
        if (wavesurferRef.current) {
            wavesurferRef.current.playPause();
        }
    };

    const handleAnalyzeRegion = async () => {
        if (!selectedRegion || !wavesurferRef.current) {
            toast.info("Select a region on the waveform first.");
            return;
        }

        const fullBuffer = wavesurferRef.current.getDecodedData();
        if (!fullBuffer) {
            toast.error("Audio data not ready.");
            return;
        }

        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

        const startSample = Math.floor(selectedRegion.start * fullBuffer.sampleRate);
        const endSample = Math.floor(selectedRegion.end * fullBuffer.sampleRate);
        const length = endSample - startSample;

        if (length <= 0) return;

        // Create segmented buffer
        const regionBuffer = audioCtx.createBuffer(
            fullBuffer.numberOfChannels,
            length,
            fullBuffer.sampleRate
        );

        for (let channel = 0; channel < fullBuffer.numberOfChannels; channel++) {
            const channelData = fullBuffer.getChannelData(channel);
            // Copy segment
            const segment = channelData.slice(startSample, endSample);
            regionBuffer.copyToChannel(segment, channel);
        }

        const toastId = toast.loading("Isolating Sonic DNA sequence...");

        try {
            const result = await audioAnalysisService.analyzeBuffer(regionBuffer);

            setRegionFeatures({
                bpm: result.bpm,
                key: `${result.key} ${result.scale}`,
                energy: result.energy,
                danceability: result.danceability || 0.5,
                happiness: result.valence || 0.5,
                acousticness: 0.3,
                instrumentalness: 0.7,
                duration: result.duration
            });

            // Smart tagging based on region
            const newTags: string[] = [];
            if (result.energy > 0.8) newTags.push('Viral Moment');
            if (result.bpm > 130) newTags.push('High Tempo');
            if (result.danceability > 0.7) newTags.push('Groove Section');

            if (newTags.length > 0) {
                setTags(prev => Array.from(new Set([...prev, ...newTags])));
                toast.success(`Region Analyzed: +${newTags.length} derived tags`);
            } else {
                toast.success("Region Analysis Complete");
            }

            toast.dismiss(toastId);

        } catch (error) {
            console.error("Region Analysis Failed", error);
            toast.error("Failed to sequence region DNA.");
        }
    };

    const handleSaveAnalysis = async () => {
        toast.info("Local save functionality currently in laboratory testing.");
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Derived Context
    const aiContextDescription = file ?
        `Track "${file.name}" | ${Math.round(features.bpm)} BPM | ${features.key}. ` +
        (regionFeatures
            ? `SELECTED REGION: ${(regionFeatures.energy * 100).toFixed(0)}% Energy, ${Math.round(regionFeatures.bpm)} BPM. Identified as potential key moment.`
            : `Global energy is ${(features.energy * 100).toFixed(0)}%. No specific region isolated.`)
        : "No audio loaded.";

    return (
        <ModuleDashboard title="Sonic DNA Console" description="Deep Metadata Extraction & Laboratory Analysis" icon={<Activity className="text-primary" />}>
            <div className="flex flex-col h-full p-4 gap-4 overflow-hidden">

                {/* Top Section: Analysis & Operations (Split View) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">

                    {/* Left: Sonic Radar (4 cols) */}
                    <div className="lg:col-span-4 bg-card glass-panel rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center relative">
                        <div className="absolute top-4 left-4 text-xs font-mono text-muted-foreground flex items-center gap-2">
                            <Fingerprint size={12} />
                            {regionFeatures ? "REGION FINGERPRINT" : "GLOBAL FINGERPRINT"}
                        </div>
                        {/* Show Region features if available, else global */}
                        <SonicRadar features={regionFeatures || features} loading={isAnalyzing} />

                        {/* Key Stats Row */}
                        <div className="flex justify-between w-full px-8 mt-6">
                            <div className="text-center" data-testid="bpm-stat">
                                <div className="text-[10px] text-muted-foreground uppercase">BPM</div>
                                <div className="text-2xl font-mono text-primary glow-text-white">{Math.round((regionFeatures || features).bpm) || '--'}</div>
                            </div>
                            <div className="text-center" data-testid="key-stat">
                                <div className="text-[10px] text-muted-foreground uppercase">KEY</div>
                                <div className="text-2xl font-mono text-primary glow-text-white">{(regionFeatures || features).key || '--'}</div>
                            </div>
                            <div className="text-center" data-testid="energy-stat">
                                <div className="text-[10px] text-muted-foreground uppercase">ENERGY</div>
                                <div className="text-2xl font-mono text-primary glow-text-white">{((regionFeatures || features).energy * 10).toFixed(1)}</div>
                            </div>
                        </div>

                        {regionFeatures && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRegionFeatures(null)}
                                className="mt-4 text-[10px] h-6 text-muted-foreground hover:text-white"
                                data-testid="reset-to-global-button"
                            >
                                <RotateCcw size={10} className="mr-1" /> Reset to Global
                            </Button>
                        )}
                    </div>

                    {/* Middle: Tagging Matrix (5 cols) */}
                    <div className="lg:col-span-5 bg-card glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                        <div className="p-3 border-b border-white/5 bg-white/5 flex justify-between items-center">
                            <span className="text-xs font-bold text-muted-foreground">METADATA MATRIX</span>
                            <Badge variant="outline" className="text-[10px] h-5 border-white/10">{tags.length} TAGS</Badge>
                        </div>
                        <TagMatrix
                            tags={tags}
                            onAddTag={(tag) => setTags([...tags, tag])}
                            onRemoveTag={(tag) => setTags(tags.filter(t => t !== tag))}
                            suggestions={DEFAULT_TAGS}
                        />
                    </div>

                    {/* Right: Actions & AI Output (3 cols) */}
                    <div className="lg:col-span-3 flex flex-col gap-4">
                        {/* Upload Card */}
                        <label className="bg-primary/5 hover:bg-primary/10 border border-primary/20 hover:border-primary/40 rounded-xl p-4 cursor-pointer transition-all group flex items-center gap-4" data-testid="import-track-button">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Upload size={18} className="text-primary" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-primary">Import Track</div>
                                <div className="text-[10px] text-muted-foreground">WAV, MP3, AIFF</div>
                            </div>
                            <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} data-testid="import-track-input" />
                        </label>

                        {/* AI Summary */}
                        <div className="flex-1 bg-gradient-to-br from-black/40 to-purple-900/10 rounded-xl border border-white/5 p-4 flex flex-col">
                            <div className="flex items-center gap-2 mb-3">
                                <Database className="text-purple-400" size={14} />
                                <span className="text-[10px] font-bold text-purple-400 uppercase">Lab Observations</span>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <p className="text-xs font-mono text-white/70 leading-relaxed">
                                    {isAnalyzing ? "Analyzing harmonic structure..." : aiContextDescription}
                                </p>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-purple-600 hover:bg-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                            disabled={!file || isAnalyzing || isSaving}
                            onClick={handleSaveAnalysis}
                            data-testid="save-analysis-button"
                        >
                            <Save size={14} className="mr-2" />
                            Save Analysis
                        </Button>
                    </div>
                </div>

                {/* Bottom Section: Waveform Console */}
                <div className="h-40 bg-card glass-panel rounded-2xl border border-white/5 flex flex-col relative overflow-hidden shrink-0">
                    {/* Toolbar */}
                    <div className="h-10 border-b border-white/5 flex items-center px-4 justify-between bg-white/5">
                        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                            {selectedRegion && (
                                <span className="text-primary flex items-center gap-1">
                                    <Scissors size={10} />
                                    SELECTION: {formatTime(selectedRegion.start)} - {formatTime(selectedRegion.end)}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedRegion && (
                                <Button size="sm" variant="secondary" className="h-6 text-[10px]" onClick={handleAnalyzeRegion} data-testid="analyze-segment-button">
                                    Analyze Segment DNA
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Waveform Canvas */}
                    <div className="flex-1 relative group bg-black/20">
                        {/* Centered Placeholder if no file */}
                        {!file && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                <span className="text-xs font-mono text-white/20 tracking-[0.2em]">NO SIGNAL</span>
                            </div>
                        )}

                        {/* Actual Waveform Container */}
                        <div ref={waveformContainerRef} className="w-full h-full" />
                    </div>

                    {/* Transport Bottom Bar */}
                    <div className="h-12 border-t border-white/5 flex items-center justify-center gap-6 bg-black/20">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full hover:bg-white/10 text-muted-foreground"
                            onClick={() => {
                                if (wavesurferRef.current) wavesurferRef.current.stop();
                                setIsPlaying(false);
                            }}
                            data-testid="stop-button"
                        >
                            <RotateCcw size={16} />
                        </Button>

                        <Button
                            size="icon"
                            className={cn(
                                "rounded-full w-10 h-10 shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:scale-105 transition-transform",
                                isPlaying ? "bg-primary text-black" : "bg-white/10 hover:bg-white/20"
                            )}
                            onClick={togglePlay}
                            disabled={!file}
                            data-testid="play-pause-button"
                        >
                            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                        </Button>

                        {/* Volume Slider */}
                        <div className="absolute right-6 flex items-center gap-3 w-32">
                            <Volume2 size={14} className="text-muted-foreground" />
                            <Slider
                                defaultValue={[75]}
                                max={100}
                                step={1}
                                onValueChange={(vals) => {
                                    if (wavesurferRef.current) wavesurferRef.current.setVolume(vals[0] / 100);
                                }}
                                className="flex-1"
                                data-testid="volume-slider"
                            />
                        </div>
                    </div>
                </div>

            </div>
        </ModuleDashboard>
    );
};

export default AudioAnalyzer;
