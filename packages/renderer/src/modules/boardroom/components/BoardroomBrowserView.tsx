import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { cn } from '@/lib/utils';

export interface QuickBookmark {
    id: string;
    title: string;
    url: string;
    badge: string;
}

export const BOARDROOM_BOOKMARKS: readonly QuickBookmark[] = [
    { id: 'spotify', title: 'Spotify for Artists', url: 'https://artists.spotify.com', badge: 'DSP' },
    { id: 'apple', title: 'Apple Music', url: 'https://artists.apple.com', badge: 'DSP' },
    { id: 'ascap', title: 'ASCAP Portal', url: 'https://members.ascap.com', badge: 'PRO' },
    { id: 'bmi', title: 'BMI Online', url: 'https://online.bmi.com', badge: 'PRO' },
    { id: 'mlc', title: 'The MLC', url: 'https://portal.themlc.com', badge: 'Mechanical' },
    { id: 'soundexchange', title: 'SoundExchange', url: 'https://sportal.soundexchange.com', badge: 'Neighboring' },
    { id: 'copyright', title: 'US Copyright', url: 'https://eco.copyright.gov/eService_enu/', badge: 'Legal' },
    { id: 'instagram', title: 'Instagram', url: 'https://www.instagram.com', badge: 'Social' },
];

interface BoardroomBrowserViewProps {
    isVisible?: boolean;
}

