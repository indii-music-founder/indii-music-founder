/**
 * AudioWorkspace - Unified Audio Generation Module
 * 
 * Tabs: Generate (SoundFX/Music/TTS), Library
 * Features: AI Generation, Audio Analysis, Waveform Display, Persistence
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
    Music, Mic, Wand2, Play, Pause, Download, Loader2,
    Volume2, Clock, Sparkles, AudioLines,
    RefreshCw, Trash2, Search, Filter, History, Clapperboard
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
import { WaveformPlayer } from './components/WaveformPlayer';
import { useVideoEditorStore } from '@/modules/video/store/videoEditorStore';

// ============================================================================
// Types
// ============================================================================

type AudioTab = 'generate' | 'library';
type GenerateMode = 'soundfx' | 'music' | 'tts';

// ============================================================================
// Constants
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
        deleteAudioAsset,
        setModule
    } = useStore();

    const setInputAudio = useVideoEditorStore(state => state.setInputAudio);

    // Navigation
    const [activeTab, setActiveTab] = useState<AudioTab>('generate');
    const [generateMode, setGenerateMode] = useState<GenerateMode>('soundfx');

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [autoAnalyze, setAutoAnalyze] = useState(true);
    const [currentResult, setCurrentResult] = useState<AudioGenerationResult | null>(null);

    // Params
    const [sfxDuration, setSfxDuration] = useState(5);
    const [musicGenre, setMusicGenre] = useState('Electronic');
    const [musicMood, setMusicMood] = useState('Energetic');
    const [musicTempo, setMusicTempo] = useState<'slow' | 'medium' | 'fast'>('medium');
    const [musicDuration, setMusicDuration] = useState(30);
    const [ttsText, setTtsText] = useState('');
    const [ttsVoice, setTtsVoice] = useState<TTSVoicePreset>('Kore');
    const [ttsSpeed, setTtsSpeed] = useState(1.0);

    // Library State
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<AudioGenerationType | 'all'>('all');
    const [playingId, setPlayingId] = useState<string | null>(null);

    // Initial load
    useEffect(() => {
        fetchAudioLibrary();
    }, [fetchAudioLibrary]);

    // ========================================================================
    // Handlers
    // ========================================================================

    const handleGenerate = useCallback(async () => {
        if (isGenerating) return;

        setIsGenerating(true);
        setCurrentResult(null);

        try {
            let res: AudioGenerationResult;

            switch (generateMode) {
                case 'soundfx':
                    if (!prompt.trim()) throw new Error('Enter a sound description.');
                    res = await audioGenerationService.generateSoundFX({
                        prompt: prompt.trim(),
                        durationSeconds: sfxDuration,
                        analyze: autoAnalyze,
                    });
                    break;
                case 'music':
                    if (!prompt.trim()) throw new Error('Enter a music description.');
                    res = await audioGenerationService.generateMusic({
                        prompt: prompt.trim(),
                        genre: musicGenre,
                        mood: musicMood,
                        tempo: musicTempo,
                        durationSeconds: musicDuration,
                        analyze: autoAnalyze,
                    });
                    break;
                case 'tts':
                    if (!ttsText.trim()) throw new Error('Enter text to speak.');
                    res = await audioGenerationService.generateTTS({
                        text: ttsText.trim(),
                        voicePreset: ttsVoice,
                        speed: ttsSpeed,
                        analyze: autoAnalyze,
                    });
                    break;
                default:
                    throw new Error(`Unknown mode: ${generateMode}`);
            }

            setCurrentResult(res);
            toast.success('Generation complete!');
        } catch (error: any) {
            console.error('[AudioWorkspace] Error:', error);
            toast.error(error.message || 'Generation failed');
        } finally {
            setIsGenerating(false);
        }
    }, [isGenerating, generateMode, prompt, sfxDuration, musicGenre, musicMood, musicTempo, musicDuration, ttsText, ttsVoice, ttsSpeed, autoAnalyze, toast]);

    const handleShipToVideo = useCallback((asset: AudioMetadata | AudioGenerationResult) => {
        const url = asset.storageUrl || (asset as any).dataUri;
        if (!url) return;

        setInputAudio(url);
        setModule('video');
        toast.info('Audio sent to Video Studio');
    }, [setInputAudio, setModule, toast]);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this asset?')) return;
        try {
            await deleteAudioAsset(id);
            if (playingId === id) setPlayingId(null);
            toast.success('Asset deleted');
        } catch (error) {
            toast.error('Delete failed');
        }
    };

    const handleDownload = (asset: AudioMetadata | AudioGenerationResult) => {
        const url = asset.storageUrl || (asset as any).dataUri;
        if (!url) return;

        const a = document.createElement('a');
        a.href = url;
        a.download = `${asset.type}_${asset.id.slice(0, 8)}.${asset.mimeType.split('/')[1] || 'wav'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

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
    // Render Helpers
    // ========================================================================

    const ModeCard = ({ mode, label, icon, current }: { mode: GenerateMode, label: string, icon: React.ReactNode, current: boolean }) => (
        <button
            onClick={() => setGenerateMode(mode)}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 w-full ${current
                ? 'bg-purple-500/10 border-purple-500 text-purple-400'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                }`}
        >
            <div className={`p-3 rounded-xl ${current ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5'}`}>
                {icon}
            </div>
            <span className="text-sm font-medium">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-black text-white relative overflow-hidden">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-white/10 bg-black/50 backdrop-blur-xl z-10">
                <div className="flex items-center gap-4">
                    <div className="bg-purple-500/20 p-2.5 rounded-xl">
                        <AudioLines className="text-purple-400 w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Audio Studio</h1>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Phase 1 / Generation</p>
                    </div>
                </div>

                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                        onClick={() => setActiveTab('generate')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'generate' ? 'bg-purple-500 shadow-lg text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Generate
                    </button>
                    <button
                        onClick={() => setActiveTab('library')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'library' ? 'bg-purple-500 shadow-lg text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Library ({generatedAssets.length})
                    </button>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto custom-scrollbar p-8">
                {activeTab === 'generate' ? (
                    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Mode Selection */}
                        <div className="grid grid-cols-3 gap-4">
                            <ModeCard
                                mode="soundfx"
                                label="Sound FX"
                                icon={<Wand2 className="w-6 h-6" />}
                                current={generateMode === 'soundfx'}
                            />
                            <ModeCard
                                mode="music"
                                label="Music"
                                icon={<Music className="w-6 h-6" />}
                                current={generateMode === 'music'}
                            />
                            <ModeCard
                                mode="tts"
                                label="Speech"
                                icon={<Mic className="w-6 h-6" />}
                                current={generateMode === 'tts'}
                            />
                        </div>

                        {/* Controls Container */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="p-8 space-y-6">
                                {/* Prompt Area */}
                                {generateMode !== 'tts' ? (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Concept / Prompt</label>
                                        <textarea
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            placeholder={generateMode === 'soundfx' ? "Describe a sound (e.g., Heavy rain on a tin roof with distant thunder)..." : "Describe the music (e.g., Lofi hip hop beat with a smooth saxophone melody)..."}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 min-h-[120px] transition-all"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Speech Text</label>
                                            <textarea
                                                value={ttsText}
                                                onChange={(e) => setTtsText(e.target.value)}
                                                placeholder="Enter the text you want to convert to speech..."
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 min-h-[150px] transition-all"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Voice Profile</label>
                                                <select
                                                    value={ttsVoice}
                                                    onChange={(e) => setTtsVoice(e.target.value as any)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                                >
                                                    {TTS_VOICE_PRESETS.map(v => <option key={v.id} value={v.id} className="bg-gray-900">{v.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Speech Rate ({ttsSpeed}x)</label>
                                                <input
                                                    type="range" min="0.5" max="2.0" step="0.1"
                                                    value={ttsSpeed} onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                                                    className="w-full accent-purple-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Specific Mode Settings */}
                                {generateMode === 'soundfx' && (
                                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-amber-400" />
                                            <span className="text-sm font-medium">Duration: {sfxDuration}s</span>
                                        </div>
                                        <input
                                            type="range" min="1" max="15" step="1"
                                            value={sfxDuration} onChange={(e) => setSfxDuration(parseInt(e.target.value))}
                                            className="w-40 accent-amber-500"
                                        />
                                    </div>
                                )}

                                {generateMode === 'music' && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Genre</label>
                                                <select value={musicGenre} onChange={(e) => setMusicGenre(e.target.value)} className="w-full bg-black/40 border border-white/10 p-2.5 rounded-xl text-sm">
                                                    {GENRE_PRESETS.map(g => <option key={g} value={g}>{g}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Mood</label>
                                                <select value={musicMood} onChange={(e) => setMusicMood(e.target.value)} className="w-full bg-black/40 border border-white/10 p-2.5 rounded-xl text-sm">
                                                    {MOOD_PRESETS.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Tempo</label>
                                                <select value={musicTempo} onChange={(e) => setMusicTempo(e.target.value as any)} className="w-full bg-black/40 border border-white/10 p-2.5 rounded-xl text-sm">
                                                    <option value="slow">Slow</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="fast">Fast</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Clock className="w-4 h-4 text-purple-400" />
                                                <span>Target Length: {musicDuration}s</span>
                                            </div>
                                            <input type="range" min="10" max="60" step="5" value={musicDuration} onChange={(e) => setMusicDuration(parseInt(e.target.value))} className="w-48 accent-purple-500" />
                                        </div>
                                    </div>
                                )}

                                {/* Utils */}
                                <div className="flex items-center justify-between pt-2">
                                    <button
                                        onClick={() => setAutoAnalyze(!autoAnalyze)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${autoAnalyze ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-white/5 border-white/10 text-gray-500'}`}
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">AI Analysis</span>
                                    </button>

                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating}
                                        className="bg-gradient-to-r from-purple-500 to-indigo-600 px-8 py-3 rounded-2xl font-bold flex items-center gap-3 shadow-xl hover:shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Snythesizing...
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                                                Generate AI Audio
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Result Preview */}
                        {currentResult && (
                            <div className="bg-white/5 border border-purple-500/30 rounded-3xl p-6 space-y-6 animate-in zoom-in-95 duration-500 shadow-2xl shadow-purple-500/5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <Sparkles className="text-purple-400 w-5 h-5" />
                                        Generated Asset
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleShipToVideo(currentResult)}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-purple-400"
                                            title="Ship to Video"
                                        >
                                            <Clapperboard className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDownload(currentResult)}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                        >
                                            <Download className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <WaveformPlayer
                                    url={currentResult.storageUrl || (currentResult as any).dataUri}
                                    isPlaying={playingId === currentResult.id}
                                    onPlay={() => setPlayingId(currentResult.id)}
                                    onPause={() => setPlayingId(null)}
                                />

                                {autoAnalyze && (
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">BPM</span>
                                            <span className="text-xl font-mono text-purple-400">{currentResult.bpm || '--'}</span>
                                        </div>
                                        <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Key</span>
                                            <span className="text-xl font-mono text-indigo-400">{currentResult.key || '--'}</span>
                                        </div>
                                        <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Scale</span>
                                            <span className="text-sm font-medium text-gray-300">Chromatic</span>
                                        </div>
                                        <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Mime</span>
                                            <span className="text-sm font-medium text-gray-300">WAV</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="max-w-6xl mx-auto space-y-6">
                        {/* Library Filter Bar */}
                        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search library..."
                                    className="w-full bg-black/40 border border-white/10 py-2 pl-11 pr-4 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-500" />
                                <select
                                    value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}
                                    className="bg-black/40 border border-white/10 p-2 rounded-xl text-sm"
                                >
                                    <option value="all">All Types</option>
                                    <option value="soundfx">Sound FX</option>
                                    <option value="music">Music</option>
                                    <option value="tts">Speech</option>
                                </select>
                            </div>
                        </div>

                        {/* Asset Grid */}
                        {isAudioLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
                                <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
                                <p className="text-gray-500 animate-pulse">Scanning audio archive...</p>
                            </div>
                        ) : filteredAssets.length === 0 ? (
                            <div className="text-center py-32 bg-white/5 rounded-3xl border border-white/10 border-dashed">
                                <History className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-400">No audio assets found</h3>
                                <p className="text-sm text-gray-600 mt-1">Try generating something new</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {filteredAssets.map(asset => (
                                    <div key={asset.id} className="group bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:border-purple-500/50 transition-all">
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${asset.type === 'music' ? 'bg-purple-500/20 text-purple-400' :
                                                        asset.type === 'soundfx' ? 'bg-amber-500/20 text-amber-500' :
                                                            'bg-emerald-500/20 text-emerald-400'
                                                        }`}>
                                                        {asset.type === 'music' ? <Music size={16} /> : asset.type === 'soundfx' ? <Wand2 size={16} /> : <Mic size={16} />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold line-clamp-1">{asset.prompt || 'Untitled Audio'}</p>
                                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{new Date(asset.generatedAt).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleShipToVideo(asset)} className="p-2 hover:bg-white/10 rounded-lg text-purple-400" title="Ship to Video"><Clapperboard size={16} /></button>
                                                    <button onClick={() => handleDownload(asset)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400"><Download size={16} /></button>
                                                    <button onClick={() => handleDelete(asset.id)} className="p-2 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 size={16} /></button>
                                                </div>
                                            </div>

                                            <WaveformPlayer
                                                url={asset.storageUrl || (asset as any).dataUri}
                                                height={40}
                                                isPlaying={playingId === asset.id}
                                                onPlay={() => setPlayingId(asset.id)}
                                                onPause={() => setPlayingId(null)}
                                            />

                                            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                                {asset.bpm && <span className="flex items-center gap-1"><Volume2 size={12} className="text-purple-400" /> {asset.bpm} BPM</span>}
                                                {asset.key && <span className="flex items-center gap-1"><Sparkles size={12} className="text-indigo-400" /> {asset.key}</span>}
                                                <span className="flex items-center gap-1"><Clock size={12} /> {Math.round(asset.estimatedDuration)}s</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default AudioWorkspace;
