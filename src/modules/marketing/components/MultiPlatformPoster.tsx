import React, { useState } from 'react';
import {
    Play, Pause, Clock, CheckCircle2, XCircle,
    Plus, Trash2, Upload, Video, Calendar, Loader2
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

interface ScheduledPost {
    id: string;
    title: string;
    platforms: SocialPlatform[];
    scheduledAt: Date;
    status: 'queued' | 'posting' | 'posted' | 'failed';
    caption: string;
}

const PLATFORMS: Platform[] = [
    { id: 'tiktok', name: 'TikTok', color: 'bg-pink-500', maxDuration: 60, ratio: '9:16' },
    { id: 'youtube_shorts', name: 'YouTube Shorts', color: 'bg-red-500', maxDuration: 60, ratio: '9:16' },
    { id: 'meta_reels', name: 'IG Reels', color: 'bg-purple-500', maxDuration: 90, ratio: '9:16' },
];

const INITIAL_POSTS: ScheduledPost[] = [];

const STATUS_ICONS = {
    queued: <Clock size={14} className="text-yellow-400" />,
    posting: <Loader2 size={14} className="animate-spin text-blue-400" />,
    posted: <CheckCircle2 size={14} className="text-green-400" />,
    failed: <XCircle size={14} className="text-red-400" />,
};

const STATUS_LABELS = {
    queued: 'Scheduled',
    posting: 'Posting…',
    posted: 'Posted',
    failed: 'Failed',
};

function formatSchedule(date: Date): string {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff < 0) return 'Completed';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 24) return `In ${Math.floor(h / 24)}d`;
    if (h > 0) return `In ${h}h ${m}m`;
    return `In ${m}m`;
}

export default function MultiPlatformPoster() {
    const [posts, setPosts] = useState<ScheduledPost[]>(INITIAL_POSTS);
    const [showNewPost, setShowNewPost] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newCaption, setNewCaption] = useState('');
    const [newPlatforms, setNewPlatforms] = useState<SocialPlatform[]>(['tiktok']);
    const [isPosting, setIsPosting] = useState<string | null>(null);
    const toast = useToast();

    const togglePlatform = (id: SocialPlatform) => {
        setNewPlatforms(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleSchedule = () => {
        if (!newTitle.trim() || newPlatforms.length === 0) return;
        const post: ScheduledPost = {
            id: Date.now().toString(),
            title: newTitle.trim(),
            platforms: newPlatforms,
            scheduledAt: new Date(Date.now() + 7200000),
            status: 'queued',
            caption: newCaption.trim() || '',
        };
        setPosts(prev => [post, ...prev]);
        setNewTitle('');
        setNewCaption('');
        setNewPlatforms(['tiktok']);
        setShowNewPost(false);
    };

    const handlePostNow = async (post: ScheduledPost) => {
        setIsPosting(post.id);
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'posting' } : p));

        try {
            // In a real scenario, we would have the mediaUrl in the post object
            // For the demo, we use a placeholder or the title as a reference
            await socialAutoPosterService.queuePost({
                id: post.id,
                mediaUrl: `gs://assets/videos/${post.id}.mp4`,
                caption: post.caption,
                hashtags: [],
                platform: post.platforms[0] as SocialPlatform
            });

            toast.success(`Post dispatched to ${post.platforms.join(', ')}`);
            setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'posted', scheduledAt: new Date() } : p));
        } catch (error) {
            toast.error("Failed to post now.");
            setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'failed' } : p));
        } finally {
            setIsPosting(null);
        }
    };

    const handleDelete = (postId: string) => {
        setPosts(prev => prev.filter(p => p.id !== postId));
    };

    const queued = posts.filter(p => p.status === 'queued');
    const completed = posts.filter(p => p.status === 'posted' || p.status === 'failed');

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
                    <Plus size={14} /> Schedule Post
                </button>
            </div>

            {/* Platform Status */}
            <div className="grid grid-cols-3 gap-3">
                {PLATFORMS.map(p => {
                    const count = posts.filter(post => post.platforms.includes(p.id) && post.status === 'queued').length;
                    return (
                        <div key={p.id} className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${p.color}`} />
                                <span className="text-xs font-bold text-white">{p.name}</span>
                            </div>
                            <p className="text-2xl font-black text-white">{count}</p>
                            <p className="text-[10px] text-gray-500">queued · {p.ratio}</p>
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
                        <h3 className="text-sm font-bold text-white">New Scheduled Post</h3>

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
                                onClick={handleSchedule}
                                disabled={!newTitle.trim() || newPlatforms.length === 0}
                                className="px-4 py-2 bg-dept-marketing hover:bg-dept-marketing/80 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                                Schedule in 2h
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

            {/* Queued Posts */}
            {queued.length > 0 && (
                <div>
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                        Scheduled ({queued.length})
                    </h3>
                    <div className="space-y-2">
                        {queued.map(post => (
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
                                        <span className="text-[10px] text-gray-600">·</span>
                                        <span className="flex items-center gap-1 text-[10px] text-yellow-500">
                                            <Calendar size={10} />
                                            {formatSchedule(post.scheduledAt)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {STATUS_ICONS[post.status]}
                                    <button
                                        onClick={() => handlePostNow(post)}
                                        disabled={isPosting === post.id}
                                        className="px-3 py-1 bg-dept-marketing/10 hover:bg-dept-marketing/20 text-dept-marketing rounded-lg text-[10px] font-bold transition-colors"
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

            {/* Completed Posts */}
            {completed.length > 0 && (
                <div>
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                        History ({completed.length})
                    </h3>
                    <div className="space-y-2">
                        {completed.map(post => (
                            <div key={post.id} className="rounded-xl bg-white/[0.01] border border-white/[0.03] p-4 flex items-center gap-4 opacity-60">
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                    <Video size={18} className="text-gray-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{post.title}</p>
                                    <p className="text-[10px] text-gray-600 mt-0.5">
                                        {post.platforms.map(pid => PLATFORMS.find(p => p.id === pid)?.name).filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {STATUS_ICONS[post.status]}
                                    <span className={`text-[10px] font-bold ${post.status === 'posted' ? 'text-green-400' : 'text-red-400'}`}>
                                        {STATUS_LABELS[post.status]}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
