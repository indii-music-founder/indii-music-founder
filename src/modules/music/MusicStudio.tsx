import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import * as Tone from 'tone';
import { Play, Pause, Activity, Music, FolderOpen, FileAudio, HardDrive, Trash2, Upload, Volume2, SkipBack, SkipForward, Info, BarChart } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { Activity, File, FileAudio, Folder, HardDrive, Music, Pause, Play, SkipBack, SkipForward, Trash2, Upload, Volume2 } from 'lucide-react';
import { ModuleDashboard } from '@/components/layout/ModuleDashboard';
import { useToast } from '@/core/context/ToastContext';
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

export default function MusicStudio() {
    // Services & State
    const [fsSupported] = useState(() => fileSystemService.isSupported());
    const [loadedAudio, setLoadedAudio] = useState<LoadedAudio[]>([]);
    const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
    const [savedLibraries] = useState<SavedLibrary[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [engineState, setEngineState] = useState<'idle' | 'starting' | 'running'>('idle');
    const [sampleRate, setSampleRate] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [engineState, setEngineState] = useState<'stopped' | 'running'>('stopped');
    const [sampleRate, setSampleRate] = useState<number | null>(null);
    const [lookAhead, setLookAhead] = useState<number | null>(null);

    // Refs
    const waveformRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const toast = useToast();

    // Init
    useEffect(() => {
        setFsSupported(fileSystemService.isSupported());

        return () => {
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
            }
        };
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

    const handleStartEngine = async () => {
        if (engineState === 'running') return;
        setEngineState('starting');

        try {
            await Tone.start();
            setSampleRate(Tone.context?.sampleRate ?? null);
            setEngineState('running');
            toast.success('Audio engine started');
        } catch (error) {
            console.error('Failed to start audio engine', error);
            setEngineState('idle');
            toast.error('Failed to start audio engine');
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
        const result = await fileSystemService.pickAudioFile();
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
                isGenerated: false
            };

            setLoadedAudio(prev => [...prev, newTrack]);
            setCurrentTrackId(newTrack.id);
            toast.success(`Loaded: ${result.file.name}`);

            setIsAnalyzing(true);
            try {
                const features = await audioAnalysisService.analyze(result.file);
                setLoadedAudio(prev => prev.map(t =>
                    t.id === newTrack.id ? { ...t, features } : t
                ));
                toast.success('Analysis Complete');
            } catch (err) {
                console.error('Analysis failed:', err);
                toast.error('Deep analysis failed, basic playback only.');
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    const handlePickDirectory = async () => {
        const directoryHandle = await fileSystemService.pickDirectory();
        if (!directoryHandle) return;

        const files = await fileSystemService.getAudioFilesFromDirectory(directoryHandle);
        if (files.length === 0) {
            toast.info('No audio files found in that folder');
            return;
        }

        const tracks: LoadedAudio[] = files.map(({ file, path }) => ({
            id: `${Date.now()}-${path}`,
            name: file.name,
            path,
            file,
            url: URL.createObjectURL(file),
            features: null,
        }));

        setLoadedAudio(prev => [...prev, ...tracks]);
        setCurrentTrackId(tracks[0].id);
        await fileSystemService.saveDirectoryHandle('music-library', directoryHandle);
        toast.success(`Loaded ${tracks.length} track(s) from folder`);
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

    const handlePickDirectory = async () => {
        if (!fsSupported) return;

        const directory = await fileSystemService.pickDirectory();
        if (!directory) return;

        const files = await fileSystemService.getAudioFilesFromDirectory(directory);
        if (files.length === 0) {
            toast.info('No audio files found in the selected folder');
            return;
        }

        const tracks: LoadedAudio[] = files.map(({ file, path }) => ({
            id: crypto.randomUUID(),
            name: file.name,
            path,
            file,
            url: URL.createObjectURL(file),
            features: null,
            isGenerated: false
        }));

        setLoadedAudio(prev => [...prev, ...tracks]);
        if (!currentTrackId && tracks[0]) {
            setCurrentTrackId(tracks[0].id);
        }

        toast.success(`${tracks.length} file(s) added from folder`);
    };

    const activeTrack = loadedAudio.find(t => t.id === currentTrackId);

    return (
        <ModuleDashboard
            title="Music Studio"
            description="Audio Analysis & Management"
            icon={<Music className="text-purple-500" />}
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
                {/* Local library controls */}
                <div className="lg:col-span-4 bg-[#161b22] border border-gray-800 rounded-xl p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                            <HardDrive size={14} /> Local Music Library
                        </h3>
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Info size={10} /> Local-only workspace
                        </span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handlePickFile}
                            disabled={!fsSupported}
                            className={`flex-1 px-3 py-2 bg-[#21262d] text-gray-200 text-xs rounded-lg transition-colors flex items-center justify-center gap-2 border ${fsSupported ? 'border-gray-700 hover:bg-[#30363d]' : 'border-gray-800 opacity-60 cursor-not-allowed'}`}
                        >
                            <Upload size={14} /> File
                        </button>
                        <button
                            onClick={handlePickDirectory}
                            disabled={!fsSupported}
                            className={`flex-1 px-3 py-2 bg-[#21262d] text-gray-200 text-xs rounded-lg transition-colors flex items-center justify-center gap-2 border ${fsSupported ? 'border-gray-700 hover:bg-[#30363d]' : 'border-gray-800 opacity-60 cursor-not-allowed'}`}
                        >
                            <FolderOpen size={14} /> Folder
                        </button>
                    </div>

                    {!fsSupported && (
                        <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/40 rounded-lg p-3">
                            File System Access API not supported in this browser.
                        </div>
                    )}

                    <div className="space-y-3">
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Browse files or a folder to keep your stems and mixes local. We never upload the audio; analysis runs entirely in-browser.
                        </p>
                        {savedLibraries.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-[11px] text-gray-500 uppercase tracking-widest">Saved Folders</div>
                                <div className="flex flex-wrap gap-2">
                                    {savedLibraries.map(lib => (
                                        <span key={lib.id} className="px-2 py-1 bg-[#0d1117] border border-gray-800 rounded text-[11px] text-gray-300">{lib.name}</span>
                                    ))}
                                </div>
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
                    </div>
                </div>

                {/* Loaded tracks and waveform */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                                <FileAudio size={14} /> Loaded Tracks
                            </h3>
                            <span className="text-[11px] text-gray-500">{loadedAudio.length} files</span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {loadedAudio.length === 0 && (
                                <div className="text-center py-8 text-gray-500 text-xs italic" role="status">
                                    No audio loaded
                                </div>
                            )}
                            {loadedAudio.map(track => (
                                <div
                                    key={track.id}
                                    onClick={() => setCurrentTrackId(track.id)}
                                    className={`group p-3 rounded-lg border cursor-pointer transition-all ${currentTrackId === track.id
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

                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 flex flex-col justify-center relative overflow-hidden">
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
                                <div className="absolute top-4 left-6 right-6 flex justify-between items-center z-10">
                                    <div className="flex flex-col">
                                        <h2 className="text-lg font-bold text-white truncate max-w-[500px]">{activeTrack.name}</h2>
                                        <span className="text-xs text-green-400 flex items-center gap-1 mt-1">
                                            <Activity size={10} /> High-Fidelity Analysis Active
                                        </span>
                                    </div>
                                    {isAnalyzing && (
                                        <div className="flex items-center gap-2 text-xs text-purple-400 animate-pulse">
                                            Analyzing Structure...
                                        </div>
                                    )}
                                </div>

                                <div id="waveform" ref={waveformRef} className="w-full my-auto" />

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

                {/* Engine status */}
                <div className="lg:col-span-3 bg-[#161b22] border border-gray-800 rounded-xl p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                            <BarChart size={14} /> Audio Engine
                        </h3>
                        <span className={`text-[10px] px-2 py-1 rounded-full ${engineState === 'running' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                            {engineState === 'running' ? 'Live' : 'Idle'}
                        </span>
                    </div>

                    <div className="space-y-2 text-xs text-gray-400">
                        <p>Low-latency engine for playback, metering, and MIDI preview.</p>
                        <p className="text-[11px] text-gray-500">Files stay on your device — no uploads.</p>
                    </div>

                    <button
                        onClick={handleStartEngine}
                        disabled={engineState === 'starting'}
                        className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${engineState === 'running'
                                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                : 'bg-purple-600/80 hover:bg-purple-600 text-white border border-purple-500/60'}`}
                    >
                        {engineState === 'running' ? 'Engine Running' : engineState === 'starting' ? 'Starting...' : 'Start Engine'}
                    </button>

                    <div className="space-y-2 text-sm text-gray-200">
                        <div className="flex justify-between">
                            <span className="text-gray-400">State</span>
                            <span className={engineState === 'running' ? 'text-green-300' : 'text-gray-200'}>{engineState === 'running' ? 'Running' : 'Idle'}</span>
                        </div>
                        <div className="flex justify-between"><span className="text-gray-400">Sample Rate</span><span>{sampleRate ? `${sampleRate} Hz` : 'Pending'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Lookahead</span><span>{Tone.context?.lookAhead ?? 0}s</span></div>
                    </div>
                </div>
            </div>
        </ModuleDashboard>
    );
}
