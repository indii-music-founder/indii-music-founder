import React, { useState } from 'react';
import { Product } from '@/services/marketplace/types';
import { MarketplaceService } from '@/services/marketplace/MarketplaceService';
import { useStore } from '@/core/store';
import { ShoppingBag, Loader2, Check } from 'lucide-react';

interface ProductCardProps {
    product: Product;
    variant?: 'default' | 'embedded';
}

export default function ProductCard({ product, variant = 'default' }: ProductCardProps) {
    const [purchasing, setPurchasing] = useState(false);
    const [purchased, setPurchased] = useState(false);
    const currentUser = useStore((state) => state.userProfile);

    const handlePurchase = async () => {
        if (!currentUser) return;

        setPurchasing(true);
        try {
            await MarketplaceService.purchaseProduct(
                product.id!,
                currentUser.id,
                product.sellerId,
                product.price
            );
            setPurchased(true);
        } catch (error) {
            console.error("Purchase failed:", error);
        } finally {
            setPurchasing(false);
        }
    };

    const isEmbedded = variant === 'embedded';

    if (isEmbedded) {
        return (
            <div className="flex bg-gray-900 border border-gray-700 rounded-lg overflow-hidden max-w-md">
                <div className="w-24 h-24 flex-shrink-0 bg-gray-800">
                    {product.images && product.images.length > 0 ? (
                        <img
                            src={product.images[0]}
                            alt={product.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                            <ShoppingBag className="text-white/20" size={24} aria-hidden="true" />
                        </div>
                    )}
                </div>

                <div className="flex-1 p-3 flex flex-col justify-center">
                    <div className="flex justify-between items-start mb-1">
                        <div>
                            <h4 className="font-semibold text-white text-sm line-clamp-1">{product.title}</h4>
                            <p className="text-xs text-gray-400 capitalize">{product.type} • {product.inventory} left</p>
                        </div>
                        <span className="text-green-400 font-bold text-sm">
                            {product.currency} {product.price}
                        </span>
                    </div>

                    <button
                        onClick={handlePurchase}
                        disabled={purchasing || purchased || product.inventory === 0}
                        aria-label={purchased ? `Owned: ${product.title}` : `Buy ${product.title} for ${product.currency} ${product.price}`}
                        className={`w-full mt-auto py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors
                            ${purchased
                                ? 'bg-green-600/20 text-green-400 cursor-default'
                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                            }`}
                    >
                        {purchasing ? (
                            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                        ) : purchased ? (
                            <>
                                <Check size={12} aria-hidden="true" /> Owned
                            </>
                        ) : (
                            <>
                                Buy Now
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // Default Card (Marketplace)
    return (
        <div className="group bg-gray-900 border border-gray-800 hover:border-blue-500/50 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1">
            {/* Image Aspect Root */}
            <div className="aspect-square relative bg-gray-800 overflow-hidden">
                {product.images && product.images.length > 0 ? (
                    <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center group-hover:from-indigo-500/20 group-hover:to-purple-500/20 transition-colors">
                        <ShoppingBag className="text-white/20 group-hover:text-white/40 transition-colors" size={48} aria-hidden="true" />
                    </div>
                )}

                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs font-medium text-white border border-white/10">
                    {(product.inventory || 0) > 0 ? `${product.inventory} left` : 'Sold Out'}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                <div>
                    <div className="flex justify-between items-start gap-2 mb-1">
                        <h3 className="font-bold text-white leading-tight">{product.title}</h3>
                        <span className="text-green-400 font-bold whitespace-nowrap">
                            {product.currency} {product.price}
                        </span>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-2">{product.description}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-gray-800 text-gray-300 capitalize">
                        {product.type}
                    </span>

                    <button
                        onClick={handlePurchase}
                        disabled={purchasing || purchased || product.inventory === 0}
                        aria-label={purchased ? `Owned: ${product.title}` : `Purchase ${product.title} for ${product.currency} ${product.price}`}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all
                            ${purchased
                                ? 'bg-green-600/20 text-green-400 cursor-default'
                                : 'bg-white text-black hover:bg-gray-200'
                            }`}
                    >
                        {purchasing ? (
                            <>
                                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                Processing...
                            </>
                        ) : purchased ? (
                            <>
                                <Check size={16} aria-hidden="true" />
                                In Collection
                            </>
                        ) : (
                            'Purchase'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
