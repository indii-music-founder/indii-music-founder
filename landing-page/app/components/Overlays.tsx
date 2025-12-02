import { useState, useEffect } from 'react';

const GlitchText = ({ text, delay = 0 }: { text: string, delay?: number }) => {
    const [display, setDisplay] = useState('');
    const [started, setStarted] = useState(false);

    // Reset when text changes
    useEffect(() => {
        setStarted(false);
        setDisplay('');
        const startTimeout = setTimeout(() => {
            setStarted(true);
        }, delay);
        return () => clearTimeout(startTimeout);
    }, [text, delay]);

    useEffect(() => {
        if (!started) return;

        let iteration = 0;
        const interval = setInterval(() => {
            setDisplay(text.split('').map((letter, index) => {
                if (index < iteration) {
                    return text[index];
                }
                // Random characters for glitch effect
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
                return chars[Math.floor(Math.random() * chars.length)];
            }).join(''));

            if (iteration >= text.length) {
                clearInterval(interval);
            }

            iteration += 1 / 2; // Speed of decoding
        }, 30);

        return () => clearInterval(interval);
    }, [text, started]);

    return <span className="font-mono">{display}</span>;
}

export default function Overlays() {
    return (
        <>
            {/* Hero Section (Page 0) */}
            <section className="h-[100vh] w-full flex items-center justify-center pointer-events-none">
                <div className="text-center z-10 drop-shadow-[0_0_15px_rgba(0,0,0,1)]">
                    <h1 className="text-7xl md:text-9xl font-bold tracking-tighter mb-6 text-white">
                        indiiOS
                    </h1>
                    <div className="flex flex-col gap-2">
                        <p className="text-2xl md:text-3xl text-white font-medium tracking-wide">
                            Your Music. Your Rules.
                        </p>
                        <p className="text-xl md:text-2xl text-white/70 font-light tracking-wide">
                            The Operating System for your Independence.
                        </p>
                    </div>
                </div>
            </section>

            {/* Deep Listening (Page 1) */}
            <section className="h-[100vh] w-full flex items-center justify-center pointer-events-none">
                <div className="text-center max-w-4xl px-8 py-12 rounded-3xl bg-black/40 backdrop-blur-md border border-white/10">
                    <h2 className="text-5xl md:text-7xl font-bold mb-6 text-white">
                        Smart Audio Analysis
                    </h2>
                    <p className="text-xl md:text-2xl text-white/90 font-light mb-8 drop-shadow-lg">
                        Informative. Helpful. Creative.
                    </p>
                    <div className="text-neon-blue text-lg tracking-widest uppercase font-bold drop-shadow-md">
                        Turning your music into actionable data.
                    </div>
                </div>
            </section>

            {/* Agent Zero (Page 2) */}
            <section className="h-[100vh] w-full flex items-center justify-center px-8 md:px-20 pointer-events-none">
                <div className="max-w-4xl text-center p-8 rounded-3xl bg-black/40 backdrop-blur-md border border-white/10">
                    <h2 className="text-6xl md:text-8xl font-bold mb-6 text-white">
                        indii
                    </h2>
                    <p className="text-xl md:text-2xl text-white/90 font-light mb-8">
                        Your helpful AI assistant. It handles the business tasks humans used to do.
                    </p>

                    <div className="flex flex-col gap-4 items-center">
                        <div className="flex items-center gap-4">
                            <span className="text-neon-purple font-bold">THE ARCHITECT</span>
                            <div className="w-12 h-0.5 bg-neon-purple/50"></div>
                        </div>
                        <p className="text-sm text-white/80 max-w-xs">
                            Plans your career strategy.
                        </p>

                        <div className="flex items-center gap-4 mt-4">
                            <span className="text-neon-blue font-bold">THE BUILDER</span>
                            <div className="w-12 h-0.5 bg-neon-blue/50"></div>
                        </div>
                        <p className="text-sm text-white/80 max-w-xs">
                            Executes the work.
                        </p>
                    </div>
                </div>
            </section >

            {/* Neural Forge (Page 3) */}
            < section className="h-[100vh] w-full flex items-center justify-center pointer-events-none" >
                <div className="text-center max-w-4xl px-8 py-12 rounded-3xl bg-black/40 backdrop-blur-md border border-white/10">
                    <h2 className="text-5xl md:text-7xl font-bold mb-6 text-white drop-shadow-[0_0_15px_rgba(0,0,0,1)]">
                        Career Strategy
                    </h2>
                    <p className="text-xl md:text-2xl text-white/90 font-light mb-8">
                        Useful insights to grow your fanbase and income. <span className="text-neon-pink font-bold">Profitable growth.</span>
                    </p>
                </div>
            </section >

            {/* The Firewall (Page 4) */}
            < section className="h-[100vh] w-full flex items-center justify-center pointer-events-none" >
                <div className="text-center max-w-4xl px-8 py-12 rounded-3xl bg-black/40 backdrop-blur-md border border-white/10">
                    <h2 className="text-5xl md:text-7xl font-bold mb-6 text-white">
                        Rights Protection
                    </h2>
                    <p className="text-xl md:text-2xl text-white/90 font-light mb-8">
                        Secure your IP. <span className="text-neon-green font-bold">Get paid for your work.</span>
                    </p>
                </div>
            </section >

            {/* Business (Page 5) */}
            < section className="h-[120vh] w-full flex flex-col items-center justify-center pointer-events-none" >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-6xl px-6 mb-20">
                    {/* Marketing Card */}
                    <div className="glass-panel p-8 rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md">
                        <h3 className="text-3xl font-bold text-white mb-2">Command Center</h3>
                        <p className="text-signal-green text-sm uppercase tracking-wider mb-6">Marketing & Reach</p>
                        <p className="text-white/80">
                            Real-time global stream tracking. Visualize your audience as living data points on a holographic interface.
                        </p>
                    </div>

                    {/* Legal Card */}
                    <div className="glass-panel p-8 rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md">
                        <h3 className="text-3xl font-bold text-white mb-2">The Shield</h3>
                        <p className="text-neon-purple text-sm uppercase tracking-wider mb-6">Legal & Rights</p>
                        <p className="text-white/80">
                            Reach real fans. Instantly turns red flags (bad terms) into green lights (negotiated rights).
                        </p>
                    </div>
                </div>

                <div className="text-center p-6 rounded-2xl bg-black/30 backdrop-blur-sm">
                    <h2 className="text-4xl md:text-5xl font-bold text-white">
                        Scale Your Career.
                    </h2>
                </div>
            </section >

            {/* Commerce (Page 5) */}
            < section className="h-[100vh] w-full flex items-center justify-center pointer-events-none" >
                <div className="text-center p-10 rounded-3xl bg-black/40 backdrop-blur-md border border-white/10">
                    <h2 className="text-6xl md:text-8xl font-bold text-white mb-4 drop-shadow-[0_0_15px_rgba(0,0,0,1)]">
                        Direct to Fan.
                    </h2>
                    <p className="text-xl text-white/90 max-w-xl mx-auto">
                        Sell merch, tickets, and vinyl directly to your audience. No middlemen.
                    </p>
                </div>
            </section >
            {/* The Titan (Spacer for 3D) */}
            < section className="h-[100vh] w-full pointer-events-none" ></section >

            {/* Outro & Launch */}
            <section className="h-auto w-full flex flex-col items-center justify-center pointer-events-auto py-32">
                <div className="text-center z-10 mb-12 pointer-events-none">
                    <h2 className="text-4xl md:text-6xl font-bold text-white mb-2 drop-shadow-[0_0_15px_rgba(0,0,0,1)]">
                        Your Music.
                    </h2>
                    <h2 className="text-4xl md:text-6xl font-bold text-white mb-2 drop-shadow-[0_0_15px_rgba(0,0,0,1)]">
                        Your Rules.
                    </h2>
                    <h2 className="text-6xl md:text-8xl font-bold text-white mt-8 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                        indiiOS
                    </h2>
                    <p className="text-xl md:text-2xl text-white/60 font-light mt-4 tracking-widest uppercase">
                        The Operating System for your Independence
                    </p>
                </div>

                <div className="text-center z-10 bg-black/60 backdrop-blur-xl p-12 rounded-3xl border border-white/10 shadow-2xl mb-20">
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">
                        Ready to Build?
                    </h2>
                    <a
                        href="http://localhost:5173"
                        className="px-10 py-5 bg-white text-black font-bold text-xl hover:bg-neon-blue hover:text-black transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(0,243,255,0.6)] hover:scale-105 transform inline-block"
                    >
                        Launch Studio
                    </a>
                    <p className="text-white/40 mt-6 text-sm">
                        v1.0.0 (Alpha)
                    </p>
                </div>

                {/* Footer */}
                <footer className="text-center z-10 text-white/30 text-sm">
                    <p className="mb-2">&copy; 2025 indiiOS. All rights reserved.</p>
                    <div className="flex gap-4 justify-center">
                        <span className="hover:text-white cursor-pointer transition-colors">Privacy Policy</span>
                        <span>|</span>
                        <span className="hover:text-white cursor-pointer transition-colors">Terms of Service</span>
                        <span>|</span>
                        <span className="hover:text-white cursor-pointer transition-colors">Contact</span>
                    </div>
                </footer>
            </section>
        </>
    );
}
