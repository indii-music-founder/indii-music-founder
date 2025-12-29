import React, { useEffect, useState } from 'react';
import { Product } from '@/services/marketplace/types';
import { MarketplaceService } from '@/services/marketplace/MarketplaceService';
import { useStore } from '@/core/store';
import ProductCard from './ProductCard';
import CreateProductModal from './CreateProductModal';
import { Plus, Store } from 'lucide-react';

interface MarketplaceStorefrontProps {
    artistId?: string; // If provided, shows specific artist's store.
}

export default function MarketplaceStorefront({ artistId }: MarketplaceStorefrontProps) {
    const currentUser = useStore((state) => state.userProfile);
    // For profile usage, artistId should be passed.
    const targetId = artistId || currentUser?.id;

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        if (targetId) {
            loadProducts();
        }
    }, [targetId]);

    const loadProducts = async () => {
        if (!targetId) return;
        setLoading(true);
        try {
            const data = await MarketplaceService.getProductsByArtist(targetId);
            setProducts(data);
        } catch (error) {
            console.error("Failed to load products", error);
        } finally {
            setLoading(false);
        }
    };

    const isOwner = currentUser?.id === targetId;

    if (!targetId) {
        return <div className="p-8 text-center text-gray-500">Store not found</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                    <Store className="text-blue-500" />
                    <h2 className="text-xl font-bold">Storefront</h2>
                </div>
                {isOwner && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
                    >
                        <Plus size={16} /> Add Product
                    </button>
                )}
            </div>

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-72 bg-gray-900 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : products.length === 0 ? (
                <div className="text-center py-16 bg-[#161b22] rounded-xl border border-gray-800 border-dashed">
                    <p className="text-gray-500">No products available yet.</p>
                    {isOwner && (
                        <p className="text-sm text-gray-600 mt-2">Start selling by adding your first product.</p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {products.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            )}

            {isCreateModalOpen && (
                <CreateProductModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onProductCreated={loadProducts}
                />
            )}
        </div>
    );
}
