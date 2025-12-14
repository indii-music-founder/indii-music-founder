import React, { useState, useEffect, useRef, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Activity, Music, FolderOpen, FileAudio, HardDrive, Trash2, Upload, Volume2, SkipBack, SkipForward, Info, BarChart } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { ModuleDashboard } from '@/components/layout/ModuleDashboard';
import { fileSystemService } from '@/services/FileSystemService';
import { audioAnalysisService, AudioFeatures } from '@/services/audio/AudioAnalysisService';

interface LoadedAudio {
    id: string;
    name: string;
    path?: string;
    file?: File;
    blob?: Blob;
    url: string;
    features?: AudioFeatures | null;
    isGenerated?: boolean;
}

interface SavedLibrary {
    id: string;
    name: string;
}

export default function MusicStudio() {
    // Services & State
    const [fsSupported, setFsSupported] = useState(false);
    const [loadedAudio, setLoadedAudio] = useState<LoadedAudio[]>([]);
    const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
    const [savedLibraries, setSavedLibraries] = useState<SavedLibrary[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Refs
    const waveformRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const toast = useToast();

    // Init
    useEffect(() => {
        setFsSupported(fileSystemService.isSupported());
        loadSavedLibraries();

        return () => {
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
            }
        };
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

    const loadSavedLibraries = async () => {
        try {
            const libs = await fileSystemService.listSavedHandles();
            setSavedLibraries(libs.filter(l => l.kind === 'directory'));
        } catch (err) {
            console.error('Failed to load saved libraries:', err);
        }
    };

    const handlePickFile = async () => {
        const result = await fileSystemService.pickAudioFile();
        if (result) {
            const url = URL.createObjectURL(result.file);
            // @ts-ignore
            const path = result.file.path;

            const newTrack: LoadedAudio = {
                id: Date.now().toString(),
                name: result.file.name,
                file: result.file,
                path,
                url,
                features: null,
                isGenerated: false
            };

            setLoadedAudio(prev => [...prev, newTrack]);
            setCurrentTrackId(newTrack.id);
            toast.success(`Loaded: ${result.file.name}`);

            // Perform Deep Analysis
            setIsAnalyzing(true);
            try {
                // We use the file purely client-side here to analyze
                const features = await audioAnalysisService.analyze(result.file);
                setLoadedAudio(prev => prev.map(t =>
                    t.id === newTrack.id ? { ...t, features } : t
                ));
                toast.success('Analysis Complete');
            } catch (err) {
                console.error("Analysis failed:", err);
                toast.error("Deep analysis failed, basic playback only.");
            } finally {
                setIsAnalyzing(false);
            }
        }
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

    const activeTrack = loadedAudio.find(t => t.id === currentTrackId);

    return (
        <ModuleDashboard
            title="Music Studio"
            description="Audio Analysis & Management"
            icon={<Music className="text-purple-500" />}
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)]">

                {/* Left Drawer: Library (3 cols) */}
                <div className="lg:col-span-3 bg-[#161b22] border border-gray-800 rounded-xl p-4 flex flex-col h-full">
                    <h3 className="text-sm font-semibold mb-4 text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <HardDrive size={14} /> Library
                    </h3>

                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={handlePickFile}
                            className="flex-1 px-3 py-2 bg-[#21262d] hover:bg-[#30363d] text-gray-200 text-xs rounded-lg transition-colors flex items-center justify-center gap-2 border border-gray-700"
                        >
                            <Upload size={14} /> Open File
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {loadedAudio.length === 0 && (
                            <div className="text-center py-8 text-gray-500 text-xs italic">
                                No tracks loaded
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
                    {/* Visualizer Area */}
                    <div className="flex-1 bg-[#161b22] border border-gray-800 rounded-xl p-6 flex flex-col justify-center relative overflow-hidden">
                        {!activeTrack ? (
                            <div className="text-center text-gray-600">
                                <Activity size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-sm">Select a track to view waveform</p>
                            </div>
                        ) : (
                            <>
                                <div className="absolute top-4 left-6 right-6 flex justify-between items-center z-10">
                                    <div className="flex flex-col">
                                        <h2 className="text-lg font-bold text-white truncate max-w-[500px]">{activeTrack.name}</h2>
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
                            <button className="text-gray-500 hover:text-white transition-colors">
                                <SkipBack size={20} />
                            </button>
                            <button
                                onClick={togglePlayPause}
                                disabled={!activeTrack}
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${activeTrack
                                        ? 'bg-white text-black hover:scale-105 active:scale-95'
                                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                            </button>
                            <button className="text-gray-500 hover:text-white transition-colors">
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

            </div>
        </ModuleDashboard>
    );
}
