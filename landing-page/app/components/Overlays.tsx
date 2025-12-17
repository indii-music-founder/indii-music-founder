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
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
                return chars[Math.floor(Math.random() * chars.length)];
            }).join(''));

            if (iteration >= text.length) {
                clearInterval(interval);
            }

            iteration += 1 / 2;
        }, 30);

        return () => clearInterval(interval);
    }, [text, started]);

    return <span className="font-mono tracking-wider">{display}</span>;
}

export default function Overlays() {
    return (
        <div className="text-white selection:bg-neon-blue selection:text-black">
            {/* Hero Section (Page 0) */}
            <section className="h-screen w-full flex flex-col items-center justify-center pointer-events-none">
                <div className="text-center z-10 px-4">
                    <h1 className="text-8xl md:text-[10rem] font-bold tracking-tighter leading-none mb-8 opacity-90 mix-blend-difference">
                        indiiOS
                    </h1>
                    <div className="flex flex-col gap-4 text-center">
                        <p className="text-2xl md:text-3xl font-light tracking-[0.2em] uppercase text-white/80">
                            Your Music. Your Rules.
                        </p>
                    </div>
                </div>
            </section>

            {/* Deep Listening (Page 1) */}
            <section className="h-screen w-full flex items-center justify-center pointer-events-none">
                <div className="glass-panel max-w-2xl p-12 rounded-[2rem] bg-black/20 backdrop-blur-xl border border-white/5 shadow-2xl">
                    <div className="mb-4 text-neon-blue font-mono text-sm tracking-widest uppercase">
                        <GlitchText text="Creative Engine" />
                    </div>
                    <h2 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
                        Sonic Vision
                    </h2>
                    <p className="text-xl text-white/60 font-light leading-relaxed">
                        Generate album art, animated covers, and social assets that pulse to the beat of your track.
                        Your sound, visualized instantly.
                    </p>
                </div>
            </section>

            {/* Agent Zero (Page 2) */}
            <section className="h-screen w-full flex items-center justify-end px-8 md:px-20 pointer-events-none">
                <div className="glass-panel max-w-xl p-12 rounded-[2rem] bg-black/20 backdrop-blur-xl border border-white/5 text-right">
                    <div className="mb-4 text-neon-purple font-mono text-sm tracking-widest uppercase">
                        <GlitchText text="Autonomous Workflow" delay={200} />
                    </div>
                    <h2 className="text-6xl md:text-8xl font-bold mb-6 tracking-tighter">
                        indii
                    </h2>
                    <p className="text-2xl text-white/80 font-light mb-8 leading-tight">
                        Your AI production manager.
                    </p>

                    <div className="flex flex-col items-end gap-6 text-white/50">
                        <div className="flex items-center gap-4">
                            <span className="text-sm uppercase tracking-widest">Generates Assets</span>
                            <div className="w-8 h-[1px] bg-white/20"></div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm uppercase tracking-widest">Manages Campaigns</span>
                            <div className="w-16 h-[1px] bg-white/20"></div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm uppercase tracking-widest">Executes Strategy</span>
                            <div className="w-24 h-[1px] bg-white/20"></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Neural Forge (Page 3) */}
            <section className="h-screen w-full flex items-center justify-start px-8 md:px-32 pointer-events-none">
                <div className="max-w-3xl">
                    <h2 className="text-7xl md:text-9xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-neon-pink to-white opacity-80">
                        Create
                    </h2>
                    <h2 className="text-7xl md:text-9xl font-bold mb-12 text-transparent bg-clip-text bg-gradient-to-r from-white to-neon-pink opacity-80 pl-20">
                        Reality
                    </h2>
                    <p className="text-2xl md:text-3xl text-white/70 font-light tracking-wide max-w-xl border-l-2 border-neon-pink pl-6">
                        From text to video. From audio to imagery. <br />
                        <span className="text-white font-medium">A complete studio in your browser.</span>
                    </p>
                </div>
            </section>

            {/* The Firewall (Page 4) */}
            <section className="h-screen w-full flex items-center justify-center pointer-events-none">
                <div className="text-center">
                    <div className="inline-block px-4 py-1 rounded-full border border-neon-green/30 bg-neon-green/10 text-neon-green font-mono text-xs tracking-widest mb-6">
                        SYSTEM_INTEGRITY_PROTECTED
                    </div>
                    <h2 className="text-6xl md:text-8xl font-bold mb-8 tracking-tighter">
                        The Vault
                    </h2>
                    <p className="text-xl md:text-2xl text-white/60 font-light max-w-2xl mx-auto">
                        Your intellectual property, secured on-chain.
                        <br />Smart contracts for simpler splits.
                    </p>
                </div>
            </section>

            {/* Business (Page 5) */}
            <section className="h-[120vh] w-full flex flex-col items-center justify-center pointer-events-none px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl mb-24">
                    <div className="p-10 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors backdrop-blur-md group">
                        <h3 className="text-3xl font-bold mb-2 group-hover:text-neon-blue transition-colors">Launch</h3>
                        <p className="text-white/40 text-sm leading-relaxed">
                            Deploy multi-channel marketing campaigns with a single click.
                        </p>
                    </div>
                    <div className="p-10 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors backdrop-blur-md group">
                        <h3 className="text-3xl font-bold mb-2 group-hover:text-neon-purple transition-colors">Manage</h3>
                        <p className="text-white/40 text-sm leading-relaxed">
                            Organize your team, your files, and your finances in one command center.
                        </p>
                    </div>
                </div>
            </section>

            {/* Commerce (Page 6) */}
            <section className="h-screen w-full flex items-center justify-center pointer-events-none">
                <h2 className="text-[15vw] font-bold opacity-10 tracking-tighter select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 blur-sm">
                    EMPIRE
                </h2>
                <div className="text-center z-10 glass-panel p-16 rounded-full aspect-square flex flex-col items-center justify-center bg-black/30 backdrop-blur-md border border-white/10">
                    <h2 className="text-5xl md:text-7xl font-bold mb-4">
                        Build
                    </h2>
                    <p className="text-lg text-white/50 font-mono tracking-widest uppercase">
                        Your Legacy
                    </p>
                </div>
            </section>

            {/* Spacer */}
            <section className="h-screen w-full pointer-events-none"></section>

            {/* Outro */}
            <section className="min-h-screen w-full flex flex-col items-center justify-center pointer-events-auto py-32">
                <div className="text-center mb-20 pointer-events-none">
                    <p className="text-sm font-mono text-white/30 tracking-[0.5em] uppercase mb-8">
                        System Ready
                    </p>
                    <h2 className="text-6xl md:text-9xl font-bold tracking-tighter mb-4">
                        indiiOS
                    </h2>
                </div>

                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-neon-blue to-neon-purple rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                    <a
                        href="/login"
                        className="relative px-12 py-6 bg-black rounded-xl leading-none flex items-center divide-x divide-gray-600"
                    >
                        <span className="flex items-center space-x-5">
                            <span className="pr-6 text-gray-100 text-xl font-bold tracking-wider">ENTER STUDIO</span>
                        </span>
                        <span className="pl-6 text-neon-blue group-hover:text-white transition duration-200">
                            &rarr;
                        </span>
                    </a>
                </div>

                <footer className="mt-40 text-center text-white/20 text-xs font-mono">
                    <p>&copy; 2025 THE WALKING AGENCY. ALL RIGHTS RESERVED.</p>
                </footer>
            </section>
        </div>
    );
}
