import React, { useEffect, useState } from 'react';
import { SocialService } from '@/services/social/SocialService';
import { SocialPost } from '@/services/social/types';
import { useStore } from '@/core/store';
import { Heart, MessageCircle, Share2, MoreHorizontal, Image as ImageIcon, Send } from 'lucide-react';

interface SocialFeedProps {
    userId?: string; // If provided, shows specific user's posts. Otherwise, home feed.
}

export default function SocialFeed({ userId }: SocialFeedProps) {
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [newPostContent, setNewPostContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const currentUser = useStore((state) => state.user);

    useEffect(() => {
        loadFeed();
    }, [userId]);

    const loadFeed = async () => {
        setLoading(true);
        try {
            const fetchedPosts = await SocialService.getFeed(userId);
            setPosts(fetchedPosts);
        } catch (error) {
            console.error("Failed to load social feed:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePost = async () => {
        if (!newPostContent.trim()) return;

        setIsPosting(true);
        try {
            await SocialService.createPost(newPostContent);
            setNewPostContent('');
            loadFeed(); // Refresh feed
        } catch (error) {
            console.error("Failed to create post:", error);
        } finally {
            setIsPosting(false);
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="flex flex-col h-full bg-[#0d1117] text-white">
            {/* Post Input (Only on Home Feed or Own Profile) */}
            {(!userId || userId === currentUser?.uid) && (
                <div className="p-4 border-b border-gray-800">
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0" />
                        <div className="flex-1">
                            <textarea
                                value={newPostContent}
                                onChange={(e) => setNewPostContent(e.target.value)}
                                placeholder="What's happening in your studio?"
                                className="w-full bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 resize-none min-h-[80px]"
                            />
                            <div className="flex justify-between items-center mt-2">
                                <button className="text-gray-400 hover:text-blue-400 transition-colors p-2 rounded-full hover:bg-gray-800">
                                    <ImageIcon size={20} />
                                </button>
                                <button
                                    onClick={handleCreatePost}
                                    disabled={!newPostContent.trim() || isPosting}
                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-full font-medium text-sm flex items-center gap-2 transition-all"
                                >
                                    {isPosting ? 'Posting...' : <>Post <Send size={14} /></>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Feed List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center p-8 text-gray-500">
                        No posts yet. Be the first to share something!
                    </div>
                ) : (
                    <div className="divide-y divide-gray-800">
                        {posts.map((post) => (
                            <article key={post.id} className="p-4 hover:bg-[#161b22] transition-colors">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden">
                                        {post.authorAvatar ? (
                                            <img src={post.authorAvatar} alt={post.authorName} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-600" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="font-bold text-white hover:underline cursor-pointer">
                                                    {post.authorName}
                                                </span>
                                                <span className="text-gray-500 text-sm ml-2">
                                                    {formatDate(post.timestamp)}
                                                </span>
                                            </div>
                                            <button className="text-gray-500 hover:text-white">
                                                <MoreHorizontal size={16} />
                                            </button>
                                        </div>

                                        <p className="text-gray-200 mt-1 whitespace-pre-wrap">{post.content}</p>

                                        {post.mediaUrls && post.mediaUrls.length > 0 && (
                                            <div className="mt-3 rounded-xl overflow-hidden border border-gray-800">
                                                <img src={post.mediaUrls[0]} alt="Post content" className="w-full h-auto max-h-[400px] object-cover" />
                                            </div>
                                        )}

                                        <div className="flex items-center gap-6 mt-3 text-gray-500">
                                            <button className="flex items-center gap-2 hover:text-red-500 transition-colors group">
                                                <Heart size={18} className="group-hover:scale-110 transition-transform" />
                                                <span className="text-sm">{post.likes}</span>
                                            </button>
                                            <button className="flex items-center gap-2 hover:text-blue-500 transition-colors">
                                                <MessageCircle size={18} />
                                                <span className="text-sm">{post.commentsCount}</span>
                                            </button>
                                            <button className="flex items-center gap-2 hover:text-green-500 transition-colors">
                                                <Share2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
