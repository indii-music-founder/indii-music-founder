import React, { useState, useEffect, useCallback } from 'react';
import {
    Play,
    Pause,
    Flame,
    Sparkles,
    ShoppingBag,
    Heart,
    MessageSquare,
    Send,
    DollarSign,
    CheckCircle2,
    Radio,
    ShieldAlert,
} from 'lucide-react';
import {
    judgeSocialAudioSnippetSelection,
    judgeAestheticThemeDerivation,
    judgeAudioDrivenMerchSku,
    judgeFanCommentModeration,
    type SocialSnippetVerdict,
    type ThemeTokens,
    type AudioMerchSkuVerdict,
} from '@/config/typesafeJudgments';

export interface CommentItem {
    id: string;
    authorName: string;
    text: string;
    timestamp: string;
    isHighlight?: boolean;
    isToxic?: boolean;
}

export interface ListenerSocialTrackCardProps {
    trackTitle: string;
    artistName: string;
    coverArtUrl?: string;
    audioUrl?: string;
    bpm?: number;
    genre?: string;
    lyricsSnippet?: string;
    initialComments?: CommentItem[];
    onMerchBuy?: (sku: string, priceUsd: number) => void;
    onTip?: (amountUsd: number) => void;
    className?: string;
}

export const ListenerSocialTrackCard: React.FC<ListenerSocialTrackCardProps> = ({
    trackTitle,
    artistName,
    coverArtUrl,
    bpm = 124,
    genre = 'Electronic',
    lyricsSnippet = 'Late night cruising down Detroit streetlights glow',
    initialComments = [],
    onMerchBuy,
    onTip,
    className = '',
}) => {
    const [isPlayingHook, setIsPlayingHook] = useState(false);
    const [hookVerdict, setHookVerdict] = useState<SocialSnippetVerdict | null>(null);
    const [themeTokens, setThemeTokens] = useState<ThemeTokens | null>(null);
    const [merchVerdict, setMerchVerdict] = useState<AudioMerchSkuVerdict | null>(null);

    const [likesCount, setLikesCount] = useState(142);
    const [hasLiked, setHasLiked] = useState(false);

    const [comments, setComments] = useState<CommentItem[]>(initialComments);
    const [newCommentText, setNewCommentText] = useState('');
    const [commentModerationNotice, setCommentModerationNotice] = useState<string | null>(null);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    const [isTipping, setIsTipping] = useState(false);
    const [tipSuccess, setTipSuccess] = useState(false);

    // Initial Jev System One evaluation of track context
    useEffect(() => {
        let isMounted = true;

        const evaluateTrackIntelligence = async () => {
            const [snippetRes, themeRes, merchRes] = await Promise.all([
                judgeSocialAudioSnippetSelection(
                    [
                        {
                            section: 'CHORUS',
                            startTimeSeconds: 45,
                            endTimeSeconds: 65,
                            energyLevel: 'peak',
                            lyricSnippet: lyricsSnippet,
                        },
                    ],
                    15
                ),
                judgeAestheticThemeDerivation({
                    title: trackTitle,
                    genre,
                    moodDescriptors: ['nocturnal', 'driving', 'electronic'],
                }),
                judgeAudioDrivenMerchSku({
                    trackTitle,
                    genre,
                    energyLevel: 'peak',
                    dominantAesthetic: 'cyberpunk neon',
                }),
            ]);

            if (isMounted) {
                setHookVerdict(snippetRes);
                setThemeTokens(themeRes);
                setMerchVerdict(merchRes);
            }
        };

        void evaluateTrackIntelligence();

        return () => {
            isMounted = false;
        };
    }, [trackTitle, artistName, bpm, genre, lyricsSnippet]);

    const handleTogglePlay = useCallback(() => {
        setIsPlayingHook((prev) => !prev);
    }, []);

    const handleLike = useCallback(() => {
        setHasLiked((prev) => {
            const next = !prev;
            setLikesCount((c) => (next ? c + 1 : c - 1));
            return next;
        });
    }, []);

    const handleCommentSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!newCommentText.trim() || isSubmittingComment) return;

            setIsSubmittingComment(true);
            setCommentModerationNotice(null);

            try {
                // Real-time Jev System One comment moderation in <50ms
                const moderation = await judgeFanCommentModeration(newCommentText, 'Listener');

                if (!moderation.isApproved) {
                    setCommentModerationNotice(moderation.moderationFlag || 'Comment violates community safety rules.');
                    return;
                }

                const newComment: CommentItem = {
                    id: `comm_${Date.now()}`,
                    authorName: 'You (Fan)',
                    text: newCommentText.trim(),
                    timestamp: 'Just now',
                    isHighlight: moderation.intent === 'LYRIC_INTERPRETATION' || moderation.vibeAlignmentScore >= 4,
                };

                setComments((prev) => [newComment, ...prev]);
                setNewCommentText('');
            } finally {
                setIsSubmittingComment(false);
            }
        },
        [newCommentText, isSubmittingComment]
    );

    const handleSendTip = useCallback(
        (amount: number) => {
            onTip?.(amount);
            setTipSuccess(true);
            setIsTipping(false);
            setTimeout(() => setTipSuccess(false), 3000);
        },
        [onTip]
    );

    return (
        <div
            className={`w-full max-w-xl mx-auto rounded-3xl border border-zinc-800 bg-zinc-950/95 overflow-hidden shadow-2xl backdrop-blur-2xl transition-all ${className}`}
            style={{
                borderColor: themeTokens ? `${themeTokens.accentHex}33` : undefined,
            }}
        >
            {/* Top Atmospheric Header */}
            <div
                className="relative p-6 bg-gradient-to-b from-zinc-900/80 to-transparent"
                style={{
                    background: themeTokens
                        ? `linear-gradient(180deg, ${themeTokens.accentHex}15 0%, rgba(9,9,11,0) 100%)`
                        : undefined,
                }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                            Now Streaming
                        </span>
                    </div>
                    {hookVerdict && (
                        <div className="flex items-center gap-1.5 rounded-full bg-zinc-900/80 px-2.5 py-1 text-[10px] font-semibold text-zinc-300 border border-zinc-800">
                            <Radio className="h-3 w-3 text-cyan-400" />
                            15s Viral Earworm Hook
                        </div>
                    )}
                </div>

                {/* Cover Art & Track Title */}
                <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 shadow-md">
                        {coverArtUrl ? (
                            <img src={coverArtUrl} alt={trackTitle} className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30 text-white font-bold text-lg">
                                {trackTitle.slice(0, 2).toUpperCase()}
                            </div>
                        )}
                        <button
                            onClick={handleTogglePlay}
                            aria-label={isPlayingHook ? 'Pause 15s viral hook' : 'Play 15s viral hook'}
                            className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 backdrop-blur-[2px] transition-all group"
                        >
                            {isPlayingHook ? (
                                <Pause className="h-8 w-8 text-white drop-shadow-md group-hover:scale-110 transition-transform" />
                            ) : (
                                <Play className="h-8 w-8 text-white fill-white drop-shadow-md group-hover:scale-110 transition-transform ml-0.5" />
                            )}
                        </button>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-white truncate tracking-tight">{trackTitle}</h3>
                        <p className="text-sm font-medium text-zinc-400 truncate">{artistName}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                                {genre}
                            </span>
                            <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                                {bpm} BPM
                            </span>
                        </div>
                    </div>
                </div>

                {/* 15s Hook Visualizer Bar */}
                {hookVerdict && (
                    <div className="mt-4 rounded-xl bg-zinc-900/80 p-3 border border-zinc-800/80">
                        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1.5">
                            <span className="flex items-center gap-1 text-cyan-400">
                                <Sparkles className="h-3 w-3" />
                                {hookVerdict.hookStrategy}
                            </span>
                            <span>{hookVerdict.suggestedEndTimeSeconds - hookVerdict.suggestedStartTimeSeconds}s Preview</span>
                        </div>
                        {/* Audio Waveform progress placeholder */}
                        <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden relative">
                            <div
                                className={`h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-300 ${
                                    isPlayingHook ? 'w-full animate-pulse' : 'w-1/3'
                                }`}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Social Action Bar (Like, Tip, Merch) */}
            <div className="px-6 py-3 border-y border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleLike}
                        className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                            hasLiked ? 'text-rose-500' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <Heart className={`h-4 w-4 ${hasLiked ? 'fill-rose-500' : ''}`} />
                        <span>{likesCount}</span>
                    </button>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                        <MessageSquare className="h-4 w-4" />
                        <span>{comments.length}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsTipping((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                    >
                        <DollarSign className="h-3.5 w-3.5" />
                        Tip Artist
                    </button>
                </div>
            </div>

            {/* Tipping Panel */}
            {isTipping && (
                <div className="p-4 bg-emerald-950/20 border-b border-emerald-900/30 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-emerald-300">Support the artist directly:</span>
                    <div className="flex items-center gap-2">
                        {[3, 5, 10].map((amt) => (
                            <button
                                key={amt}
                                onClick={() => handleSendTip(amt)}
                                className="rounded-lg bg-emerald-600/30 px-3 py-1 text-xs font-bold text-emerald-200 hover:bg-emerald-600/50 transition-colors border border-emerald-500/30"
                            >
                                ${amt}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {tipSuccess && (
                <div className="p-2.5 bg-emerald-500/20 border-b border-emerald-500/40 text-center text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Thank you! Tip sent directly to the artist.
                </div>
            )}

            {/* Jev Audio-Driven Merch Recommendation Card */}
            {merchVerdict && (
                <div className="p-5 border-b border-zinc-800/80 bg-zinc-900/20">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                            <ShoppingBag className="h-3.5 w-3.5" />
                            Official Track Apparel
                        </span>
                        <span className="text-xs font-bold text-white">${merchVerdict.retailPriceUsd} USD</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                                {merchVerdict.recommendedSku.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-zinc-400 mt-0.5">{merchVerdict.conversionPitch}</p>
                        </div>
                        <button
                            onClick={() => onMerchBuy?.(merchVerdict.recommendedSku, merchVerdict.retailPriceUsd)}
                            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-black hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/10"
                        >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            Cop Merch
                        </button>
                    </div>
                </div>
            )}

            {/* Fan Comments Section */}
            <div className="p-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-orange-400" />
                    Fan Discussion
                </h4>

                {/* Moderation Notice if rejected */}
                {commentModerationNotice && (
                    <div className="mb-4 rounded-xl bg-rose-950/40 p-3 border border-rose-900/60 flex items-center gap-2 text-xs text-rose-300">
                        <ShieldAlert className="h-4 w-4 flex-shrink-0 text-rose-400" />
                        <span>{commentModerationNotice}</span>
                    </div>
                )}

                {/* Comment Input */}
                <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 mb-4">
                    <input
                        type="text"
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        placeholder="Join the discussion... (real-time Jev filtered)"
                        className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none transition-colors"
                        disabled={isSubmittingComment}
                    />
                    <button
                        type="submit"
                        disabled={!newCommentText.trim() || isSubmittingComment}
                        aria-label="Post comment"
                        className="rounded-xl bg-emerald-500 p-2 text-black hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </form>

                {/* Comments List */}
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {comments.length === 0 ? (
                        <p className="text-xs text-zinc-500 text-center py-4">
                            Be the first listener to drop a comment!
                        </p>
                    ) : (
                        comments.map((comm) => (
                            <div
                                key={comm.id}
                                className={`rounded-xl p-3 border text-xs transition-all ${
                                    comm.isHighlight
                                        ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                                        : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-300'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-semibold text-white flex items-center gap-1.5">
                                        {comm.authorName}
                                        {comm.isHighlight && (
                                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                                                Lyric Insight
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-[10px] text-zinc-500">{comm.timestamp}</span>
                                </div>
                                <p className="text-xs leading-relaxed">{comm.text}</p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
