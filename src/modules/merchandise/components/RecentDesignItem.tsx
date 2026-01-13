import React from 'react';
import { MerchProduct } from '../types';
import { ArrowRight } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface RecentDesignItemProps {
    product: MerchProduct;
}

export const RecentDesignItem = React.memo(({ product }: RecentDesignItemProps) => {
    return (
        <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
            <div className="w-12 h-12 bg-neutral-800 rounded-md border border-white/10 flex items-center justify-center overflow-hidden">
                {product.image ? (
                    <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-lg">🎨</span>
                )}
            </div>
            <div className="flex-1">
                <h5 className="text-sm font-medium text-white group-hover:text-[#FFE135]">{product.title}</h5>
                <p className="text-xs text-neutral-500">
                    {product.createdAt && typeof product.createdAt === 'object' && 'toDate' in product.createdAt ?
                        `Added ${(product.createdAt as Timestamp).toDate().toLocaleDateString()}` :
                        'Just now'
                    }
                </p>
            </div>
            <ArrowRight size={14} className="text-neutral-600 group-hover:text-white" />
        </div>
    );
}, areRecentDesignPropsEqual);

function areRecentDesignPropsEqual(prevProps: RecentDesignItemProps, nextProps: RecentDesignItemProps) {
    const prev = prevProps.product;
    const next = nextProps.product;

    if (prev === next) return true;
    if (prev.id !== next.id) return false;
    if (prev.title !== next.title) return false;
    if (prev.image !== next.image) return false;

    // Check createdAt equality
    if (prev.createdAt === next.createdAt) return true;
    if (!prev.createdAt || !next.createdAt) return false;

    // Handle Firestore Timestamp
    if ('seconds' in prev.createdAt && 'seconds' in next.createdAt) {
        return (prev.createdAt as Timestamp).toMillis() === (next.createdAt as Timestamp).toMillis();
    }

    // Handle Date objects
    if (prev.createdAt instanceof Date && next.createdAt instanceof Date) {
        return prev.createdAt.getTime() === next.createdAt.getTime();
    }

    return false;
}
