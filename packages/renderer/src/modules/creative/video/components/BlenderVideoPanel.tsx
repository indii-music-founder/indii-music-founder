import React, { useState, useEffect } from 'react';
import {
    Box,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Play,
    Loader2,
    Copy,
    Disc,
    Radio,
    Flame,
    Music,
    Layers
} from 'lucide-react';
import { blenderService, FALLBACK_TEMPLATES } from '@/services/blender/BlenderService';
import type {
    BlenderStatus,
    BlenderTemplateInfo,
    BlenderTemplateId,
    BlenderAspectRatio
} from '@/services/blender/types';

interface BlenderVideoPanelProps {
    currentAudioPath?: string;
    currentCoverArtPath?: string;
    artistName?: string;
    trackTitle?: string;
    bpm?: number;
    onRenderComplete?: (outputPath: string) => void;
}

const TEMPLATE_ICONS: Record<BlenderTemplateId, React.ReactNode> = {
    audio_reactive_tunnel: <Layers className="w-5 h-5 text-cyan-400" />,
    vinyl_turntable: <Disc className="w-5 h-5 text-amber-400" />,
    chrome_text: <Sparkles className="w-5 h-5 text-pink-400" />,
    spectrum_bars: <Radio className="w-5 h-5 text-emerald-400" />,
    concert_stage: <Flame className="w-5 h-5 text-purple-400" />
};

