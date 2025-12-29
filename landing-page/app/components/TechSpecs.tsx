'use client';

import { motion } from 'framer-motion';
import { Cpu, ShieldCheck, Zap, Network, Lock, GitBranch } from 'lucide-react';

const specs = [
    {
        label: 'Cognitive Engine',
        value: 'Gemini 3 Pro',
        detail: 'High-reasoning model with 2M token context window.',
        icon: Cpu
    },
    {
        label: 'Protocol',
        value: 'Antigravity v4.5',
        detail: 'Self-correcting autonomous code integrity system.',
        icon: ShieldCheck
    },
    {
        label: 'Latency',
        value: '< 50ms',
        detail: 'Edge-cached distribution via global CDN.',
        icon: Zap
    },
    {
        label: 'Architecture',
        value: 'Hybrid-Cloud',
        detail: 'Electron + Next.js with secure IPC bridges.',
        icon: Network
    },
    {
        label: 'Security',
        value: 'Enterprise',
        detail: 'AES-256 encryption for all assets at rest.',
        icon: Lock
    },
    {
        label: 'Versioning',
        value: 'SemVer',
        detail: 'Automated release pipelines with Graphite.',
        icon: GitBranch
    }
];

export default function TechSpecs() {
    return (
        <section className="w-full max-w-7xl mx-auto px-4 pb-32 relative z-10">
            <div className="border-t border-white/10 my-24" />

            <div className="flex flex-col md:flex-row items-start justify-between gap-12 mb-16">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="max-w-xl"
                >
                    <h2 className="text-sm font-mono text-dopamine-pink mb-4 uppercase tracking-widest">
                        System Architecture
                    </h2>
                    <h3 className="text-3xl md:text-5xl font-bold mb-6">
                        Built on the <br />
                        <span className="text-white/40">Antigravity Protocol.</span>
                    </h3>
                    <p className="text-gray-400 text-lg">
                        indiiOS isn't just an app; it's a self-maintaining ecosystem powered by autonomous agents that ensure code quality and production parity 24/7.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm"
                >
                    <code className="text-xs md:text-sm font-mono text-electric-blue">
                        <span className="text-gray-500">// System Check</span><br />
                        Running... [OK]<br />
                        Core: Active<br />
                        Neural: Connected<br />
                        Version: Beta 4.5
                    </code>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                {specs.map((spec, index) => (
                    <motion.div
                        key={spec.label}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="group bg-void p-8 hover:bg-white/5 transition-colors relative"
                    >
                        <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-50 transition-opacity">
                            <spec.icon size={24} />
                        </div>

                        <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">
                            {spec.label}
                        </div>
                        <div className="text-2xl font-bold text-white mb-2 group-hover:text-electric-blue transition-colors">
                            {spec.value}
                        </div>
                        <div className="text-sm text-gray-400">
                            {spec.detail}
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
