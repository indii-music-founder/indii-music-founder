import React from 'react';
import { MerchCard } from './MerchCard';
import { MerchProduct } from '../types';
import { formatCurrency } from '@/lib/utils';

interface TopSellingProductItemProps {
    product: MerchProduct & { revenue: number, units: number };
}

export const TopSellingProductItem = React.memo(({ product }: TopSellingProductItemProps) => {
    return (
        <MerchCard className="group p-4 flex items-center gap-4 cursor-pointer">
            <div className="w-20 h-24 bg-neutral-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                {product.image ? (
                    <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                ) : (
                    <>
                        <div className="absolute inset-0 bg-yellow-400/10 group-hover:bg-yellow-400/20 transition-all" />
                        <span className="text-2xl">👕</span>
                    </>
                )}
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-white group-hover:text-[#FFE135] transition-colors">{product.title}</h4>
                <p className="text-sm text-neutral-500">{product.price} • {product.units} Sold</p>
            </div>
            <div className="text-right">
                <span className="text-[#FFE135] font-mono font-bold">{formatCurrency(product.revenue)}</span>
            </div>
        </MerchCard>
    );
}, areTopSellingPropsEqual);

function areTopSellingPropsEqual(prevProps: TopSellingProductItemProps, nextProps: TopSellingProductItemProps) {
    const prev = prevProps.product;
    const next = nextProps.product;

    if (prev === next) return true;
    if (prev.id !== next.id) return false;
    if (prev.title !== next.title) return false;
    if (prev.image !== next.image) return false;
    if (prev.price !== next.price) return false;
    if (prev.revenue !== next.revenue) return false;
    if (prev.units !== next.units) return false;

    return true;
}
