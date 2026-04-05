'use client';

import React, { useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useAuth } from './components/auth/AuthProvider';
import { getStudioUrl } from './lib/auth';
import { Database, ShieldCheck, Megaphone, BrainCircuit, Globe, Cpu, Network, Zap, ArrowRight, Activity } from 'lucide-react';

/* --- Premium Reusable UI Components --- */

function SpotlightCard({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden rounded-[2.5rem] border border-white/[0.06] bg-[#0a0a0a] shadow-2xl transition-transform duration-500 hover:-translate-y-1 ${className}`}
    >
      {/* Spotlight Glow */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-500 z-0"
        style={{
          opacity,
          background: `radial-gradient(800px circle at ${position.x}px ${position.y}px, rgba(245,158,11,0.12), transparent 40%)`,
        }}
      />
      {/* Top Border Highlight */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-500 z-0"
        style={{
          opacity,
          background: `radial-gradient(400px circle at ${position.x}px 0px, rgba(255,255,255,0.15), transparent 50%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

const words = "The Business Edge for Real Artists.".split(" ");

export default function Home() {
  const { user, loading } = useAuth();
  const { scrollYProgress } = useScroll();

  // Scroll animations for extreme polish
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.85]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);
  const heroTranslateY = useTransform(scrollYProgress, [0, 0.3], [0, 100]);

  const productRotateX = useTransform(scrollYProgress, [0.1, 0.4], [30, 0]);
  const productScale = useTransform(scrollYProgress, [0.1, 0.4], [0.8, 1]);
  const productOpacity = useTransform(scrollYProgress, [0.1, 0.4], [0, 1]);

  return (
    <main className="relative flex flex-col items-center justify-start min-h-screen overflow-x-hidden bg-[#030303] text-gray-200 selection:bg-amber-500/30 selection:text-amber-100 font-sans">

      {/* 1. Global Background (Space Black + Subtle Amber Ambient Glow) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[1000px] h-[800px] bg-amber-900/15 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[600px] bg-purple-900/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      {/* 2. Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 bg-[#030303]/60 backdrop-blur-3xl border-b border-white/[0.04]">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.1)] group-hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-shadow duration-500">
            <span className="text-amber-500 font-black text-[10px] tracking-tighter">iOS</span>
          </div>
          <span className="font-bold tracking-tight text-white/90 group-hover:text-amber-400 transition-colors duration-500">indiiOS</span>
        </div>

        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-8 bg-white/[0.02] border border-white/5 rounded-full px-6 py-2 backdrop-blur-md shadow-xl">
            <a href="#philosophy" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Philosophy</a>
            <a href="#capabilities" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Capabilities</a>
            <a href="#invest" className="text-sm font-bold text-amber-500 hover:text-amber-400 transition-colors">Founders Round</a>
          </div>
          <a
            href={getStudioUrl()}
            className="group relative inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-black bg-white rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative z-10 transition-colors group-hover:text-white">
              {loading ? "Verifying..." : user ? "Resume Session" : "Launch Studio"}
            </span>
            <ArrowRight size={14} className="relative z-10 transition-transform group-hover:translate-x-1 group-hover:text-white" />
          </a>
        </div>
      </nav>

      {/* 3. Hero Section (Kinetic Typography & Glowing Accents) */}
      <motion.section
        style={{ scale: heroScale, opacity: heroOpacity, y: heroTranslateY }}
        className="relative z-10 flex flex-col items-center justify-center w-full max-w-5xl px-4 min-h-[100vh] pt-20 pb-0 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold tracking-[0.2em] shadow-[0_0_20px_rgba(245,158,11,0.15)] uppercase mb-8 backdrop-blur-md"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          Music/OS 4.0 is Live
        </motion.div>

        <h1 className="text-5xl md:text-7xl lg:text-[6rem] font-black tracking-tighter text-white leading-[0.95] drop-shadow-2xl flex flex-wrap justify-center max-w-5xl">
          {words.map((word, i) => (
            <motion.span
              initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              key={i}
              className={`mr-4 last:mr-0 ${word === "Artists." ? "text-transparent bg-clip-text bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]" : ""}`}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 text-lg md:text-xl text-gray-400 max-w-3xl leading-relaxed font-light"
        >
          <strong className="text-white font-medium block mb-4">Independence doesn't mean being alone. Discover the power of the second 'i'.</strong>
          AI doesn't exist to replace your creativity. It exists to replace your label.
          indiiOS is an autonomous talent agency in your browser, built to handle distribution, legal splits, and marketing so you can focus entirely on the art.
        </motion.p>
      </motion.section>

      {/* 4. The 3D Scroll-Bound Product Teaser */}
      <section className="relative z-20 w-full max-w-6xl px-4 -mt-32 mb-40 perspective-[2000px]">
        <motion.div
          style={{ rotateX: productRotateX, scale: productScale, opacity: productOpacity, transformStyle: "preserve-3d" }}
          className="w-full aspect-[16/9] rounded-t-[2.5rem] border border-white/10 bg-[#0A0A0A] shadow-[0_40px_100px_rgba(0,0,0,0.9),_0_0_80px_rgba(245,158,11,0.08)] overflow-hidden flex flex-col relative"
        >
          {/* Faux Browser Window Glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent pointer-events-none" />

          <div className="h-12 border-b border-white/5 flex items-center px-6 gap-3 bg-white/[0.02]">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
              <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
            </div>
            <div className="mx-auto flex items-center gap-2 bg-[#1A1A1A] border border-white/5 rounded-md px-32 py-1.5 shadow-inner">
              <ShieldCheck size={12} className="text-green-500" />
              <span className="text-[10px] font-mono text-gray-400 tracking-widest uppercase">indiios.studio/workspace</span>
            </div>
          </div>

          <div className="flex-1 flex bg-[#030303] relative overflow-hidden border-t border-white/5">
            <img
              src="/dashboard-preview.png"
              alt="indiiOS Dashboard Interface"
              className="w-full h-[150%] object-cover object-top opacity-90 transition-opacity duration-1000 hover:opacity-100"
              style={{ filter: 'contrast(1.05) brightness(0.95)' }}
            />
            {/* Vignette Shadow to blend the edges into the mockup frame */}
            <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(3,3,3,1),inset_0__0_30px_rgba(3,3,3,1)] pointer-events-none" />
          </div>
        </motion.div>
      </section>

      {/* 5. The Core Philosophy (Spotlight Bento Box) */}
      <section id="capabilities" className="w-full max-w-6xl px-4 py-24 mb-24 z-20 relative">
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-8 pb-2">
            Everything your label <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600 opacity-90 inline-block rotate-[-2deg] drop-shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              won't do.
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed font-light">
            From automated SFTP track delivery to splitting royalties and verifying complex legal contracts, the indiiOS Agent Swarm is your autonomous back-office.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Distribution */}
          <SpotlightCard className="col-span-1 md:col-span-2 p-10 md:p-16 group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-30 group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000 pointer-events-none">
              <Network size={200} className="text-amber-500" strokeWidth={1} />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-end pt-32">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                <Database className="text-amber-400" size={28} />
              </div>
              <h3 className="text-4xl font-bold text-white mb-6 tracking-tight">Universal Distribution</h3>
              <p className="text-gray-400 max-w-lg leading-relaxed text-lg font-light">
                Connect strictly to top-tier DSPs and independent distributors. Manage rich metadata, ISRCs, and track ingestion natively. No middle-men holding your rights hostage.
              </p>
            </div>
          </SpotlightCard>

          {/* Legal */}
          <SpotlightCard className="col-span-1 p-10 md:p-12 group">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(59,130,246,0.2)] group-hover:scale-110 transition-transform duration-500">
              <ShieldCheck className="text-blue-400" size={28} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">Legal Autopilot</h3>
            <p className="text-gray-400 text-base leading-relaxed mb-8 font-light">
              Our Legal Agent scans your sync licenses and label agreements, summarizing dangerous clauses and perpetual lock-ins before you sign.
            </p>
            <div className="mt-auto text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-4 py-3 rounded-xl border border-blue-500/20 text-center uppercase tracking-widest">
              &gt; Risk: 0 Detected
            </div>
          </SpotlightCard>

          {/* Marketing */}
          <SpotlightCard className="col-span-1 p-10 md:p-12 group">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(168,85,247,0.2)] group-hover:scale-110 transition-transform duration-500">
              <Megaphone className="text-purple-400" size={28} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">Marketing Swarm</h3>
            <p className="text-gray-400 text-base leading-relaxed font-light">
              Generate localized press releases, cross-platform social campaigns, and customized brand asset sheets instantly based entirely on your sonic DNA.
            </p>
          </SpotlightCard>

          {/* The Conductor */}
          <SpotlightCard className="col-span-1 md:col-span-2 p-10 md:p-16 group !bg-gradient-to-b from-[#0a0a0a] to-[#140e06]">
            <div className="relative z-10 flex flex-col md:flex-row h-full justify-between gap-12 items-center">
              <div className="flex-1">
                <div className="w-32 h-8 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-8">
                  Superintelligence
                </div>
                <h3 className="text-4xl font-bold text-white mb-6 tracking-tight">The Indii Conductor</h3>
                <p className="text-gray-400 max-w-lg leading-relaxed text-lg font-light">
                  The intelligence core. Tell the Conductor what you want to achieve, and it dynamically spins up specialized agents across distribution, legal, and brand to execute the entire workflow.
                </p>
              </div>
              <div className="flex-shrink-0 w-48 h-48 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-3xl animate-pulse" />
                <BrainCircuit className="text-amber-400 relative z-10 group-hover:scale-110 transition-transform duration-700" size={80} strokeWidth={1} />
              </div>
            </div>
          </SpotlightCard>
        </div>
      </section>

      {/* 6. Founders Covenant */}
      <section id="invest" className="w-full max-w-5xl px-4 py-24 mb-24 z-20 relative">
        <div className="relative overflow-hidden rounded-[3rem] border border-amber-500/30 bg-gradient-to-b from-amber-900/20 to-[#0a0a0a] p-12 md:p-20 shadow-[0_0_100px_rgba(245,158,11,0.1)]">
          <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
            <ShieldCheck size={300} className="text-amber-500" strokeWidth={0.5} />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 font-bold text-xs tracking-widest uppercase mb-8 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              10 Seats Maximum • Lifetime Access
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6">
              The Founders Covenant
            </h2>
            <p className="text-gray-300 text-lg md:text-xl max-w-2xl mb-12 font-light leading-relaxed">
              We are issuing exactly <strong className="text-white">10 lifetime seats</strong>. At $2,500, you receive permanent access to all current and future indiiOS features with zero recurring software fees.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-12 text-left">
              <div className="bg-[#030303]/50 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                <h4 className="text-amber-400 font-bold mb-2 flex items-center gap-2"><Cpu size={16} /> Pass-Through Intelligence</h4>
                <p className="text-sm text-gray-400">Bring your own API keys. You pay exactly what the models cost. Zero markup by us. True operational sovereignty.</p>
              </div>
              <div className="bg-[#030303]/50 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                <h4 className="text-amber-400 font-bold mb-2 flex items-center gap-2"><ShieldCheck size={16} /> Cryptographic Proof</h4>
                <p className="text-sm text-gray-400">Your name and a SHA-256 hash of your covenant terms are committed directly into the indiiOS codebase structure forever.</p>
              </div>
            </div>

            <a
              href="http://localhost:4242/checkout"
              className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 text-lg font-black text-black bg-gradient-to-r from-amber-400 to-amber-600 rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(245,158,11,0.4)]"
            >
              <span className="relative z-10">Claim Your Seat — $2,500</span>
              <ArrowRight size={20} className="relative z-10 transition-transform group-hover:translate-x-2" />
            </a>
            <div className="mt-6 text-sm font-mono text-gray-500 uppercase tracking-widest">
              Subject to Availability
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-white/[0.04] py-16 px-12 flex flex-col md:flex-row items-center justify-between gap-8 text-sm text-gray-500 bg-[#030303] z-20 relative">
        <div className="flex items-center gap-4">
          <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex justify-center items-center shadow-[0_0_10px_rgba(245,158,11,0.2)]">
            <Zap size={12} className="text-amber-500" />
          </div>
          <span className="font-medium tracking-wide">© 2026 indiiOS Inc. All Rights Reserved.</span>
        </div>
        <div className="flex gap-8">
          <a href="/privacy" className="hover:text-white transition-colors font-medium">Privacy Policy</a>
          <a href="/terms" className="hover:text-white transition-colors font-medium">Terms of Service</a>
          <a href="mailto:invest@indiios.com" className="text-amber-500 hover:text-amber-400 transition-colors font-bold uppercase tracking-widest">Invest</a>
        </div>
      </footer>

    </main>
  );
}
