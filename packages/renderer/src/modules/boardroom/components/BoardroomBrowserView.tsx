import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import {
    ExternalLink,
    Globe,
    Sparkles,
    Plus,
} from 'lucide-react';
import { isBoardroomWebSearchQuery, parseBoardroomBrowserAddress } from '@indii/shared';
import { useStore } from '@/core/store';
import { secureUUIDv4 } from '@/utils/crypto-random';
import { useToast } from '@/core/context/ToastContext';
import {
    judgeBoardroomWebpageSemantics,
    type BoardroomWebpageSemantics,
} from '@/config/typesafeJudgments';
import { resolveBoardroomBrowserEndpoint } from '@/modules/boardroom/components/boardroomBrowserEndpoint';
import { BoardroomBrowserToolbar } from '@/modules/boardroom/components/BoardroomBrowserToolbar';
import {
    BOARDROOM_BOOKMARKS,
    BoardroomBrowserBookmarks,
    matchesBookmark,
} from '@/modules/boardroom/components/BoardroomBrowserBookmarks';
import { BoardroomBrowserFrameBlockedCard } from '@/modules/boardroom/components/BoardroomBrowserFrameBlockedCard';
import { BoardroomBrowserReader } from '@/modules/boardroom/components/BoardroomBrowserReader';

interface BoardroomBrowserViewProps {
    isVisible?: boolean;
}

const BoardroomHostedBrowser = lazy(() => import('@/modules/boardroom/components/BoardroomHostedBrowser'));
const BoardroomWebSearch = lazy(() => import('@/modules/boardroom/components/BoardroomWebSearch'));
const hostedEndpoint = resolveBoardroomBrowserEndpoint({
    enabled: import.meta.env.VITE_BOARDROOM_BROWSER_ENABLED === 'true',
    configuredEndpoint: import.meta.env.VITE_BOARDROOM_BROWSER_URL,
    isDev: import.meta.env.DEV,
    hostname: typeof window === 'undefined' ? '' : window.location.hostname,
});

