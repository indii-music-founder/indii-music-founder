import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Play,
    Loader2,
    Disc,
    Radio,
    Flame,
    Music,
    Layers
} from 'lucide-react';
import { ElectronPlatformAdapter } from '@/services/platform/PlatformBridgeService';
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
    pendingSaveKey?: string;
    onRenderComplete?: (outputPath: string) => Promise<string | void> | string | void;
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
    pendingSaveKey,
    onRenderComplete
}) => {
    const [audioPath, setAudioPath] = useState(currentAudioPath && !/^(https?:|gs:|blob:)/.test(currentAudioPath) ? currentAudioPath : '');
    const [coverPath, setCoverPath] = useState(currentCoverArtPath && !/^(https?:|gs:|blob:)/.test(currentCoverArtPath) ? currentCoverArtPath : '');
    const activeRequest = useRef<string | null>(null);
    const currentSaveKey = useRef(pendingSaveKey);
    currentSaveKey.current = pendingSaveKey;
    const [progressMessage, setProgressMessage] = useState('');
    const pendingSave = useRef<{ path: string; key?: string; save: () => Promise<string | void> } | null>(null);
    const [hasPendingSave, setHasPendingSave] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<BlenderStatus | null>(null);
    const [templates, setTemplates] = useState<BlenderTemplateInfo[]>(FALLBACK_TEMPLATES);
    const [selectedTemplate, setSelectedTemplate] = useState<BlenderTemplateId>('audio_reactive_tunnel');
    const [aspectRatio, setAspectRatio] = useState<BlenderAspectRatio>('16:9');
    const [durationSeconds, setDurationSeconds] = useState<number>(30);
    const [isRendering, setIsRendering] = useState(false);
    const [renderProgress, setRenderProgress] = useState<number>(0);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [renderResult, setRenderResult] = useState<string | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        blenderService.getStatus().then(s => {
            if (mounted) setStatus(s);
        });
        blenderService.listTemplates().then(t => {
            if (mounted && t.length > 0) setTemplates(t);
        });
        const unsubscribe = window.electronAPI?.blender?.onProgress?.(progress => {
            if (mounted && progress.requestId === activeRequest.current) {
                setRenderProgress(Math.min(100, Math.max(0, progress.percentage)));
                setProgressMessage(progress.message || 'Rendering…');
            }
        });
        return () => {
            mounted = false;
            unsubscribe?.();
            if (activeRequest.current) void window.electronAPI?.blender?.cancelRender?.(activeRequest.current);
        };
    }, []);

    useEffect(() => {
        activeRequest.current = null;
        setIsRendering(false);
        setIsSaving(false);
        setRenderProgress(0);
        setRenderResult(null);
        setPreviewUrl(null);
        setRenderError(null);
        pendingSave.current = null;
        setHasPendingSave(false);
        if (pendingSaveKey) {
            try {
                const output = localStorage.getItem(`indii.blender.pending:${pendingSaveKey}`);
                if (output && /^[a-f0-9-]{36}\.mp4$/i.test(output.split(/[\\/]/).pop() || '') && onRenderComplete) {
                    pendingSave.current = { path: output, key: pendingSaveKey,
                        save: async () => onRenderComplete(output) };
                    setHasPendingSave(true);
                }
            } catch (error) { setRenderError(error instanceof Error ? error.message : String(error)); }
        }
        return () => {
            if (activeRequest.current) void window.electronAPI?.blender?.cancelRender?.(activeRequest.current);
        };
        // Capture the callback for this account/project; a rerender must not
        // retarget a pending save to a newly selected account or project.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingSaveKey]);

    const refreshStatus = async () => {
        try { setStatus(await blenderService.getStatus()); }
        catch (error) { setRenderError(error instanceof Error ? error.message : String(error)); }
    };

    const chooseInput = async (kind: 'audio' | 'image') => {
        try {
            const selected = await new ElectronPlatformAdapter().selectFile({
                title: kind === 'audio' ? 'Choose music for this video' : 'Choose cover art',
                filters: [{ name: kind === 'audio' ? 'Music' : 'Images', extensions: kind === 'audio'
                    ? ['wav', 'mp3', 'flac', 'm4a', 'aiff', 'ogg'] : ['png', 'jpg', 'jpeg', 'webp'] }],
            });
            if (selected) { if (kind === 'audio') setAudioPath(selected); else setCoverPath(selected); }
        } catch (error) { setRenderError(error instanceof Error ? error.message : String(error)); }
    };

    const saveCompletedVideo = async () => {
        const pending = pendingSave.current;
        if (!pending) return;
        setIsSaving(true);
        setRenderError(null);
        setProgressMessage('Saving video to your project…');
        try {
            const savedUrl = await pending.save();
            if (pending.key) {
                try { localStorage.removeItem(`indii.blender.pending:${pending.key}`); }
                catch { /* Cloud records are committed; retrying a leftover reminder is idempotent. */ }
            }
            if (currentSaveKey.current !== pending.key) return;
            if (savedUrl) setPreviewUrl(savedUrl);
            setRenderResult(pending.path);
            pendingSave.current = null;
            setHasPendingSave(false);
        } catch (error) {
            if (currentSaveKey.current === pending.key) setRenderError(error instanceof Error ? error.message : String(error));
        } finally {
            if (currentSaveKey.current === pending.key) setIsSaving(false);
        }
    };

    const handleStartRender = async () => {
        if (!audioPath || !status?.installed || !window.electronAPI?.blender || !onRenderComplete || !pendingSaveKey) {
            setRenderError('Open a signed-in project in the desktop studio and choose a music file before rendering.');
            return;
        }
        const originSaveKey = pendingSaveKey;
        const requestId = crypto.randomUUID();
        activeRequest.current = requestId;
        setIsRendering(true);
        setRenderProgress(0);
        setProgressMessage('Starting Blender…');
        setRenderResult(null);
        setPreviewUrl(null);
        setRenderError(null);

        try {
            const res = await blenderService.renderMusicVideo({
                audioFilePath: audioPath,
                requestId,
                templateId: selectedTemplate,
                bpm,
                durationSeconds,
                aspectRatio,
                visualTokens: {
                    artistName,
                    trackTitle,
                    coverArtPath: coverPath || undefined
                }
            });


            if (res.success) {
                if (!res.outputPath) throw new Error('Blender returned no completed video.');
                const output = res.outputPath;
                if (originSaveKey) {
                    try { localStorage.setItem(`indii.blender.pending:${originSaveKey}`, output); }
                    catch (error) { setRenderError(error instanceof Error ? error.message : String(error)); }
                }
                if (currentSaveKey.current !== originSaveKey) return;
                pendingSave.current = { path: output, key: originSaveKey, save: async () => onRenderComplete(output) };
                setHasPendingSave(true);
                await saveCompletedVideo();
                if (currentSaveKey.current === originSaveKey) setRenderProgress(100);
            } else {
                if (currentSaveKey.current === originSaveKey) setRenderError(res.error || 'Rendering encountered an error.');
            }
        } catch (err) {
            if (currentSaveKey.current === originSaveKey) setRenderError(err instanceof Error ? err.message : String(err));
        } finally {
            if (activeRequest.current === requestId) {
                activeRequest.current = null;
                setIsSaving(false);
                setIsRendering(false);
            }
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

                        </h3>
                        <p className="text-sm text-neutral-400">
                            Make 3D visualizers and music videos driven by your track.
                        </p>
                    </div>
                </div>

                {/* Status Badge */}
                <div>
                    {status?.installed && window.electronAPI?.blender ? (
                        <div className="flex items-center space-x-2 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{status.version || 'Blender Ready'} ({status.gpuAcceleration} GPU)</span>
                        </div>
                    ) : (
                        <div className="flex items-center space-x-2 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-full">
                            <AlertCircle className="w-4 h-4" />
                            <span>{!window.electronAPI?.blender ? 'Open desktop studio' : !status ? 'Checking Blender…' : 'Blender Not Detected'}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Installation Helper if not installed */}
            {status && !status.installed && (
                <div className="bg-neutral-950 border border-amber-500/20 rounded-lg p-4 flex items-center justify-between text-sm">
                    <div className="space-y-1">
                        <p className="text-neutral-200 font-medium">{window.electronAPI?.blender ? 'Install Blender to unlock 3D rendering' : 'Render 3D videos in the desktop studio'}</p>
                        <p className="text-neutral-400 text-xs">
                            {window.electronAPI?.blender ? 'Download Blender for your computer from blender.org.' : 'The web studio cannot inspect Blender installed on your computer.'}
                        </p>
                    </div>
                    {window.electronAPI?.blender ? <div className="flex gap-2">
                        <a href="https://www.blender.org/download/" target="_blank" rel="noreferrer" className="px-3 py-2 bg-neutral-800 rounded">Get Blender</a>
                        <button type="button" onClick={() => void refreshStatus()} className="px-3 py-2 bg-neutral-800 rounded">Check again</button>
                    </div> : <a href="https://indii.music/" target="_blank" rel="noreferrer" className="px-3 py-2 bg-neutral-800 rounded">Get desktop studio</a>}
                </div>
            )}

            <div className="space-y-3 text-sm">
                <button type="button" onClick={() => void chooseInput('audio')} disabled={isRendering || !window.electronAPI?.blender}
                    className="px-4 py-2 rounded bg-neutral-800 disabled:opacity-50">Choose music file</button>
                <p>{audioPath ? audioPath.split(/[\\/]/).pop() : 'Choose the track to animate.'}</p>
                {templates.find(template => template.id === selectedTemplate)?.supportsCoverArt && <>
                    <button type="button" onClick={() => void chooseInput('image')} disabled={isRendering || !window.electronAPI?.blender}
                        className="px-4 py-2 rounded bg-neutral-800 disabled:opacity-50">Choose cover art (optional)</button>
                    {coverPath && <p>{coverPath.split(/[\\/]/).pop()}</p>}
                </>}
            </div>
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
                            {progressMessage}
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
                    <span>Video saved to your project.</span>
                </div>
            )}
            {previewUrl && <video controls src={previewUrl} preload="metadata"
                className="w-full max-h-96 rounded-lg bg-black"
                onError={() => setRenderError('The video is saved, but playback could not load. Open it from your project library to retry.')} />}
            {renderError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
                    <span>Error: {renderError}</span>
                </div>
            )}

            {hasPendingSave && !isRendering && <div className="space-y-2 text-sm">
                <p>The video is rendered locally. Save it to your project before starting another render.</p>
                <button type="button" disabled={isSaving} onClick={() => void saveCompletedVideo()}
                    className="px-4 py-2 rounded bg-cyan-700 disabled:opacity-50">{isSaving ? 'Saving…' : 'Retry project save'}</button>
            </div>}
            {isRendering && !isSaving && <button type="button" onClick={() => {
                if (activeRequest.current) void window.electronAPI?.blender?.cancelRender?.(activeRequest.current);
            }} className="px-4 py-2 rounded bg-neutral-800">Cancel render</button>}
            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                    onClick={handleStartRender}
                    disabled={isRendering || isSaving || hasPendingSave || !pendingSaveKey || !audioPath || !status?.installed || !window.electronAPI?.blender}
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
