import React from 'react';
import { motion } from 'motion/react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Download, Monitor, Apple, Command, ArrowDown } from 'lucide-react';
import { getColorForModule } from '@/core/theme/moduleColors';

export default function DownloadHub() {
    const moduleColor = getColorForModule('settings');
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`mt-6 rounded-2xl overflow-hidden border ${moduleColor.border}/20 bg-linear-to-br from-black/40 to-black/80`}
        >
            <div className={`flex items-center justify-between px-5 py-4 ${moduleColor.bg} border-b ${moduleColor.border}/20`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 ${moduleColor.bg} rounded-xl border ${moduleColor.border}/30`}>
                        <Monitor size={18} className={moduleColor.text} />
                    </div>
                    <div>
                        <h3 className="text-white text-sm font-bold tracking-wide">indii Studio Desktop</h3>
                        <p className={`${moduleColor.text}/70 text-xs mt-0.5`}>Founder Exclusive Offline Access</p>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-4">
                <p className="text-sm text-slate-300">
                    Download the native desktop application to leverage local compute, offline audio processing, and direct SFTP distribution.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    {/* Mac (Apple Silicon) */}
                    <a
                        href="https://github.com/indii-music-founder/indii-music-founder/releases/latest"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`group flex flex-col items-center justify-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:bg-white/[0.04] hover:${moduleColor.border}/30 transition-all`}
                    >
                        <Apple size={24} className="text-slate-300 group-hover:text-white transition-colors" />
                        <div className="text-center">
                            <span className="block text-xs font-semibold text-slate-200 group-hover:text-white">macOS</span>
                            <span className="block text-[10px] text-slate-500 font-mono mt-1">Apple Silicon / Intel</span>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${moduleColor.bg} ${moduleColor.text} text-[10px] font-bold uppercase tracking-wider group-hover:bg-white/10 transition-colors`}>
                            <Download size={12} />
                            <span>Download</span>
                        </div>
                    </a>

                    {/* Windows */}
                    <a
                        href="https://github.com/indii-music-founder/indii-music-founder/releases/latest"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`group flex flex-col items-center justify-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:bg-white/[0.04] hover:${moduleColor.border}/30 transition-all`}
                    >
                        <Monitor size={24} className="text-slate-300 group-hover:text-white transition-colors" />
                        <div className="text-center">
                            <span className="block text-xs font-semibold text-slate-200 group-hover:text-white">Windows</span>
                            <span className="block text-[10px] text-slate-500 font-mono mt-1">Windows 10 / 11</span>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${moduleColor.bg} ${moduleColor.text} text-[10px] font-bold uppercase tracking-wider group-hover:bg-white/10 transition-colors`}>
                            <Download size={12} />
                            <span>Download</span>
                        </div>
                    </a>

                    {/* Linux */}
                    <a
                        href="https://github.com/indii-music-founder/indii-music-founder/releases/latest"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`group flex flex-col items-center justify-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:bg-white/[0.04] hover:${moduleColor.border}/30 transition-all`}
                    >
                        <Command size={24} className="text-slate-300 group-hover:text-white transition-colors" />
                        <div className="text-center">
                            <span className="block text-xs font-semibold text-slate-200 group-hover:text-white">Linux</span>
                            <span className="block text-[10px] text-slate-500 font-mono mt-1">AppImage / .deb</span>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${moduleColor.bg} ${moduleColor.text} text-[10px] font-bold uppercase tracking-wider group-hover:bg-white/10 transition-colors`}>
                            <Download size={12} />
                            <span>Download</span>
                        </div>
                    </a>
                </div>
            </div>
        </motion.div>
    );
}
