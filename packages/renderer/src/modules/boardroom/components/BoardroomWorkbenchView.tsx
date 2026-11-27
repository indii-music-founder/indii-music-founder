import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import type { ReferencedAsset } from '@/core/store/slices/boardroomSlice';
import { projectBucketMatches } from '@/core/constants';
import { cn } from '@/lib/utils';
import type { BoardroomWorkbenchTarget } from '@/core/store/slices/boardroomSlice';
import { webArtifactStorage } from '@/services/agent/WebArtifactStorage';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';
import { isSafeExternalAssetUrl } from '@/modules/boardroom/utils/boardroomUrls';

type WorkbenchTab = 'assets' | 'artifacts' | 'canvas';
type ArtifactRequest = { filename: string; owner?: string; target: BoardroomWorkbenchTarget; attempt: number };
type ArtifactRead = { request: ArtifactRequest } & (
    { status: 'loaded'; content: string } | { status: 'failed' }
);

export interface BoardroomWorkbenchViewProps {
    filterSessionId?: string | null;
    filterProjectId?: string | null;
    assetScope?: 'room' | 'project';
    onAssetScopeChange?: (scope: 'room' | 'project') => void;
    onPinAsset?: (asset: ReferencedAsset) => void;
}

export function BoardroomWorkbenchView({
    filterSessionId,
    filterProjectId,
    assetScope = 'room',
    onAssetScopeChange,
    onPinAsset,
}: BoardroomWorkbenchViewProps = {}) {
    const toast = useToast();
    const openStudio = useStore(state => state.openBoardroomModulePreview);
    const artifactOwner = useStore(state => state.user?.uid);
    const {
        generatedHistory: rawGeneratedHistory,
        isHistoryInitialized,
        historySyncError,
        initializeHistory,
        boardroomWorkbenchTarget,
        addReferencedAsset,
        openImageInStudio,
        canvasPanels,
        boardroomControl,
        takeBoardroomControl,
    } = useStore(
        useShallow(state => ({
            generatedHistory: state.generatedHistory || [],
            isHistoryInitialized: state.isHistoryInitialized ?? true,
            historySyncError: state.historySyncError ?? null,
            initializeHistory: state.initializeHistory,
            boardroomWorkbenchTarget: state.boardroomWorkbenchTarget,
            addReferencedAsset: state.addReferencedAsset,
            openImageInStudio: state.openImageInStudio,
            canvasPanels: state.canvasPanels || [],
            boardroomControl: state.boardroomControl,
            takeBoardroomControl: state.takeBoardroomControl,
        }))
    );

    const projectHistory = filterSessionId && filterProjectId
        ? rawGeneratedHistory.filter(item => projectBucketMatches(item.projectId, filterProjectId))
        : rawGeneratedHistory;
    const roomHistory = filterSessionId
        ? rawGeneratedHistory.filter(item => item.sessionId === filterSessionId)
        : rawGeneratedHistory;
    const generatedHistory = filterSessionId && assetScope === 'room'
        ? roomHistory
        : projectHistory;

    const [tabOverride, setTabOverride] = useState<{
        target: BoardroomWorkbenchTarget;
        tab: WorkbenchTab;
    } | null>(null);
    const defaultTab = boardroomWorkbenchTarget?.kind === 'artifact' || boardroomWorkbenchTarget?.kind === 'split-sheet'
        ? 'artifacts'
        : boardroomWorkbenchTarget?.kind === 'canvas' ? 'canvas' : 'assets';
    const subTab = tabOverride && tabOverride.target === boardroomWorkbenchTarget ? tabOverride.tab : defaultTab;
    const setSubTab = (tab: WorkbenchTab) => setTabOverride({ target: boardroomWorkbenchTarget, tab });

    const requestedPanel = boardroomWorkbenchTarget?.kind === 'canvas' ? boardroomWorkbenchTarget.panelId : null;
    const [listAttempt, setListAttempt] = useState(0);
    const listRequest = useMemo(() => ({
        owner: artifactOwner,
        target: boardroomWorkbenchTarget,
        attempt: listAttempt,
    }), [artifactOwner, boardroomWorkbenchTarget, listAttempt]);
    const [artifactList, setArtifactList] = useState<{
        request: typeof listRequest;
        files?: { filename: string }[];
    } | null>(null);
    const currentList = artifactList?.request === listRequest ? artifactList : null;
    const artifacts = currentList?.files ?? [];
    const [artifactOverride, setArtifactOverride] = useState<{
        target: BoardroomWorkbenchTarget;
        filename: string;
    } | null>(null);
    const targetArtifact = boardroomWorkbenchTarget?.kind === 'artifact'
        ? boardroomWorkbenchTarget.filename
        : boardroomWorkbenchTarget?.kind === 'split-sheet' && boardroomWorkbenchTarget.itemId
            ? artifacts.find(a => a.filename === boardroomWorkbenchTarget.itemId || a.filename.includes(boardroomWorkbenchTarget.itemId ?? ''))?.filename ?? null
            : null;
    const selectedArtifactFile = artifactOverride && artifactOverride.target === boardroomWorkbenchTarget
        ? artifactOverride.filename
        : targetArtifact ?? artifacts[0]?.filename ?? null;
    const [attempt, setAttempt] = useState(0);
    const artifactRequest = useMemo(() => subTab === 'artifacts' && selectedArtifactFile
        ? { filename: selectedArtifactFile, owner: artifactOwner, target: boardroomWorkbenchTarget, attempt }
        : null, [artifactOwner, attempt, boardroomWorkbenchTarget, selectedArtifactFile, subTab]);
    const [artifactRead, setArtifactRead] = useState<ArtifactRead | null>(null);
    const currentRead = artifactRead?.request === artifactRequest ? artifactRead : null;
    const activeArtifactContent = currentRead?.status === 'loaded' ? currentRead.content : null;

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

    useEffect(() => {
        if (!artifactRequest) return;
        let cancelled = false;
        const read = async () => {
            try {
                const agent = window.electronAPI?.agent;
                const content = agent?.readArtifact
                    ? await agent.readArtifact(artifactRequest.filename).then(result => result.success ? result.data : undefined)
                    : await webArtifactStorage.read(artifactRequest.owner, artifactRequest.filename);
                if (cancelled) return;
                if (typeof content === 'string') {
                    setArtifactRead({ request: artifactRequest, status: 'loaded', content });
                } else {
                    setArtifactRead({ request: artifactRequest, status: 'failed' });
                }
            } catch {
                if (!cancelled) setArtifactRead({ request: artifactRequest, status: 'failed' });
            }
        };
        void read();
        return () => { cancelled = true; };
    }, [artifactRequest]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const agent = window.electronAPI?.agent;
                const files = agent?.listArtifacts
                    ? await agent.listArtifacts().then(result => result.success ? result.data : undefined)
                    : await webArtifactStorage.list(listRequest.owner);
                if (!cancelled) setArtifactList({ request: listRequest, files });
            } catch {
                if (!cancelled) setArtifactList({ request: listRequest });
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [listRequest]);

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
        const assetPayload: ReferencedAsset = {
            id: `asset-${item.id}`,
            name: (item.prompt || `${item.type} asset`).slice(0, 60),
            type: 'url',
            value: item.url,
            prompt: item.prompt,
            sourceType: item.type,
            storageUri: item.storageUri,
            origin: filterSessionId ? 'meeting_room_workbench' : 'boardroom_workbench',
        };
        if (onPinAsset) {
            onPinAsset(assetPayload);
            toast.success('Asset pinned to Meeting Room references!');
            return;
        }
        addReferencedAsset(assetPayload);
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

    const workbenchHolder = boardroomControl?.surface === 'workbench' ? boardroomControl.holder : 'artist';
    const workbenchHolderName = workbenchHolder === 'artist'
        ? 'You'
        : resolveAgentVisualIdentity(workbenchHolder).displayName;

    const availableTabs: WorkbenchTab[] = requestedPanel || canvasPanels.length > 0
        ? ['assets', 'artifacts', 'canvas']
        : ['assets', 'artifacts'];

    const handleWorkbenchTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const currentIndex = availableTabs.indexOf(subTab);
        if (currentIndex < 0) return;
        let nextIndex = -1;
        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % availableTabs.length;
        else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + availableTabs.length) % availableTabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = availableTabs.length - 1;
        if (nextIndex < 0) return;
        event.preventDefault();
        const nextTab = availableTabs[nextIndex]!;
        setSubTab(nextTab);
        document.getElementById(`workbench-tab-${nextTab}`)?.focus();
    };

    return (
        <div data-testid="boardroom-workbench-view" className="h-full w-full flex flex-col bg-bg-dark text-white min-h-0 min-w-0 overflow-hidden">
            {/* Control Status Bar (Spec D2) */}
            <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-surface border-b border-white/10 shrink-0 gap-2 text-xs">
                <span role="status" className="text-white/75">
                    {workbenchHolder === 'artist' ? 'You have control' : `${workbenchHolderName} has control`}
                </span>
                {workbenchHolder !== 'artist' && (
                    <button
                        type="button"
                        onClick={() => takeBoardroomControl?.('workbench')}
                        className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                        Take control
                    </button>
                )}
            </div>
            {/* Workbench Sub-Tab Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-black/60 border-b border-white/10 shrink-0 min-w-0">
                <div
                    role="tablist"
                    aria-label="Asset Workbench sections"
                    onKeyDown={handleWorkbenchTabKeyDown}
                    className="flex flex-wrap items-center gap-1 min-w-0"
                >
                    <button
                        id="workbench-tab-assets"
                        type="button"
                        role="tab"
                        aria-selected={subTab === 'assets'}
                        aria-controls="workbench-tabpanel-assets"
                        tabIndex={subTab === 'assets' ? 0 : -1}
                        onClick={() => setSubTab('assets')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
                            subTab === 'assets'
                                ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/40"
                                : "text-white/60 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <ImageIcon size={13} />
                        <span>Generated Media ({generatedHistory.length})</span>
                    </button>
                    <button
                        id="workbench-tab-artifacts"
                        type="button"
                        role="tab"
                        aria-selected={subTab === 'artifacts'}
                        aria-controls="workbench-tabpanel-artifacts"
                        tabIndex={subTab === 'artifacts' ? 0 : -1}
                        onClick={() => setSubTab('artifacts')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
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
                            id="workbench-tab-canvas"
                            type="button"
                            role="tab"
                            aria-selected={subTab === 'canvas'}
                            aria-controls="workbench-tabpanel-canvas"
                            tabIndex={subTab === 'canvas' ? 0 : -1}
                            onClick={() => setSubTab('canvas')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
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
                {filterSessionId && onAssetScopeChange && subTab === 'assets' && (
                    <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10 shrink-0">
                        <button
                            type="button"
                            onClick={() => onAssetScopeChange('room')}
                            className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors",
                                assetScope === 'room'
                                    ? "bg-indigo-600 text-white"
                                    : "text-white/60 hover:text-white"
                            )}
                        >
                            This Room ({roomHistory.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => onAssetScopeChange('project')}
                            className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors",
                                assetScope === 'project'
                                    ? "bg-indigo-600 text-white"
                                    : "text-white/60 hover:text-white"
                            )}
                        >
                            All Project ({projectHistory.length})
                        </button>
                    </div>
                )}
            </div>

            {/* Sub-tab 1: Generated Assets */}
            {subTab === 'assets' && (
                <div
                    id="workbench-tabpanel-assets"
                    role="tabpanel"
                    aria-labelledby="workbench-tab-assets"
                    className="flex-1 flex flex-col @[640px]:flex-row min-h-0 min-w-0 overflow-hidden"
                >
                    {/* Left Thumbnails List */}
                    <div className="w-full @[640px]:w-56 border-b @[640px]:border-b-0 @[640px]:border-r border-white/10 p-2 overflow-y-auto custom-scrollbar flex @[640px]:flex-col gap-2 shrink-0 bg-black/40">
                        {historySyncError ? (
                            <div className="space-y-2 p-3 text-xs">
                                <p role="alert" className="text-rose-300">Could not load media: {historySyncError}</p>
                                {initializeHistory && (
                                    <button
                                        type="button"
                                        onClick={() => void initializeHistory()}
                                        className="rounded bg-white/10 px-2.5 py-1 text-white hover:bg-white/15"
                                    >
                                        Retry media
                                    </button>
                                )}
                            </div>
                        ) : !isHistoryInitialized && generatedHistory.length === 0 ? (
                            <p role="status" className="p-4 text-xs text-white/60">Loading media…</p>
                        ) : generatedHistory.length === 0 ? (
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
                                            <img src={item.url} alt="" loading="lazy" className="w-full h-full object-cover" />
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
                                        <span className="text-[10px] uppercase font-mono text-white/40">
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
                                        <div className="p-6 text-center space-y-4">
                                            <Music size={28} className="text-green-400 mx-auto" />
                                            <audio src={activeAsset.url} controls className="w-full" />
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-white/40">
                                            <FileText size={20} className="mx-auto mb-2 opacity-50" />
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
                                        <span>Pin for Team</span>
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
                                <ImageIcon size={20} className="opacity-30 mb-2" />
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
                <div
                    id="workbench-tabpanel-artifacts"
                    role="tabpanel"
                    aria-labelledby="workbench-tab-artifacts"
                    className="flex-1 flex flex-col @[640px]:flex-row min-h-0 min-w-0 overflow-hidden"
                >
                    {/* Artifacts List */}
                    <div className="w-full @[640px]:w-56 border-b @[640px]:border-b-0 @[640px]:border-r border-white/10 p-2 overflow-y-auto custom-scrollbar flex @[640px]:flex-col gap-1.5 shrink-0 bg-black/40">
                        {!currentList ? (
                            <p role="status" className="p-2 text-xs text-white/60">Loading artifacts…</p>
                        ) : !currentList.files ? (
                            <div className="space-y-2 p-2 text-xs">
                                <p role="alert" className="text-rose-300">Could not list artifacts.</p>
                                <button type="button" className="rounded bg-white/10 px-2 py-1"
                                    onClick={() => setListAttempt(value => value + 1)}>
                                    Retry list
                                </button>
                            </div>
                        ) : artifacts.length === 0 ? (
                            <p className="text-xs text-white/30 text-center p-6 italic">No artifacts saved.</p>
                        ) : (
                            artifacts.map(art => (
                                <button
                                    key={art.filename}
                                    type="button"
                                    onClick={() => setArtifactOverride({ target: boardroomWorkbenchTarget, filename: art.filename })}
                                    aria-pressed={selectedArtifactFile === art.filename}
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
                        {boardroomWorkbenchTarget?.kind === 'split-sheet' && (
                            <div
                                data-testid="boardroom-split-sheet-target"
                                className="max-w-3xl mx-auto mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100"
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block mb-0.5">
                                    Active Split Sheet
                                </span>
                                <span className="font-semibold">
                                    {boardroomWorkbenchTarget.title || boardroomWorkbenchTarget.itemId || 'Collaborator Split Sheet'}
                                </span>
                            </div>
                        )}
                        {selectedArtifactFile ? (
                            <div className="max-w-3xl mx-auto space-y-4">
                                <div className="border-b border-white/10 pb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h2 className="text-sm font-bold text-white flex items-center gap-2 min-w-0 truncate">
                                        <FileText size={15} className="text-indigo-400 shrink-0" />
                                        <span className="truncate">{selectedArtifactFile}</span>
                                    </h2>
                                    <button
                                        type="button"
                                        disabled={!activeArtifactContent?.trim()}
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
                                {!currentRead ? (
                                    <p role="status" className="text-xs text-white/60">Loading document...</p>
                                ) : currentRead.status === 'failed' ? (
                                    <div className="space-y-2 text-xs">
                                        <p role="alert" className="text-rose-300">Could not read this document.</p>
                                        <button
                                            type="button"
                                            onClick={() => setAttempt(value => value + 1)}
                                            className="rounded bg-white/10 px-2 py-1 text-white hover:bg-white/15"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                ) : currentRead.content.trim() ? (
                                    <div className="prose prose-invert prose-sm leading-relaxed text-xs">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {currentRead.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <p className="text-xs text-white/60">This document is empty.</p>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-white/40 h-full">
                                <FileText size={20} className="opacity-30 mb-2" />
                                <p className="text-xs">Select an artifact to read.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Sub-tab 3: A2UI Canvas Data Panels */}
            {subTab === 'canvas' && (
                <div
                    id="workbench-tabpanel-canvas"
                    role="tabpanel"
                    aria-labelledby="workbench-tab-canvas"
                    className="flex-1 p-6 overflow-y-auto custom-scrollbar"
                >
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
