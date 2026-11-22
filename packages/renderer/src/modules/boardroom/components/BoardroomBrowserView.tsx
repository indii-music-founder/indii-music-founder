import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    RotateCcw,
    Lock,
    ExternalLink,
    Pin,
    Bookmark,
    Search,
    BookOpen,
    Globe,
    Check,
    Sparkles,
    Plus,
} from 'lucide-react';
import { useStore } from '@/core/store';
import { secureUUIDv4 } from '@/utils/crypto-random';
import { useToast } from '@/core/context/ToastContext';
import { cn } from '@/lib/utils';
import {
    judgeBoardroomWebpageSemantics,
    type BoardroomWebpageSemantics,
} from '@/config/typesafeJudgments';
import { resolveBoardroomBrowserEndpoint } from './boardroomBrowserEndpoint';

interface QuickBookmark {
    id: string;
    title: string;
    url: string;
    badge: string;
}

const BOARDROOM_BOOKMARKS: readonly QuickBookmark[] = [
    { id: 'spotify', title: 'Spotify for Artists', url: 'https://artists.spotify.com', badge: 'DSP' },
    { id: 'apple', title: 'Apple Music', url: 'https://artists.apple.com', badge: 'DSP' },
    { id: 'ascap', title: 'ASCAP Portal', url: 'https://members.ascap.com', badge: 'PRO' },
    { id: 'bmi', title: 'BMI Online', url: 'https://online.bmi.com', badge: 'PRO' },
    { id: 'mlc', title: 'The MLC', url: 'https://portal.themlc.com', badge: 'Mechanical' },
    { id: 'soundexchange', title: 'SoundExchange', url: 'https://sportal.soundexchange.com', badge: 'Neighboring' },
    { id: 'copyright', title: 'US Copyright', url: 'https://eco.copyright.gov/eService_enu/', badge: 'Legal' },
    { id: 'google-fonts', title: 'Google Fonts', url: 'https://fonts.google.com/', badge: 'Fonts' },
    { id: 'instagram', title: 'Instagram', url: 'https://www.instagram.com', badge: 'Social' },
];

interface BoardroomBrowserViewProps {
    isVisible?: boolean;
}

const BoardroomHostedBrowser = lazy(() => import('./BoardroomHostedBrowser'));
const BoardroomWebSearch = lazy(() => import('./BoardroomWebSearch'));
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

