import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import {
    Activity, File, FileAudio, Folder, HardDrive, Music, Pause, Play,
    SkipBack, SkipForward, Trash2, Upload, Volume2, ShieldCheck, Download,
    Zap, Globe, Fingerprint, Search, Menu
} from 'lucide-react';
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
    const [validMetatdataCount, setValidMetadataCount] = useState(0);
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

        // Create new instance - Banana Pro Aesthetic
        const ws = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: '#333', // Dark grey base
            progressColor: '#FFD700', // Electric Yellow
            cursorColor: '#FFFFFF',
            barWidth: 3,
            barGap: 2,
            height: 160,
            normalize: true,
            backend: 'WebAudio',
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

    // Recalculate stats when loadedAudio changes
    useEffect(() => {
        const valid = loadedAudio.filter(t => t.metadata.isGolden).length;
        setValidMetadataCount(valid);
    }, [loadedAudio]);

    const togglePlayPause = () => {
        if (wavesurferRef.current) {
            wavesurferRef.current.playPause();
            setIsPlaying(wavesurferRef.current.isPlaying());
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
    const progress = loadedAudio.length > 0 ? Math.round((validMetatdataCount / loadedAudio.length) * 100) : 0;

    return (
        <ModuleDashboard
            title="Music Analysis"
            description="Deep Sonic Analysis & Fingerprinting"
            icon={<Activity className="text-yellow-400" />}
        // Banana Pro Theme Overrides could go here if ModuleDashboard supports 'em, but we'll style children
        >
            <ModuleErrorBoundary moduleName="Music Studio">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)] font-sans text-gray-200">

                    {/* Left Drawer: Library (3 cols) */}
                    <div className="lg:col-span-3 bg-[#111] border border-gray-800 rounded-2xl p-4 flex flex-col h-full space-y-4 shadow-2xl">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Source Library</h3>
                                <div className={`w-2 h-2 rounded-full ${fsSupported ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`} />
                            </div>

                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={handlePickFile}
                                    className="flex-1 py-3 bg-[#1A1A1A] hover:bg-[#252525] text-gray-300 text-xs font-medium rounded-xl transition-all border border-gray-800 flex flex-col items-center gap-2 group"
                                >
                                    <FileAudio size={18} className="text-yellow-500/50 group-hover:text-yellow-400 transition-colors" />
                                    <span>Import File</span>
                                </button>
                                <button
                                    onClick={handlePickDirectory}
                                    className="flex-1 py-3 bg-[#1A1A1A] hover:bg-[#252525] text-gray-300 text-xs font-medium rounded-xl transition-all border border-gray-800 flex flex-col items-center gap-2 group"
                                >
                                    <Folder size={18} className="text-yellow-500/50 group-hover:text-yellow-400 transition-colors" />
                                    <span>Scan Folder</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] uppercase text-gray-600 font-bold">Queue</span>
                            <span className="text-[10px] text-yellow-500 font-mono">{loadedAudio.length} TRACKS</span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {loadedAudio.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                                    <Music size={32} strokeWidth={1} className="mb-2" />
                                    <p className="text-xs">Library Empty</p>
                                </div>
                            )}
                            {loadedAudio.map(track => (
                                <div
                                    key={track.id}
                                    onClick={() => setCurrentTrackId(track.id)}
                                    className={`group p-3 rounded-xl border cursor-pointer transition-all relative overflow-hidden ${currentTrackId === track.id
                                        ? 'bg-yellow-500/10 border-yellow-500/50'
                                        : 'bg-[#161616] border-gray-800/50 hover:border-gray-600'
                                        }`}
                                >
                                    {/* Active Indicator */}
                                    {currentTrackId === track.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400 shadow-[0_0_10px_#eab308]" />
                                    )}

                                    <div className="flex items-center justify-between mb-1 pl-2">
                                        <span className={`text-sm font-semibold truncate max-w-[140px] ${currentTrackId === track.id ? 'text-white' : 'text-gray-400'}`}>
                                            {track.name}
                                        </span>
                                        {track.metadata.isGolden ? (
                                            <ShieldCheck size={14} className="text-green-400" />
                                        ) : (
                                            <div className="w-2 h-2 rounded-full bg-red-500/50" />
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between pl-2">
                                        <span className="text-[10px] font-mono text-gray-600">
                                            {track.features ? `${track.features.bpm} BPM` : 'PENDING'}
                                        </span>
                                        <Trash2
                                            size={12}
                                            className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => handleRemoveTrack(e, track.id)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Center: Dashboard Main (9 cols) */}
                    <div className="lg:col-span-9 flex flex-col gap-6">

                        {/* Top Cards Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Metadata Health */}
                            <div className="bg-[#111] border border-gray-800 rounded-2xl p-5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <ShieldCheck size={64} className="text-white" />
                                </div>
                                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Metadata Health</h4>
                                <div className="flex items-end gap-2">
                                    <span className="text-4xl font-mono text-white font-light">{progress}%</span>
                                    <span className="text-xs text-yellow-500 mb-2">GOLDEN</span>
                                </div>
                                <div className="w-full h-1 bg-gray-800 rounded-full mt-4 overflow-hidden">
                                    <div
                                        className="h-full bg-yellow-400 shadow-[0_0_10px_#eab308] transition-all duration-500"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>

                            {/* Audio Fingerprint Status */}
                            <div className="bg-[#111] border border-gray-800 rounded-2xl p-5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Fingerprint size={64} className="text-white" />
                                </div>
                                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Acoustic Fingerprint</h4>
                                {activeTrack?.features ? (
                                    <div className="mt-2">
                                        <div className="flex gap-4 mb-2">
                                            <div>
                                                <div className="text-[10px] text-gray-600">KEY</div>
                                                <div className="text-xl text-white font-mono">{activeTrack.features.key}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-gray-600">SCALE</div>
                                                <div className="text-xl text-white font-mono">{activeTrack.features.scale}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded inline-flex">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            Generated
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center text-gray-600 text-xs">
                                        Select track to analyze
                                    </div>
                                )}
                            </div>

                            {/* Territory / Global Rights */}
                            <div className="bg-[#111] border border-gray-800 rounded-2xl p-5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Globe size={64} className="text-white" />
                                </div>
                                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Global Rights</h4>
                                <div className="mt-3 space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-300">Territories</span>
                                        <span className="text-yellow-400 font-mono">WW</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-300">Restrictions</span>
                                        <span className="text-green-400 font-mono">NONE</span>
                                    </div>
                                    <div className="w-full bg-gray-800 h-[1px] my-2" />
                                    <div className="flex items-center gap-2 opacity-50">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        <span className="text-[10px] text-gray-500">Rights ID: {activeTrack ? 'US-X1...' : '--'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Analysis Visualizer */}
                        <div className="flex-1 bg-[#090909] border border-gray-800 rounded-2xl p-1 relative overflow-hidden shadow-inner flex flex-col">
                            {/* Toolbar */}
                            <div className="absolute top-4 right-4 z-20 flex gap-2">
                                <button
                                    onClick={() => setIsMetadataDrawerOpen(true)}
                                    className="p-2 bg-black/40 hover:bg-yellow-500 hover:text-black text-gray-400 backdrop-blur-md rounded-lg border border-gray-700 hover:border-yellow-400 transition-all"
                                >
                                    <Menu size={16} />
                                </button>
                            </div>

                            <div className="flex-1 relative flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900/50 to-transparent">
                                {!activeTrack ? (
                                    <div className="text-center">
                                        <Activity size={48} className="text-gray-800 mx-auto mb-4" />
                                        <p className="text-gray-600 text-sm font-mono">WAITING FOR AUDIO STREAM...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Waveform Container */}
                                        <div id="waveform" ref={waveformRef} className="w-full px-8 relative z-10" />

                                        {/* Overlay Stats */}
                                        <div className="absolute bottom-6 left-8 flex gap-8 z-10">
                                            {activeTrack.features && (
                                                <>
                                                    <div>
                                                        <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Energy</div>
                                                        <div className="h-1 w-16 bg-gray-800 rounded-full overflow-hidden">
                                                            <div className="h-full bg-white" style={{ width: `${activeTrack.features.energy * 100}%` }} />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Dance</div>
                                                        <div className="h-1 w-16 bg-gray-800 rounded-full overflow-hidden">
                                                            <div className="h-full bg-white" style={{ width: `${activeTrack.features.danceability * 100}%` }} />
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Player Bar */}
                            <div className="h-16 bg-[#111] border-t border-gray-800 flex items-center px-6 gap-6 justify-between">
                                <div className="flex items-center gap-4">
                                    <button onClick={togglePlayPause} className="w-10 h-10 rounded-full bg-yellow-400 text-black flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_15px_rgba(250,204,21,0.3)]">
                                        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                                    </button>
                                    <div className="text-xs">
                                        <div className="text-white font-medium max-w-[200px] truncate">{activeTrack?.name || 'No Track'}</div>
                                        <div className="text-gray-500 font-mono text-[10px]">{isAnalyzing ? 'ANALYZING...' : 'READY'}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Zap size={14} className={isPlaying ? "text-yellow-400" : "text-gray-600"} />
                                        <div className="h-8 w-[1px] bg-gray-800" />
                                        <span className="font-mono text-xs text-gray-400">
                                            {activeTrack?.features?.bpm ? `${activeTrack.features.bpm} BPM` : '--'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    <MetadataDrawer
                        isOpen={isMetadataDrawerOpen}
                        onClose={() => setIsMetadataDrawerOpen(false)}
                        metadata={activeTrack?.metadata || INITIAL_METADATA}
                        onUpdate={handleMetadataUpdate}
                    />

                </div>
            </ModuleErrorBoundary>
        </ModuleDashboard>
    );
}
