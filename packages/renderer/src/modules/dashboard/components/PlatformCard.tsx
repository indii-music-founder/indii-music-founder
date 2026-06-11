import React, { useState } from 'react';
import { Monitor, Globe, Check, Lock, Cpu, HardDrive, Radio, Upload, Headphones, Zap, ArrowRight, X, Flame, ShieldAlert, Activity, LucideIcon } from 'lucide-react';
import { useStore } from '@/core/store';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';

const isElectron = typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).electronAPI;

interface FeatureRow {
    key: string;
    label: string;
    icon: LucideIcon;
    web: boolean | 'limited';
    desktop: boolean;
}

const features: FeatureRow[] = [
    { key: 'creativeStudio', label: 'Creative Studio', icon: Zap, web: true, desktop: true },
    { key: 'agentOrchestration', label: 'Agent Orchestration', icon: Cpu, web: true, desktop: true },
    { key: 'distributionPipeline', label: 'Distribution Pipeline', icon: Upload, web: 'limited', desktop: true },
    { key: 'audioDNA', label: 'Audio DNA Analyzer', icon: Headphones, web: 'limited', desktop: true },
    { key: 'localFile', label: 'Local File Processing', icon: HardDrive, web: false, desktop: true },
    { key: 'sftp', label: 'SFTP Delivery', icon: Radio, web: false, desktop: true },
    { key: 'offlineMode', label: 'Offline Mode', icon: Lock, web: false, desktop: true },
];

function StatusDot({ status }: { status: boolean | 'limited' }) {
    if (status === true) return <Check size={13} className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />;
    if (status === 'limited') return <span className="text-[10px] font-bold text-amber-500/60 tracking-wider">LITE</span>;
    return <span className="text-[10px] text-gray-600">—</span>;
}

export function PlatformCard() {
    const { t } = useTranslation();
    const setModule = useStore(state => state.setModule);
    const [dismissed, setDismissed] = useState(false);

    // If already running in Electron, show a confirmation card instead
    if (isElectron) {
        return (
            <div className="relative overflow-hidden border-b border-white/5 bg-[#050505]">
                <div className="absolute inset-0 bg-linear-to-r from-amber-900/10 via-transparent to-orange-900/5 pointer-events-none" />
                <div className="relative z-10 px-6 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Monitor size={16} className="text-amber-500 flex-shrink-0" />
                        <p className="text-xs text-gray-400">
                            <span className="font-bold text-amber-400">{t('dashboard.desktopStudio')}</span> — {t('dashboard.growthProtocolActive')}
                        </p>
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20 uppercase tracking-wider flex-shrink-0 animate-pulse">
                            {t('dashboard.live')}
                        </span>
                    </div>

                    {/* Indii Growth Protocol Metrics - Space Black & Amber Theme */}
                    <div className="flex items-center gap-4 bg-black/60 border border-amber-500/20 rounded-md px-3 py-1.5 shadow-[0_0_15px_rgba(245,158,11,0.05)] backdrop-blur-sm">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-mono text-amber-500/60 uppercase tracking-widest">{t('dashboard.viralScore')}</span>
                            <div className="flex items-center gap-1.5">
                                <Flame size={12} className="text-amber-400" />
                                <span className="text-sm font-bold text-amber-100">84.5</span>
                            </div>
                        </div>

                        <div className="w-px h-6 bg-white/10" />

                        <div className="flex flex-col">
                            <span className="text-[9px] font-mono text-amber-500/60 uppercase tracking-widest">{t('dashboard.velocity')}</span>
                            <div className="flex items-center gap-1.5">
                                <Activity size={12} className="text-emerald-400" />
                                <span className="text-sm font-bold text-emerald-100">+12.4%</span>
                            </div>
                        </div>

                        <div className="w-px h-6 bg-white/10" />

                        <div className="flex flex-col">
                            <span className="text-[9px] font-mono text-amber-500/60 uppercase tracking-widest">{t('dashboard.cpsKillSwitch')}</span>
                            <div className="flex items-center gap-1.5">
                                <ShieldAlert size={12} className="text-amber-500" />
                                <span className="text-xs font-bold text-amber-500 tracking-wider">{t('dashboard.standby')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <AnimatePresence>
            {!dismissed && (
                <motion.div
                    initial={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="relative overflow-hidden border-b border-white/5"
                >
                    <div className="absolute inset-0 bg-linear-to-r from-indigo-900/10 via-transparent to-purple-900/10 pointer-events-none" />

                    {/* Dismiss button — top right */}
                    <button
                        onClick={() => setDismissed(true)}
                        className="absolute top-2.5 right-3 z-20 p-1.5 text-gray-500 hover:text-gray-200 transition-colors rounded-lg hover:bg-white/10"
                        aria-label={t('dashboard.dismiss')}
                    >
                        <X size={14} />
                    </button>

                    <div className="relative z-10 px-6 py-2.5 pr-10">
                        <div className="flex items-start gap-6">
                            {/* Current platform indicator */}
                            <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-1 opacity-80">
                                <Globe size={20} className="text-blue-400" />
                                <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">{t('dashboard.web')}</span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-sm font-bold text-gray-200">
                                        {t('dashboard.webPreview')}
                                    </h3>
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30 uppercase tracking-wider">
                                        {t('dashboard.preview')}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-500 mb-2 max-w-lg leading-snug">
                                    {t('dashboard.webPreviewDescription')}
                                </p>

                                {/* Feature comparison grid */}
                                <div className="grid grid-cols-7 gap-x-3 gap-y-1.5 max-w-md">
                                    {/* Column headers */}
                                    <div className="col-span-5" />
                                    <div className="flex items-center justify-center">
                                        <span className="text-[8px] font-mono text-gray-600 uppercase">{t('dashboard.web')}</span>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <span className="text-[8px] font-mono text-amber-500/70 uppercase">{t('dashboard.founders')}</span>
                                    </div>

                                    {features.map(f => (
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        <React.Fragment {...({ key: f.label } as any)}>
                                            <div className="col-span-5 flex items-center gap-2">
                                                <f.icon size={12} className="text-gray-500 flex-shrink-0" />
                                                <span className="text-[11px] text-gray-400 truncate">{t('dashboard.features.' + f.key)}</span>
                                            </div>
                                            <div className="flex items-center justify-center">
                                                <StatusDot status={f.web} />
                                            </div>
                                            <div className="flex items-center justify-center">
                                                <StatusDot status={f.desktop} />
                                            </div>
                                        </React.Fragment>
                                    ))}
                                </div>

                                {/* CTA */}
                                <button
                                    onClick={() => setModule('founders-checkout')}
                                    className="group mt-2.5 flex items-center gap-2 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors uppercase tracking-widest"
                                >
                                    {t('dashboard.unlockDesktop')}
                                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

