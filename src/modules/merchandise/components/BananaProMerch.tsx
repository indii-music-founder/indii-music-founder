import React from 'react';
import { Crown, Zap, ShieldCheck } from 'lucide-react';
import { useMerchandise } from '../hooks/useMerchandise';



export const BananaProMerch: React.FC = () => {
    const { proProducts: products } = useMerchandise();

    return (
        <div className="space-y-16 animate-in fade-in slide-in-from-right-8 duration-700 pb-20 max-w-7xl mx-auto">

            {/* Pro Hero */}
            <div className="relative h-[450px] rounded-2xl overflow-hidden border border-border/20 group">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay scale-110 group-hover:scale-100 transition-transform duration-[3000ms]" />
                <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/40 to-background z-10" />

                <div className="relative z-20 h-full flex flex-col items-center justify-center p-8 text-center max-w-3xl mx-auto">
                    <div className="flex items-center justify-center gap-3 mb-8 animate-pulse">
                        <Crown className="text-primary" size={48} strokeWidth={0.5} />
                    </div>

                    <div className="space-y-2 mb-8">
                        <span className="text-[10px] tracking-[0.8em] text-primary font-black uppercase mb-4 block">Archive Series // 2025</span>
                        <h2 className="text-7xl md:text-9xl font-black tracking-tighter text-foreground italic leading-none">
                            BANANA <span className="text-outline text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/20">PRO</span>
                        </h2>
                    </div>

                    <p className="text-muted-foreground text-lg font-light leading-relaxed tracking-wide max-w-xl mx-auto">
                        Engineered for the elite spectrum of digital creation.
                        Technical performance materials meet sculptural minimalist aesthetics.
                    </p>

                    <div className="mt-12 group/btn relative">
                        <div className="absolute inset-0 bg-primary blur-xl opacity-20 group-hover/btn:opacity-40 transition-opacity" />
                        <button className="relative bg-foreground text-background font-black px-12 py-5 rounded-sm hover:-translate-y-1 active:translate-y-0 transition-all text-sm tracking-[0.3em] uppercase">
                            AUTHENTICATE ACCESS
                        </button>
                    </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute bottom-8 left-8 z-20 hidden lg:block">
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest leading-none">Status: Connected</span>
                        <span className="text-[8px] font-mono text-primary uppercase tracking-widest leading-none">Protocol: Secure</span>
                    </div>
                </div>
            </div>

            {/* Product Experience Grid */}
            <div className="px-4">
                <div className="flex items-end justify-between mb-16 border-b border-border/30 pb-8">
                    <div className="space-y-1">
                        <h3 className="text-4xl font-black text-foreground tracking-tighter">THE CATALOGUE</h3>
                        <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">Selected Works // Vol 01</p>
                    </div>
                    <div className="flex gap-12 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] hidden md:flex">
                        <div className="flex flex-col gap-1">
                            <span>Sourcing</span>
                            <span className="text-foreground">Global Prime</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span>Shipping</span>
                            <span className="text-foreground">Expedited Elite</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
                    {products.map((product, i) => (
                        <div key={product.id} className={`group cursor-pointer ${i % 2 !== 0 ? 'md:mt-24' : ''}`}>
                            <div className="aspect-[3/4] bg-secondary/20 relative overflow-hidden mb-8 border border-border/10 group-hover:border-primary/30 transition-all duration-700">
                                <img src={product.image} alt={product.title} className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-[1500ms]" />

                                <div className="absolute top-0 right-0 p-8">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black text-foreground/40 font-mono tracking-widest">0{i + 1}</span>
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
                    ))}
                </div>
            </div>

            {/* Quality Statement */}
            <div className="max-w-4xl mx-auto text-center py-24 border-t border-border/20 mt-24">
                <ShieldCheck className="mx-auto text-primary/30 mb-8" size={64} strokeWidth={0.5} />
                <h4 className="text-foreground font-black text-sm tracking-[1em] uppercase mb-6">CERTIFIED PERFORMANCE</h4>
                <p className="text-muted-foreground font-light leading-relaxed tracking-wider max-w-2xl mx-auto italic">
                    "Every garment in the PRO series undergoes a rigorous calibration process.
                    We don't just manufacture; we engineer artifacts for the highest level of creative output."
                </p>
                <div className="mt-12 flex justify-center items-center gap-4">
                    <div className="h-px w-12 bg-border/50" />
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.5em]">Banana Studio R&D</span>
                    <div className="h-px w-12 bg-border/50" />
                </div>
            </div>

        </div>
    );
};
