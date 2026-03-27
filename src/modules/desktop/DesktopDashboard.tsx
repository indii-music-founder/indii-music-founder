import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Cpu, HardDrive, Wifi, ShieldCheck, ToggleLeft, ToggleRight, Keyboard, Database, Network, Power } from 'lucide-react';
import { useStore } from '@/core/store';
import { cn } from '@/lib/utils';
import { useToast } from '@/core/context/ToastContext';

export default function DesktopDashboard() {
    const { userProfile, currentProjectId } = useStore();
    const toast = useToast();

    const [settings, setSettings] = useState({
        runOnStartup: true,
        hardwareAcceleration: true,
        offlineSync: false,
        globalShortcuts: true,
        backgroundAgent: true,
    });

    const toggleSetting = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
        toast.success(`Setting ${key} updated.`);
    };

    return (
        <div className="flex h-full bg-background overflow-hidden relative text-white">
            {/* Ambient Background Effect */}
            <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="flex-1 flex flex-col z-10 min-w-0">
                {/* Header */}
                <div className="h-24 border-b border-white/5 flex items-center justify-between px-10 bg-surface/30 backdrop-blur-md">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center gap-3">
                            <Monitor size={28} className="text-cyan-500" />
                            DESKTOP INTEGRATION
                        </h1>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">System-Level Configuration</p>
                    </div>

                    <div className="flex items-center gap-4 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-bold text-gray-300 tracking-wider">ELECTRON DAEMON ACTIVE</span>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* System Status Panel */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-surface/30 border border-white/5 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
                                <h3 className="text-sm font-bold text-gray-200 mb-6 flex items-center gap-2">
                                    <Cpu size={16} className="text-cyan-400" /> SYSTEM RESOURCES
                                </h3>

                                <div className="space-y-6">
                                    <ResourceBar label="MEMORY / VRAM" value={64} color="bg-cyan-500" />
                                    <ResourceBar label="CPU UTILIZATION" value={28} color="bg-blue-500" />
                                    <ResourceBar label="FILE CACHE" value={82} color="bg-purple-500" />
                                </div>

                                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Network</p>
                                        <p className="text-sm text-green-400 font-medium flex items-center gap-1 mt-1"><Wifi size={14} /> Connected</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Security</p>
                                        <p className="text-sm text-green-400 font-medium flex items-center gap-1 mt-1"><ShieldCheck size={14} /> Secure</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Integration Settings */}
                        <div className="lg:col-span-2 space-y-4">
                            <SettingCard
                                icon={Power}
                                title="Run on System Startup"
                                description="Launch indiiOS automatically in the background when your computer starts."
                                enabled={settings.runOnStartup}
                                onClick={() => toggleSetting('runOnStartup')}
                            />

                            <SettingCard
                                icon={Cpu}
                                title="Hardware Acceleration"
                                description="Utilize GPU for rendering the UI and accelerating local AI processing models."
                                enabled={settings.hardwareAcceleration}
                                onClick={() => toggleSetting('hardwareAcceleration')}
                            />

                            <SettingCard
                                icon={Database}
                                title="Offline Vault Synchronization"
                                description="Keep active project files mirrored locally allowing uninterrupted work without internet."
                                enabled={settings.offlineSync}
                                onClick={() => toggleSetting('offlineSync')}
                            />

                            <SettingCard
                                icon={Keyboard}
                                title="Global Command Shortcuts"
                                description="Enable system-wide hotkeys (e.g., CMD+SHIFT+Space) to instantly summon the AI agent."
                                enabled={settings.globalShortcuts}
                                onClick={() => toggleSetting('globalShortcuts')}
                            />

                            <SettingCard
                                icon={Network}
                                title="Background Agent Daemon"
                                description="Allow non-intrusive AI agents to continue processing generation tasks while minimized."
                                enabled={settings.backgroundAgent}
                                onClick={() => toggleSetting('backgroundAgent')}
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

function ResourceBar({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div>
            <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-400 font-medium tracking-wide">{label}</span>
                <span className="text-white font-bold">{value}%</span>
            </div>
            <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={cn("h-full rounded-full shadow-[0_0_10px_rgba(255,255,255,0.2)]", color)}
                />
            </div>
        </div>
    );
}

function SettingCard({ icon: Icon, title, description, enabled, onClick }: { icon: React.ElementType, title: string, description: string, enabled: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full text-left p-6 rounded-3xl border transition-all duration-300 flex items-start gap-6 group hover:scale-[1.01] active:scale-95",
                enabled
                    ? "bg-surface/40 hover:bg-surface/60 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.05)]"
                    : "bg-surface/20 hover:bg-surface/40 border-white/5"
            )}
        >
            <div className={cn(
                "p-3 rounded-2xl flex-shrink-0 transition-colors",
                enabled ? "bg-cyan-500/20 text-cyan-400" : "bg-black/40 text-gray-500 group-hover:text-gray-400"
            )}>
                <Icon size={24} />
            </div>

            <div className="flex-1 min-w-0">
                <h4 className={cn("text-lg font-bold mb-1 transition-colors", enabled ? "text-white" : "text-gray-300")}>{title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed pr-8">{description}</p>
            </div>

            <div className="flex-shrink-0 ml-4 pt-1">
                {enabled ? (
                    <ToggleRight size={32} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                ) : (
                    <ToggleLeft size={32} className="text-gray-600" />
                )}
            </div>
        </button>
    );
}