function normalizeExternalHttpUrl(rawInput: string): string | null {
    const trimmed = rawInput.trim();
    if (!trimmed) return null;
    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
        ? trimmed
        : trimmed.includes('.') && !trimmed.includes(' ')
            ? `https://${trimmed}`
            : `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
}

function isHttpsUrl(rawInput: string): boolean {
    try {
        return new URL(rawInput).protocol === 'https:';
    } catch {
        return false;
    }
}

function isSameOriginUrl(rawInput: string): boolean {
    if (typeof window === 'undefined' || !window.location?.origin) return false;
    try {
        return new URL(rawInput).origin === window.location.origin;
    } catch {
        return false;
    }
}

const FRAME_BLOCKED_DOMAINS = [
    'spotify.com',
    'apple.com',
    'ascap.com',
    'bmi.com',
    'themlc.com',
    'soundexchange.com',
    'copyright.gov',
    'instagram.com',
    'youtube.com',
    'youtu.be',
    'github.com',
    'fonts.google.com',
    'x.com',
    'twitter.com',
    'tiktok.com',
    'facebook.com',
    'distrokid.com',
    'tunecore.com',
    'cdbaby.com',
] as const;

function isKnownFrameBlockedUrl(rawInput: string): boolean {
    try {
        const hostname = new URL(rawInput).hostname.toLowerCase();
        return FRAME_BLOCKED_DOMAINS.some(
            domain => hostname === domain || hostname.endsWith(`.${domain}`)
        );
    } catch {
        return false;
    }
}

export function BoardroomBrowserView({ isVisible = true }: BoardroomBrowserViewProps) {
    const toast = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRevision = useRef(0);
    const currentUrl = useRef<string | null>(null);
    const isVisibleRef = useRef(isVisible);
    const syncBoundsRef = useRef<(() => void) | null>(null);

    const boardroomBrowserUrl = useStore(state => state.boardroomBrowserUrl);
    const setBoardroomBrowserUrl = useStore(state => state.setBoardroomBrowserUrl);
    const addReferencedAsset = useStore(state => state.addReferencedAsset);
    const activeAgents = useStore(state => state.activeAgents) || [];
    const toggleAgent = useStore(state => state.toggleAgent);

    const initialBrowserUrl = useRef(boardroomBrowserUrl || 'https://artists.spotify.com');
    const [inputUrl, setInputUrl] = useState(boardroomBrowserUrl || 'https://artists.spotify.com');
    const [webHistory, setWebHistory] = useState(() => ({
        entries: [initialBrowserUrl.current],
        index: 0,
    }));
    const [dismissedHostedUrl, setDismissedHostedUrl] = useState<string>();
    const [searchQuery, setSearchQuery] = useState<string>();
    const [iframeKey, setIframeKey] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isPinning, setIsPinning] = useState(false);
    const [isExtractingReader, setIsExtractingReader] = useState(false);
    const [pageLoadFailed, setPageLoadFailed] = useState(false);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [pageTitle, setPageTitle] = useState('');
    const [isPinned, setIsPinned] = useState(false);
    const [isReaderMode, setIsReaderMode] = useState(false);
    const [extractedText, setExtractedText] = useState<string | null>(null);
    const [lastSemanticJudgment, setLastSemanticJudgment] = useState<BoardroomWebpageSemantics | null>(null);

    const isNativeElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.boardroomBrowser);

    const canReadPage = typeof window !== 'undefined' && Boolean(window.electronAPI?.agent?.extractWebPage);
    const invalidatePage = useCallback((url: string, force = false) => {
        if (!force && currentUrl.current === url) return;
        currentUrl.current = url;
        initialBrowserUrl.current = url;
        pageRevision.current += 1;
        setLastSemanticJudgment(null);
        setIsPinned(false);
        setExtractedText(null);
        setIsReaderMode(false);
        setPageTitle('');
    }, []);

    // Keep input field updated with store URL
    useEffect(() => {
        if (boardroomBrowserUrl) {
            invalidatePage(boardroomBrowserUrl);
            setInputUrl(boardroomBrowserUrl);
            if (!isNativeElectron) {
                setWebHistory(history => {
                    if (history.entries[history.index] === boardroomBrowserUrl) return history;
                    const entries = [...history.entries.slice(0, history.index + 1).slice(-20), boardroomBrowserUrl];
                    return { entries, index: entries.length - 1 };
                });
            }
        }
    }, [boardroomBrowserUrl, invalidatePage, isNativeElectron]);

    // Electron Native Viewport Sync
    useEffect(() => {
        if (!isNativeElectron || !window.electronAPI?.boardroomBrowser) return;

        const api = window.electronAPI.boardroomBrowser;

        // Attach native WebContentsView
        void api.attach({ initialUrl: initialBrowserUrl.current }).then(result => {
            if (!result.success) setPageLoadFailed(true);
        }).catch(() => setPageLoadFailed(true));

        const unsubscribeState = api.onStateChange((state) => {
            if (state.url) {
                invalidatePage(state.url);
                setBoardroomBrowserUrl(state.url);
                setInputUrl(state.url);
            }
            if (state.title) setPageTitle(state.title);
            setIsLoading(state.isLoading);
            setPageLoadFailed(Boolean(state.error));
            setCanGoBack(state.canGoBack);
            setCanGoForward(state.canGoForward);
        });

        const syncBounds = () => {
            if (boundsFrame !== null) return;
            boundsFrame = window.requestAnimationFrame(() => {
                boundsFrame = null;
                if (!containerRef.current) return;
                const rect = containerRef.current.getBoundingClientRect();
                const bounds = {
                    x: Math.round(rect.left),
                    y: Math.round(rect.top),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    visible: isVisibleRef.current && rect.width > 20 && rect.height > 20,
                };
                const boundsKey = `${bounds.x},${bounds.y},${bounds.width},${bounds.height},${bounds.visible}`;
                if (boundsKey === lastBoundsKey) return;
                lastBoundsKey = boundsKey;
                void api.setBounds(bounds).catch(() => {
                    // The native view may be disposed while the renderer is tearing down.
                });
            });
        };

        let boundsFrame: number | null = null;
        let lastBoundsKey: string | null = null;

        syncBoundsRef.current = syncBounds;
        syncBounds();

        const observer = new ResizeObserver(() => syncBounds());
        if (containerRef.current) observer.observe(containerRef.current);
        window.addEventListener('resize', syncBounds);
        window.addEventListener('scroll', syncBounds, true);

        return () => {
            syncBoundsRef.current = null;
            if (boundsFrame !== null) window.cancelAnimationFrame(boundsFrame);
            observer.disconnect();
            window.removeEventListener('resize', syncBounds);
            window.removeEventListener('scroll', syncBounds, true);
            if (unsubscribeState) unsubscribeState();
            // ISSUE-1680: Hide and detach the native WebContentsView on unmount
            // so it never lingers above non-Boardroom screens.
            void api.setBounds({ x: 0, y: 0, width: 0, height: 0, visible: false }).catch(() => {});
            void api.detach?.().catch(() => {});
        };
    }, [isNativeElectron, setBoardroomBrowserUrl, invalidatePage]);

    // Sync WebContentsView visibility cleanly without re-attaching
    useEffect(() => {
        isVisibleRef.current = isVisible;
        syncBoundsRef.current?.();
    }, [isVisible]);

    const runNativePageCommand = async (
        command: () => Promise<{ success: boolean }>,
        revision = pageRevision.current,
    ) => {
        try {
            if ((await command()).success) return;
        } catch {
            // The IPC channel can close before returning a result.
        }
        if (revision === pageRevision.current) {
            setIsLoading(false);
            setPageLoadFailed(true);
        }
    };

    const handleNavigate = (targetUrl: string) => {
        if (!isNativeElectron && isBoardroomWebSearchQuery(targetUrl)) {
            setSearchQuery(targetUrl.trim());
            return;
        }
        const safeUrl = normalizeExternalHttpUrl(targetUrl);
        if (!safeUrl) {
            toast.error('Only valid HTTP/HTTPS URLs are supported in the Boardroom browser.');
            return;
        }

        invalidatePage(safeUrl);
        setPageLoadFailed(false);
        setBoardroomBrowserUrl(safeUrl);
        setInputUrl(safeUrl);
        setIsPinned(false);
        setExtractedText(null);
        setDismissedHostedUrl(undefined);

        const api = window.electronAPI?.boardroomBrowser;
        if (api) {
            void runNativePageCommand(() => api.navigate(safeUrl));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleNavigate(inputUrl);
        }
    };

    const moveWebHistory = (delta: number) => {
        const index = webHistory.index + delta;
        const url = webHistory.entries[index];
        if (!url) return;
        setWebHistory({ ...webHistory, index });
        setDismissedHostedUrl(undefined);
        setBoardroomBrowserUrl(url);
    };

    const handleBack = () => {
        const api = window.electronAPI?.boardroomBrowser;
        if (api) {
            void runNativePageCommand(() => api.goBack());
        } else {
            moveWebHistory(-1);
        }
    };

    const handleForward = () => {
        const api = window.electronAPI?.boardroomBrowser;
        if (api) {
            void runNativePageCommand(() => api.goForward());
        } else {
            moveWebHistory(1);
        }
    };

    const handleReload = () => {
        const api = window.electronAPI?.boardroomBrowser;
        if (api) {
            void runNativePageCommand(() => api.reload());
        } else {
            invalidatePage(committedUrl, true);
            setIsLoading(!isBlockedSelfEmbed && !isFrameBlockedPortal);
            setIframeKey(prev => prev + 1);
        }
    };

    const handleOpenExternal = async () => {
        const target = normalizeExternalHttpUrl(boardroomBrowserUrl || 'https://artists.spotify.com');
        if (!target) {
            toast.error('Cannot open invalid or non-HTTP(S) URL externally.');
            return;
        }
        const api = window.electronAPI?.boardroomBrowser;
        if (api) {
            try {
                if ((await api.openExternal(target)).success) return;
            } catch {
                // Display the same failure for a rejected IPC call.
            }
            toast.error('Could not open the page in your browser.');
        } else {
            window.open(target, '_blank', 'noopener,noreferrer');
        }
    };

    const handlePinToContext = async () => {
        if (isPinning || (isNativeElectron && (pageLoadFailed || isLoading))) return;
        const revision = pageRevision.current;
        try {
            setIsPinning(true);
            let pageData = {
                title: '',
                url: committedUrl,
                text: '',
            };

            if (isNativeElectron && window.electronAPI?.boardroomBrowser) {
                const res = await window.electronAPI.boardroomBrowser.captureContext();
                if (res.success && res.data) {
                    pageData = {
                        title: res.data.title || pageData.title,
                        url: res.data.url || pageData.url,
                        text: res.data.text || '',
                    };
                }
            } else if (window.electronAPI?.agent?.extractWebPage) {
                const res = await window.electronAPI.agent.extractWebPage(pageData.url);
                if (res.success && res.data) {
                    pageData = {
                        title: res.data.title || pageData.title,
                        url: res.data.finalUrl || pageData.url,
                        text: res.data.text || '',
                    };
                }
            }

            // TypeSafe Jev System One semantic enrichment
            const semantics = await judgeBoardroomWebpageSemantics(pageData.url, pageData.title, pageData.text);
            if (revision !== pageRevision.current) return;
            setLastSemanticJudgment(semantics);

            const classificationSource = semantics.source === 'jev' ? 'TypeSafe Jev' : 'Automatic category suggestion';
            const promptText = pageData.text
                ? `[${classificationSource}: ${semantics.categoryLabel} | Owner: ${semantics.recommendedDepartment.toUpperCase()} | Relevance: ${Math.round(semantics.relevanceScore * 100)}%]\n\nExtracted Webpage Content:\n${pageData.text.slice(0, 10000)}`
                : `[${classificationSource}: ${semantics.categoryLabel} | Owner: ${semantics.recommendedDepartment.toUpperCase()}]\nPage text was not captured; only the URL is available.`;

            addReferencedAsset({
                id: `web-${secureUUIDv4()}`,
                name: pageData.title || pageData.url,
                type: 'url',
                value: pageData.url,
                prompt: promptText,
                origin: 'boardroom_browser',
            });

            setIsPinned(true);
            if (pageData.text.trim()) {
                toast.success(`Pinned. ${classificationSource}: ${semantics.categoryLabel} (${semantics.recommendedDepartment.toUpperCase()})`);
            } else {
                toast.info('Page URL pinned, but its text could not be captured.');
            }
        } catch {
            if (revision === pageRevision.current) toast.error('Failed to capture webpage context.');
        } finally {
            setIsPinning(false);
        }
    };

    const handleExtractReader = async () => {
        if (isExtractingReader) return;
        if (extractedText) {
            setIsReaderMode(prev => !prev);
            return;
        }

        const revision = pageRevision.current;
        try {
            setIsExtractingReader(true);
            if (window.electronAPI?.agent?.extractWebPage) {
                const res = await window.electronAPI.agent.extractWebPage(committedUrl);
                if (revision !== pageRevision.current) return;
                if (res.success && res.data?.text?.trim()) {
                    setPageTitle(res.data.title || '');
                    setExtractedText(res.data.text);
                    setIsReaderMode(true);
                    return;
                }
            }
            toast.error('Could not extract text for reader mode.');
        } catch {
            if (revision === pageRevision.current) toast.error('Could not extract text for reader mode.');
        } finally {
            setIsExtractingReader(false);
        }
    };

    const committedUrl =
        normalizeExternalHttpUrl(boardroomBrowserUrl || 'https://artists.spotify.com') ||
        'https://artists.spotify.com';
    const canNavigateBack = isNativeElectron ? canGoBack : webHistory.index > 0;
    const canNavigateForward = isNativeElectron ? canGoForward : webHistory.index < webHistory.entries.length - 1;
    const isSecureUrl = isHttpsUrl(committedUrl);
    const isBlockedSelfEmbed = !isNativeElectron && isSameOriginUrl(committedUrl);
    const matchedBookmark = BOARDROOM_BOOKMARKS.find(bookmark => matchesBookmark(committedUrl, bookmark.url));
    const portalHost = (() => {
        try {
            return new URL(committedUrl).hostname.replace(/^www\./, '');
        } catch {
            return committedUrl;
        }
    })();
    const portalTitle = matchedBookmark?.title || portalHost;
    const hostedPage = !isNativeElectron && !isBlockedSelfEmbed && hostedEndpoint
        ? parseBoardroomBrowserAddress(committedUrl)
        : undefined;
    const canOpenHosted = hostedPage !== undefined;
    const isFrameBlockedPortal = !isNativeElectron && (canOpenHosted || isKnownFrameBlockedUrl(committedUrl));
    const openHosted = () => setDismissedHostedUrl(undefined);

    if (searchQuery !== undefined) {
        return (
            <Suspense fallback={<p role="status" className="p-3">Opening search…</p>}>
                <BoardroomWebSearch
                    initialQuery={searchQuery}
                    onClose={() => setSearchQuery(undefined)}
                    openInBoardroom={hostedEndpoint && !isNativeElectron ? resultUrl => {
                        if (!parseBoardroomBrowserAddress(resultUrl)) return undefined;
                        return () => {
                            setSearchQuery(undefined);
                            handleNavigate(resultUrl);
                        };
                    } : undefined}
                />
            </Suspense>
        );
    }

    if (hostedPage && hostedEndpoint && dismissedHostedUrl !== committedUrl) {
        return (
            <Suspense fallback={<p role="status" className="p-3">Loading live browser…</p>}>
                <BoardroomHostedBrowser
                    endpoint={hostedEndpoint}
                    targetUrl={hostedPage.href}
                    onSearch={(query, pageUrl) => {
                        setBoardroomBrowserUrl(pageUrl);
                        setSearchQuery(query);
                    }}
                    onClose={pageUrl => {
                        setDismissedHostedUrl(pageUrl);
                        setBoardroomBrowserUrl(pageUrl);
                    }}
                />
            </Suspense>
        );
    }


    return (
        <div data-testid="boardroom-browser-view" className="@container h-full w-full flex flex-col bg-bg-dark text-white min-h-0 min-w-0 overflow-hidden">
            <BoardroomBrowserToolbar
                canNavigateBack={canNavigateBack}
                canNavigateForward={canNavigateForward}
                isLoading={isLoading}
                isSecureUrl={isSecureUrl}
                inputUrl={inputUrl}
                onInputUrlChange={setInputUrl}
                onInputKeyDown={handleKeyDown}
                onBack={handleBack}
                onForward={handleForward}
                onReload={handleReload}
                onNavigate={handleNavigate}
                onPinToContext={handlePinToContext}
                isPinning={isPinning}
                isPinned={isPinned}
                pageLoadFailed={pageLoadFailed}
                isNativeElectron={isNativeElectron}
                canReadPage={canReadPage}
                onExtractReader={handleExtractReader}
                isExtractingReader={isExtractingReader}
                isReaderMode={isReaderMode}
                canOpenHosted={canOpenHosted}
                isFrameBlockedPortal={isFrameBlockedPortal}
                onOpenHosted={openHosted}
                onOpenSearch={() => setSearchQuery(inputUrl.trim() === boardroomBrowserUrl ? '' : inputUrl.trim())}
                onOpenExternal={handleOpenExternal}
            />

            <BoardroomBrowserBookmarks committedUrl={committedUrl} onNavigate={handleNavigate} />

            {/* TypeSafe Jev Semantic Classification Banner */}
            {lastSemanticJudgment && (
                <div
                    className="flex items-center justify-between px-3 py-1 bg-indigo-950/50 border-b border-indigo-500/20 text-[11px] shrink-0 select-none motion-safe:animate-in motion-safe:fade-in-0"
                    data-testid="boardroom-browser-jev-badge"
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="flex items-center gap-1 font-bold text-indigo-300 shrink-0">
                            <Sparkles size={11} className="text-indigo-400" />
                            {lastSemanticJudgment.source === 'jev' ? 'TypeSafe Jev:' : 'Automatic suggestion:'}
                        </span>
                        <span className="text-white/90 font-medium truncate">{lastSemanticJudgment.categoryLabel}</span>
                        <span className="text-white/30 shrink-0">•</span>
                        <span className="text-indigo-200/80 font-mono text-[10px] shrink-0">
                            Owner: <strong className="text-indigo-200">{lastSemanticJudgment.recommendedDepartment.toUpperCase()}</strong> ({Math.round(lastSemanticJudgment.relevanceScore * 100)}% match)
                        </span>
                    </div>
                    {!activeAgents.includes(lastSemanticJudgment.recommendedDepartment) && (
                        <button
                            type="button"
                            onClick={() => {
                                toggleAgent(lastSemanticJudgment.recommendedDepartment);
                                toast.success(`Seated ${lastSemanticJudgment.recommendedDepartment.toUpperCase()} Head at the Boardroom table!`);
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 hover:text-white text-[10px] font-bold border border-indigo-500/30 transition-all shrink-0 ml-2"
                            title={`Seat ${lastSemanticJudgment.recommendedDepartment.toUpperCase()} Head`}
                            data-testid="boardroom-jev-seat-department-btn"
                        >
                            <Plus size={10} />
                            <span>Seat {lastSemanticJudgment.recommendedDepartment.toUpperCase()}</span>
                        </button>
                    )}
                </div>
            )}

            {isNativeElectron && pageLoadFailed && (
                <div role="alert" className="px-3 py-2 text-xs text-amber-200 bg-amber-950/70 border-b border-amber-500/30">
                    This page could not be loaded. Check its address or try reloading before pinning it.
                </div>
            )}

            {/* Browser Viewport */}
            <div className="flex-1 relative min-h-0 min-w-0 bg-black flex flex-col overflow-hidden">
                {isNativeElectron ? (
                    // Native Electron WebContentsView mount point placeholder
                    <div
                        ref={containerRef}
                        className="w-full h-full relative"
                        data-testid="boardroom-native-browser-container"
                    >
                        {isLoading && (
                            <div className="absolute top-0 inset-x-0 h-0.5 bg-indigo-500 motion-safe:animate-pulse z-10" />
                        )}
                    </div>
                ) : isReaderMode ? (
                    <BoardroomBrowserReader
                        pageTitle={pageTitle}
                        committedUrl={committedUrl}
                        extractedText={extractedText}
                        onBackToFrame={() => setIsReaderMode(false)}
                    />
                ) : isBlockedSelfEmbed ? (
                    // Prevent recursive self-embedding under allow-scripts + allow-same-origin
                    <div
                        data-testid="boardroom-same-origin-guard"
                        className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-bg-dark"
                    >
                        <Globe size={28} className="text-indigo-400/70" />
                        <div className="space-y-1 max-w-md">
                            <p className="text-sm font-semibold text-white">Same-origin URL blocked from recursive frame</p>
                            <p className="text-xs text-white/60">
                                Embedding the active app origin inside a sandboxed iframe is disabled. Use another portal URL or open externally.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleOpenExternal}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-400/40 text-xs font-semibold text-indigo-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                        >
                            Open in New Tab <ExternalLink size={12} />
                        </button>
                    </div>
                ) : isFrameBlockedPortal ? (
                    <BoardroomBrowserFrameBlockedCard
                        portalTitle={portalTitle}
                        committedUrl={committedUrl}
                        matchedBookmark={matchedBookmark}
                        canOpenHosted={canOpenHosted}
                        canReadPage={canReadPage}
                        isExtractingReader={isExtractingReader}
                        isPinning={isPinning}
                        onOpenHosted={openHosted}
                        onOpenExternal={handleOpenExternal}
                        onExtractReader={handleExtractReader}
                        onPinToContext={handlePinToContext}
                    />
                ) : (
                    // Standard Web Iframe Fallback
                    <div className="w-full h-full relative flex flex-col min-h-0 min-w-0">
                        {isLoading && (
                            <div className="absolute top-0 inset-x-0 h-0.5 bg-indigo-500 motion-safe:animate-pulse z-10 pointer-events-none" />
                        )}
                        <iframe
                            key={`${committedUrl}:${iframeKey}`}
                            src={committedUrl}
                            onLoad={() => setIsLoading(false)}
                            onError={() => setIsLoading(false)}
                            title="Boardroom Embedded Browser"
                            className="w-full flex-1 min-h-0 border-0 bg-white block"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                            allow="focus-without-user-activation 'none'"
                            referrerPolicy="strict-origin-when-cross-origin"
                            data-testid="boardroom-web-iframe"
                        />
                        {/* Notice for X-Frame-Options blocked pages in standard web */}
                        <div className="p-2 bg-zinc-900 border-t border-white/10 flex items-center justify-between gap-3 text-[11px] text-white/60 shrink-0">
                            <span className="min-w-0">
                                Some sites block embedding. Open the page in a new tab if it does not appear here.
                            </span>
                            <button
                                type="button"
                                onClick={handleOpenExternal}
                                className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold shrink-0 whitespace-nowrap"
                            >
                                Open in New Tab <ExternalLink size={10} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
export default BoardroomBrowserView;
