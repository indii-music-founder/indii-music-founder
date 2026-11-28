import React from 'react';
import { BookOpen, ExternalLink, Globe, Pin } from 'lucide-react';
import type { QuickBookmark } from '@/modules/boardroom/components/BoardroomBrowserBookmarks';

interface BoardroomBrowserFrameBlockedCardProps {
    portalTitle: string;
    committedUrl: string;
    matchedBookmark?: QuickBookmark;
    canOpenHosted: boolean;
    canReadPage: boolean;
    isExtractingReader: boolean;
    isPinning: boolean;
    onOpenHosted: () => void;
    onOpenExternal: () => void;
    onExtractReader: () => void;
    onPinToContext: () => void;
}

export function BoardroomBrowserFrameBlockedCard({
    portalTitle,
    committedUrl,
    matchedBookmark,
    canOpenHosted,
    canReadPage,
    isExtractingReader,
    isPinning,
    onOpenHosted,
    onOpenExternal,
    onExtractReader,
    onPinToContext,
}: BoardroomBrowserFrameBlockedCardProps) {
    return (
        <div
            data-testid="boardroom-frame-blocked-card"
            className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-bg-dark via-surface to-bg-dark overflow-y-auto custom-scrollbar"
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
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/30 text-indigo-200">
                                {matchedBookmark.badge}
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] font-mono text-white/40 truncate">{committedUrl}</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    {canOpenHosted && (
                        <button
                            type="button"
                            onClick={onOpenHosted}
                            className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400"
                        >
                            Open live browser
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onOpenExternal}
                        data-testid="boardroom-portal-open-tab-btn"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/85 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                    >
                        <span>Open {portalTitle} in New Tab</span>
                        <ExternalLink size={12} />
                    </button>
                    {canReadPage && (
                        <button
                            type="button"
                            onClick={onExtractReader}
                            disabled={isExtractingReader}
                            aria-busy={isExtractingReader}
                            data-testid="boardroom-portal-reader-btn"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/85 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                        >
                            <BookOpen size={12} />
                            <span>Reader Mode</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onPinToContext}
                        disabled={isPinning}
                        aria-busy={isPinning}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/85 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                    >
                        <Pin size={12} />
                        <span>{isPinning ? 'Pinning…' : 'Pin to Boardroom'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
