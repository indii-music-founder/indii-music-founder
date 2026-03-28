import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Plus, DollarSign, Tag, Image as ImageIcon, Sparkles, Box, Trash2, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '@/core/store';
import { MarketplaceService } from '@/services/marketplace/MarketplaceService';
import { Product } from '@/services/marketplace/types';
import { UserService } from '@/services/UserService';
import type { BrandAsset } from '@/types/User';
import { useToast } from '@/core/context/ToastContext';
import { motion, AnimatePresence } from 'motion/react';
import { logger } from '@/utils/logger';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionableEmptyState } from '@/components/shared/ActionableEmptyState';

interface MerchTableProps {
    isDashboardView?: boolean;
    pageSize?: number;
}

export const MerchTable: React.FC<MerchTableProps> = ({ isDashboardView = false, pageSize = 6 }) => {
    const { userProfile } = useStore();
    const toast = useToast();
    const [products, setProducts] = useState<Product[]>([]);
    const [assets, setAssets] = useState<BrandAsset[]>([]); // From BrandKit
    const [isMinting, setIsMinting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // Minting Form State
    const [selectedAsset, setSelectedAsset] = useState<BrandAsset | null>(null);
    const [price, setPrice] = useState('0.99');
    const [title, setTitle] = useState('');
    const [inventory, setInventory] = useState('100');

    const totalPages = Math.ceil(products.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedProducts = useMemo(() =>
        products.slice(startIndex, startIndex + pageSize),
        [products, startIndex, pageSize]);

    const loadProducts = useCallback(async () => {
        if (!userProfile) return;
        try {
            const items = await MarketplaceService.getProductsByArtist(userProfile.id);
            setProducts(items);
        } catch (err) {
            logger.error("Failed to load products", err);
        }
    }, [userProfile]);

    const loadAssets = useCallback(async () => {
        if (!userProfile) return;
        try {
            const profile = await UserService.getUserProfile(userProfile.id);
            if (profile?.brandKit?.referenceImages) {
                setAssets(profile.brandKit.referenceImages);
            }
        } catch (err) {
            logger.error("Failed to load assets", err);
        }
    }, [userProfile]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadProducts();
        loadAssets();
    }, [loadProducts, loadAssets]);

    const handleMint = async () => {
        if (!userProfile || !selectedAsset) return;

        try {
            await MarketplaceService.createProduct({
                sellerId: userProfile.id,
                title: title || selectedAsset.description || 'Untitled Asset',
                description: selectedAsset.description || 'AI Generated Asset',
                price: parseFloat(price) * 100, // Cents
                currency: 'USD',
                type: 'digital-asset',
                images: [selectedAsset.url],
                inventory: parseInt(inventory),
                metadata: {
                    originalAssetId: selectedAsset.id,
                    tags: selectedAsset.tags || []
                },
                splits: [
                    { recipientId: userProfile.id, role: 'artist', percentage: 100 }
                ]
            });

            toast.success('Asset Minted successfully!');
            setIsMinting(false);
            loadProducts();

            // Reset form
            setTitle('');
            setPrice('0.99');
            setSelectedAsset(null);
        } catch (error) {
            logger.error("Operation failed:", error);
            toast.error('Failed to mint asset.');
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <Box className="text-dept-royalties" size={24} />
                        {isDashboardView ? 'Product Ledger' : 'Inventory Management'}
                    </h3>
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-[0.2em] mt-1 ml-9">Marketplace Liquidity Status</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsMinting(!isMinting)}
                    className="flex items-center gap-2 bg-gradient-to-r from-dept-creative to-dept-royalties hover:from-dept-creative/80 hover:to-dept-royalties/80 text-white px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-xl shadow-dept-creative/20 border border-white/10"
                >
                    {isMinting ? <Trash2 size={16} /> : <Plus size={16} />}
                    {isMinting ? 'Cancel' : 'Mint New Item'}
                </motion.button>
            </div>

            <AnimatePresence>
                {isMinting && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mb-8 p-8 bg-white/5 border border-white/10 rounded-[2rem] space-y-8 backdrop-blur-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-dept-creative/10 blur-[50px] pointer-events-none" />

                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-yellow-400" />
                                <h4 className="text-sm font-black text-white uppercase tracking-widest">Global Asset Minting</h4>
                            </div>

                            {/* Asset Selector */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-1">1. Select Creative Asset</label>
                                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar lg:pb-2">
                                    {assets.map((asset) => (
                                        <motion.button
                                            key={asset.id}
                                            whileHover={{ y: -5 }}
                                            onClick={() => {
                                                setSelectedAsset(asset);
                                                setTitle(asset.description || '');
                                            }}
                                            className={`relative shrink-0 w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all shadow-lg ${selectedAsset?.id === asset.id ? 'border-dept-creative ring-4 ring-dept-creative/20' : 'border-white/5 grayscale hover:grayscale-0 hover:border-white/20'
                                                }`}
                                        >
                                            <img src={asset.url} alt="asset" className="w-full h-full object-cover" />
                                            {selectedAsset?.id === asset.id && (
                                                <div className="absolute inset-0 bg-dept-creative/20 flex items-center justify-center">
                                                    <Sparkles size={24} className="text-white drop-shadow-lg" />
                                                </div>
                                            )}
                                        </motion.button>
                                    ))}
                                    {assets.length === 0 && (
                                        <div className="w-full py-10 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl">
                                            <p className="text-sm text-gray-500 font-medium italic">No assets found in Brand Kit. Generate some art first!</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedAsset && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="grid grid-cols-1 md:grid-cols-3 gap-6"
                                >
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Product Title</label>
                                        <input
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-dept-creative transition-all font-medium"
                                            placeholder="Descriptive Title"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Market Price (USD)</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                                            <input
                                                type="number"
                                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 pl-10 text-sm text-white outline-none focus:border-dept-royalties transition-all font-mono font-bold"
                                                value={price}
                                                onChange={e => setPrice(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Scarcity (Units)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-dept-distribution transition-all font-bold"
                                            value={inventory}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setInventory(val);
                                                const stock = parseInt(val);
                                                if (!isNaN(stock)) {
                                                    if (stock === 1) setPrice('49.99');
                                                    else if (stock < 10) setPrice('19.99');
                                                    else if (stock < 100) setPrice('4.99');
                                                    else setPrice('0.99');
                                                }
                                            }}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            <div className="flex justify-end border-t border-white/5 pt-6">
                                <motion.button
                                    disabled={!selectedAsset}
                                    whileHover={selectedAsset ? { scale: 1.02 } : {}}
                                    whileTap={selectedAsset ? { scale: 0.98 } : {}}
                                    onClick={handleMint}
                                    className={`px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-white transition-all shadow-2xl flex items-center gap-3 ${!selectedAsset ? 'bg-gray-800 opacity-30 cursor-not-allowed' : 'bg-gradient-to-r from-dept-licensing to-dept-royalties hover:from-dept-licensing/80 hover:to-dept-royalties/80 shadow-dept-royalties/20'
                                        }`}
                                >
                                    Confirm & Dispatch to Store
                                    <ArrowRight size={18} />
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Product List Ledger */}
            <div className="space-y-4">
                {products.length === 0 ? (
                    <ActionableEmptyState
                        icon={<Tag size={48} />}
                        title="VIRTUAL LEDGER IS EMPTY"
                        description="No active products or digital assets detected in your current catalog."
                        colorClasses={{
                            text: 'text-gray-500',
                            bg: 'bg-white/5',
                            border: 'border-white/10'
                        }}
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        <AnimatePresence mode="popLayout">
                            {paginatedProducts.map((product, index) => (
                                <ContextMenu.Root key={product.id}>
                                    <ContextMenu.Trigger asChild>
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            transition={{ delay: (index % pageSize) * 0.05 }}
                                            className="group flex items-center gap-6 p-5 bg-white/5 backdrop-blur-sm rounded-[1.5rem] border border-white/5 hover:border-dept-royalties/30 hover:bg-white/10 transition-all cursor-default relative overflow-hidden shadow-xl"
                                        >
                                            <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-dept-royalties/5 to-transparent pointer-events-none group-hover:from-dept-royalties/10 transition-all" />

                                            <div className="w-16 h-16 bg-white/10 rounded-2xl overflow-hidden shrink-0 border border-white/10 group-hover:border-dept-royalties/30 transition-all shadow-inner">
                                                {product.images[0] ? (
                                                    <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                ) : (
                                                    <ImageIcon className="w-full h-full p-4 text-gray-700" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0 pr-4">
                                                <h4 className="text-lg font-bold text-white truncate group-hover:text-dept-royalties transition-colors uppercase tracking-tight">{product.title}</h4>
                                                <div className="flex items-center gap-4 mt-2">
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 border border-white/5 rounded-lg">
                                                        <Tag size={10} className="text-dept-royalties" />
                                                        <span className="text-[10px] font-black text-gray-400 tracking-tighter uppercase">{product.type}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 border border-white/5 rounded-lg">
                                                        <Package size={10} className="text-dept-licensing" />
                                                        <span className="text-[10px] font-black text-gray-400 tracking-tighter uppercase">Stock: {product.inventory ?? '∞'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right flex flex-col items-end pr-2">
                                                <div className="text-2xl font-black text-white group-hover:text-dept-licensing transition-all drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                                                    ${(product.price / 100).toFixed(2)}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1 bg-dept-licensing/10 px-2 py-0.5 rounded-full border border-dept-licensing/20">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-dept-licensing animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                                    <span className="text-[8px] font-bold text-dept-licensing uppercase tracking-widest">Active</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </ContextMenu.Trigger>
                                    <ContextMenu.Portal>
                                        <ContextMenu.Content className="min-w-[160px] bg-[#1a1c20] border border-white/10 rounded-xl p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95">
                                            <ContextMenu.Item
                                                onSelect={() => navigator.clipboard.writeText(product.id)}
                                                className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded outline-none cursor-pointer font-bold"
                                            >
                                                Copy Product ID
                                            </ContextMenu.Item>
                                            <ContextMenu.Item
                                                onSelect={() => navigator.clipboard.writeText(product.title)}
                                                className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded outline-none cursor-pointer font-bold"
                                            >
                                                Copy Title
                                            </ContextMenu.Item>
                                            <ContextMenu.Separator className="h-px bg-white/10 my-1" />
                                            <ContextMenu.Item
                                                onSelect={async () => {
                                                    try {
                                                        await MarketplaceService.deleteProduct(product.id);
                                                        toast.success('Product deleted successfully');
                                                        loadProducts();
                                                    } catch (err) {
                                                        toast.error('Failed to delete product');
                                                    }
                                                }}
                                                className="flex items-center gap-2 px-2 py-1.5 text-xs text-red-400 hover:bg-red-400/10 rounded outline-none cursor-pointer font-bold"
                                            >
                                                Delete Product
                                            </ContextMenu.Item>
                                        </ContextMenu.Content>
                                    </ContextMenu.Portal>
                                </ContextMenu.Root>
                            ))}
                        </AnimatePresence>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 pt-4">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                    Page {currentPage} of {totalPages} <span className="ml-2 font-mono text-gray-600">({products.length} products)</span>
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronLeft size={16} className="text-white" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronRight size={16} className="text-white" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
