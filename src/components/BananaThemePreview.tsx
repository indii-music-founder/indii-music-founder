import React from 'react';

export const BananaThemePreview = () => {
    return (
        <div className="p-8 space-y-8 bg-background text-foreground min-h-screen">
            <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight">Banana Brand System</h1>
                <p className="text-muted-foreground">Visualizing the new design tokens.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Standard Banana */}
                <div className="space-y-3">
                    <div className="h-32 rounded-xl bg-banana-yellow shadow-lg flex items-center justify-center">
                        <span className="font-bold text-black border-2 border-black px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">Banana Standard</span>
                    </div>
                    <p className="font-mono text-sm">bg-banana-yellow / #FFE135</p>
                </div>

                {/* Banana Peel */}
                <div className="space-y-3">
                    <div className="h-32 rounded-xl bg-banana-peel shadow-sm border border-banana-yellow/20 flex items-center justify-center">
                        <span className="font-medium text-banana-dark">Banana Peel</span>
                    </div>
                    <p className="font-mono text-sm">bg-banana-peel / #FFF4B0</p>
                </div>

                {/* Banana Pro Dark */}
                <div className="space-y-3">
                    <div className="h-32 rounded-xl bg-banana-pro-dark border border-white/10 flex items-center justify-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-banana-pro-accent/5 to-transparent"></div>
                        <span className="font-bold text-white z-10">Banana Pro</span>
                    </div>
                    <p className="font-mono text-sm">bg-banana-pro-dark / #0A0A0A</p>
                </div>

                {/* Banana Pro Accent */}
                <div className="space-y-3">
                    <div className="h-32 rounded-xl bg-banana-pro-dark border border-banana-pro-accent flex items-center justify-center relative shadow-[0_0_15px_rgba(227,242,0,0.3)]">
                        <button className="px-4 py-2 bg-banana-pro-accent text-black font-bold rounded-md hover:scale-105 transition-transform">
                            Action
                        </button>
                    </div>
                    <p className="font-mono text-sm">text-banana-pro-accent / #E3FF00</p>
                </div>
            </div>

            <div className="p-6 rounded-2xl bg-banana-pro-dark border border-white/10 max-w-2xl mx-auto mt-12">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Banana Pro Dashboard</h2>
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                    </div>
                </div>
                <div className="h-40 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center text-banana-pro-accent font-mono">
              // WAVFORM_VISUALIZATION_AREA
                </div>
            </div>
        </div>
    );
};
