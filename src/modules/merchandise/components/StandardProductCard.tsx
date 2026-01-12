import React from 'react';
import { Star, ShoppingCart } from 'lucide-react';
import { MerchProduct } from '../types';

interface StandardProductCardProps {
    product: MerchProduct;
}

// ⚡ Bolt Optimization: Constant array prevents reallocation on every render
const STARS = [1, 2, 3, 4, 5];

export const StandardProductCard = React.memo(({ product }: StandardProductCardProps) => {
    return (
        <div className="bg-card/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-300 group hover:-translate-y-2">
            <div className="aspect-[4/5] bg-secondary/30 relative overflow-hidden">
                <img
                    src={product.image}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                    // ⚡ Bolt Optimization: Offload decoding from main thread
                    decoding="async"
                />
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <div className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter shadow-lg">
                        Best Seller
                    </div>
                </div>
                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-end p-6">
                    <button className="w-full bg-background text-foreground font-bold py-3 rounded-xl shadow-2xl flex items-center justify-center gap-2 hover:bg-primary hover:text-primary-foreground transition-all translate-y-4 group-hover:translate-y-0 group-focus-within:translate-y-0 duration-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                        <ShoppingCart size={18} />
                        ADD TO CART
                    </button>
                </div>
            </div>
            <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h4 className="text-foreground font-black text-xl tracking-tight leading-tight">{product.title}</h4>
                        <div className="flex items-center gap-1 mt-1">
                            {STARS.map(s => <Star key={s} size={10} className="fill-primary text-primary" />)}
                            <span className="text-[10px] text-muted-foreground ml-1">(24 reviews)</span>
                        </div>
                    </div>
                    <span className="text-primary font-black text-lg">{product.price}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                    {product.tags?.map(tag => (
                        <span key={tag} className="text-[10px] font-bold text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded border border-border/50">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}, arePropsEqual);

// ⚡ Bolt Optimization: Custom comparison function to prevent re-renders when parent regenerates
// object references (e.g. from Firestore snapshots) but the data hasn't changed.
function arePropsEqual(prevProps: StandardProductCardProps, nextProps: StandardProductCardProps) {
    const prev = prevProps.product;
    const next = nextProps.product;

    // 1. Reference equality check (fastest)
    if (prev === next) return true;

    // 2. Deep check of displayed fields
    if (prev.id !== next.id) return false;
    if (prev.title !== next.title) return false;
    if (prev.image !== next.image) return false;
    if (prev.price !== next.price) return false;

    // 3. Check tags array
    if (prev.tags === next.tags) return true;
    if (!prev.tags || !next.tags) return prev.tags === next.tags;
    if (prev.tags.length !== next.tags.length) return false;

    for (let i = 0; i < prev.tags.length; i++) {
        if (prev.tags[i] !== next.tags[i]) return false;
    }

    return true;
}

StandardProductCard.displayName = 'StandardProductCard';
