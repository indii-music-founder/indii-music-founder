import React, { useState, useEffect, useCallback } from 'react';
import { Package, Plus, DollarSign, Tag, Image as ImageIcon, Sparkles, Box, Trash2, ArrowRight } from 'lucide-react';
import { useStore } from '@/core/store';
import { MarketplaceService } from '@/services/marketplace/MarketplaceService';
import { Product } from '@/services/marketplace/types';
import { UserService } from '@/services/UserService';
import { useToast } from '@/core/context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

interface MerchTableProps {
    isDashboardView?: boolean;
}

export const MerchTable: React.FC<MerchTableProps> = ({ isDashboardView = false }) => {
    const { userProfile } = useStore();
    const toast = useToast();
    const [products, setProducts] = useState<Product[]>([]);
    const [assets, setAssets] = useState<any[]>([]); // From BrandKit
    const [isMinting, setIsMinting] = useState(false);

    // Minting Form State
    const [selectedAsset, setSelectedAsset] = useState<any>(null);
    const [price, setPrice] = useState('0.99');
    const [title, setTitle] = useState('');
    const [inventory, setInventory] = useState('100');

    const loadProducts = useCallback(async () => {
        if (!userProfile) return;
        try {
            const items = await MarketplaceService.getProductsByArtist(userProfile.id);
            setProducts(items);
        } catch (err) {
            console.error("Failed to load products", err);
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
            console.error("Failed to load assets", err);
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
            console.error(error);
            toast.error('Failed to mint asset.');
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <Box className="text-purple-400" size={24} />
                        {isDashboardView ? 'Product Ledger' : 'Inventory Management'}
                    </h3>
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-[0.2em] mt-1 ml-9">Marketplace Liquidity Status</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsMinting(!isMinting)}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-xl shadow-purple-500/20 border border-white/10"
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
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] pointer-events-none" />

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
                                            className={`relative shrink-0 w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all shadow-lg ${selectedAsset?.id === asset.id ? 'border-purple-500 ring-4 ring-purple-500/20' : 'border-white/5 grayscale hover:grayscale-0 hover:border-white/20'
                                                }`}
                                        >
                                            <img src={asset.url} alt="asset" className="w-full h-full object-cover" />
                                            {selectedAsset?.id === asset.id && (
                                                <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
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
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-purple-500 transition-all font-medium"
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
                                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 pl-10 text-sm text-white outline-none focus:border-emerald-500 transition-all font-mono font-bold"
                                                value={price}
                                                onChange={e => setPrice(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Scarcity (Units)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-500 transition-all font-bold"
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
                                    className={`px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-white transition-all shadow-2xl flex items-center gap-3 ${!selectedAsset ? 'bg-gray-800 opacity-30 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20'
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
                    <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-[2rem] flex flex-col items-center">
                        <Tag size={48} className="text-gray-700 mb-4" />
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">VIRTUAL LEDGER IS EMPTY</p>
                        <p className="text-gray-600 text-xs mt-2 font-medium">No active products or digital assets detected.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {products.map((product, index) => (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="group flex items-center gap-6 p-5 bg-white/5 backdrop-blur-sm rounded-[1.5rem] border border-white/5 hover:border-purple-500/30 hover:bg-white/10 transition-all cursor-default relative overflow-hidden shadow-xl"
                            >
                                <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-purple-500/5 to-transparent pointer-events-none group-hover:from-purple-500/10 transition-all" />

                                <div className="w-16 h-16 bg-white/10 rounded-2xl overflow-hidden shrink-0 border border-white/10 group-hover:border-purple-500/30 transition-all shadow-inner">
                                    {product.images[0] ? (
                                        <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                        <ImageIcon className="w-full h-full p-4 text-gray-700" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 pr-4">
                                    <h4 className="text-lg font-bold text-white truncate group-hover:text-purple-400 transition-colors uppercase tracking-tight">{product.title}</h4>
                                    <div className="flex items-center gap-4 mt-2">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 border border-white/5 rounded-lg">
                                            <Tag size={10} className="text-purple-500" />
                                            <span className="text-[10px] font-black text-gray-400 tracking-tighter uppercase">{product.type}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 border border-white/5 rounded-lg">
                                            <Package size={10} className="text-teal-500" />
                                            <span className="text-[10px] font-black text-gray-400 tracking-tighter uppercase">Stock: {product.inventory ?? '∞'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right flex flex-col items-end pr-2">
                                    <div className="text-2xl font-black text-white group-hover:text-emerald-400 transition-all drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                                        ${(product.price / 100).toFixed(2)}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                        <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest">Active</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
