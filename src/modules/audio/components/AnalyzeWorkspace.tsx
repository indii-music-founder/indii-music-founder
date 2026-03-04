import React, { useState, useCallback } from 'react';
import { Upload, FileAudio, Loader2, Sparkles, AlertCircle, CheckCircle2, Info, ArrowRight } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { audioAnalysisService, type DeepAudioFeatures } from '@/services/audio/AudioAnalysisService';
import { WaveformPlayer } from './WaveformPlayer';

interface AnalyzeWorkspaceProps {
    onAnalysisComplete?: (file: File, features: DeepAudioFeatures) => void;
}

export const AnalyzeWorkspace: React.FC<AnalyzeWorkspaceProps> = ({ onAnalysisComplete }) => {
    const toast = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [results, setResults] = useState<DeepAudioFeatures | null>(null);
    const [fromCache, setFromCache] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (uploadedFile && uploadedFile.type.startsWith('audio/')) {
            setFile(uploadedFile);
            setResults(null);
            setFromCache(false);
        } else {
            toast.error('Invalid file type. Please upload an audio file.');
        }
    };

    const runAnalysis = useCallback(async () => {
        if (!file) return;

        setIsAnalyzing(true);
        try {
            const { features, fromCache: cached } = await audioAnalysisService.analyze(file);
            setResults(features);
            setFromCache(cached);
            onAnalysisComplete?.(file, features);
            toast.success('Audio analysis complete!');
        } catch (error: any) {
            console.error('[AnalyzeWorkspace] Analysis failed:', error);
            toast.error(error.message || 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    }, [file, onAnalysisComplete, toast]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {!file ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/5 border-2 border-dashed border-white/10 rounded-3xl group hover:border-purple-500/50 transition-all cursor-pointer relative">
                    <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="p-5 rounded-2xl bg-white/5 group-hover:bg-purple-500/10 mb-4 transition-all">
                        <Upload className="w-8 h-8 text-gray-500 group-hover:text-purple-400" />
                    </div>
                    <h3 className="text-lg font-medium">Upload audio for compliance check</h3>
                    <p className="text-gray-500 text-sm mt-1">QC scan for WAV, MP3, FLAC (Max 50MB)</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Selected File Card */}
                    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-500/20 rounded-xl">
                                <FileAudio className="text-purple-400 w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold">{file.name}</h3>
                                <p className="text-xs text-gray-500 uppercase tracking-widest leading-none mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFile(null)}
                                className="px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors"
                                disabled={isAnalyzing}
                            >
                                Replace
                            </button>
                            {!results && (
                                <button
                                    onClick={runAnalysis}
                                    disabled={isAnalyzing}
                                    className="px-6 py-2 bg-purple-500 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-600 shadow-lg shadow-purple-500/20 disabled:opacity-50 transition-all"
                                >
                                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    Run Audio Audit
                                </button>
                            )}
                        </div>
                    </div>

                    {results && (
                        <div className="grid grid-cols-3 gap-6 animate-in zoom-in-95 duration-500">
                            {/* Analysis Stats (Left Column) */}
                            <div className="col-span-1 space-y-6">
                                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Vital Statistics</h4>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400">Tempo</span>
                                            <span className="text-lg font-mono text-purple-400">{results.bpm} BPM</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400">Key / Scale</span>
                                            <span className="text-lg font-mono text-indigo-400">{results.key} {results.scale}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400">Integrated Loudness</span>
                                            <span className="text-lg font-mono text-amber-500">{results.loudness?.toFixed(1) || '--'} LUFS</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400">Danceability</span>
                                            <span className="text-lg font-mono text-emerald-400">{Math.round((results.danceability || 0) * 100)}%</span>
                                        </div>
                                    </div>

                                    {fromCache && (
                                        <div className="pt-2">
                                            <p className="text-[10px] text-gray-600 bg-white/5 p-2 rounded-lg italic flex items-center gap-1">
                                                <Info size={12} /> Data loaded from local cache
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Mood / Sentiment */}
                                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Store Tagging Metadata</h4>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
                                                <span>Energy</span>
                                                <span>{Math.round(results.energy * 100)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${results.energy * 100}%` }} />
                                            </div>
                                        </div>
                                        {results.moods && Object.entries(results.moods).map(([mood, val]) => (
                                            <div key={mood} className="space-y-1">
                                                <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
                                                    <span>{mood}</span>
                                                    <span>{Math.round(val * 100)}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500/50 rounded-full" style={{ width: `${val * 100}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Center + Right (Audit & Player) */}
                            <div className="col-span-2 space-y-6">
                                {/* Waveform Preview */}
                                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1 mb-4 text-center">Technical QC Profile</h4>
                                    <WaveformPlayer
                                        url={URL.createObjectURL(file)}
                                        height={120}
                                        waveColor="#312e81"
                                        progressColor="#a855f7"
                                    />
                                </div>

                                {/* Technical Audit Registry */}
                                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1 leading-none">Distribution Compliance Registry</h4>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20">PRE-QC AUDIT</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className={`p-4 rounded-2xl border ${results.audit?.peakLevel && results.audit.peakLevel > -0.1 ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-gray-400">Peak Level</span>
                                                {results.audit?.peakLevel && results.audit.peakLevel > -0.1 ? <AlertCircle size={14} className="text-red-500" /> : <CheckCircle2 size={14} className="text-emerald-500" />}
                                            </div>
                                            <span className={`text-lg font-mono ${results.audit?.peakLevel && results.audit.peakLevel > -0.1 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {results.audit?.peakLevel?.toFixed(1) || '--'} dBFS
                                            </span>
                                        </div>

                                        <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-2xl">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-gray-400">Sample Rate</span>
                                                <CheckCircle2 size={14} className="text-emerald-500" />
                                            </div>
                                            <span className="text-lg font-mono text-indigo-400">
                                                {results.audit?.sampleRate ? `${(results.audit.sampleRate / 1000).toFixed(1)} kHz` : '--'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Risks & Recommendations */}
                                    <div className="space-y-3 pt-2">
                                        {results.audit?.rejectionRisks && results.audit.rejectionRisks.length > 0 ? (
                                            results.audit.rejectionRisks.map((risk, i) => (
                                                <div key={i} className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                                    <p className="text-xs text-red-200">{risk}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                                <CheckCircle2 size={16} className="text-emerald-500" />
                                                <p className="text-xs text-emerald-200">Asset meets basic technical standards for global distribution.</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4 flex justify-end">
                                        <button className="flex items-center gap-2 text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors uppercase tracking-widest">
                                            Register Sonic ID <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
