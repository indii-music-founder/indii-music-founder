import React, { useState, useEffect } from 'react';
import { Package, Plus, DollarSign, Tag, Image as ImageIcon } from 'lucide-react';
import { useStore } from '@/core/store';
import { MarketplaceService } from '@/services/marketplace/MarketplaceService';
import { Product } from '@/services/marketplace/types';
import { UserService } from '@/services/UserService';
import { useToast } from '@/core/context/ToastContext';

export const MerchTable: React.FC = () => {
    const { user } = useStore();
    const toast = useToast();
    const [products, setProducts] = useState<Product[]>([]);
    const [assets, setAssets] = useState<any[]>([]); // From BrandKit
    const [isMinting, setIsMinting] = useState(false);

    // Minting Form State
    const [selectedAsset, setSelectedAsset] = useState<any>(null);
    const [price, setPrice] = useState('0.99');
    const [title, setTitle] = useState('');
    const [inventory, setInventory] = useState('100');

    useEffect(() => {
        if (user) {
            loadProducts();
            loadAssets();
        }
    }, [user]);

    // Dynamic Pricing Logic based on Scarcity
    useEffect(() => {
        const stock = parseInt(inventory);
        if (!isNaN(stock)) {
            if (stock === 1) setPrice('49.99'); // 1-of-1 "Golden"
            else if (stock < 10) setPrice('19.99'); // Limited Edition
            else if (stock < 100) setPrice('4.99'); // Rare
            else setPrice('0.99'); // Standard
        }
    }, [inventory]);

    const loadProducts = async () => {
        if (!user) return;
        const items = await MarketplaceService.getProductsByArtist(user.uid);
        setProducts(items);
    };

    const loadAssets = async () => {
        if (!user) return;
        const profile = await UserService.getUserProfile(user.uid);
        if (profile?.brandKit?.referenceImages) {
            setAssets(profile.brandKit.referenceImages);
        }
    };

    const handleMint = async () => {
        if (!user || !selectedAsset) return;

        try {
            await MarketplaceService.createProduct({
                sellerId: user.uid,
                title: title || selectedAsset.description || 'Untitled Asset',
                description: selectedAsset.description || 'AI Generated Asset',
                price: parseFloat(price) * 100, // Cents
                currency: 'USD',
                type: 'digital-asset',
                images: [selectedAsset.url],
                inventory: parseInt(inventory),
                metadata: {
                    originalAssetId: selectedAsset.id,
                    tags: selectedAsset.tags
                },
                splits: [
                    { recipientId: user.uid, role: 'artist', percentage: 100 }
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
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Package className="text-purple-400" size={20} />
                        Merch Table
                    </h3>
                    <p className="text-gray-400 text-sm">Mint and sell digital collectibles directly to fans.</p>
                </div>
                <button
                    onClick={() => setIsMinting(!isMinting)}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus size={16} /> Mint New Item
                </button>
            </div>

            {isMinting && (
                <div className="mb-6 p-4 bg-purple-900/10 border border-purple-500/20 rounded-lg space-y-4">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Mint Digital Asset</h4>

                    {/* Asset Selector */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400">Select Source Asset</label>
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                            {assets.map((asset) => (
                                <button
                                    key={asset.id}
                                    onClick={() => {
                                        setSelectedAsset(asset);
                                        setTitle(asset.description || '');
                                    }}
                                    className={`relative shrink-0 w-20 h-20 rounded overflow-hidden border-2 transition-all ${selectedAsset?.id === asset.id ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-gray-700 hover:border-gray-500'
                                        }`}
                                >
                                    <img src={asset.url} alt="asset" className="w-full h-full object-cover" />
                                </button>
                            ))}
                            {assets.length === 0 && (
                                <div className="text-xs text-gray-500 italic p-2">No assets found in Brand Kit. Generate some art first!</div>
                            )}
                        </div>
                    </div>

                    {selectedAsset && (
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Title</label>
                                <input
                                    className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-sm text-white outline-none focus:border-purple-500"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Price (USD)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-2 top-2.5 text-gray-500" size={12} />
                                    <input
                                        type="number"
                                        className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 pl-6 text-sm text-white outline-none focus:border-green-500"
                                        value={price}
                                        onChange={e => setPrice(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Inventory</label>
                                <input
                                    type="number"
                                    className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-sm text-white outline-none focus:border-blue-500"
                                    value={inventory}
                                    onChange={e => setInventory(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-2">
                        <button
                            disabled={!selectedAsset}
                            onClick={handleMint}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all ${!selectedAsset ? 'bg-gray-700 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 shadow-lg hover:shadow-green-500/20'
                                }`}
                        >
                            Mint to Store
                        </button>
                    </div>
                </div>
            )}

            {/* Product List */}
            <div className="space-y-3">
                {products.length === 0 ? (
                    <div className="text-center py-8 text-gray-600">
                        <Tag size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Merch table is empty.</p>
                    </div>
                ) : (
                    products.map(product => (
                        <div key={product.id} className="flex items-center gap-4 p-3 bg-[#0d1117] rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                            <div className="w-12 h-12 bg-gray-800 rounded overflow-hidden shrink-0">
                                {product.images[0] ? (
                                    <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="w-full h-full p-3 text-gray-600" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-white truncate">{product.title}</h4>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400 border border-gray-700">
                                        {product.type}
                                    </span>
                                    <span>Stock: {product.inventory ?? '∞'}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-white">
                                    ${(product.price / 100).toFixed(2)}
                                </div>
                                <div className="text-[10px] text-green-400">Active</div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
