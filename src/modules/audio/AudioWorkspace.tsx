/**
 * AudioWorkspace - Unified Audio Generation Module
 * 
 * Tabs: Generate (SoundFX/Music/TTS), Library
 * Part of Phase 1: Audio Generation in the master completion plan.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Music, Mic, Wand2, Play, Pause, Download, Loader2,
    Volume2, Hash, Clock, Sparkles, AudioLines,
    RefreshCw, Trash2, Search, Filter, History
} from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import {
    audioGenerationService,
    type AudioGenerationResult,
    type TTSVoicePreset,
    type AudioGenerationType,
    TTS_VOICE_PRESETS,
} from '@/services/audio/AudioGenerationService';
import { type AudioMetadata } from '@/services/audio/AudioPersistenceService';

// ============================================================================
// Types
// ============================================================================

type AudioTab = 'generate' | 'library';
type GenerateMode = 'soundfx' | 'music' | 'tts';

// ============================================================================
// Genre / Mood Presets
// ============================================================================

const GENRE_PRESETS = [
    'Electronic', 'Hip-Hop', 'Lo-Fi', 'Cinematic', 'Ambient',
    'Rock', 'Jazz', 'Classical', 'R&B', 'Pop', 'Trap', 'House',
];

const MOOD_PRESETS = [
    'Energetic', 'Chill', 'Dark', 'Uplifting', 'Melancholy',
    'Aggressive', 'Dreamy', 'Suspenseful', 'Romantic', 'Epic',
];

// ============================================================================
// Component
// ============================================================================

const AudioWorkspace: React.FC = () => {
    const toast = useToast();
    const {
        generatedAssets,
        fetchAudioLibrary,
        isAudioLoading,
        deleteAudioAsset
    } = useStore();

    // Navigation
    const [activeTab, setActiveTab] = useState<AudioTab>('generate');
    const [generateMode, setGenerateMode] = useState<GenerateMode>('soundfx');

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [autoAnalyze, setAutoAnalyze] = useState(false);

    // SoundFX controls
    const [sfxDuration, setSfxDuration] = useState(5);

    // Music controls
    const [musicGenre, setMusicGenre] = useState('Electronic');
    const [musicMood, setMusicMood] = useState('Energetic');
    const [musicTempo, setMusicTempo] = useState<'slow' | 'medium' | 'fast'>('medium');
    const [musicDuration, setMusicDuration] = useState(30);

    // TTS controls
    const [ttsText, setTtsText] = useState('');
    const [ttsVoice, setTtsVoice] = useState<TTSVoicePreset>('Kore');
    const [ttsSpeed, setTtsSpeed] = useState(1.0);

    // Playback
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Library Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<AudioGenerationType | 'all'>('all');

    // Initial load
    useEffect(() => {
        fetchAudioLibrary();
    }, [fetchAudioLibrary]);

    // ========================================================================
    // Generation Handlers
    // ========================================================================

    const handleGenerate = useCallback(async () => {
        if (isGenerating) return;

        setIsGenerating(true);
        try {
            switch (generateMode) {
                case 'soundfx':
                    if (!prompt.trim()) {
                        toast.error('Enter a sound description.');
                        setIsGenerating(false);
                        return;
                    }
                    await audioGenerationService.generateSoundFX({
                        prompt: prompt.trim(),
                        durationSeconds: sfxDuration,
                        analyze: autoAnalyze,
                    });
                    break;

                case 'music':
                    if (!prompt.trim()) {
                        toast.error('Enter a music description.');
                        setIsGenerating(false);
                        return;
                    }
                    await audioGenerationService.generateMusic({
                        prompt: prompt.trim(),
                        genre: musicGenre,
                        mood: musicMood,
                        tempo: musicTempo,
                        durationSeconds: musicDuration,
                        analyze: autoAnalyze,
                    });
                    break;

                case 'tts':
                    if (!ttsText.trim()) {
                        toast.error('Enter text to speak.');
                        setIsGenerating(false);
                        return;
                    }
                    await audioGenerationService.generateTTS({
                        text: ttsText.trim(),
                        voicePreset: ttsVoice,
                        speed: ttsSpeed,
                        analyze: autoAnalyze,
                    });
                    break;

                default:
                    throw new Error(`Unknown mode: ${generateMode}`);
            }

            toast.success(`${generateMode === 'soundfx' ? 'Sound effect' : generateMode === 'music' ? 'Music track' : 'Speech'} generated!`);

        } catch (error) {
            console.error('[AudioWorkspace] Generation failed:', error);
            toast.error(error instanceof Error ? error.message : 'Audio generation failed.');
        } finally {
            setIsGenerating(false);
        }
    }, [isGenerating, generateMode, prompt, sfxDuration, musicGenre, musicMood, musicTempo, musicDuration, ttsText, ttsVoice, ttsSpeed, autoAnalyze, toast]);

    // ========================================================================
    // Playback & Library Handlers
    // ========================================================================

    const togglePlay = useCallback((item: AudioMetadata | AudioGenerationResult) => {
        const id = 'id' in item ? item.id : (item as any).id;
        const uri = 'storageUrl' in item ? item.storageUrl : (item as any).dataUri;

        if (!uri) {
            toast.error('Audio source not available.');
            return;
        }

        if (playingId === id) {
            audioRef.current?.pause();
            setPlayingId(null);
            return;
        }

        if (audioRef.current) {
            audioRef.current.pause();
        }

        const audio = new Audio(uri);
        audioRef.current = audio;
        audio.onended = () => setPlayingId(null);
        audio.onerror = () => {
            setPlayingId(null);
            toast.error('Playback failed.');
        };
        audio.play();
        setPlayingId(id);
    }, [playingId, toast]);

    const handleDownload = useCallback((item: AudioMetadata | AudioGenerationResult) => {
        const id = 'id' in item ? item.id : (item as any).id;
        const uri = 'storageUrl' in item ? item.storageUrl : (item as any).dataUri;
        const mimeType = item.mimeType;

        if (!uri) return;

        const link = document.createElement('a');
        link.href = uri;
        const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('mp3') ? 'mp3' : 'audio';
        link.download = `${item.type}_${id.substring(0, 8)}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Downloaded!');
    }, [toast]);

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm('Are you sure you want to delete this audio asset?')) return;

        try {
            await deleteAudioAsset(id);
            if (playingId === id) {
                audioRef.current?.pause();
                setPlayingId(null);
            }
            toast.success('Asset deleted.');
        } catch (err) {
            toast.error('Failed to delete asset.');
        }
    }, [deleteAudioAsset, playingId, toast]);

    // ========================================================================
    // Filtering
    // ========================================================================

    const filteredAssets = generatedAssets.filter(asset => {
        const matchesSearch = asset.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (asset.fullText && asset.fullText.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesType = typeFilter === 'all' || asset.type === typeFilter;
        return matchesSearch && matchesType;
    });

    // ========================================================================
    // Mode Label Helpers
    // ========================================================================

    const modeConfig: Record<GenerateMode, { icon: React.ReactNode; label: string; color: string; bgColor: string; accentColor: string }> = {
        soundfx: { icon: <Wand2 size={14} />, label: 'Sound FX', color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20', accentColor: 'amber' },
        music: { icon: <Music size={14} />, label: 'Music', color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/20', accentColor: 'purple' },
        tts: { icon: <Mic size={14} />, label: 'Text to Speech', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20', accentColor: 'emerald' },
    };

    const typeLabel = (type: AudioGenerationType | string) => {
        switch (type) {
            case 'soundfx': return { label: 'SFX', color: 'bg-amber-500/20 text-amber-300' };
            case 'music': return { label: 'MUSIC', color: 'bg-purple-500/20 text-purple-300' };
            case 'tts': return { label: 'TTS', color: 'bg-emerald-500/20 text-emerald-300' };
            default: return { label: 'AUDIO', color: 'bg-gray-500/20 text-gray-300' };
        }
    };

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div className="h-full flex flex-col bg-[#0d1117] text-white overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 text-purple-400">
                        <AudioLines size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">Audio Studio</h1>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">AI-Powered Audio Generation</p>
                    </div>
                </div>
                {/* Tab Navigation */}
                <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                    {(['generate', 'library'] as AudioTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === tab
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {activeTab === 'generate' ? (
                    <div className="flex-1 flex">
                        {/* Left Panel: Controls */}
                        <div className="w-[380px] border-r border-white/5 flex flex-col overflow-y-auto custom-scrollbar">
                            {/* Mode Selector */}
                            <div className="p-4 border-b border-white/5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block text-white/40">Generation Mode</label>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {(Object.entries(modeConfig) as [GenerateMode, typeof modeConfig[GenerateMode]][]).map(([mode, config]) => (
                                        <button
                                            key={mode}
                                            onClick={() => setGenerateMode(mode)}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${generateMode === mode
                                                ? `${config.bgColor} ${config.color}`
                                                : 'border-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300'
                                                }`}
                                        >
                                            {config.icon}
                                            <span className="text-[9px] font-bold uppercase tracking-wider">{config.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Mode-Specific Controls */}
                            <div className="p-4 space-y-4 flex-1">
                                {generateMode === 'soundfx' && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Describe the sound</label>
                                            <textarea
                                                value={prompt}
                                                onChange={e => setPrompt(e.target.value)}
                                                placeholder="e.g. Cinematic whoosh transitioning to a deep bass drop..."
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-amber-500/40 focus:outline-none resize-none"
                                                rows={4}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                <Clock size={10} /> Duration: {sfxDuration}s
                                            </label>
                                            <input
                                                type="range" min={1} max={30}
                                                value={sfxDuration}
                                                onChange={e => setSfxDuration(Number(e.target.value))}
                                                className="w-full accent-amber-500"
                                            />
                                        </div>
                                    </>
                                )}

                                {generateMode === 'music' && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Music Direction</label>
                                            <textarea
                                                value={prompt}
                                                onChange={e => setPrompt(e.target.value)}
                                                placeholder="e.g. A driving synthwave track with arpeggiated melodies..."
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-purple-500/40 focus:outline-none resize-none"
                                                rows={3}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Genre</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {GENRE_PRESETS.map(g => (
                                                    <button key={g} onClick={() => setMusicGenre(g)}
                                                        className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase border transition-all ${musicGenre === g ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'border-white/10 text-white/40 hover:text-white'}`}>{g}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Tempo</label>
                                                <div className="flex gap-1">
                                                    {(['slow', 'medium', 'fast'] as const).map(t => (
                                                        <button key={t} onClick={() => setMusicTempo(t)}
                                                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase border transition-all ${musicTempo === t ? 'bg-white/10 text-white' : 'border-white/5 text-white/20'}`}>{t}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Clock size={10} /> {musicDuration}s</label>
                                                <input type="range" min={15} max={60} step={5} value={musicDuration} onChange={e => setMusicDuration(Number(e.target.value))} className="w-full accent-purple-500" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {generateMode === 'tts' && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Text to Speak</label>
                                            <textarea
                                                value={ttsText}
                                                onChange={e => setTtsText(e.target.value)}
                                                placeholder="Enter text..."
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-500/40 focus:outline-none resize-none"
                                                rows={5}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Voice</label>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {TTS_VOICE_PRESETS.map(v => (
                                                    <button key={v.id} onClick={() => setTtsVoice(v.id)}
                                                        className={`px-3 py-1.5 rounded-lg text-left border transition-all ${ttsVoice === v.id ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'border-white/5 text-white/30'}`}>
                                                        <div className="text-[9px] font-bold">{v.label}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Auto-Analyze Toggle */}
                                <div className="pt-2">
                                    <button
                                        onClick={() => setAutoAnalyze(!autoAnalyze)}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${autoAnalyze ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'border-white/5 text-white/40'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Sparkles size={14} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Auto-Analyze Metadata</span>
                                        </div>
                                        <div className={`w-6 h-3 rounded-full relative transition-colors ${autoAnalyze ? 'bg-blue-500' : 'bg-white/10'}`}>
                                            <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${autoAnalyze ? 'left-3.5' : 'left-0.5'}`} />
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Generate Button */}
                            <div className="p-4 border-t border-white/5">
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50 ${modeConfig[generateMode].accentColor === 'amber' ? 'bg-amber-600 hover:bg-amber-500' : modeConfig[generateMode].accentColor === 'purple' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white shadow-xl shadow-black/20`}
                                >
                                    {isGenerating ? <><Loader2 size={16} className="animate-spin" /> Working...</> : <><Sparkles size={16} /> Create {modeConfig[generateMode].label}</>}
                                </button>
                            </div>
                        </div>

                        {/* Right Panel: Results History */}
                        <div className="flex-1 flex flex-col bg-black/20 overflow-hidden">
                            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><History size={12} /> Generation History</h2>
                                <span className="text-[10px] text-white/20 font-medium tracking-tight">Current Session</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {generatedAssets.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-4 text-white/10 opacity-30">
                                        <AudioLines size={64} />
                                        <div className="text-center">
                                            <p className="text-sm font-bold uppercase tracking-widest">Awaiting Audio</p>
                                            <p className="text-[10px] mt-2 max-w-[200px]">Define your sound parameters and start producing.</p>
                                        </div>
                                    </div>
                                ) : (
                                    generatedAssets.map(asset => {
                                        const badge = typeLabel(asset.type);
                                        const isPlaying = playingId === asset.id;
                                        return (
                                            <div key={asset.id} className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all ${isPlaying ? 'bg-white/10 border-white/20 shadow-2xl' : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.05] hover:border-white/10'}`}>
                                                <button onClick={() => togglePlay(asset as any)} className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-blue-500 text-white animate-pulse' : 'bg-white/5 text-white/40 hover:bg-blue-500 hover:text-white'}`}>
                                                    {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${badge.color}`}>{badge.label}</span>
                                                        <span className="text-[10px] text-white/30 font-medium tracking-tight">{~~asset.estimatedDuration}s</span>
                                                        {asset.bpm && <span className="text-[9px] text-blue-400/60 font-bold tracking-widest uppercase items-center flex gap-1"><RefreshCw size={8} /> {asset.bpm} BPM</span>}
                                                    </div>
                                                    <p className="text-xs text-white/80 font-medium truncate">{asset.prompt}</p>
                                                    <div className="flex items-center gap-4 mt-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleDownload(asset as any)} className="text-[9px] font-bold uppercase tracking-widest hover:text-blue-400 flex items-center gap-1 transition-colors"><Download size={10} /> Store</button>
                                                        <button onClick={() => handleDelete(asset.id)} className="text-[9px] font-bold uppercase tracking-widest hover:text-red-400 flex items-center gap-1 transition-colors"><Trash2 size={10} /> Trash</button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Library Tab: Persistent Storage View */
                    <div className="flex-1 flex flex-col overflow-hidden bg-black/10">
                        {/* Library Toolbar */}
                        <div className="p-4 border-b border-white/5 flex items-center justify-between gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search library..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-white/20"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="text-white/20" size={14} />
                                <select
                                    value={typeFilter}
                                    onChange={e => setTypeFilter(e.target.value as any)}
                                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/60 focus:outline-none"
                                >
                                    <option value="all">All Types</option>
                                    <option value="soundfx">Sound FX</option>
                                    <option value="music">Music</option>
                                    <option value="tts">Speech</option>
                                </select>
                            </div>
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {isAudioLoading ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-3 opacity-30">
                                    <Loader2 className="animate-spin" size={32} />
                                    <span className="text-xs font-bold uppercase tracking-widest">Fetching Library...</span>
                                </div>
                            ) : filteredAssets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-30">
                                    <Hash size={48} className="mb-4" />
                                    <p className="text-sm font-bold uppercase tracking-widest">Collection Empty</p>
                                    <p className="text-[10px] mt-2 max-w-[240px]">No persistent audio assets found. Start generating to build your library.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredAssets.map(asset => {
                                        const badge = typeLabel(asset.type);
                                        const isPlaying = playingId === asset.id;
                                        return (
                                            <div key={asset.id} className={`flex flex-col p-5 rounded-3xl border transition-all ${isPlaying ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}>
                                                <div className="flex justify-between items-start mb-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${badge.color}`}>{badge.label}</span>
                                                    <p className="text-[9px] text-white/20 font-mono">{new Date(asset.generatedAt).toLocaleDateString()}</p>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-semibold text-white/90 line-clamp-3 mb-4 leading-relaxed tracking-tight select-none cursor-default">
                                                        {asset.prompt}
                                                    </p>
                                                    {asset.bpm && (
                                                        <div className="flex gap-2 mb-4">
                                                            <div className="px-2 py-1 rounded-lg bg-black/40 border border-white/5 flex items-center gap-1.5">
                                                                <RefreshCw size={10} className="text-blue-400" />
                                                                <span className="text-[10px] font-bold text-white/60">{asset.bpm} BPM</span>
                                                            </div>
                                                            {asset.key && (
                                                                <div className="px-2 py-1 rounded-lg bg-black/40 border border-white/5 flex items-center gap-1.5">
                                                                    <Mic size={10} className="text-purple-400" />
                                                                    <span className="text-[10px] font-bold text-white/60">{asset.key}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 pt-2 border-t border-white/5 mt-auto">
                                                    <button onClick={() => togglePlay(asset as any)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${isPlaying ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                                                        {isPlaying ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Listen</>}
                                                    </button>
                                                    <button onClick={() => handleDownload(asset as any)} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                                                        <Download size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(asset.id)} className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AudioWorkspace;
