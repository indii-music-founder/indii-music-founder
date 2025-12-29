import React, { useEffect, useState } from 'react';
import { SocialService } from '@/services/social/SocialService';
import { SocialPost } from '@/services/social/types';
import { MarketplaceService } from '@/services/marketplace/MarketplaceService';
import { Product } from '@/services/marketplace/types';
import ProductCard from '@/modules/marketplace/components/ProductCard';
import { useStore } from '@/core/store';
import { Heart, MessageCircle, Share2, MoreHorizontal, Image as ImageIcon, Send, ShoppingBag } from 'lucide-react';
import { useSocial } from '../hooks/useSocial';

interface SocialFeedProps {
    userId?: string;
}

// Memoized to prevent re-renders when parent state changes but props don't
const SocialFeed = React.memo(function SocialFeed({ userId }: SocialFeedProps) {
    const {
        posts,
        isFeedLoading: loading,
        filter,
        setFilter,
        actions: { createPost }
    } = useSocial(userId);

    const [newPostContent, setNewPostContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);

    // Quick Post Shortcuts
    const shortcuts = [
        { label: "Announce Drop", icon: "🚀", text: "New Drop Alert! 🚨 [Product Name] is now live. Cop it before it's gone!" },
        { label: "Behind the Scenes", icon: "🎬", text: "In the lab cooking up something special... 🧪 #StudioFlow" },
        { label: "Thank You", icon: "🙏", text: "Big love to everyone showing support on the latest track! Y'all are the best. ❤️" }
    ];

    // Drop State
    const [artistProducts, setArtistProducts] = useState<Product[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [showProductPicker, setShowProductPicker] = useState(false);

    const userProfile = useStore((state) => state.userProfile);

    useEffect(() => {
        if (userProfile?.accountType === 'artist' || userProfile?.accountType === 'label') {
            loadArtistProducts();
        }
    }, [userProfile]);

    const loadArtistProducts = async () => {
        if (!userProfile?.id) return;
        try {
            const products = await MarketplaceService.getProductsByArtist(userProfile.id);
            setArtistProducts(products);
        } catch (error) {
            console.error("Failed to load products for picker:", error);
        }
    };

    const handleCreatePost = async () => {
        if (!newPostContent.trim()) return;

        setIsPosting(true);
        const success = await createPost(
            newPostContent,
            [],
            selectedProductId || undefined
        );

        if (success) {
            setNewPostContent('');
            setSelectedProductId(null);
            setShowProductPicker(false);
        }
        setIsPosting(false);
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
            {/* Post Input */}
            {(!userId || userId === userProfile?.id) && (
                <div className="p-4 border-b border-gray-800">
                    {/* Shortcuts */}
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                        {shortcuts.map(s => (
                            <button
                                key={s.label}
                                onClick={() => setNewPostContent(s.text)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-xs font-medium text-gray-300 transition-colors whitespace-nowrap"
                            >
                                <span>{s.icon}</span>
                                {s.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0 relative overflow-hidden text-white flex items-center justify-center font-bold">
                            {userProfile?.avatarUrl ? (
                                <img src={userProfile.avatarUrl} alt="Me" className="w-full h-full object-cover" />
                            ) : (
                                <span>{userProfile?.id?.substring(0, 1).toUpperCase() || 'U'}</span>
                            )}
                        </div>
                        <div className="flex-1">
                            <textarea
                                value={newPostContent}
                                onChange={(e) => setNewPostContent(e.target.value)}
                                placeholder="What's happening in your studio?"
                                className="w-full bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 resize-none min-h-[80px] focus:outline-none"
                            />

                            {/* Selected Product Preview */}
                            {selectedProductId && (
                                <div className="mb-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded-lg flex items-center justify-between">
                                    <span className="text-sm text-blue-200">
                                        Attaching: <span className="font-bold">{artistProducts.find(p => p.id === selectedProductId)?.title}</span>
                                    </span>
                                    <button
                                        onClick={() => setSelectedProductId(null)}
                                        className="text-xs text-blue-300 hover:text-white"
                                    >
                                        Remove
                                    </button>
                                </div>
                            )}

                            {/* Product Picker */}
                            {showProductPicker && (
                                <div className="mb-3 bg-gray-900 border border-gray-700 rounded-lg p-2 absolute z-10 shadow-xl max-h-60 overflow-y-auto w-64">
                                    <div className="text-xs text-gray-500 uppercase font-bold mb-2">Select Product</div>
                                    {artistProducts.length === 0 ? (
                                        <div className="text-sm text-gray-400 p-2">No active products found.</div>
                                    ) : (
                                        <div className="space-y-1">
                                            {artistProducts.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => {
                                                        setSelectedProductId(p.id!);
                                                        setShowProductPicker(false);
                                                    }}
                                                    className="w-full text-left p-2 hover:bg-gray-800 rounded text-sm flex justify-between items-center"
                                                >
                                                    <span className="truncate">{p.title}</span>
                                                    <span className="text-green-400 text-xs">{p.currency} {p.price}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-2 border-t border-gray-800 pt-3">
                                <div className="flex gap-2">
                                    <button className="text-gray-400 hover:text-blue-400 transition-colors p-2 rounded-full hover:bg-gray-800">
                                        <ImageIcon size={20} />
                                    </button>
                                    {((userProfile as any)?.accountType === 'artist' || (userProfile as any)?.accountType === 'label') && (
                                        <button
                                            onClick={() => setShowProductPicker(!showProductPicker)}
                                            className={`transition-colors p-2 rounded-full hover:bg-gray-800 relative
                                                ${selectedProductId ? 'text-blue-400' : 'text-gray-400 hover:text-blue-400'}`}
                                            title="Attach Product (Drop)"
                                        >
                                            <ShoppingBag size={20} />
                                            {artistProducts.length > 0 && (
                                                <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></span>
                                            )}
                                        </button>
                                    )}
                                </div>
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

            {/* Feed Tabs */}
            <div className="flex border-b border-gray-800">
                {(['all', 'following', 'mine'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`flex-1 py-3 text-sm font-medium transition-colors relative
                            ${filter === f ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        {filter === f && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full mx-12"></div>
                        )}
                    </button>
                ))}
            </div>

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
                            <FeedItem key={post.id} post={post} formatDate={formatDate} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});



// Sub-component for individual items to handle async product fetching if needed
// or we can pass products from a global store. For MVP, we'll fetch product if ID exists.
// Ideally, the feed query should join this data, but NoSQL :)
export default SocialFeed;

// Sub-component for individual items to handle async product fetching if needed
// or we can pass products from a global store. For MVP, we'll fetch product if ID exists.
// Ideally, the feed query should join this data, but NoSQL :)
const FeedItem = React.memo(({ post, formatDate }: { post: SocialPost, formatDate: (ts: number) => string }) => {
    const [embeddedProduct, setEmbeddedProduct] = useState<Product | null>(null);

    useEffect(() => {
        if (post.productId) {
            // Fetch product details
            // In a real app, use a data loader or cache
            MarketplaceService.getProductsByArtist(post.authorId).then(products => {
                const found = products.find(p => p.id === post.productId);
                if (found) setEmbeddedProduct(found);
            });
        }
    }, [post.productId, post.authorId]);

    return (
        <article className="p-4 hover:bg-[#161b22] transition-colors group">
            <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden cursor-pointer">
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
                        <button className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal size={16} />
                        </button>
                    </div>

                    <p className="text-gray-200 mt-1 whitespace-pre-wrap">{post.content}</p>

                    {/* Social Drop / Embedded Product */}
                    {embeddedProduct && (
                        <div className="mt-3">
                            <ProductCard product={embeddedProduct} variant="embedded" />
                        </div>
                    )}

                    {post.mediaUrls && post.mediaUrls.length > 0 && (
                        <div className="mt-3 rounded-xl overflow-hidden border border-gray-800">
                            <img src={post.mediaUrls[0]} alt="Post content" className="w-full h-auto max-h-[400px] object-cover" />
                        </div>
                    )}

                    <div className="flex items-center gap-6 mt-3 text-gray-500">
                        <button className="flex items-center gap-2 hover:text-red-500 transition-colors group/like">
                            <Heart size={18} className="group-hover/like:scale-110 transition-transform" />
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
    );
});
