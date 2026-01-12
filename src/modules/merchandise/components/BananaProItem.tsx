import React from 'react';
import { MerchProduct } from '../types';

interface BananaProItemProps {
    product: MerchProduct;
    index: number;
}

const BananaProItem: React.FC<BananaProItemProps> = ({ product, index }) => {
    return (
        <div className={`group cursor-pointer ${index % 2 !== 0 ? 'md:mt-24' : ''}`}>
            <div className="aspect-[3/4] bg-secondary/20 relative overflow-hidden mb-8 border border-border/10 group-hover:border-primary/30 transition-all duration-700">
                {/* ⚡ Bolt Optimization: Lazy load below-fold images to save bandwidth */}
                <img
                    src={product.image}
                    alt={product.title}
                    className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-[1500ms]"
                    loading="lazy"
                />

                <div className="absolute top-0 right-0 p-8">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-foreground/40 font-mono tracking-widest">
                            0{index + 1}
                        </span>
                        <div className="w-px h-12 bg-border/30 mt-2" />
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 w-full p-8 translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <button className="w-full bg-primary text-primary-foreground font-black py-5 text-xs tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-colors">
                        SECURE ITEM
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl text-foreground font-black tracking-tighter mb-2 italic">{product.title}</h3>
                        <div className="flex gap-6 overflow-hidden">
                            {product.features?.map(f => (
                                <div key={f} className="flex items-center gap-2">
                                    <div className="w-1 h-1 bg-primary rounded-full" />
                                    <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl text-foreground font-light tracking-tighter">{product.price}</span>
                        <p className="text-[8px] text-muted-foreground uppercase font-mono mt-1">INC. TAX</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ⚡ Bolt Optimization: Custom comparison function to prevent re-renders when parent regenerates
// object references (e.g. from Firestore snapshots) but the data hasn't changed.
function arePropsEqual(prevProps: BananaProItemProps, nextProps: BananaProItemProps) {
    const prev = prevProps.product;
    const next = nextProps.product;

    // 1. Reference equality check (fastest)
    if (prev === next && prevProps.index === nextProps.index) return true;

    // 2. Index check (if index changes, layout changes)
    if (prevProps.index !== nextProps.index) return false;

    // 3. Deep check of displayed fields
    if (prev.id !== next.id) return false;
    if (prev.title !== next.title) return false;
    if (prev.image !== next.image) return false;
    if (prev.price !== next.price) return false;

    // 4. Check features array
    if (prev.features === next.features) return true;
    if (!prev.features || !next.features) return prev.features === next.features;
    if (prev.features.length !== next.features.length) return false;

    for (let i = 0; i < prev.features.length; i++) {
        if (prev.features[i] !== next.features[i]) return false;
    }

    return true;
}

export default React.memo(BananaProItem, arePropsEqual);
