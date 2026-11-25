import React from 'react';
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    Check,
    ExternalLink,
    Globe,
    Lock,
    Pin,
    RotateCcw,
    Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BoardroomBrowserToolbarProps {
    canNavigateBack: boolean;
    canNavigateForward: boolean;
    isLoading: boolean;
    isSecureUrl: boolean;
    inputUrl: string;
    onInputUrlChange: (url: string) => void;
    onInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
    onNavigate: (url: string) => void;
    onPinToContext: () => void;
    isPinning: boolean;
    isPinned: boolean;
    pageLoadFailed: boolean;
    isNativeElectron: boolean;
    canReadPage: boolean;
    onExtractReader: () => void;
    isExtractingReader: boolean;
    isReaderMode: boolean;
    canOpenHosted: boolean;
    isFrameBlockedPortal: boolean;
    onOpenHosted: () => void;
    onOpenSearch: () => void;
    onOpenExternal: () => void;
}

export function BoardroomBrowserToolbar({
    canNavigateBack,
    canNavigateForward,
    isLoading,
    isSecureUrl,
    inputUrl,
    onInputUrlChange,
    onInputKeyDown,
    onBack,
    onForward,
    onReload,
    onNavigate,
    onPinToContext,
    isPinning,
    isPinned,
    pageLoadFailed,
    isNativeElectron,
    canReadPage,
    onExtractReader,
    isExtractingReader,
    isReaderMode,
    canOpenHosted,
    isFrameBlockedPortal,
    onOpenHosted,
    onOpenSearch,
    onOpenExternal,
}: BoardroomBrowserToolbarProps) {
    return (
        <div className="flex items-center gap-1.5 px-2.5 py-2 bg-black/60 border-b border-white/10 shrink-0 min-w-0 overflow-hidden">
            <button
                type="button"
                onClick={onBack}
                disabled={!canNavigateBack}
                className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    canNavigateBack ? "text-white/80 hover:text-white hover:bg-white/10" : "text-white/20 cursor-not-allowed",
                )}
                title="Back"
                aria-label="Back"
            >
                <ArrowLeft size={14} />
            </button>
            <button
                type="button"
                onClick={onForward}
                disabled={!canNavigateForward}
                className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    canNavigateForward ? "text-white/80 hover:text-white hover:bg-white/10" : "text-white/20 cursor-not-allowed",
                )}
                title="Forward"
                aria-label="Forward"
            >
                <ArrowRight size={14} />
            </button>
            <button
                type="button"
                onClick={onReload}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="Reload"
                aria-label="Reload"
            >
                <RotateCcw size={13} className={cn(isLoading && "motion-safe:animate-spin text-indigo-400")} />
            </button>

            <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs focus-within:border-indigo-500/50 transition-colors">
                {isSecureUrl ? (
                    <Lock size={12} className="text-emerald-400 shrink-0" aria-label="HTTPS connection" />
                ) : (
                    <Globe size={12} className="text-amber-400 shrink-0" aria-label="Unencrypted HTTP connection" />
                )}
                <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => onInputUrlChange(e.target.value)}
                    onKeyDown={onInputKeyDown}
                    placeholder="Enter URL or search portal..."
                    aria-label="Browser URL or search query"
                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-white/90 text-xs placeholder:text-white/30"
                    data-testid="boardroom-browser-url-input"
                />
                <button
                    type="button"
                    onClick={() => onNavigate(inputUrl)}
                    className="text-white/40 hover:text-white p-0.5 rounded transition-colors shrink-0"
                    title="Navigate"
                    aria-label="Navigate to URL"
                >
                    <Search size={12} />
                </button>
            </div>

            <button
                type="button"
                onClick={onPinToContext}
                disabled={isPinning || (isNativeElectron && (pageLoadFailed || isLoading))}
                aria-busy={isPinning}
                className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors shrink-0",
                    isPinned
                        ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                        : "bg-indigo-600/20 hover:bg-indigo-600/35 border-indigo-500/30 text-indigo-200",
                )}
                title="Share this page with your team"
                aria-label="Pin page for your team"
                data-testid="boardroom-browser-pin-btn"
            >
                {isPinned ? <Check size={12} /> : <Pin size={12} />}
                <span className="hidden @[500px]:inline">{isPinning ? 'Pinning…' : isPinned ? 'Pinned' : 'Pin to Boardroom'}</span>
            </button>

            {!isNativeElectron && canReadPage && (
                <button
                    type="button"
                    onClick={onExtractReader}
                    disabled={isExtractingReader}
                    aria-busy={isExtractingReader}
                    className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors shrink-0",
                        isReaderMode
                            ? "bg-amber-500/20 border-amber-400/40 text-amber-300"
                            : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70",
                    )}
                    title="Toggle Reader Mode for frame-restricted sites"
                    aria-label="Reader mode"
                >
                    <BookOpen size={12} />
                    <span className="hidden @[580px]:inline">Reader</span>
                </button>
            )}

            {canOpenHosted && !isFrameBlockedPortal && (
                <button
                    type="button"
                    onClick={onOpenHosted}
                    className="shrink-0 rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-semibold"
                >
                    Open live browser
                </button>
            )}

            {!isNativeElectron && (
                <button
                    type="button"
                    onClick={onOpenSearch}
                    title="Search the web"
                    aria-label="Search the web"
                    className="shrink-0 rounded-lg p-2 text-white/70 hover:bg-white/10"
                >
                    <Search size={14} />
                </button>
            )}

            <button
                type="button"
                onClick={onOpenExternal}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                title={isNativeElectron ? 'Open in your browser' : 'Open in a new tab'}
                aria-label="Open externally"
                data-testid="boardroom-browser-external-btn"
            >
                <ExternalLink size={14} />
            </button>
        </div>
    );
}
