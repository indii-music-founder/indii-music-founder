import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Play, Activity, Music, FolderOpen, FileAudio, HardDrive, Trash2, Upload } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { ModuleDashboard } from '@/components/layout/ModuleDashboard';
import { fileSystemService } from '@/services/FileSystemService';

interface LoadedAudio {
    name: string;
    path?: string;
    file: File;
    url: string;
    metadata?: any;
    isAnalyzing?: boolean;
}

interface SavedLibrary {
    id: string;
    name: string;
}

export default function MusicStudio() {
    // ... existing imports and state ...
    const [isStarted, setIsStarted] = useState(false);
    const [fsSupported, setFsSupported] = useState(false);
    const [loadedAudio, setLoadedAudio] = useState<LoadedAudio[]>([]);
    const [savedLibraries, setSavedLibraries] = useState<SavedLibrary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const synthRef = useRef<Tone.Synth | null>(null);
    const playerRef = useRef<Tone.Player | null>(null);
    const toast = useToast();

    // ... existing useEffect ...

    // ... existing loadSavedLibraries ...

    // ... existing startAudioEngine ...

    const analyzeAudioFile = async (file: File): Promise<any> => {
        if (window.electronAPI?.audio && 'path' in file) {
            try {
                // @ts-ignore - Electron File object has path property
                const path = file.path;
                console.log("Analyzing local file:", path);
                return await window.electronAPI.audio.analyze(path);
            } catch (err) {
                console.error("Analysis failed:", err);
                return null;
            }
        }
        return null;
    };

    const handlePickFile = async () => {
        const result = await fileSystemService.pickAudioFile();
        if (result) {
            const url = URL.createObjectURL(result.file);
            // @ts-ignore
            const path = result.file.path;

            const newAudio: LoadedAudio = {
                name: result.file.name,
                file: result.file,
                path,
                url,
                isAnalyzing: true
            };

            setLoadedAudio(prev => [...prev, newAudio]);
            toast.success(`Loaded: ${result.file.name}`);

            // Perform analysis
            analyzeAudioFile(result.file).then(async (analysisResult) => {
                let metadata = analysisResult?.metadata;
                let cloudData = null;

                if (analysisResult?.hash) {
                    // Check cloud for existing data
                    try {
                        cloudData = await window.electronAPI!.audio.getMetadata(analysisResult.hash);
                        if (cloudData) {
                            console.log("Cloud metadata found:", cloudData);
                            toast.success(`Found existing cloud data: ${cloudData.title}`);
                        } else {
                            console.log("No cloud data found. New track.");
                        }
                    } catch (e) {
                        console.error("Cloud lookup failed:", e);
                    }
                }

                setLoadedAudio(prev => prev.map(a =>
                    a.url === url ? {
                        ...a,
                        metadata: { ...metadata, cloud: cloudData },
                        isAnalyzing: false
                    } : a
                ));

                const statusMsg = cloudData ? `Recognized: ${cloudData.title}` : `Analyzed ${result.file.name}`;
                if (metadata) toast.success(statusMsg);
            });
        }
    };

    const handlePickDirectory = async () => {
        setIsLoading(true);
        try {
            const dirHandle = await fileSystemService.pickDirectory();
            if (dirHandle) {
                const libraryId = `library-${Date.now()}`;
                await fileSystemService.saveDirectoryHandle(libraryId, dirHandle);
                await loadSavedLibraries();

                const files = await fileSystemService.getAudioFilesFromDirectory(dirHandle);
                const newAudio = files.map(f => ({
                    name: f.file.name,
                    path: f.path,
                    file: f.file,
                    url: URL.createObjectURL(f.file),
                }));
                setLoadedAudio(prev => [...prev, ...newAudio]);
                toast.success(`Loaded ${files.length} audio files from ${dirHandle.name}`);
            }
        } catch (err) {
            console.error('Failed to load directory:', err);
            toast.error('Failed to load music library');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadSavedLibrary = async (id: string) => {
        setIsLoading(true);
        try {
            const dirHandle = await fileSystemService.getSavedDirectoryHandle(id);
            if (dirHandle) {
                const files = await fileSystemService.getAudioFilesFromDirectory(dirHandle);
                const newAudio = files.map(f => ({
                    name: f.file.name,
                    path: f.path,
                    file: f.file,
                    url: URL.createObjectURL(f.file),
                }));
                setLoadedAudio(prev => [...prev, ...newAudio]);
                toast.success(`Loaded ${files.length} files from ${dirHandle.name}`);
            } else {
                toast.error('Permission denied or library not found');
            }
        } catch (err) {
            console.error('Failed to load library:', err);
            toast.error('Failed to access saved library');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveLibrary = async (id: string) => {
        await fileSystemService.removeSavedHandle(id);
        await loadSavedLibraries();
        toast.success('Library removed');
    };

    const handlePlayAudio = async (audio: LoadedAudio) => {
        if (!isStarted) {
            await startAudioEngine();
        }
        if (playerRef.current) {
            playerRef.current.stop();
            playerRef.current.dispose();
        }
        playerRef.current = new Tone.Player(audio.url).toDestination();
        await playerRef.current.load(audio.url);
        playerRef.current.start();
        toast.success(`Playing: ${audio.name}`);
    };

    const handleRemoveAudio = (index: number) => {
        setLoadedAudio(prev => {
            const audio = prev[index];
            URL.revokeObjectURL(audio.url);
            return prev.filter((_, i) => i !== index);
        });
    };

    return (
        <ModuleDashboard
            title="Music Studio"
            description="Create and synthesize audio with Tone.js"
            icon={<Music className="text-purple-500" />}
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - File Access */}
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <HardDrive size={18} className="text-purple-400" />
                        Local Music Library
                    </h3>

                    {!fsSupported ? (
                        <div className="p-4 bg-yellow-900/20 border border-yellow-800/50 rounded-lg">
                            <p className="text-sm text-yellow-200">
                                File System Access API not supported. Use Chrome or Edge for local file access.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <button
                                    onClick={handlePickFile}
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Upload size={16} /> File
                                </button>
                                <button
                                    onClick={handlePickDirectory}
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <FolderOpen size={16} /> Folder
                                </button>
                            </div>

                            {savedLibraries.length > 0 && (
                                <div className="border-t border-gray-800 pt-4">
                                    <p className="text-xs text-gray-500 mb-2">Saved Libraries</p>
                                    {savedLibraries.map(lib => (
                                        <div key={lib.id} className="flex items-center justify-between p-2 bg-[#0d1117] rounded border border-gray-800 mb-2">
                                            <button
                                                onClick={() => handleLoadSavedLibrary(lib.id)}
                                                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white"
                                            >
                                                <FolderOpen size={14} /> {lib.name}
                                            </button>
                                            <button
                                                onClick={() => handleRemoveLibrary(lib.id)}
                                                className="text-gray-500 hover:text-red-400"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="p-3 bg-green-900/20 border border-green-800/50 rounded-lg">
                                <p className="text-xs text-green-200">
                                    <strong>Privacy:</strong> Files stay on your device. Nothing is uploaded.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Middle Column - Loaded Audio */}
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <FileAudio size={18} className="text-blue-400" />
                        Loaded Tracks ({loadedAudio.length})
                    </h3>

                    {loadedAudio.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                            <FileAudio size={32} className="mb-2 opacity-50" />
                            <p className="text-sm">No audio loaded</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {loadedAudio.map((audio, idx) => (
                                <div key={idx} className="flex items-center gap-2 p-2 bg-[#0d1117] rounded border border-gray-800 group">
                                    <button
                                        onClick={() => handlePlayAudio(audio)}
                                        className="p-1 bg-green-600 hover:bg-green-500 rounded"
                                    >
                                        <Play size={12} />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm truncate">{audio.name}</p>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            {audio.isAnalyzing && <span className="text-yellow-500 animate-pulse">Analyzing...</span>}
                                            {audio.metadata && (
                                                <>
                                                    <span className="text-blue-400">{audio.metadata.format_name || 'Format'}</span>
                                                    <span>•</span>
                                                    <span>{(audio.metadata.duration / 60).toFixed(2)}m</span>
                                                    <span>•</span>
                                                    <span>{Math.round(audio.metadata.bit_rate / 1000)}kbps</span>
                                                    {audio.metadata.cloud && (
                                                        <span className="ml-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px] border border-blue-500/30">
                                                            CLOUD MATCH
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveAudio(idx)}
                                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Column - Status */}
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Activity size={18} className="text-green-400" />
                        Audio Engine
                    </h3>

                    {!isStarted ? (
                        <div className="flex flex-col items-center justify-center h-48">
                            <Activity size={32} className="text-gray-600 mb-4" />
                            <p className="text-gray-400 text-sm mb-4 text-center">Click to enable audio playback</p>
                            <button
                                onClick={startAudioEngine}
                                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Play size={16} /> Start Engine
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-2 bg-[#0d1117] rounded border border-gray-800">
                                <span className="text-gray-400 text-sm">State</span>
                                <span className="text-green-400 font-mono text-sm">Running</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-[#0d1117] rounded border border-gray-800">
                                <span className="text-gray-400 text-sm">Sample Rate</span>
                                <span className="text-blue-400 font-mono text-sm">{Tone.context.sampleRate} Hz</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-[#0d1117] rounded border border-gray-800">
                                <span className="text-gray-400 text-sm">Look Ahead</span>
                                <span className="text-purple-400 font-mono text-sm">{Tone.context.lookAhead.toFixed(2)} s</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ModuleDashboard>
    );
}
