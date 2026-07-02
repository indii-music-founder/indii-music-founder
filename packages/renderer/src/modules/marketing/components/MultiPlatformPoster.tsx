import React, { useState } from 'react';
import {
    Clock, CheckCircle2, XCircle,
    Plus, Trash2, Video, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { socialAutoPosterService, type SocialPlatform } from '@/services/marketing/SocialAutoPosterService';
import { useToast } from '@/core/context/ToastContext';

interface Platform {
    id: SocialPlatform;
    name: string;
    color: string;
    maxDuration: number; // seconds
    ratio: string;
}

// ISSUE-666: each selected platform is dispatched independently and gets its
// own confirmed status — never a blanket "posted to all" after one call.
type PlatformDispatchStatus = 'queued' | 'failed';

interface DraftPost {
    id: string;
    title: string;
    mediaUrl: string;
    platforms: SocialPlatform[];
    status: 'draft' | 'posting' | 'done';
    caption: string;
    platformResults: Partial<Record<SocialPlatform, { status: PlatformDispatchStatus; error?: string }>>;
}

const PLATFORMS: Platform[] = [
    { id: 'tiktok', name: 'TikTok', color: 'bg-pink-500', maxDuration: 60, ratio: '9:16' },
    { id: 'youtube_shorts', name: 'YouTube Shorts', color: 'bg-red-500', maxDuration: 60, ratio: '9:16' },
    { id: 'meta_reels', name: 'IG Reels', color: 'bg-green-500', maxDuration: 90, ratio: '9:16' },
];

const platformName = (id: SocialPlatform): string =>
    PLATFORMS.find(p => p.id === id)?.name ?? id;

export default function MultiPlatformPoster() {
    const [posts, setPosts] = useState<DraftPost[]>([]);
    const [showNewPost, setShowNewPost] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newMediaUrl, setNewMediaUrl] = useState('');
    const [newCaption, setNewCaption] = useState('');
    const [newPlatforms, setNewPlatforms] = useState<SocialPlatform[]>(['tiktok']);
    const [isPosting, setIsPosting] = useState<string | null>(null);
    const toast = useToast();

    const togglePlatform = (id: SocialPlatform) => {
        setNewPlatforms(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleSaveDraft = () => {
        if (!newTitle.trim() || !newMediaUrl.trim() || newPlatforms.length === 0) return;
        const post: DraftPost = {
            id: Date.now().toString(),
            title: newTitle.trim(),
            mediaUrl: newMediaUrl.trim(),
            platforms: newPlatforms,
            status: 'draft',
            caption: newCaption.trim() || '',
            platformResults: {},
        };
        setPosts(prev => [post, ...prev]);
        setNewTitle('');
        setNewMediaUrl('');
        setNewCaption('');
        setNewPlatforms(['tiktok']);
        setShowNewPost(false);
    };

    const handlePostNow = async (post: DraftPost) => {
        setIsPosting(post.id);
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'posting' } : p));

        // Dispatch every selected platform independently; record per-platform outcomes.
        const results: DraftPost['platformResults'] = {};
        await Promise.all(post.platforms.map(async platform => {
            try {
                await socialAutoPosterService.queuePost({
                    id: `${post.id}_${platform}`,
                    mediaUrl: post.mediaUrl,
                    caption: post.caption,
                    hashtags: [],
                    platform,
                });
                results[platform] = { status: 'queued' };
            } catch (error: unknown) {
                results[platform] = {
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Dispatch failed',
                };
            }
        }));

        const queuedNames = post.platforms.filter(p => results[p]?.status === 'queued').map(platformName);
        const failedNames = post.platforms.filter(p => results[p]?.status === 'failed').map(platformName);
        if (queuedNames.length > 0) {
            toast.success(`Queued for delivery: ${queuedNames.join(', ')}`);
        }
        if (failedNames.length > 0) {
            toast.error(`Not queued: ${failedNames.join(', ')}`);
        }

        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'done', platformResults: results } : p));
        setIsPosting(null);
    };

    const handleDelete = (postId: string) => {
        setPosts(prev => prev.filter(p => p.id !== postId));
    };

    const drafts = posts.filter(p => p.status === 'draft' || p.status === 'posting');
    const completed = posts.filter(p => p.status === 'done');

    return (
        <div className="p-6 space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-white tracking-tighter uppercase">
                        Multi-Platform Auto-Poster
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Queue videos for TikTok, YouTube Shorts & IG Reels
                    </p>
                </div>
                <button
                    onClick={() => setShowNewPost(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-dept-marketing hover:bg-dept-marketing/80 text-white rounded-lg text-xs font-bold transition-colors"
                >
                    <Plus size={14} /> New Post
                </button>
            </div>

            {/* Platform Status */}
            <div className="grid grid-cols-3 gap-3">
                {PLATFORMS.map(p => {
                    const count = drafts.filter(post => post.platforms.includes(p.id)).length;
                    return (
                        <div key={p.id} className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${p.color}`} />
                                <span className="text-xs font-bold text-white">{p.name}</span>
                            </div>
                            <p className="text-2xl font-black text-white">{count}</p>
                            <p className="text-[10px] text-gray-500">drafted · {p.ratio}</p>
                        </div>
                    );
                })}
            </div>

            {/* New Post Modal */}
            <AnimatePresence>
                {showNewPost && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="rounded-xl bg-white/[0.03] border border-white/10 p-5 space-y-4"
                    >
                        <h3 className="text-sm font-bold text-white">New Post</h3>

                        <div>
                            <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Video Title</label>
                            <input
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                placeholder="e.g. Studio Session BTS"
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/20"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Media URL</label>
                            <input
                                value={newMediaUrl}
                                onChange={e => setNewMediaUrl(e.target.value)}
                                placeholder="https://..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/20"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Caption</label>
                            <textarea
                                value={newCaption}
                                onChange={e => setNewCaption(e.target.value)}
                                rows={2}
                                placeholder="Caption with hashtags…"
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/20 resize-none"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-2">Platforms</label>
                            <div className="flex gap-2 flex-wrap">
                                {PLATFORMS.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => togglePlatform(p.id)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${newPlatforms.includes(p.id)
                                            ? 'bg-dept-marketing/20 border-dept-marketing text-dept-marketing'
                                            : 'border-white/10 text-gray-500 hover:border-white/20'
                                            }`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${p.color}`} />
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveDraft}
                                disabled={!newTitle.trim() || !newMediaUrl.trim() || newPlatforms.length === 0}
                                className="px-4 py-2 bg-dept-marketing hover:bg-dept-marketing/80 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                                Save Draft
                            </button>
                            <button
                                onClick={() => setShowNewPost(false)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-xs font-bold transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Drafts (this device only — not yet dispatched anywhere) */}
            {drafts.length > 0 && (
                <div>
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                        Drafts ({drafts.length}) · saved on this device only
                    </h3>
                    <div className="space-y-2">
                        {drafts.map(post => (
                            <motion.div
                                key={post.id}
                                layout
                                className="rounded-xl bg-white/[0.02] border border-white/5 p-4 flex items-center gap-4"
                            >
                                <div className="w-10 h-10 rounded-lg bg-dept-marketing/10 flex items-center justify-center flex-shrink-0">
                                    <Video size={18} className="text-dept-marketing" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{post.title}</p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {post.platforms.map(pid => {
                                            const platform = PLATFORMS.find(p => p.id === pid);
                                            return platform ? (
                                                <span key={pid} className="flex items-center gap-1 text-[10px] text-gray-500">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${platform.color}`} />
                                                    {platform.name}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {post.status === 'posting'
                                        ? <Loader2 size={14} className="animate-spin text-blue-400" />
                                        : <Clock size={14} className="text-yellow-400" />}
                                    <button
                                        onClick={() => handlePostNow(post)}
                                        disabled={isPosting === post.id}
                                        className="px-3 py-1 bg-dept-marketing/10 hover:bg-dept-marketing/20 text-dept-marketing rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
                                    >
                                        Post Now
                                    </button>
                                    <button
                                        onClick={() => handleDelete(post.id)}
                                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Dispatched posts — per-platform confirmed outcomes */}
            {completed.length > 0 && (
                <div>
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                        History ({completed.length})
                    </h3>
                    <div className="space-y-2">
                        {completed.map(post => (
                            <div key={post.id} className="rounded-xl bg-white/[0.01] border border-white/[0.03] p-4 flex items-center gap-4 opacity-80">
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                    <Video size={18} className="text-gray-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{post.title}</p>
                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                        {post.platforms.map(pid => {
                                            const result = post.platformResults[pid];
                                            const queuedOk = result?.status === 'queued';
                                            return (
                                                <span
                                                    key={pid}
                                                    title={result?.error}
                                                    className={`flex items-center gap-1 text-[10px] font-bold ${queuedOk ? 'text-green-400' : 'text-red-400'}`}
                                                >
                                                    {queuedOk ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                                    {platformName(pid)}: {queuedOk ? 'Queued for delivery' : 'Failed'}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
