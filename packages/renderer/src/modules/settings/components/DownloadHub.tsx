import React from 'react';
import { motion } from 'motion/react';
import { Download, Monitor, Apple, Command, ArrowDown } from 'lucide-react';

export default function DownloadHub() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 rounded-2xl overflow-hidden border border-cyan-500/20 bg-linear-to-br from-cyan-950/20 via-black/40 to-cyan-950/10"
        >
            <div className="flex items-center justify-between px-5 py-4 bg-cyan-500/10 border-b border-cyan-500/20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
                        <Monitor size={18} className="text-cyan-400" />
                    </div>
                    <div>
                        <h3 className="text-cyan-50 text-sm font-bold tracking-wide">indiiOS Studio Desktop</h3>
                        <p className="text-cyan-400/70 text-xs mt-0.5">Founder Exclusive Offline Access</p>
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
                        href="https://github.com/the-walking-agency-det/indiiOS-Alpha-Electron/releases/latest"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col items-center justify-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:bg-white/[0.04] hover:border-cyan-500/30 transition-all"
                    >
                        <Apple size={24} className="text-slate-300 group-hover:text-white transition-colors" />
                        <div className="text-center">
                            <span className="block text-xs font-semibold text-slate-200 group-hover:text-white">macOS</span>
                            <span className="block text-[10px] text-slate-500 font-mono mt-1">Apple Silicon / Intel</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider group-hover:bg-cyan-500/20 transition-colors">
                            <Download size={12} />
                            <span>Download</span>
                        </div>
                    </a>

                    {/* Windows */}
                    <a
                        href="https://github.com/the-walking-agency-det/indiiOS-Alpha-Electron/releases/latest"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col items-center justify-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:bg-white/[0.04] hover:border-cyan-500/30 transition-all"
                    >
                        <Monitor size={24} className="text-slate-300 group-hover:text-white transition-colors" />
                        <div className="text-center">
                            <span className="block text-xs font-semibold text-slate-200 group-hover:text-white">Windows</span>
                            <span className="block text-[10px] text-slate-500 font-mono mt-1">Windows 10 / 11</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider group-hover:bg-cyan-500/20 transition-colors">
                            <Download size={12} />
                            <span>Download</span>
                        </div>
                    </a>

                    {/* Linux */}
                    <a
                        href="https://github.com/the-walking-agency-det/indiiOS-Alpha-Electron/releases/latest"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col items-center justify-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:bg-white/[0.04] hover:border-cyan-500/30 transition-all"
                    >
                        <Command size={24} className="text-slate-300 group-hover:text-white transition-colors" />
                        <div className="text-center">
                            <span className="block text-xs font-semibold text-slate-200 group-hover:text-white">Linux</span>
                            <span className="block text-[10px] text-slate-500 font-mono mt-1">AppImage / .deb</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider group-hover:bg-cyan-500/20 transition-colors">
                            <Download size={12} />
                            <span>Download</span>
                        </div>
                    </a>
                </div>
            </div>
        </motion.div>
    );
}
