import React from 'react';
import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOARDROOM_PORTAL_URLS } from '@/modules/boardroom/utils/boardroomUrls';

export interface QuickBookmark {
    id: string;
    title: string;
    url: string;
    badge: string;
}

export const BOARDROOM_BOOKMARKS: readonly QuickBookmark[] = [
    { id: 'spotify', title: 'Spotify for Artists', url: BOARDROOM_PORTAL_URLS.spotify, badge: 'DSP' },
    { id: 'apple', title: 'Apple Music', url: BOARDROOM_PORTAL_URLS.apple, badge: 'DSP' },
    { id: 'ascap', title: 'ASCAP Portal', url: BOARDROOM_PORTAL_URLS.ascap, badge: 'PRO' },
    { id: 'bmi', title: 'BMI Online', url: BOARDROOM_PORTAL_URLS.bmi, badge: 'PRO' },
    { id: 'mlc', title: 'The MLC', url: BOARDROOM_PORTAL_URLS.the_mlc, badge: 'Mechanical' },
    { id: 'soundexchange', title: 'SoundExchange', url: BOARDROOM_PORTAL_URLS.soundexchange, badge: 'Neighboring' },
    { id: 'copyright', title: 'US Copyright', url: BOARDROOM_PORTAL_URLS.loc_copyright, badge: 'Legal' },
    { id: 'google-fonts', title: 'Google Fonts', url: BOARDROOM_PORTAL_URLS.google_fonts, badge: 'Fonts' },
    { id: 'instagram', title: 'Instagram', url: BOARDROOM_PORTAL_URLS.instagram, badge: 'Social' },
];

export function matchesBookmark(activeUrl: string, bookmarkUrl: string): boolean {
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

interface BoardroomBrowserBookmarksProps {
    committedUrl: string;
    onNavigate: (url: string) => void;
    disabled?: boolean;
}

export function BoardroomBrowserBookmarks({ committedUrl, onNavigate, disabled }: BoardroomBrowserBookmarksProps) {
    return (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-black/40 border-b border-white/5 shrink-0">
            <Bookmark size={11} className="text-indigo-400/70 shrink-0 ml-0.5 mr-1" />
            {BOARDROOM_BOOKMARKS.map((bookmark) => (
                <button
                    key={bookmark.id}
                    type="button"
                    onClick={() => onNavigate(bookmark.url)}
                    disabled={disabled}
                    className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 disabled:opacity-50",
                        matchesBookmark(committedUrl, bookmark.url)
                            ? "bg-indigo-500/25 text-indigo-200 border border-indigo-400/40 font-bold"
                            : "bg-white/5 hover:bg-white/10 text-white/70 border border-white/5",
                    )}
                >
                    <span>{bookmark.title}</span>
                    <span className="text-[10px] font-mono uppercase opacity-50 px-1 py-0.5 rounded bg-black/40">
                        {bookmark.badge}
                    </span>
                </button>
            ))}
        </div>
    );
}
