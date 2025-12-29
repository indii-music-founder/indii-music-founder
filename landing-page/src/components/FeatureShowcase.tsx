'use client';

import { motion } from 'framer-motion';
import { Disc, Scale, Clapperboard, AudioWaveform, ArrowRight } from 'lucide-react';

const features = [
    {
        id: 'publishing',
        title: 'Global Manufacturing',
        subtitle: 'Publishing Module',
        description: 'Automated DDEX injection to 100+ DSPs. The Release Wizard aggregates metadata, validates ERN 4.3 standards, and handles multi-threaded asset ingestion.',
        icon: Disc,
        color: 'text-electric-blue',
        gradient: 'from-blue-500/20 to-cyan-500/20',
        meta: 'Status: Beta Ready'
    },
    {
        id: 'legal',
        title: 'Autonomous Negotiation',
        subtitle: 'Legal Module',
        description: 'AI-driven contract analysis and generation. The Licensing Service manages rights, subscriptions, and splits with real-time error handling.',
        icon: Scale,
        color: 'text-frequency-pink',
        gradient: 'from-pink-500/20 to-purple-500/20',
        meta: 'Status: Beta Ready'
    },
    {
        id: 'creative',
        title: 'Neural Synthesis',
        subtitle: 'Creative Module',
        description: 'Generative video and audio production powered by Veo 3.1. Create music videos, stems, and marketing assets directly from your browser.',
        icon: Clapperboard,
        color: 'text-white',
        gradient: 'from-white/10 to-gray-500/10',
        meta: 'Power: High'
    }
];

export default function FeatureShowcase() {
    return (
        <section className="w-full max-w-7xl mx-auto px-4 py-32 relative z-10">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="text-center mb-24"
            >
                <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                    Tools of the <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue to-frequency-pink">Trade</span>
                </h2>
                <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
                    The first operating system designed to replace your record label.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {features.map((feature, index) => (
                    <motion.div
                        key={feature.id}
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: index * 0.2 }}
                        className={`
              relative group overflow-hidden rounded-3xl p-8 
              glass-panel border border-white/5
              hover:border-white/10 transition-all duration-500
            `}
                    >
                        {/* Background Gradient */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-start justify-between mb-8">
                                <div className={`p-4 rounded-2xl bg-white/5 backdrop-blur-md ${feature.color}`}>
                                    <feature.icon size={32} />
                                </div>
                                <span className="text-xs font-mono uppercase tracking-widest text-white/30 border border-white/10 px-2 py-1 rounded-full">
                                    {feature.meta}
                                </span>
                            </div>

                            <div className="mt-auto">
                                <h4 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-2">
                                    {feature.subtitle}
                                </h4>
                                <h3 className="text-2xl md:text-3xl font-bold mb-4 text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-400 transition-all">
                                    {feature.title}
                                </h3>
                                <p className="text-gray-400 leading-relaxed mb-6">
                                    {feature.description}
                                </p>

                                <div className="flex items-center gap-2 text-sm font-medium text-white/60 group-hover:text-white transition-colors cursor-pointer">
                                    See Documentation <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