export function BoardroomBrowserView({ isVisible = true }: BoardroomBrowserViewProps) {
    const toast = useToast();
    const containerRef = useRef<HTMLDivElement>(null);

    const boardroomBrowserUrl = useStore(state => state.boardroomBrowserUrl);
    const setBoardroomBrowserUrl = useStore(state => state.setBoardroomBrowserUrl);
    const addReferencedAsset = useStore(state => state.addReferencedAsset);

    const [inputUrl, setInputUrl] = useState(boardroomBrowserUrl || 'https://artists.spotify.com');
    const [isLoading, setIsLoading] = useState(false);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [pageTitle, setPageTitle] = useState('Spotify for Artists');
    const [isPinned, setIsPinned] = useState(false);
    const [isReaderMode, setIsReaderMode] = useState(false);
    const [extractedText, setExtractedText] = useState<string | null>(null);

    const isNativeElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.boardroomBrowser);

    // Keep input field updated with store URL
    useEffect(() => {
        if (boardroomBrowserUrl) {
            setInputUrl(boardroomBrowserUrl);
        }
    }, [boardroomBrowserUrl]);

    // Electron Native Viewport Sync
    useEffect(() => {
        if (!isNativeElectron || !window.electronAPI?.boardroomBrowser) return;

        const api = window.electronAPI.boardroomBrowser;

        // Attach native WebContentsView
        void api.attach({ initialUrl: boardroomBrowserUrl || 'https://artists.spotify.com' });

        const unsubscribeState = api.onStateChange((state) => {
            if (state.url) {
                setBoardroomBrowserUrl(state.url);
                setInputUrl(state.url);
            }
            if (state.title) setPageTitle(state.title);
            setIsLoading(state.isLoading);
            setCanGoBack(state.canGoBack);
            setCanGoForward(state.canGoForward);
        });

        const syncBounds = () => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            void api.setBounds({
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                visible: isVisible && rect.width > 20 && rect.height > 20,
            });
        };

        syncBounds();

        const observer = new ResizeObserver(() => syncBounds());
        if (containerRef.current) observer.observe(containerRef.current);
        window.addEventListener('resize', syncBounds);
        window.addEventListener('scroll', syncBounds, true);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', syncBounds);
            window.removeEventListener('scroll', syncBounds, true);
            if (unsubscribeState) unsubscribeState();
            // Hide on unmount or tab switch
            void api.setBounds({ x: 0, y: 0, width: 0, height: 0, visible: false });
        };
    }, [isNativeElectron, isVisible, boardroomBrowserUrl, setBoardroomBrowserUrl]);

    const handleNavigate = (targetUrl: string) => {
        const trimmed = targetUrl.trim();
        if (!trimmed) return;

        setBoardroomBrowserUrl(trimmed);
        setInputUrl(trimmed);
        setIsPinned(false);
        setExtractedText(null);

        if (isNativeElectron && window.electronAPI?.boardroomBrowser) {
            void window.electronAPI.boardroomBrowser.navigate(trimmed);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleNavigate(inputUrl);
        }
    };

    const handleBack = () => {
        if (isNativeElectron && window.electronAPI?.boardroomBrowser) {
            void window.electronAPI.boardroomBrowser.goBack();
        }
    };

    const handleForward = () => {
        if (isNativeElectron && window.electronAPI?.boardroomBrowser) {
            void window.electronAPI.boardroomBrowser.goForward();
        }
    };

    const handleReload = () => {
        if (isNativeElectron && window.electronAPI?.boardroomBrowser) {
            void window.electronAPI.boardroomBrowser.reload();
        }
    };

    const handleOpenExternal = () => {
        const target = inputUrl || boardroomBrowserUrl || 'https://artists.spotify.com';
        if (isNativeElectron && window.electronAPI?.boardroomBrowser) {
            void window.electronAPI.boardroomBrowser.openExternal(target);
        } else {
            window.open(target, '_blank', 'noopener,noreferrer');
        }
    };

    const handlePinToContext = async () => {
        try {
            setIsLoading(true);
            let pageData = {
                title: pageTitle || inputUrl,
                url: inputUrl || boardroomBrowserUrl,
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

            addReferencedAsset({
                id: `web-${Date.now()}`,
                name: pageData.title || pageData.url,
                type: 'url',
                value: pageData.url,
                prompt: pageData.text ? `Extracted Webpage Content:\n${pageData.text.slice(0, 10000)}` : undefined,
                origin: 'boardroom_browser',
            });

            setIsPinned(true);
            toast.success(`Pinned "${pageData.title.slice(0, 40)}" into Boardroom swarm context!`);
        } catch (error) {
            toast.error('Failed to capture webpage context.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExtractReader = async () => {
        if (extractedText) {
            setIsReaderMode(prev => !prev);
            return;
        }

        try {
            setIsLoading(true);
            if (window.electronAPI?.agent?.extractWebPage) {
                const res = await window.electronAPI.agent.extractWebPage(inputUrl);
                if (res.success && res.data) {
                    setExtractedText(res.data.text);
                    setIsReaderMode(true);
                    return;
                }
            }
            toast.info('Reader mode is ready. Opening reader preview.');
            setIsReaderMode(true);
        } catch {
            toast.error('Could not extract text for reader mode.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div data-testid="boardroom-browser-view" className="h-full w-full flex flex-col bg-zinc-950 text-white min-h-0 min-w-0 overflow-hidden">
            {/* Top Navigation & URL Bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-black/60 border-b border-white/10 shrink-0">
                <button
                    type="button"
                    onClick={handleBack}
                    disabled={!canGoBack}
                    className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        canGoBack ? "text-white/80 hover:text-white hover:bg-white/10" : "text-white/20 cursor-not-allowed"
                    )}
                    title="Back"
                    aria-label="Back"
                >
                    <ArrowLeft size={14} />
                </button>
                <button
                    type="button"
                    onClick={handleForward}
                    disabled={!canGoForward}
                    className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        canGoForward ? "text-white/80 hover:text-white hover:bg-white/10" : "text-white/20 cursor-not-allowed"
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
                <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs focus-within:border-indigo-500/50 transition-all">
                    <Lock size={12} className="text-emerald-400 shrink-0" />
                    <input
                        type="text"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter URL or search portal..."
                        className="flex-1 bg-transparent border-none outline-none text-white/90 text-xs placeholder:text-white/30"
                        data-testid="boardroom-browser-url-input"
                    />
                    <button
                        type="button"
                        onClick={() => handleNavigate(inputUrl)}
                        className="text-white/40 hover:text-white p-0.5 rounded transition-colors"
                        title="Navigate"
                    >
                        <Search size={12} />
                    </button>
                </div>

                {/* Pin to Swarm Context Action */}
                <button
                    type="button"
                    onClick={handlePinToContext}
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
                    <span className="hidden sm:inline">{isPinned ? 'Pinned' : 'Pin to Swarm'}</span>
                </button>

                {/* Web Fallback Reader Mode Toggle */}
                {!isNativeElectron && (
                    <button
                        type="button"
                        onClick={handleExtractReader}
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
                        <span className="hidden md:inline">Reader</span>
                    </button>
                )}

                {/* External Browser Button */}
                <button
                    type="button"
                    onClick={handleOpenExternal}
                    className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    title="Open in default OS browser"
                    aria-label="Open externally"
                    data-testid="boardroom-browser-external-btn"
                >
                    <ExternalLink size={14} />
                </button>
            </div>

            {/* Quick Industry Bookmarks Bar */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 border-b border-white/5 overflow-x-auto custom-scrollbar shrink-0">
                <Bookmark size={11} className="text-indigo-400/70 shrink-0 ml-0.5 mr-1" />
                {BOARDROOM_BOOKMARKS.map((bookmark) => (
                    <button
                        key={bookmark.id}
                        type="button"
                        onClick={() => handleNavigate(bookmark.url)}
                        className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all whitespace-nowrap shrink-0",
                            inputUrl.includes(bookmark.url.replace('https://', ''))
                                ? "bg-indigo-500/25 text-indigo-200 border border-indigo-400/40 font-bold"
                                : "bg-white/5 hover:bg-white/10 text-white/70 border border-white/5"
                        )}
                    >
                        <span>{bookmark.title}</span>
                        <span className="text-[8px] font-mono uppercase opacity-50 px-1 py-0.2 rounded bg-black/40">
                            {bookmark.badge}
                        </span>
                    </button>
                ))}
            </div>

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
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar text-white/80 space-y-4 max-w-3xl mx-auto">
                        <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-white">{pageTitle}</h2>
                                <p className="text-xs text-white/40 truncate mt-0.5">{inputUrl}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsReaderMode(false)}
                                className="px-3 py-1 text-xs bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
                            >
                                Back to Frame
                            </button>
                        </div>
                        <div className="prose prose-invert prose-sm leading-relaxed whitespace-pre-wrap font-sans text-xs">
                            {extractedText || (
                                <div className="text-center py-12 text-white/40">
                                    <Globe size={24} className="mx-auto mb-2 opacity-30" />
                                    <p>Extracting readable text from webpage...</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // Standard Web Iframe Fallback
                    <div className="w-full h-full relative flex flex-col">
                        <iframe
                            src={boardroomBrowserUrl || 'https://artists.spotify.com'}
                            title="Boardroom Embedded Browser"
                            className="w-full h-full border-none flex-1"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                            data-testid="boardroom-web-iframe"
                        />
                        {/* Notice for X-Frame-Options blocked pages in standard web */}
                        <div className="p-2 bg-zinc-900 border-t border-white/10 flex items-center justify-between text-[11px] text-white/60">
                            <span>Some portals (Spotify, ASCAP) block embedding in web browsers. Use <strong>Reader Mode</strong> or the <strong>Desktop App</strong> for native view.</span>
                            <button
                                type="button"
                                onClick={handleOpenExternal}
                                className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
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
