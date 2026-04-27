import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/core/store';
import { ArrowLeft, CheckCircle2, Landmark, Mail } from 'lucide-react';

export default function FoundersCheckout() {
    const setModule = useStore(state => state.setModule);

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 overflow-y-auto relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/10 via-background to-background pointer-events-none" />
            
            <button
                onClick={() => setModule('dashboard')}
                className="fixed top-6 left-6 z-20 flex items-center gap-2 text-xs text-gray-500 hover:text-gray-200 transition-colors group"
            >
                <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                Return to Studio
            </button>

            <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="z-10 max-w-4xl w-full text-center mt-12"
            >
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest uppercase mb-8">
                    Founders Round — 10 Seats Maximum
                </div>
                
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6">
                    Back The <span className="text-amber-400">Vision</span>.
                </h1>
                
                <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed mb-16">
                    To comply with strict investment and capitalization regulations, we do not accept credit card payments for Founder seats. 
                    Please use one of the direct funding methods below.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left mb-16">
                    {/* Method 1: Cash App */}
                    <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 hover:border-amber-500/30 transition-colors relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all">
                            <span className="text-6xl font-black text-amber-500">$</span>
                        </div>
                        <div className="w-12 h-12 bg-green-500/10 text-green-400 rounded-xl flex items-center justify-center mb-6">
                            <span className="text-2xl font-black">$</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Cash App</h3>
                        <p className="text-gray-400 text-sm mb-6 h-12">The fastest way to secure your seat. Processed immediately during business hours.</p>
                        <div className="bg-black/50 p-4 rounded-xl border border-white/5 font-mono text-amber-400 text-lg font-bold text-center">
                            $indiiOS
                        </div>
                    </div>

                    {/* Method 2: Wire Transfer */}
                    <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 hover:border-amber-500/30 transition-colors relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all">
                            <Landmark size={64} className="text-amber-500" />
                        </div>
                        <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-6">
                            <Landmark size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Wire Transfer</h3>
                        <p className="text-gray-400 text-sm mb-6 h-12">Standard institutional transfer. Domestic or international routes available.</p>
                        <a 
                            href="mailto:founders@indiios.com?subject=Wire Transfer Request - Founders Seat"
                            className="block w-full text-center bg-white/5 hover:bg-white/10 text-white p-4 rounded-xl border border-white/10 transition-colors text-sm font-semibold"
                        >
                            Request Wire Instructions
                        </a>
                    </div>

                    {/* Method 3: Check */}
                    <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 hover:border-amber-500/30 transition-colors relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all">
                            <Mail size={64} className="text-amber-500" />
                        </div>
                        <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center mb-6">
                            <Mail size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Physical Check</h3>
                        <p className="text-gray-400 text-sm mb-6 h-12">Mail a certified check. Seat is reserved upon receipt and tracking confirmation.</p>
                        <div className="bg-black/50 p-4 rounded-xl border border-white/5 text-sm text-gray-300">
                            <span className="text-white font-semibold block mb-1">New Detroit Music LLC</span>
                            1001 Woodward Ave<br />
                            Detroit, MI 48226
                        </div>
                    </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 max-w-2xl mx-auto flex items-start gap-4 text-left">
                    <CheckCircle2 className="text-amber-500 shrink-0 mt-1" size={24} />
                    <div>
                        <h4 className="text-amber-500 font-semibold mb-1">What happens next?</h4>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Once your funds are verified, our administrative team will manually activate your account. 
                            You will receive an email confirmation, and your Founders Agreement hash will be permanently encoded to the codebase. 
                            The Mac (DMG) and Windows (EXE) installers will immediately become available in your settings.
                        </p>
                    </div>
                </div>
                
                <p className="mt-12 pb-12 text-gray-500 text-xs uppercase tracking-widest font-mono">
                    Investment Price: $2,500.00 USD
                </p>
            </motion.div>
        </div>
    );
}
