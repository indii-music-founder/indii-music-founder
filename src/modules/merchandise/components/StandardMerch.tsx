import React from 'react';
import { Tag, Star } from 'lucide-react';
import { useMerchandise } from '../hooks/useMerchandise';
import { StandardProductCard } from './StandardProductCard';
import { DeptLoader } from '@/components/ui/DeptLoader';


export const StandardMerch: React.FC = () => {
    const { standardProducts: products, loading } = useMerchandise();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">

            {/* Hero Section */}
            <div className="relative rounded-3xl overflow-hidden h-72 border border-primary/20 group shadow-2xl transition-all duration-500 hover:shadow-primary/10">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 z-10" />
                {/* ⚡ Bolt Optimization: Prioritize LCP image loading */}
                <img
                    src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=2000&q=80"
                    alt="Standard Collection Hero"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms] ease-out"
                    // HTML attribute support for high priority
                    fetchPriority="high"
                />
                <div className="absolute inset-0 z-20 flex flex-col justify-center px-12 bg-background/30 backdrop-blur-[4px]">
                    <div className="w-fit mb-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                        Season 25 // Summer
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black text-foreground mb-4 drop-shadow-sm tracking-tighter leading-none">
                        THE <span className="text-primary italic">MERCH</span> COLLECTION
                    </h2>
                    <p className="text-foreground/80 text-xl max-w-lg font-medium drop-shadow-sm leading-relaxed">
                        Bold, vibrant, and unapologetically fun.
                        Premium streetwear engineered for the modern digital creator.
                    </p>
                    <div className="flex gap-4 mt-8">
                        <button type="button" className="bg-primary text-primary-foreground font-black px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 flex items-center gap-3 uppercase text-sm tracking-wider focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none">
                            <Star size={20} fill="currentColor" />
                            Explore Catalog
                        </button>
                        <button type="button" className="bg-white/10 backdrop-blur-md border border-white/20 text-foreground font-bold px-8 py-4 rounded-full hover:bg-white/20 transition-all text-sm tracking-wider focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:outline-none">
                            Our Story
                        </button>
                    </div>
                </div>
            </div>

            {/* Product Grid */}
            <div>
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tighter">
                        <div className="p-2 bg-primary rounded-lg">
                            <Tag className="text-primary-foreground" size={20} />
                        </div>
                        LATEST DROPS
                    </h3>
                    <div className="flex gap-2" role="group" aria-label="Filter products">
                        {['All', 'Tees', 'Hoodies', 'Accessories'].map((cat, i) => (
                            <button
                                key={cat}
                                type="button"
                                aria-pressed={i === 0}
                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary border border-border/50'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {loading && products.length === 0 ? (
                        <div className="col-span-full py-12 flex justify-center" role="status">
                            <DeptLoader message="Loading drops..." moduleId="merchandise" />
                        </div>
                    ) : (
                        <>
                            {products.map(product => (
                                <StandardProductCard key={product.id} product={product} />
                            ))}

                            {/* Add New Placeholder */}
                            <button
                                type="button"
                                aria-label="Design new asset"
                                className="w-full h-full text-left border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center p-8 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group min-h-[400px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
                            >
                                <div className="w-20 h-20 bg-secondary/50 rounded-2xl flex items-center justify-center mb-6 border border-border/50 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300">
                                    <Tag className="text-primary" size={32} />
                                </div>
                                <h4 className="text-foreground font-black text-lg tracking-tight">DESIGN NEW ASSET</h4>
                                <p className="text-muted-foreground text-sm text-center mt-2 max-w-[200px]">Launch a new merch drop in minutes with AI.</p>
                                <div className="mt-8 text-primary font-black text-xs uppercase tracking-widest border-b-2 border-primary pb-1 hover:text-primary/70 hover:border-primary/70 transition-all">
                                    Open Designer
                                </div>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Collections Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                <div className="bg-gradient-to-br from-yellow-400/20 to-orange-400/20 rounded-3xl p-8 border border-yellow-500/20 h-48 flex items-end">
                    <div>
                        <h4 className="text-2xl font-black text-foreground tracking-tighter uppercase">Flash Drops</h4>
                        <p className="text-muted-foreground text-sm font-bold">New drops every Sunday 10AM EST.</p>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-indigo-400/20 to-purple-400/20 rounded-3xl p-8 border border-indigo-500/20 h-48 flex items-end">
                    <div>
                        <h4 className="text-2xl font-black text-foreground tracking-tighter uppercase">Artist Collabs</h4>
                        <p className="text-muted-foreground text-sm font-bold">Limited run exclusively for fans.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
