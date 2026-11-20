import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    Image as ImageIcon,
    FileText,
    Music,
    Video,
    Download,
    Pin,
    ExternalLink,
    BarChart3,
} from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { HistoryItem } from '@/core/types/history';
import { cn } from '@/lib/utils';

function isSafeExternalAssetUrl(rawUrl: string): boolean {
    try {
        const parsed = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : 'https://localhost');
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'blob:';
    } catch {
        return false;
    }
}

export function BoardroomWorkbenchView() {
    const toast = useToast();
    const openStudio = useStore(state => state.openBoardroomModulePreview);
    const artifactRequestIdRef = useRef(0);
    const {
        generatedHistory,
        boardroomWorkbenchTarget,
        addReferencedAsset,
        openImageInStudio,
        canvasPanels,
    } = useStore(
        useShallow(state => ({
            generatedHistory: state.generatedHistory || [],
            boardroomWorkbenchTarget: state.boardroomWorkbenchTarget,
            addReferencedAsset: state.addReferencedAsset,
            openImageInStudio: state.openImageInStudio,
            canvasPanels: state.canvasPanels || [],
        }))
    );

    const requestedTab = boardroomWorkbenchTarget?.kind === 'canvas' ? 'canvas' : 'assets';
    const [tabOverride, setTabOverride] = useState<{
        target: typeof boardroomWorkbenchTarget;
        tab: 'assets' | 'artifacts' | 'canvas';
    }>();
    const subTab = tabOverride?.target === boardroomWorkbenchTarget ? tabOverride.tab : requestedTab;
    const setSubTab = (tab: typeof subTab) => setTabOverride({ target: boardroomWorkbenchTarget, tab });
    const requestedPanel = boardroomWorkbenchTarget?.kind === 'canvas' ? boardroomWorkbenchTarget.panelId : null;
    const [artifacts, setArtifacts] = useState<{ filename: string }[]>([]);
    const [activeArtifactContent, setActiveArtifactContent] = useState<string | null>(null);
    const [selectedArtifactFile, setSelectedArtifactFile] = useState<string | null>(null);

    // Selected asset from history: sync cleanly whenever store target changes while mounted
    const targetAssetKey =
        boardroomWorkbenchTarget?.kind === 'asset'
            ? boardroomWorkbenchTarget.itemId
            : null;
    const [userAssetOverride, setUserAssetOverride] = useState<{
        forTargetKey: string | null;
        itemId: string;
    } | null>(null);
    const selectedAssetId =
        userAssetOverride && userAssetOverride.forTargetKey === targetAssetKey
            ? userAssetOverride.itemId
            : targetAssetKey || generatedHistory[0]?.id || null;

    const activeAsset = generatedHistory.find(i => i.id === selectedAssetId) ?? null;

    const handleSelectArtifact = useCallback(async (filename: string) => {
        const requestId = ++artifactRequestIdRef.current;
        setSelectedArtifactFile(filename);
        setActiveArtifactContent(null);
        if (window.electronAPI?.agent?.readArtifact) {
            try {
                const res = await window.electronAPI.agent.readArtifact(filename);
                if (requestId !== artifactRequestIdRef.current) return;
                if (res.success && res.data) {
                    setActiveArtifactContent(res.data);
                }
            } catch {
                if (requestId !== artifactRequestIdRef.current) return;
                toast.error(`Failed to read artifact ${filename}`);
            }
        }
    }, [toast]);

    // Load artifacts if electron API is available
    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            if (typeof window !== 'undefined' && window.electronAPI?.agent?.listArtifacts) {
                try {
                    const res = await window.electronAPI.agent.listArtifacts();
                    if (isMounted && res.success && res.data) {
                        setArtifacts(res.data);
                        if (res.data.length > 0) {
                            void handleSelectArtifact(res.data[0].filename);
                        }
                    }
                } catch {
                    // ignore
                }
            }
        };
        void load();
        return () => { isMounted = false; };
    }, [handleSelectArtifact]);

    const handleExport = useCallback(async (item: HistoryItem) => {
        try {
            const { downloadAsset } = await import('@/utils/download');
            const ext = item.type === 'video' ? 'mp4' : item.type === 'music' ? 'mp3' : 'png';
            const filename = `${item.type}-export-${item.id.slice(0, 8)}.${ext}`;
            const ok = await downloadAsset(item.url, filename);
            if (ok) {
                toast.success(`"${(item.prompt || 'Asset').slice(0, 40)}" saved to your computer.`);
            } else {
                toast.error('Export failed.');
            }
        } catch {
            toast.error('Export failed.');
        }
    }, [toast]);

    const handlePinToTable = (item: HistoryItem) => {
        addReferencedAsset({
            id: `asset-${item.id}`,
            name: (item.prompt || `${item.type} asset`).slice(0, 60),
            type: 'url',
            value: item.url,
            prompt: item.prompt,
            sourceType: item.type,
            origin: 'boardroom_workbench',
        });
        toast.success(`Asset pinned to Boardroom references!`);
    };

    const handleSendToStudio = (item: HistoryItem) => {
        if (item.type === 'image' && openImageInStudio) {
            openImageInStudio({
                imageId: item.id,
                sourceUrl: item.url,
                sourceMessageId: `boardroom-wb-${item.id}`,
                agentId: 'creative',
                prompt: item.prompt || 'Boardroom Asset',
            });
            toast.success(`Sent to Creative Studio!`);
        } else {
            if (item.url && isSafeExternalAssetUrl(item.url)) {
                window.open(item.url, '_blank', 'noopener,noreferrer');
            } else {
                toast.error('Blocked unsupported asset URL scheme.');
            }
        }
    };

    return (
        <div data-testid="boardroom-workbench-view" className="h-full w-full flex flex-col bg-zinc-950 text-white min-h-0 min-w-0 overflow-hidden">
            {/* Workbench Sub-Tab Switcher */}
            <div className="flex items-center justify-between px-3 py-2 bg-black/60 border-b border-white/10 shrink-0 min-w-0">
                <div
                    role="tablist"
                    aria-label="Asset Workbench sections"
                    className="flex flex-wrap items-center gap-1 min-w-0"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={subTab === 'assets'}
                        onClick={() => setSubTab('assets')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
                            subTab === 'assets'
                                ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/40"
                                : "text-white/60 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <ImageIcon size={13} />
                        <span>Generated Media ({generatedHistory.length})</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={subTab === 'artifacts'}
                        onClick={() => setSubTab('artifacts')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
                            subTab === 'artifacts'
                                ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/40"
                                : "text-white/60 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <FileText size={13} />
                        <span>Artifacts & Splits ({artifacts.length})</span>
                    </button>
                    {(requestedPanel || canvasPanels.length > 0) && (
                        <button
                            type="button"
                            role="tab"
                            aria-selected={subTab === 'canvas'}
                            onClick={() => setSubTab('canvas')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
                                subTab === 'canvas'
                                    ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/40"
                                    : "text-white/60 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <BarChart3 size={13} />
                            <span>A2UI Data ({canvasPanels.length})</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Sub-tab 1: Generated Assets */}
            {subTab === 'assets' && (
                <div className="flex-1 flex flex-col @[640px]:flex-row min-h-0 min-w-0 overflow-hidden">
                    {/* Left Thumbnails List */}
                    <div className="w-full @[640px]:w-56 border-b @[640px]:border-b-0 @[640px]:border-r border-white/10 p-2 overflow-y-auto custom-scrollbar flex @[640px]:flex-col gap-2 shrink-0 bg-black/40">
                        {generatedHistory.length === 0 ? (
                            <p className="text-xs text-white/30 text-center p-6 italic">No assets generated yet.</p>
                        ) : (
                            generatedHistory.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setUserAssetOverride({ forTargetKey: targetAssetKey, itemId: item.id })}
                                    className={cn(
                                        "flex items-center gap-2 p-2 rounded-xl text-left transition-all border shrink-0 md:w-full",
                                        selectedAssetId === item.id
                                            ? "bg-indigo-600/25 border-indigo-400/50 shadow-md"
                                            : "bg-white/5 border-white/5 hover:bg-white/10 text-white/70"
                                    )}
                                >
                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/60 shrink-0 flex items-center justify-center">
                                        {item.type === 'image' && item.url ? (
                                            <img src={item.url} alt="" className="w-full h-full object-cover" />
                                        ) : item.type === 'video' ? (
                                            <Video size={16} className="text-cyan-400" />
                                        ) : item.type === 'music' ? (
                                            <Music size={16} className="text-green-400" />
                                        ) : (
                                            <FileText size={16} className="text-amber-400" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1 hidden md:block">
                                        <p className="text-xs font-bold truncate text-white/90">
                                            {item.prompt || 'Generated Asset'}
                                        </p>
                                        <span className="text-[9px] uppercase font-mono text-white/40">
                                            {item.type}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Main Asset Inspector */}
                    <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar min-h-0 min-w-0">
                        {activeAsset ? (
                            <div className="space-y-4 max-w-2xl mx-auto w-full">
                                {/* Preview Card */}
                                <div className="rounded-2xl border border-white/10 bg-black/60 overflow-hidden shadow-2xl flex items-center justify-center max-h-[50vh] p-2">
                                    {activeAsset.type === 'image' && activeAsset.url ? (
                                        <img
                                            src={activeAsset.url}
                                            alt={activeAsset.prompt || 'Generated Asset'}
                                            className="max-h-[46vh] max-w-full object-contain rounded-xl"
                                        />
                                    ) : activeAsset.type === 'video' && activeAsset.url ? (
                                        <video src={activeAsset.url} controls className="max-h-[46vh] max-w-full rounded-xl" />
                                    ) : activeAsset.type === 'music' && activeAsset.url ? (
                                        <div className="p-8 text-center space-y-4">
                                            <Music size={48} className="text-green-400 mx-auto" />
                                            <audio src={activeAsset.url} controls className="w-full" />
                                        </div>
                                    ) : (
                                        <div className="p-12 text-center text-white/40">
                                            <FileText size={32} className="mx-auto mb-2 opacity-50" />
                                            <p className="text-xs">{activeAsset.prompt || 'Text deliverable'}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Asset Prompt & Details */}
                                {activeAsset.prompt && (
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-white/80">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 block mb-1">
                                            Generation Prompt
                                        </span>
                                        <p className="leading-relaxed">{activeAsset.prompt}</p>
                                    </div>
                                )}

                                {/* Action Toolbar */}
                                <div className="flex flex-wrap items-center gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => handlePinToTable(activeAsset)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-200 text-xs font-bold transition-all"
                                    >
                                        <Pin size={13} />
                                        <span>Pin to Swarm</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSendToStudio(activeAsset)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-bold transition-all"
                                    >
                                        <ExternalLink size={13} />
                                        <span>Open in Studio</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleExport(activeAsset)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 text-xs font-bold transition-all"
                                    >
                                        <Download size={13} />
                                        <span>Export</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-white/40">
                                <ImageIcon size={32} className="opacity-30 mb-2" />
                                <p className="text-xs">{targetAssetKey ? 'The requested asset is unavailable.' : 'Select or generate an asset to inspect.'}</p>
                                {!generatedHistory.length && (
                                    <button
                                        type="button"
                                        onClick={() => openStudio('creative')}
                                        className="mt-3 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                                    >
                                        Open Studio
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Sub-tab 2: Artifacts & Split Sheets */}
            {subTab === 'artifacts' && (
                <div className="flex-1 flex flex-col @[640px]:flex-row min-h-0 min-w-0 overflow-hidden">
                    {/* Artifacts List */}
                    <div className="w-full @[640px]:w-56 border-b @[640px]:border-b-0 @[640px]:border-r border-white/10 p-2 overflow-y-auto custom-scrollbar flex @[640px]:flex-col gap-1.5 shrink-0 bg-black/40">
                        {artifacts.length === 0 ? (
                            <p className="text-xs text-white/30 text-center p-6 italic">No artifacts saved.</p>
                        ) : (
                            artifacts.map(art => (
                                <button
                                    key={art.filename}
                                    type="button"
                                    onClick={() => handleSelectArtifact(art.filename)}
                                    className={cn(
                                        "w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs transition-all border truncate",
                                        selectedArtifactFile === art.filename
                                            ? "bg-indigo-600/30 border-indigo-400/50 text-indigo-200 font-bold"
                                            : "bg-white/5 border-white/5 hover:bg-white/10 text-white/70"
                                    )}
                                >
                                    <FileText size={13} className="shrink-0 text-indigo-400" />
                                    <span className="truncate">{art.filename}</span>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Markdown Document Reader */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar min-h-0 min-w-0">
                        {selectedArtifactFile ? (
                            <div className="max-w-3xl mx-auto space-y-4">
                                <div className="border-b border-white/10 pb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h2 className="text-sm font-bold text-white flex items-center gap-2 min-w-0 truncate">
                                        <FileText size={15} className="text-indigo-400 shrink-0" />
                                        <span className="truncate">{selectedArtifactFile}</span>
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (activeArtifactContent && navigator.clipboard?.writeText) {
                                                void navigator.clipboard
                                                    .writeText(activeArtifactContent)
                                                    .then(() => toast.success('Document copied to clipboard!'))
                                                    .catch(() => toast.error('Failed to copy document.'));
                                            }
                                        }}
                                        className="text-xs px-2.5 py-1 bg-white/10 hover:bg-white/15 rounded-lg text-white/80 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                                    >
                                        Copy Markdown
                                    </button>
                                </div>
                                <div className="prose prose-invert prose-sm leading-relaxed text-xs">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {activeArtifactContent || 'Loading document...'}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-white/40 h-full">
                                <FileText size={32} className="opacity-30 mb-2" />
                                <p className="text-xs">Select an artifact to read.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Sub-tab 3: A2UI Canvas Data Panels */}
            {subTab === 'canvas' && (
                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                    <div className="max-w-3xl mx-auto space-y-4">
                        {requestedPanel && !canvasPanels.some(panel => panel.id === requestedPanel) && (
                            <p role="status">The requested canvas panel is unavailable.</p>
                        )}
                        {canvasPanels.filter(panel => !requestedPanel || panel.id === requestedPanel).map((panel) => (
                            <div key={panel.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 size={15} className="text-indigo-400" />
                                        <span className="text-xs font-bold text-white">{panel.title}</span>
                                    </div>
                                    <span className="text-[10px] uppercase font-mono text-white/40">{panel.type}</span>
                                </div>
                                <div className="text-xs text-white/80">
                                    {typeof panel.data === 'string' ? (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{panel.data}</ReactMarkdown>
                                    ) : (
                                        <pre className="p-3 bg-black/40 rounded-lg overflow-x-auto text-[11px] font-mono">
                                            {JSON.stringify(panel.data, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
export default BoardroomWorkbenchView;
