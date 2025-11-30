export default function Overlays() {
    return (
        <>
            {/* Hero Section (Page 0) */}
            <section className="h-screen w-full flex items-center justify-center pointer-events-none">
                <div className="text-center z-10 mix-blend-difference">
                    <h1 className="text-7xl md:text-9xl font-bold tracking-tighter mb-6 text-white">
                        indiiOS
                    </h1>
                    <p className="text-xl md:text-2xl text-white/70 max-w-2xl mx-auto font-light tracking-wide">
                        Your Music. Your Rules.
                    </p>
                </div>
                <div className="absolute bottom-10 animate-bounce text-white/50 text-sm tracking-widest uppercase">
                    Scroll to Explore
                </div>
            </section>

            {/* Deep Listening (Page 1) */}
            <section className="h-screen w-full flex items-center justify-center pointer-events-none">
                <div className="text-center max-w-4xl px-6">
                    <h2 className="text-5xl md:text-7xl font-bold mb-6 text-white">
                        Deep Listening
                    </h2>
                    <p className="text-xl md:text-2xl text-white/70 font-light mb-8">
                        The AI doesn't just hear; it fingerprints. From raw audio chaos to structured creative order.
                    </p>
                    <div className="text-neon-blue text-lg tracking-widest uppercase">
                        It listens. It learns. It creates.
                    </div>
                </div>
            </section>

            {/* Agent Zero (Page 2) */}
            <section className="h-screen w-full flex flex-row-reverse items-center justify-between px-8 md:px-20 pointer-events-none">
                <div className="w-full md:w-1/2 text-right">
                    <h2 className="text-5xl md:text-7xl font-bold mb-6 text-white">
                        Agent R <span className="text-neon-purple text-3xl block mt-2">Powered by Agent0</span>
                    </h2>
                    <p className="text-xl md:text-2xl text-white/70 font-light mb-8">
                        Symbiotic Co-Evolution. Not just a bot—a manager that writes its own curriculum based on your career’s unique data.
                    </p>

                    <div className="flex flex-col gap-4 items-end">
                        <div className="flex items-center gap-4">
                            <span className="text-neon-purple font-bold">THE ARCHITECT</span>
                            <div className="w-12 h-1 bg-neon-purple/50 rounded-full"></div>
                        </div>
                        <p className="text-sm text-white/50 max-w-xs">
                            Formulates strategy and "Frontier Tasks" to push your limits.
                        </p>

                        <div className="flex items-center gap-4 mt-4">
                            <span className="text-neon-blue font-bold">THE BUILDER</span>
                            <div className="w-12 h-1 bg-neon-blue/50 rounded-full"></div>
                        </div>
                        <p className="text-sm text-white/50 max-w-xs">
                            Ruthlessly executes code and tools to build the vision.
                        </p>
                    </div>
                </div>
            </section>

            {/* Business (Page 3) */}
            <section className="h-screen w-full flex flex-col items-center justify-center pointer-events-none">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-6xl px-6 mb-20">
                    {/* Marketing Card */}
                    <div className="glass-panel p-8 rounded-2xl border border-white/10">
                        <h3 className="text-3xl font-bold text-white mb-2">Command Center</h3>
                        <p className="text-signal-green text-sm uppercase tracking-wider mb-6">Marketing & Reach</p>
                        <p className="text-white/70">
                            Real-time global stream tracking. Visualize your audience as living data points on a holographic interface.
                        </p>
                    </div>

                    {/* Legal Card */}
                    <div className="glass-panel p-8 rounded-2xl border border-white/10">
                        <h3 className="text-3xl font-bold text-white mb-2">The Shield</h3>
                        <p className="text-neon-purple text-sm uppercase tracking-wider mb-6">Legal & Rights</p>
                        <p className="text-white/70">
                            AI-powered contract scanning. Instantly turns red flags (bad terms) into green lights (negotiated rights).
                        </p>
                    </div>
                </div>

                <div className="text-center">
                    <h2 className="text-4xl md:text-5xl font-bold text-white">
                        Scale your reach. <span className="text-white/50">Secure your rights.</span>
                    </h2>
                </div>
            </section>

            {/* Commerce (Page 4) */}
            <section className="h-screen w-full flex items-center justify-center pointer-events-none">
                <div className="text-center">
                    <h2 className="text-6xl md:text-8xl font-bold text-white mb-4 mix-blend-difference">
                        The Infinite Showroom
                    </h2>
                    <p className="text-xl text-white/70 max-w-xl mx-auto">
                        Liquid Art splashes onto the physical world. Instant merch generation from your sonic identity.
                    </p>
                </div>
            </section>
        </>
    );
}
