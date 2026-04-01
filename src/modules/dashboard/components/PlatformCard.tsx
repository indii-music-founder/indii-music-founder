import React from 'react';
import { Monitor, Globe, Check, Lock, Cpu, HardDrive, Radio, Upload, Headphones, Zap } from 'lucide-react';

const isElectron = typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).electronAPI;

interface FeatureRow {
    label: string;
    icon: React.ElementType;
    web: boolean | 'limited';
    desktop: boolean;
}

const features: FeatureRow[] = [
    { label: 'AI Creative Studio', icon: Zap, web: true, desktop: true },
    { label: 'Agent Orchestration', icon: Cpu, web: true, desktop: true },
    { label: 'Distribution Pipeline', icon: Upload, web: 'limited', desktop: true },
    { label: 'Audio DNA Analyzer', icon: Headphones, web: 'limited', desktop: true },
    { label: 'Local File Processing', icon: HardDrive, web: false, desktop: true },
    { label: 'SFTP Delivery', icon: Radio, web: false, desktop: true },
    { label: 'Offline Mode', icon: Lock, web: false, desktop: true },
];

function StatusDot({ status }: { status: boolean | 'limited' }) {
    if (status === true) return <Check size={13} className="text-green-400" />;
    if (status === 'limited') return <span className="text-[10px] font-bold text-amber-400">LITE</span>;
    return <span className="text-[10px] text-gray-600">—</span>;
}

export function PlatformCard() {
    return (
        <div className="relative overflow-hidden border-b border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/10 via-transparent to-purple-900/10 pointer-events-none" />

            <div className="relative z-10 px-6 py-4">
                <div className="flex items-start gap-6">
                    {/* Current platform indicator */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-1.5 pt-1">
                        {isElectron ? (
                            <Monitor size={20} className="text-purple-400" />
                        ) : (
                            <Globe size={20} className="text-blue-400" />
                        )}
                        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">
                            {isElectron ? 'Desktop' : 'Web'}
                        </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-bold text-gray-200">
                                {isElectron
                                    ? 'You\'re running the full Desktop Studio'
                                    : 'You\'re previewing the Web Studio'
                                }
                            </h3>
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full border uppercase tracking-wider ${isElectron
                                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                }`}>
                                {isElectron ? 'Full' : 'Preview'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3 max-w-lg">
                            {isElectron
                                ? 'All capabilities unlocked — local audio processing, SFTP distribution, offline mode, and the AI sidecar are active.'
                                : 'This web preview lets you explore every module, but the full desktop app unlocks local audio processing, SFTP distribution, and offline mode.'
                            }
                        </p>

                        {/* Feature comparison grid */}
                        <div className="grid grid-cols-7 gap-x-3 gap-y-1.5 max-w-md">
                            {features.map(f => (
                                <React.Fragment key={f.label}>
                                    <div className="col-span-5 flex items-center gap-2">
                                        <f.icon size={12} className="text-gray-500 flex-shrink-0" />
                                        <span className="text-[11px] text-gray-400 truncate">{f.label}</span>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <StatusDot status={f.web} />
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <StatusDot status={f.desktop} />
                                    </div>
                                </React.Fragment>
                            ))}
                            {/* Column headers */}
                            <div className="col-span-5" />
                            <div className="flex items-center justify-center">
                                <span className="text-[8px] font-mono text-gray-600 uppercase">Web</span>
                            </div>
                            <div className="flex items-center justify-center">
                                <span className="text-[8px] font-mono text-gray-600 uppercase">App</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
