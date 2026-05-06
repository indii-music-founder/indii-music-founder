import React, { useEffect, useState, useCallback } from 'react';
import { SocialPost } from '@/services/social/types';
import { MarketplaceService } from '@/services/marketplace/MarketplaceService';
import { Product } from '@/services/marketplace/types';
import ProductCard from '@/modules/marketplace/components/ProductCard';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import type { StoreState } from '@/core/store';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  MoreHorizontal, 
  Image as ImageIcon, 
  Send, 
  ShoppingBag, 
  Ghost,
  X,
  Rocket,
  Plus
} from 'lucide-react';
import { useSocial } from '../hooks/useSocial';
import { areFeedItemPropsEqual } from './SocialFeed.utils';
import { formatDate } from '@/lib/utils';
import { logger } from '@/utils/logger';
import ProductPickerModal from './ProductPickerModal';
import { motion, AnimatePresence } from 'framer-motion';

interface SocialFeedProps {
    userId?: string;
}

const SHORTCUTS = [
    { label: "Announce Drop", icon: "🚀", text: "New Drop Alert! 🚨 [Product Name] is now live. Cop it before it's gone!" },
    { label: "Behind the Scenes", icon: "🎬", text: "In the lab cooking up something special... 🧪 #StudioFlow" },
    { label: "Thank You", icon: "🙏", text: "Big love to everyone showing support on the latest track! Y'all are the best. ❤️" }
];

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

    // Drop State
    const [artistProducts, setArtistProducts] = useState<Product[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [showProductPicker, setShowProductPicker] = useState(false);

    const userProfile = useStore(useShallow((state: StoreState) => state.userProfile));

    const loadArtistProducts = async () => {
        if (!userProfile?.id) return;
        try {
            const products = await MarketplaceService.getProductsByArtist(userProfile.id);
            setArtistProducts(products);
        } catch (error: unknown) {
            logger.error("Failed to load products for picker:", error);
        }
    };

    useEffect(() => {
        if (userProfile?.accountType === 'artist' || userProfile?.accountType === 'label') {
            const timer = setTimeout(() => {
                void loadArtistProducts();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [userProfile]);

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

    const selectedProduct = artistProducts.find(p => p.id === selectedProductId);

    return (
        <div className="flex flex-col h-full bg-[#0d1117] text-white">
            {/* Post Input */}
            {(!userId || userId === userProfile?.id) && (
                <div className="p-6 border-b border-gray-800 bg-[#161b22]/50">
                    <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-full bg-dept-creative flex-shrink-0 relative overflow-hidden text-black flex items-center justify-center font-bold shadow-lg shadow-dept-creative/20">
                            {userProfile?.photoURL ? (
                                <img src={userProfile.photoURL} alt="Me" className="w-full h-full object-cover" />
                            ) : (
                                <span>{userProfile?.id?.substring(0, 1).toUpperCase() || 'U'}</span>
                            )}
                        </div>
                        <div className="flex-1 space-y-4">
                            <div className="bg-black/40 border border-gray-800 rounded-2xl p-4 focus-within:border-dept-creative/50 transition-colors">
                                <textarea
                                    value={newPostContent}
                                    onChange={(e) => setNewPostContent(e.target.value)}
                                    data-testid="social-post-input"
                                    placeholder="What's happening in your studio?"
                                    className="w-full bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 resize-none min-h-[100px] focus:outline-none text-lg"
                                />
                                
                                <AnimatePresence>
                                    {selectedProduct && (
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="mt-4 p-3 bg-dept-creative/5 border border-dept-creative/20 rounded-xl flex items-center gap-4 relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 p-1 bg-dept-creative/10 rounded-bl-xl text-[10px] font-bold text-dept-creative uppercase tracking-tighter">
                                                Active Drop
                                            </div>
                                            <div className="w-12 h-12 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                                                {selectedProduct.images?.[0] && (
                                                    <img src={selectedProduct.images[0]} className="w-full h-full object-cover" alt="" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-white truncate">{selectedProduct.title}</div>
                                                <div className="text-xs text-dept-creative">{selectedProduct.currency} {selectedProduct.price}</div>
                                            </div>
                                            <button 
                                                onClick={() => setSelectedProductId(null)}
                                                className="p-1.5 hover:bg-red-500/10 hover:text-red-400 text-gray-500 rounded-lg transition-colors"
                                            >
                                                <X size={16} />
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => { }} 
                                        className="p-2.5 text-gray-400 hover:text-dept-creative transition-colors rounded-xl hover:bg-dept-creative/5 group"
                                        title="Add Media"
                                    >
                                        <ImageIcon size={20} className="group-hover:scale-110 transition-transform" />
                                    </button>
                                    {((userProfile as any)?.accountType === 'artist' || (userProfile as any)?.accountType === 'label') && (
                                        <button
                                            onClick={() => setShowProductPicker(true)}
                                            data-testid="social-attach-product-button"
                                            className={`p-2.5 rounded-xl transition-all group flex items-center gap-2
                                                ${selectedProductId 
                                                    ? 'bg-dept-creative text-black font-bold text-xs px-4' 
                                                    : 'text-gray-400 hover:text-dept-creative hover:bg-dept-creative/5'}`}
                                            title="Attach Social Drop"
                                        >
                                            <ShoppingBag size={20} className={!selectedProductId ? "group-hover:scale-110 transition-transform" : ""} />
                                            {selectedProductId ? "Product Attached" : ""}
                                        </button>
                                    )}
                                    
                                    <div className="h-6 w-[1px] bg-gray-800 mx-2" />
                                    
                                    <div className="flex gap-1 overflow-x-auto scrollbar-hide max-w-[300px]">
                                        {SHORTCUTS.map(s => (
                                                <button
                                                key={s.label}
                                                onClick={() => setNewPostContent(s.text)}
                                                data-testid={`social-shortcut-${s.label.toLowerCase().replace(/\s+/g, '-')}`}
                                                className="px-3 py-1.5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg text-[10px] font-bold text-gray-400 hover:text-white transition-all whitespace-nowrap flex items-center gap-1.5"
                                            >
                                                <span>{s.icon}</span>
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <button
                                    onClick={handleCreatePost}
                                    disabled={!newPostContent.trim() || isPosting}
                                    data-testid="social-post-submit"
                                    className="bg-dept-creative hover:bg-dept-creative/90 disabled:opacity-50 disabled:cursor-not-allowed text-black px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-dept-creative/20 group"
                                >
                                    {isPosting ? 'Posting...' : <>Post <Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /></>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Picker Modal */}
            <AnimatePresence>
                {showProductPicker && (
                    <ProductPickerModal 
                        onClose={() => setShowProductPicker(false)}
                        onSelect={(id) => {
                            setSelectedProductId(id);
                            setShowProductPicker(false);
                        }}
                        selectedId={selectedProductId}
                    />
                )}
            </AnimatePresence>

            {/* Feed Tabs */}
            <div className="flex border-b border-gray-800 px-6 bg-[#0d1117]/80 backdrop-blur-md sticky top-0 z-10">
                {(['all', 'following', 'mine'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`py-4 px-6 text-sm font-bold transition-all relative
                            ${filter === f ? 'text-dept-creative' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {f.toUpperCase()}
                        {filter === f && (
                            <motion.div 
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-1 bg-dept-creative rounded-t-full shadow-[0_-4px_10px_rgba(0,255,102,0.5)]" 
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Feed List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dept-creative"></div>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 animate-in fade-in duration-500">
                        <div className="bg-gray-800/50 p-4 rounded-full mb-4">
                            <Ghost size={32} className="text-gray-400" aria-hidden="true" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-1">It's quiet in here</h3>
                        <p className="text-sm max-w-[250px]">
                            No posts yet. Be the first to share what's happening in your studio!
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-800">
                        {posts.map((post) => (
                            <FeedItem key={post.id} post={post} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});

export default SocialFeed;

// Sub-component for individual items to handle async product fetching if needed
// ⚡ Bolt Optimization: Memoize to prevent re-renders when parent's local state changes (typing)
// We use custom deep comparison here because Firestore onSnapshot often returns new object references
// even for unchanged items, which defeats shallow comparison.
const FeedItem = React.memo(({ post }: { post: SocialPost }) => {
    const [embeddedProduct, setEmbeddedProduct] = useState<Product | null>(null);

    useEffect(() => {
        if (post.productId) {
            // ⚡ Bolt Optimization: MarketplaceService now uses caching to prevent redundant requests
            MarketplaceService.getProductById(post.productId).then(product => {
                if (product) setEmbeddedProduct(product);
            });
        }
    }, [post.productId]);

    return (
        <article className="p-4 hover:bg-[#161b22] transition-colors group">
            <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden cursor-pointer">
                    {post.authorAvatar ? (
                        <img src={post.authorAvatar} alt={post.authorName} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-linear-to-br from-gray-700 to-gray-600" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="font-bold text-white hover:underline cursor-pointer">
                                {post.authorName}
                            </span>
                            <span className="text-gray-500 text-sm ml-2">
                                {formatDate(post.timestamp, true)}
                            </span>
                        </div>
                        <button
                            className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:ring-2 focus-visible:ring-blue-500 rounded p-1 focus-visible:outline-none"
                            aria-label={`More options for post by ${post.authorName}`}
                        >
                            <MoreHorizontal size={16} />
                        </button>
                    </div>

                    <p className="text-gray-200 mt-1 whitespace-pre-wrap">{post.content}</p>

                    {/* Social Drop / Embedded Product */}
                    {embeddedProduct && (
                        <div className="mt-3">
                            <ProductCard
                                product={embeddedProduct}
                                variant="embedded"
                                source="social"
                                sourceId={post.id}
                            />
                        </div>
                    )}

                    {post.mediaUrls && post.mediaUrls.length > 0 && (
                        <div className="mt-3 rounded-xl overflow-hidden border border-gray-800">
                            {/* ⚡ Bolt Optimization: Lazy load feed images to improve performance on long lists */}
                            <img
                                src={post.mediaUrls[0]}
                                alt="Post content"
                                className="w-full h-auto max-h-[400px] object-cover"
                                loading="lazy"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-6 mt-3 text-gray-500">
                        <button
                            className="flex items-center gap-2 hover:text-red-500 transition-colors group/like focus-visible:ring-2 focus-visible:ring-red-500 rounded px-1 focus-visible:outline-none"
                            aria-label={`Like post, ${post.likes} likes`}
                        >
                            <Heart size={18} className="group-hover/like:scale-110 transition-transform" />
                            <span className="text-sm">{post.likes}</span>
                        </button>
                        <button
                            className="flex items-center gap-2 hover:text-dept-creative transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative rounded px-1 focus-visible:outline-none"
                            aria-label={`Comment on post, ${post.commentsCount} comments`}
                        >
                            <MessageCircle size={18} />
                            <span className="text-sm">{post.commentsCount}</span>
                        </button>
                        <button
                            className="flex items-center gap-2 hover:text-dept-creative transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative rounded px-1 focus-visible:outline-none"
                            aria-label="Share post"
                        >
                            <Share2 size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
}, areFeedItemPropsEqual);