function matchesBookmark(activeUrl: string, bookmarkUrl: string): boolean {
    try {
        const active = new URL(activeUrl);
        const bookmark = new URL(bookmarkUrl);
        const normalizeHost = (host: string) => host.toLowerCase().replace(/^www\./, '');
        if (normalizeHost(active.hostname) !== normalizeHost(bookmark.hostname)) {
            return false;
        }
        const bookmarkPath = bookmark.pathname.replace(/\/+$/, '') || '/';
        if (bookmarkPath === '/') return true;
        const activePath = active.pathname.replace(/\/+$/, '') || '/';
        return activePath === bookmarkPath || activePath.startsWith(`${bookmarkPath}/`);
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
    const [hostedUrl, setHostedUrl] = useState<string>();
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
            // The native view may already be disposed.
            void api.setBounds({ x: 0, y: 0, width: 0, height: 0, visible: false }).catch(() => {});
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
        const input = targetUrl.trim();
        if (!isNativeElectron && input && !/^[a-z][a-z0-9+.-]*:/i.test(input)
            && (!input.includes('.') || /\s/.test(input))) {
            setSearchQuery(input);
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
    const isFrameBlockedPortal = !isNativeElectron && isKnownFrameBlockedUrl(committedUrl);
    const canOpenHosted = !isNativeElectron && hostedEndpoint
        && ['artists.spotify.com', 'fonts.google.com'].includes(new URL(committedUrl).hostname);

    if (searchQuery !== undefined) {
        return (
            <Suspense fallback={<p role="status" className="p-3">Opening search…</p>}>
                <BoardroomWebSearch
                    initialQuery={searchQuery}
                    onClose={() => setSearchQuery(undefined)}
                    openInBoardroom={hostedEndpoint ? resultUrl => {
                        if (!['artists.spotify.com', 'fonts.google.com'].includes(new URL(resultUrl).hostname)) return undefined;
                        return () => {
                            setSearchQuery(undefined);
                            setHostedUrl(resultUrl);
                        };
                    } : undefined}
                />
            </Suspense>
        );
    }

    if (hostedUrl && hostedEndpoint) {
        return (
            <Suspense fallback={<p role="status" className="p-3">Loading live browser…</p>}>
                <BoardroomHostedBrowser endpoint={hostedEndpoint} initialUrl={hostedUrl} onClose={() => setHostedUrl(undefined)} />
            </Suspense>
        );
    }


    return (
        <div data-testid="boardroom-browser-view" className="@container h-full w-full flex flex-col bg-zinc-950 text-white min-h-0 min-w-0 overflow-hidden">
            {/* Top Navigation & URL Bar */}
            <div className="flex items-center gap-1.5 px-2.5 py-2 bg-black/60 border-b border-white/10 shrink-0 min-w-0 overflow-hidden">
                <button
                    type="button"
                    onClick={handleBack}
                    disabled={!canNavigateBack}
                    className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        canNavigateBack ? "text-white/80 hover:text-white hover:bg-white/10" : "text-white/20 cursor-not-allowed"
                    )}
                    title="Back"
                    aria-label="Back"
                >
                    <ArrowLeft size={14} />
                </button>
                <button
                    type="button"
                    onClick={handleForward}
                    disabled={!canNavigateForward}
                    className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        canNavigateForward ? "text-white/80 hover:text-white hover:bg-white/10" : "text-white/20 cursor-not-allowed"
                    )}
                    title="Forward"
                    aria-label="Forward"
                >
                    <ArrowRight size={14} />
                </button>
                <button
                    type="button"
                    onClick={handleReload}
                    className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                    title="Reload"
                    aria-label="Reload"
                >
                    <RotateCcw size={13} className={cn(isLoading && "animate-spin text-indigo-400")} />
                </button>

                {/* URL Input Bar */}
                <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs focus-within:border-indigo-500/50 transition-all">
                    {isSecureUrl ? (
                        <Lock
                            size={12}
                            className="text-emerald-400 shrink-0"
                            aria-label="HTTPS connection"
                        />
                    ) : (
                        <Globe
                            size={12}
                            className="text-amber-400 shrink-0"
                            aria-label="Unencrypted HTTP connection"
                        />
                    )}
                    <input
                        type="text"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter URL or search portal..."
                        aria-label="Browser URL or search query"
                        className="flex-1 min-w-0 bg-transparent border-none outline-none text-white/90 text-xs placeholder:text-white/30"
                        data-testid="boardroom-browser-url-input"
                    />
                    <button
                        type="button"
                        onClick={() => handleNavigate(inputUrl)}
                        className="text-white/40 hover:text-white p-0.5 rounded transition-colors shrink-0"
                        title="Navigate"
                        aria-label="Navigate to URL"
                    >
                        <Search size={12} />
                    </button>
                </div>

                {/* Pin to Swarm Context Action */}
                <button
                    type="button"
                    onClick={handlePinToContext}
                    disabled={isPinning || (isNativeElectron && (pageLoadFailed || isLoading))}
                    aria-busy={isPinning}
                    className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0",
                        isPinned
                            ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                            : "bg-indigo-600/20 hover:bg-indigo-600/35 border-indigo-500/30 text-indigo-200"
                    )}
                    title="Pin this page into Boardroom swarm context"
                    aria-label="Pin page to swarm"
                    data-testid="boardroom-browser-pin-btn"
                >
                    {isPinned ? <Check size={12} /> : <Pin size={12} />}
                    <span className="hidden @[500px]:inline">{isPinning ? 'Pinning…' : isPinned ? 'Pinned' : 'Pin to Swarm'}</span>
                </button>

                {/* Web Fallback Reader Mode Toggle */}
                {!isNativeElectron && canReadPage && (
                    <button
                        type="button"
                        onClick={handleExtractReader}
                        disabled={isExtractingReader}
                        aria-busy={isExtractingReader}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0",
                            isReaderMode
                                ? "bg-amber-500/20 border-amber-400/40 text-amber-300"
                                : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70"
                        )}
                        title="Toggle Reader Mode for frame-restricted sites"
                        aria-label="Reader mode"
                    >
                        <BookOpen size={12} />
                        <span className="hidden @[580px]:inline">Reader</span>
                    </button>
                )}

                {canOpenHosted && !isFrameBlockedPortal && (
                    <button type="button" onClick={() => setHostedUrl(committedUrl)}
                        className="shrink-0 rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-semibold">
                        Open live browser
                    </button>
                )}

                {!isNativeElectron && (
                    <button type="button"
                        onClick={() => setSearchQuery(inputUrl.trim() === boardroomBrowserUrl ? '' : inputUrl.trim())}
                        title="Search the web" aria-label="Search the web"
                        className="shrink-0 rounded-lg p-2 text-white/70 hover:bg-white/10">
                        <Search size={14} />
                    </button>
                )}

                {/* External Browser Button */}
                <button
                    type="button"
                    onClick={handleOpenExternal}
                    className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    title={isNativeElectron ? 'Open in your browser' : 'Open in a new tab'}
                    aria-label="Open externally"
                    data-testid="boardroom-browser-external-btn"
                >
                    <ExternalLink size={14} />
                </button>
            </div>

            {/* Quick Industry Bookmarks Bar */}
            <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-black/40 border-b border-white/5 shrink-0">
                <Bookmark size={11} className="text-indigo-400/70 shrink-0 ml-0.5 mr-1" />
                {BOARDROOM_BOOKMARKS.map((bookmark) => (
                    <button
                        key={bookmark.id}
                        type="button"
                        onClick={() => handleNavigate(bookmark.url)}
                        className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
                            matchesBookmark(committedUrl, bookmark.url)
                                ? "bg-indigo-500/25 text-indigo-200 border border-indigo-400/40 font-bold"
                                : "bg-white/5 hover:bg-white/10 text-white/70 border border-white/5"
                        )}
                    >
                        <span>{bookmark.title}</span>
                        <span className="text-[8px] font-mono uppercase opacity-50 px-1 py-0.5 rounded bg-black/40">
                            {bookmark.badge}
                        </span>
                    </button>
                ))}
            </div>

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
                            <div className="absolute top-0 inset-x-0 h-0.5 bg-indigo-500 animate-pulse z-10" />
                        )}
                    </div>
                ) : isReaderMode ? (
                    // Web Reader Mode View
                    <div className="flex-1 w-full min-h-0 overflow-y-auto custom-scrollbar">
                        <div className="p-6 text-white/80 space-y-4 max-w-3xl mx-auto">
                            <div className="border-b border-white/10 pb-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="text-base font-bold text-white truncate">{pageTitle || committedUrl}</h2>
                                    <p className="text-xs text-white/40 truncate mt-0.5">{committedUrl}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsReaderMode(false)}
                                    className="px-3 py-1 text-xs bg-white/10 hover:bg-white/15 rounded-lg transition-colors shrink-0 whitespace-nowrap"
                                >
                                    Back to Frame
                                </button>
                            </div>
                            <div className="prose prose-invert prose-sm leading-relaxed whitespace-pre-wrap font-sans text-xs">
                                {extractedText || (
                                    <div className="text-center py-8 text-white/40">
                                        <Globe size={24} className="mx-auto mb-2 opacity-30" />
                                        <p>Extracting readable text from webpage...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : isBlockedSelfEmbed ? (
                    // Prevent recursive self-embedding under allow-scripts + allow-same-origin
                    <div
                        data-testid="boardroom-same-origin-guard"
                        className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-zinc-950"
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
                    // Clean Portal Launch Card for X-Frame-Options / CSP frame-ancestors portals in web mode
                    <div
                        data-testid="boardroom-frame-blocked-card"
                        className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-zinc-950 via-[#08080e] to-zinc-950 overflow-y-auto custom-scrollbar"
                    >
                        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl space-y-4">
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                                    <Globe size={20} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-center gap-2 flex-wrap">
                                    <h3 className="text-sm font-bold text-white">{portalTitle}</h3>
                                    {matchedBookmark?.badge && (
                                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/30 text-indigo-200">
                                            {matchedBookmark.badge}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] font-mono text-white/40 truncate">{committedUrl}</p>
                                <p className="text-xs text-white/65 leading-relaxed pt-1">
                                    {portalTitle} blocks inline web iframe embedding (<code className="text-white/80">X-Frame-Options</code>). Open it directly in a browser tab or use the desktop app for native view.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                {canOpenHosted && (
                                    <button type="button" onClick={() => setHostedUrl(committedUrl)}
                                        className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400">
                                        Open live browser
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleOpenExternal}
                                    data-testid="boardroom-portal-open-tab-btn"
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/85 transition-all focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                                >
                                    <span>Open {portalTitle} in New Tab</span>
                                    <ExternalLink size={12} />
                                </button>
                                {canReadPage && (
                                    <button
                                        type="button"
                                        onClick={handleExtractReader}
                                        disabled={isExtractingReader}
                                        aria-busy={isExtractingReader}
                                        data-testid="boardroom-portal-reader-btn"
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/85 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                                    >
                                        <BookOpen size={12} />
                                        <span>Reader Mode</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handlePinToContext}
                                    disabled={isPinning}
                                    aria-busy={isPinning}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/85 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                                >
                                    <Pin size={12} />
                                    <span>{isPinning ? 'Pinning…' : 'Pin to Swarm'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Standard Web Iframe Fallback
                    <div className="w-full h-full relative flex flex-col min-h-0 min-w-0">
                        {isLoading && (
                            <div className="absolute top-0 inset-x-0 h-0.5 bg-indigo-500 animate-pulse z-10 pointer-events-none" />
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
