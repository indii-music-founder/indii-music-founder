import React from 'react';
import { Tag, Star, ShoppingCart } from 'lucide-react';
import { useMerchandise } from '../hooks/useMerchandise';



export const BananaMerch: React.FC = () => {
    const { standardProducts: products } = useMerchandise();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">

            {/* Hero Section */}
            <div className="relative rounded-3xl overflow-hidden h-72 border border-primary/20 group shadow-2xl transition-all duration-500 hover:shadow-primary/10">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 z-10" />
                <img
                    src="file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/brain/34958d54-a9d0-4ced-a8bb-687671d31774/banana_standard_tshirt_mockup_1767126973658.png"
                    alt="Standard Collection Hero"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms] ease-out"
                />
                <div className="absolute inset-0 z-20 flex flex-col justify-center px-12 bg-background/30 backdrop-blur-[4px]">
                    <div className="w-fit mb-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                        Season 25 // Summer
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black text-foreground mb-4 drop-shadow-sm tracking-tighter leading-none">
                        THE <span className="text-primary italic">BANANA</span> COLLECTION
                    </h2>
                    <p className="text-foreground/80 text-xl max-w-lg font-medium drop-shadow-sm leading-relaxed">
                        Bold, vibrant, and unapologetically fun.
                        Premium streetwear engineered for the modern digital creator.
                    </p>
                    <div className="flex gap-4 mt-8">
                        <button className="bg-primary text-primary-foreground font-black px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 flex items-center gap-3 uppercase text-sm tracking-wider">
                            <Star size={20} fill="currentColor" />
                            Explore Catalog
                        </button>
                        <button className="bg-white/10 backdrop-blur-md border border-white/20 text-foreground font-bold px-8 py-4 rounded-full hover:bg-white/20 transition-all text-sm tracking-wider">
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
                    <div className="flex gap-2">
                        {['All', 'Tees', 'Hoodies', 'Accessories'].map((cat, i) => (
                            <button key={cat} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary border border-border/50'}`}>
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {products.map(product => (
                        <div key={product.id} className="bg-card/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-300 group hover:-translate-y-2">
                            <div className="aspect-[4/5] bg-secondary/30 relative overflow-hidden">
                                <img src={product.image} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                <div className="absolute top-4 left-4 flex flex-col gap-2">
                                    <div className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter shadow-lg">
                                        Best Seller
                                    </div>
                                </div>
                                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                                    <button className="w-full bg-background text-foreground font-bold py-3 rounded-xl shadow-2xl flex items-center justify-center gap-2 hover:bg-primary hover:text-primary-foreground transition-all translate-y-4 group-hover:translate-y-0 duration-300">
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
                                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={10} className="fill-primary text-primary" />)}
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
                    ))}

                    {/* Add New Placeholder */}
                    <div className="border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center p-8 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group min-h-[400px]">
                        <div className="w-20 h-20 bg-secondary/50 rounded-2xl flex items-center justify-center mb-6 border border-border/50 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300">
                            <Tag className="text-primary" size={32} />
                        </div>
                        <h4 className="text-foreground font-black text-lg tracking-tight">DESIGN NEW ASSET</h4>
                        <p className="text-muted-foreground text-sm text-center mt-2 max-w-[200px]">Launch a new merch drop in minutes with AI.</p>
                        <button className="mt-8 text-primary font-black text-xs uppercase tracking-widest border-b-2 border-primary pb-1 hover:text-primary/70 hover:border-primary/70 transition-all">
                            Open Designer
                        </button>
                    </div>
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
