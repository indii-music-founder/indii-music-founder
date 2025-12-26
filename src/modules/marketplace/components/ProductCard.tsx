import React, { useState } from 'react';
import { Product } from '@/services/marketplace/types';
import { ShoppingBag, Music, Shirt, Ticket, Check } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { MarketplaceService } from '@/services/marketplace/MarketplaceService';
import { useStore } from '@/core/store';

interface ProductCardProps {
    product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
    const { id, title, description, price, type, images, sellerId } = product;
    const toast = useToast();
    const currentUser = useStore((state) => state.user);
    const [isPurchasing, setIsPurchasing] = useState(false);

    const formatPrice = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount / 100);
    };

    const getIcon = () => {
        switch (type) {
            case 'song': return <Music size={16} />;
            case 'merch': return <Shirt size={16} />;
            case 'ticket': return <Ticket size={16} />;
            default: return <ShoppingBag size={16} />;
        }
    };

    const handleBuy = async () => {
        if (!currentUser) {
            toast.error("Please login to purchase");
            return;
        }

        setIsPurchasing(true);
        try {
            await MarketplaceService.purchaseProduct(id, currentUser.uid, sellerId, price);
            toast.success(`Purchased ${title}!`);
        } catch (error) {
            console.error(error);
            toast.error("Purchase failed");
        } finally {
            setIsPurchasing(false);
        }
    };

    return (
        <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all group">
            {/* Image */}
            <div className="h-48 bg-gray-900 relative overflow-hidden">
                {images[0] ? (
                    <img src={images[0]} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-700">
                        {getIcon()}
                    </div>
                )}
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-white flex items-center gap-1">
                    {getIcon()} {type.toUpperCase()}
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-white text-lg truncate flex-1">{title}</h3>
                    <span className="font-mono text-green-400 font-bold ml-2">
                        {formatPrice(price)}
                    </span>
                </div>
                <p className="text-gray-400 text-sm line-clamp-2 h-10 mb-4">
                    {description}
                </p>

                <button
                    onClick={handleBuy}
                    disabled={isPurchasing}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                    {isPurchasing ? 'Processing...' : 'Buy Now'}
                </button>
            </div>
        </div>
    );
}
