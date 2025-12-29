import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import * as Tone from 'tone';
import { Activity, File, FileAudio, Folder, HardDrive, Music, Pause, Play, SkipBack, SkipForward, Trash2, Upload, Volume2, ShieldCheck, Download } from 'lucide-react';
import { ModuleDashboard } from '@/components/layout/ModuleDashboard';
import { useToast } from '@/core/context/ToastContext';
import { nativeFileSystemService } from '@/services/NativeFileSystemService';
import { audioAnalysisService, AudioFeatures } from '@/services/audio/AudioAnalysisService';
import { fingerprintService } from '@/services/audio/FingerprintService';
import { MetadataDrawer } from './components/MetadataDrawer';
import { GoldenMetadata, INITIAL_METADATA } from '@/services/metadata/types';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

interface LoadedAudio {
    id: string;
    name: string;
    path?: string;
    file?: File;
    blob?: Blob;
    url: string;
    features?: AudioFeatures | null;
    isGenerated?: boolean;
    metadata: GoldenMetadata;
}

export default function MusicStudio() {
    // Services & State
    const [fsSupported] = useState(() => nativeFileSystemService.isSupported());
    const [loadedAudio, setLoadedAudio] = useState<LoadedAudio[]>([]);
    const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [engineState, setEngineState] = useState<'stopped' | 'running'>('stopped');
    const [sampleRate, setSampleRate] = useState<number | null>(null);
    const [lookAhead, setLookAhead] = useState<number | null>(null);
    const [isMetadataDrawerOpen, setIsMetadataDrawerOpen] = useState(false);

    // Refs
    const waveformRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const toast = useToast();

    // Cleanup on unmount
    useEffect(() => () => {
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
        }
    }, []);

    // WaveSurfer Setup when track changes
    useEffect(() => {
        if (!currentTrackId || !waveformRef.current) return;

        const track = loadedAudio.find(t => t.id === currentTrackId);
        if (!track) return;

        // Destroy old instance if exists
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
        }

        // Create new instance
        const ws = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: '#4b5563',
            progressColor: '#8b5cf6',
            cursorColor: '#c4b5fd',
            barWidth: 2,
            barGap: 3,
            height: 128,
            normalize: true,
        });

        ws.load(track.url);

        ws.on('ready', () => {
            setIsPlaying(false);
        });

        ws.on('finish', () => {
            setIsPlaying(false);
        });

        ws.on('interaction', () => {
            ws.play();
            setIsPlaying(true);
        });

        wavesurferRef.current = ws;

        return () => {
            ws.destroy();
        };
    }, [currentTrackId]);

    const togglePlayPause = () => {
        if (wavesurferRef.current) {
            wavesurferRef.current.playPause();
            setIsPlaying(wavesurferRef.current.isPlaying());
        }
    };

    const startEngine = async () => {
        try {
            await Tone.start();
            setEngineState('running');
            setSampleRate(Math.round(Tone.context.sampleRate));
            setLookAhead((Tone.context.lookAhead ?? null) as number | null);
        } catch (error) {
            console.error('Failed to start engine', error);
            toast.error('Unable to start audio engine');
        }
    };

    const handlePickFile = async () => {
        const result = await nativeFileSystemService.pickAudioFile();
        if (result) {
            const url = URL.createObjectURL(result.file);
            // @ts-expect-error File.path is provided by Electron's file picker
            const path = result.file.path;

            const newTrack: LoadedAudio = {
                id: Date.now().toString(),
                name: result.file.name,
                file: result.file,
                path,
                url,
                features: null,
                isGenerated: false,
                metadata: { ...INITIAL_METADATA, trackTitle: result.file.name.replace(/\.[^/.]+$/, "") }
            };

            setLoadedAudio(prev => [...prev, newTrack]);
            setCurrentTrackId(newTrack.id);
            toast.success(`Loaded: ${result.file.name}`);

            setIsAnalyzing(true);
            try {
                // 1. Analyze Features
                const features = await audioAnalysisService.analyze(result.file);

                // 2. Generate Fingerprint (using features)
                const fingerprint = await fingerprintService.generateFingerprint(result.file, features);

                setLoadedAudio(prev => prev.map(t =>
                    t.id === newTrack.id ? {
                        ...t,
                        features,
                        metadata: { ...t.metadata, masterFingerprint: fingerprint }
                    } : t
                ));
                toast.success('Sonic Analysis Complete');
            } catch (err) {
                console.error('Analysis failed:', err);
                toast.error('Deep analysis failed, basic playback only.');
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    const handlePickDirectory = async () => {
        const directoryHandle = await nativeFileSystemService.pickDirectory();
        if (!directoryHandle) return;

        const files = await nativeFileSystemService.getAudioFilesFromDirectory(directoryHandle);
        if (files.length === 0) {
            toast.info('No audio files found in that folder');
            return;
        }

        // Create tracks initially
        const tracks: LoadedAudio[] = files.map(({ file, path }) => ({
            id: `${Date.now()}-${path}`,
            name: file.name,
            path,
            file,
            url: URL.createObjectURL(file),
            features: null,
            metadata: { ...INITIAL_METADATA, trackTitle: file.name.replace(/\.[^/.]+$/, "") }
        }));

        setLoadedAudio(prev => [...prev, ...tracks]);
        setCurrentTrackId(tracks[0].id);

        // Asynchronously fingerprint/analyze all loaded tracks
        // We do this one by one to avoid UI freeze, or parallel if worker supported.
        // For prototype, let's do simple loop with promises but don't block UI
        const batchToastId = toast.loading(`Analyzing ${tracks.length} tracks...`);

        (async () => {
            for (const track of tracks) {
                if (!track.file) continue;
                try {
                    const features = await audioAnalysisService.analyze(track.file);
                    const fingerprint = await fingerprintService.generateFingerprint(track.file, features);

                    setLoadedAudio(prev => prev.map(t =>
                        t.id === track.id ? {
                            ...t,
                            features,
                            metadata: { ...t.metadata, masterFingerprint: fingerprint }
                        } : t
                    ));
                } catch (e) {
                    console.error('Batch analysis failed for', track.name);
                }
            }
            toast.dismiss(batchToastId);
            toast.success("Batch Analysis Complete");
        })();

        await nativeFileSystemService.saveDirectoryHandle('music-library', directoryHandle);
    };

    const handleRemoveTrack = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setLoadedAudio(prev => {
            const track = prev.find(t => t.id === id);
            if (track) URL.revokeObjectURL(track.url);
            return prev.filter(t => t.id !== id);
        });
        if (currentTrackId === id) setCurrentTrackId(null);
    };

    // Metadata Update Handler
    const handleMetadataUpdate = (newData: GoldenMetadata) => {
        if (!currentTrackId) return;
        setLoadedAudio(prev => prev.map(t =>
            t.id === currentTrackId ? { ...t, metadata: newData } : t
        ));
    };

    const activeTrack = loadedAudio.find(t => t.id === currentTrackId);

    return (
        <ModuleDashboard
            title="Music Analysis"
            description="Audio Analysis & Management"
            icon={<Music className="text-purple-500" />}
        >
            <ModuleErrorBoundary moduleName="Music Studio">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)]">

                    {/* Left Drawer: Library (3 cols) */}
                    <div className="lg:col-span-3 bg-[#161b22] border border-gray-800 rounded-xl p-4 flex flex-col h-full space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <HardDrive size={16} className="text-purple-400" />
                                    <h3 className="text-sm font-semibold text-gray-200">Local Music Library</h3>
                                </div>
                                <span className="text-[10px] uppercase text-gray-500">{fsSupported ? 'Online' : 'Unavailable'}</span>
                            </div>
                            {fsSupported ? (
                                <div className="flex gap-2 mb-2">
                                    <button
                                        onClick={handlePickFile}
                                        className="flex-1 px-3 py-2 bg-[#21262d] hover:bg-[#30363d] text-gray-200 text-xs rounded-lg transition-colors flex items-center justify-center gap-2 border border-gray-700"
                                    >
                                        <File size={14} /> File
                                    </button>
                                    <button
                                        onClick={handlePickDirectory}
                                        className="flex-1 px-3 py-2 bg-[#21262d] hover:bg-[#30363d] text-gray-200 text-xs rounded-lg transition-colors flex items-center justify-center gap-2 border border-gray-700"
                                    >
                                        <Folder size={14} /> Folder
                                    </button>
                                </div>
                            ) : (
                                <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/40 rounded-md p-3">
                                    File System Access API not supported
                                </div>
                            )}
                            <p className="text-[11px] text-gray-500">Files stay on your device. We never upload your stems.</p>
                        </div>

                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <Upload size={12} /> Loaded Tracks
                            </h4>
                            <span className="text-[11px] text-gray-500">{loadedAudio.length} loaded</span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {loadedAudio.length === 0 && (
                                <div className="text-center py-8 text-gray-500 text-xs italic">
                                    No audio loaded
                                </div>
                            )}
                            {loadedAudio.map(track => (
                                <div
                                    key={track.id}
                                    onClick={() => setCurrentTrackId(track.id)}
                                    className={`group p-2 rounded-lg border cursor-pointer transition-all ${currentTrackId === track.id
                                        ? 'bg-purple-900/30 border-purple-500/50'
                                        : 'bg-[#0d1117] border-gray-800 hover:border-gray-600'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileAudio size={12} className="text-blue-400 flex-shrink-0" />
                                            <span className={`text-xs font-medium truncate ${currentTrackId === track.id ? 'text-purple-200' : 'text-gray-300'}`}>
                                                {track.name}
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => handleRemoveTrack(e, track.id)}
                                            className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    {track.features && (
                                        <div className="flex gap-2 mt-1 px-1">
                                            <span className="text-[10px] bg-gray-800/50 px-1 rounded text-gray-400">{track.features.bpm} BPM</span>
                                            <span className="text-[10px] bg-gray-800/50 px-1 rounded text-gray-400">{track.features.key} {track.features.scale}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Center: Visualizer & Analysis (9 cols) */}
                    <div className="lg:col-span-9 flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-gray-200 flex items-center gap-2"><Music size={14} /> Audio Engine</span>
                                    <span className={`text-[11px] ${engineState === 'running' ? 'text-green-400' : 'text-gray-500'}`}>{engineState === 'running' ? 'Active' : 'Idle'}</span>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">Start the embedded Tone.js engine to enable synthesis and playback.</p>
                                <button
                                    onClick={startEngine}
                                    className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm"
                                >
                                    {engineState === 'running' ? 'Engine Running' : 'Start Engine'}
                                </button>
                                <div className="mt-3 text-xs text-gray-400 space-y-1">
                                    <div className="flex justify-between"><span>State</span><span>{engineState === 'running' ? 'Running' : 'Stopped'}</span></div>
                                    <div className="flex justify-between"><span>Sample Rate</span><span>{sampleRate ? `${sampleRate} Hz` : 'Not started'}</span></div>
                                    <div className="flex justify-between"><span>Look Ahead</span><span>{lookAhead != null ? `${lookAhead}s` : 'Not started'}</span></div>
                                </div>
                            </div>
                            <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4">
                                <span className="text-sm font-semibold text-gray-200 flex items-center gap-2"><Activity size={14} /> Track Insights</span>
                                <p className="text-xs text-gray-500 mt-2">{loadedAudio.length ? 'Select a track to view metrics.' : 'No audio loaded yet.'}</p>
                            </div>
                            <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4">
                                <span className="text-sm font-semibold text-gray-200 flex items-center gap-2"><Volume2 size={14} /> Playback</span>
                                <p className="text-xs text-gray-500 mt-2">Waveform playback uses WaveSurfer for visual monitoring.</p>
                            </div>
                        </div>

                        {/* Visualizer Area */}
                        <div className="flex-1 bg-[#161b22] border border-gray-800 rounded-xl p-6 flex flex-col justify-center relative overflow-hidden">
                            {!activeTrack ? (
                                <div className="text-center text-gray-600">
                                    <Activity size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-sm">Select a track to view waveform</p>
                                </div>
                            ) : (
                                <>
                                    <MetadataDrawer
                                        isOpen={isMetadataDrawerOpen}
                                        onClose={() => setIsMetadataDrawerOpen(false)}
                                        metadata={activeTrack.metadata}
                                        onUpdate={handleMetadataUpdate}
                                    />

                                    {/* Top Bar: Title & Metadata Status */}
                                    <div className="absolute top-4 left-6 right-6 flex justify-between items-center z-10">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-lg font-bold text-white truncate max-w-[500px]">{activeTrack.metadata.trackTitle || activeTrack.name}</h2>
                                                <button
                                                    onClick={() => setIsMetadataDrawerOpen(true)}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTrack.metadata.isGolden
                                                        ? 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
                                                        : 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
                                                        }`}
                                                >
                                                    <ShieldCheck size={12} />
                                                    {activeTrack.metadata.isGolden ? 'Golden Master' : 'Metadata Incomplete'}
                                                </button>
                                            </div>
                                            <span className="text-xs text-green-400 flex items-center gap-1 mt-1">
                                                <Activity size={10} /> High-Fidelity Analysis Active
                                            </span>
                                        </div>
                                        {isAnalyzing && (
                                            <div className="flex items-center gap-2 text-xs text-purple-400 animate-pulse">
                                                Analyizing Structure...
                                            </div>
                                        )}
                                    </div>

                                    <div id="waveform" ref={waveformRef} className="w-full my-auto" />

                                    {/* Deep Metrics Overlay */}
                                    {activeTrack.features && (
                                        <div className="absolute bottom-4 left-6 flex gap-6">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-500 uppercase tracking-widest">Energy</span>
                                                <span className="text-2xl font-mono text-white">{(activeTrack.features.energy * 100).toFixed(0)}<span className="text-sm text-gray-600">%</span></span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-500 uppercase tracking-widest">BPM</span>
                                                <span className="text-2xl font-mono text-white">{activeTrack.features.bpm}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-500 uppercase tracking-widest">Key</span>
                                                <span className="text-2xl font-mono text-white">{activeTrack.features.key} <span className="text-xs text-gray-400">{activeTrack.features.scale}</span></span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-500 uppercase tracking-widest">Danceability</span>
                                                <span className="text-2xl font-mono text-white">{activeTrack.features.danceability.toFixed(1)}</span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Transport Controls */}
                        <div className="h-24 bg-[#0d1117] border border-gray-800 rounded-xl p-4 flex items-center justify-between px-8">
                            <div className="flex items-center gap-4">
                                <button className="text-gray-500 hover:text-white transition-colors" aria-label="Previous track">
                                    <SkipBack size={20} />
                                </button>
                                <button
                                    onClick={togglePlayPause}
                                    disabled={!activeTrack}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${activeTrack
                                        ? 'bg-white text-black hover:scale-105 active:scale-95'
                                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                        }`}
                                    aria-label={isPlaying ? 'Pause' : 'Play'}
                                >
                                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                                </button>
                                <button className="text-gray-500 hover:text-white transition-colors" aria-label="Next track">
                                    <SkipForward size={20} />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 w-32">
                                <Volume2 size={16} className="text-gray-500" />
                                <div className="h-1 bg-gray-800 rounded-full flex-1 overflow-hidden">
                                    <div className="h-full bg-gray-500 w-2/3" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Export / Action Bar */}
                    <div className="h-14 flex items-center justify-end gap-4">
                        <button
                            disabled={!activeTrack || !activeTrack.metadata.isGolden}
                            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${activeTrack && activeTrack.metadata.isGolden
                                ? 'bg-white text-black hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                                }`}
                        >
                            <Download size={18} />
                            {activeTrack && activeTrack.metadata.isGolden ? 'Export Master' : 'Complete Metadata to Export'}
                        </button>
                    </div>
                </div>
            </ModuleErrorBoundary>
        </ModuleDashboard>
    );
}