export const BlenderVideoPanel: React.FC<BlenderVideoPanelProps> = ({
    currentAudioPath = '',
    currentCoverArtPath = '',
    artistName = 'Artist',
    trackTitle = 'Track',
    bpm = 120,
    onRenderComplete
}) => {
    const [status, setStatus] = useState<BlenderStatus | null>(null);
    const [templates, setTemplates] = useState<BlenderTemplateInfo[]>(FALLBACK_TEMPLATES);
    const [selectedTemplate, setSelectedTemplate] = useState<BlenderTemplateId>('audio_reactive_tunnel');
    const [aspectRatio, setAspectRatio] = useState<BlenderAspectRatio>('16:9');
    const [durationSeconds, setDurationSeconds] = useState<number>(30);
    const [isRendering, setIsRendering] = useState(false);
    const [renderProgress, setRenderProgress] = useState<number>(0);
    const [renderResult, setRenderResult] = useState<string | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [copiedInstallCmd, setCopiedInstallCmd] = useState(false);

    useEffect(() => {
        let mounted = true;
        blenderService.getStatus().then(s => {
            if (mounted) setStatus(s);
        });
        blenderService.listTemplates().then(t => {
            if (mounted && t.length > 0) setTemplates(t);
        });
        return () => { mounted = false; };
    }, []);

    const handleCopyInstallCmd = () => {
        navigator.clipboard.writeText('brew install --cask blender');
        setCopiedInstallCmd(true);
        setTimeout(() => setCopiedInstallCmd(false), 2000);
    };

    const handleStartRender = async () => {
        setIsRendering(true);
        setRenderProgress(10);
        setRenderResult(null);
        setRenderError(null);

        const fakeProgress = setInterval(() => {
            setRenderProgress(prev => (prev < 90 ? prev + 15 : prev));
        }, 1200);

        try {
            const outPath = `/tmp/indii_${selectedTemplate}_${Date.now()}.mp4`;
            const res = await blenderService.renderMusicVideo({
                audioFilePath: currentAudioPath || '/tmp/audio_placeholder.wav',
                outputVideoPath: outPath,
                templateId: selectedTemplate,
                bpm,
                durationSeconds,
                aspectRatio,
                visualTokens: {
                    artistName,
                    trackTitle,
                    coverArtPath: currentCoverArtPath
                }
            });

            clearInterval(fakeProgress);
            setRenderProgress(100);

            if (res.success) {
                setRenderResult(res.outputPath);
                onRenderComplete?.(res.outputPath);
            } else {
                setRenderError(res.error || 'Rendering encountered an error.');
            }
        } catch (err) {
            clearInterval(fakeProgress);
            setRenderError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsRendering(false);
        }
    };

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-white space-y-6">
            {/* Header & Status */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-cyan-500/10 rounded-lg text-cyan-400">
                        <Box className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            Blender 3D Music Video Engine
                            <span className="text-xs font-mono uppercase bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded">
                                MCP Integration
                            </span>
                        </h3>
                        <p className="text-sm text-neutral-400">
                            Headless & interactive 3D visualizers, vinyl turntables, and reactive music videos.
                        </p>
                    </div>
                </div>

                {/* Status Badge */}
                <div>
                    {status?.installed ? (
                        <div className="flex items-center space-x-2 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{status.version || 'Blender Ready'} ({status.gpuAcceleration} GPU)</span>
                        </div>
                    ) : (
                        <div className="flex items-center space-x-2 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-full">
                            <AlertCircle className="w-4 h-4" />
                            <span>Blender Not Detected</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Installation Helper if not installed */}
            {status && !status.installed && (
                <div className="bg-neutral-950 border border-amber-500/20 rounded-lg p-4 flex items-center justify-between text-sm">
                    <div className="space-y-1">
                        <p className="text-neutral-200 font-medium">Install Blender to unlock 3D rendering</p>
                        <p className="text-neutral-400 text-xs">
                            Run Homebrew command on macOS or download from blender.org.
                        </p>
                    </div>
                    <button
                        onClick={handleCopyInstallCmd}
                        className="flex items-center space-x-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1.5 rounded text-xs transition"
                    >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedInstallCmd ? 'Copied!' : 'brew install --cask blender'}</span>
                    </button>
                </div>
            )}

            {/* Template Selection Grid */}
            <div className="space-y-3">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Select 3D Music Video Template
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {templates.map(tpl => {
                        const isSelected = selectedTemplate === tpl.id;
                        return (
                            <button
                                key={tpl.id}
                                onClick={() => setSelectedTemplate(tpl.id)}
                                className={`text-left p-4 rounded-lg border transition space-y-2 ${
                                    isSelected
                                        ? 'bg-neutral-800 border-cyan-500 ring-1 ring-cyan-500/50'
                                        : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        {TEMPLATE_ICONS[tpl.id] || <Music className="w-5 h-5 text-neutral-400" />}
                                        <span className="font-medium text-sm text-neutral-100">{tpl.name}</span>
                                    </div>
                                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-neutral-900 text-neutral-400 rounded">
                                        {tpl.recommendedAspectRatio}
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                                    {tpl.description}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Settings (Aspect Ratio & Duration) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        Aspect Ratio
                    </label>
                    <div className="flex space-x-2">
                        {(['16:9', '9:16', '1:1'] as BlenderAspectRatio[]).map(ratio => (
                            <button
                                key={ratio}
                                onClick={() => setAspectRatio(ratio)}
                                className={`px-4 py-2 rounded text-xs font-mono font-medium border transition ${
                                    aspectRatio === ratio
                                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                                }`}
                            >
                                {ratio === '16:9' ? '16:9 (YouTube)' : ratio === '9:16' ? '9:16 (Shorts/TikTok)' : '1:1 (Square)'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        Duration (Seconds)
                    </label>
                    <div className="flex items-center space-x-3">
                        <input
                            type="range"
                            min="5"
                            max="60"
                            step="5"
                            value={durationSeconds}
                            onChange={e => setDurationSeconds(Number(e.target.value))}
                            className="w-full accent-cyan-400"
                        />
                        <span className="text-sm font-mono text-cyan-300 w-12 text-right">{durationSeconds}s</span>
                    </div>
                </div>
            </div>

            {/* Render Progress Bar */}
            {isRendering && (
                <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs text-neutral-400">
                        <span className="flex items-center gap-1.5 text-cyan-400">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Rendering 3D frames with Blender...
                        </span>
                        <span className="font-mono">{renderProgress}%</span>
                    </div>
                    <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800">
                        <div
                            className="bg-cyan-500 h-full transition-all duration-300"
                            style={{ width: `${renderProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Result / Error Notification */}
            {renderResult && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-xs flex items-center justify-between">
                    <span>Render complete! Video saved to {renderResult}</span>
                </div>
            )}
            {renderError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
                    <span>Error: {renderError}</span>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                    onClick={handleStartRender}
                    disabled={isRendering}
                    className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-800 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition shadow-lg shadow-cyan-600/20"
                >
                    {isRendering ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Rendering 3D Video...</span>
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4" />
                            <span>Render 3D Music Video</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
