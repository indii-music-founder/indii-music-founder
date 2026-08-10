import React, { useState } from 'react';
import { Send, MessageSquare, MessageCircle, Loader2, Sparkles, Instagram } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { sendInstagramMessage, replyInstagramComment, getInstagramMediaComments } from '@/services/social/InstagramPlatformService';
import type { InstagramCommentItem } from '@indii/shared';

export const InstagramInbox: React.FC = () => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'dm' | 'comments'>('dm');

    // DM State
    const [recipientIgUserId, setRecipientIgUserId] = useState('');
    const [dmText, setDmText] = useState('');
    const [dmMediaUrl, setDmMediaUrl] = useState('');
    const [sendingDm, setSendingDm] = useState(false);

    // Comments State
    const [mediaId, setMediaId] = useState('');
    const [comments, setComments] = useState<InstagramCommentItem[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);

    // Active Reply State
    const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [submittingReply, setSubmittingReply] = useState(false);

    const handleSendDm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipientIgUserId.trim()) {
            toast.error('Recipient Instagram User ID is required');
            return;
        }
        if (!dmText.trim() && !dmMediaUrl.trim()) {
            toast.error('Please provide message text or a media URL');
            return;
        }

        setSendingDm(true);
        try {
            const res = await sendInstagramMessage({
                recipientIgUserId: recipientIgUserId.trim(),
                messageText: dmText.trim() || undefined,
                mediaUrl: dmMediaUrl.trim() || undefined,
            });
            if (res.ok) {
                toast.success('Instagram Direct Message delivered!');
                setDmText('');
                setDmMediaUrl('');
            }
        } catch (err) {
            toast.error(`Failed to send DM: ${String(err)}`);
        } finally {
            setSendingDm(false);
        }
    };

    const handleFetchComments = async () => {
        if (!mediaId.trim()) {
            toast.error('Please enter an Instagram Media ID');
            return;
        }

        setLoadingComments(true);
        try {
            const res = await getInstagramMediaComments(mediaId.trim());
            setComments(res.comments);
            toast.success(`Loaded ${res.comments.length} comments`);
        } catch (err) {
            toast.error(`Failed to fetch comments: ${String(err)}`);
        } finally {
            setLoadingComments(false);
        }
    };

    const handleSendReply = async (commentId: string) => {
        if (!replyText.trim()) return;

        setSubmittingReply(true);
        try {
            const res = await replyInstagramComment({
                commentId,
                replyText: replyText.trim(),
            });
            if (res.ok) {
                toast.success('Reply published to Instagram!');
                setReplyText('');
                setReplyingCommentId(null);
                // Refresh comments
                await handleFetchComments();
            }
        } catch (err) {
            toast.error(`Failed to post reply: ${String(err)}`);
        } finally {
            setSubmittingReply(false);
        }
    };

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden backdrop-blur-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/40">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-md">
                        <Instagram className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-zinc-100">Instagram Engagement & Automation</h2>
                        <p className="text-xs text-zinc-400">Manage direct messages and post comments in real-time</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center bg-zinc-800/80 p-1 rounded-lg border border-zinc-700/50">
                    <button
                        type="button"
                        onClick={() => setActiveTab('dm')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                            activeTab === 'dm'
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Direct Messages</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('comments')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                            activeTab === 'comments'
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Comments</span>
                    </button>
                </div>
            </div>

            {/* Direct Messages Tab */}
            {activeTab === 'dm' && (
                <form onSubmit={handleSendDm} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1.5">Recipient Instagram User ID</label>
                        <input
                            type="text"
                            value={recipientIgUserId}
                            onChange={(e) => setRecipientIgUserId(e.target.value)}
                            placeholder="e.g. 17841400000000002"
                            className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-rose-500 transition-colors"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1.5">Message Text</label>
                        <textarea
                            value={dmText}
                            onChange={(e) => setDmText(e.target.value)}
                            placeholder="Type your message..."
                            rows={3}
                            className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-rose-500 transition-colors resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1.5">Optional Media URL (Image Attachment)</label>
                        <input
                            type="url"
                            value={dmMediaUrl}
                            onChange={(e) => setDmMediaUrl(e.target.value)}
                            placeholder="https://storage.googleapis.com/.../promo.jpg"
                            className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-rose-500 transition-colors"
                        />
                    </div>

                    <div className="pt-2 flex justify-end">
                        <button
                            type="submit"
                            disabled={sendingDm}
                            className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                        >
                            {sendingDm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            <span>Send Instagram DM</span>
                        </button>
                    </div>
                </form>
            )}

            {/* Comments Tab */}
            {activeTab === 'comments' && (
                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={mediaId}
                            onChange={(e) => setMediaId(e.target.value)}
                            placeholder="Enter Instagram Media ID (e.g. 17900000000000001)"
                            className="flex-1 px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-rose-500 transition-colors"
                        />
                        <button
                            type="button"
                            onClick={() => void handleFetchComments()}
                            disabled={loadingComments}
                            className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {loadingComments ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-rose-400" />}
                            <span>Fetch Comments</span>
                        </button>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-3">
                        {comments.length === 0 ? (
                            <div className="p-8 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30">
                                <p className="text-xs text-zinc-500">No comments loaded. Enter a Media ID above to fetch live comments.</p>
                            </div>
                        ) : (
                            comments.map((comment) => (
                                <div key={comment.id} className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-rose-400">@{comment.username}</span>
                                        <span className="text-[11px] text-zinc-500">{new Date(comment.timestamp).toLocaleString()}</span>
                                    </div>
                                    <p className="text-sm text-zinc-200">{comment.text}</p>

                                    <div className="pt-2 flex items-center justify-between border-t border-zinc-800/60">
                                        <span className="text-xs text-zinc-400">{comment.likeCount} likes</span>
                                        <button
                                            type="button"
                                            onClick={() => setReplyingCommentId(replyingCommentId === comment.id ? null : comment.id)}
                                            className="text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors"
                                        >
                                            {replyingCommentId === comment.id ? 'Cancel Reply' : 'Reply'}
                                        </button>
                                    </div>

                                    {replyingCommentId === comment.id && (
                                        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                                            <textarea
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                placeholder={`Reply to @${comment.username}...`}
                                                rows={2}
                                                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-rose-500 resize-none"
                                            />
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => void handleSendReply(comment.id)}
                                                    disabled={submittingReply}
                                                    className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                                >
                                                    {submittingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                                    <span>Post Reply</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
