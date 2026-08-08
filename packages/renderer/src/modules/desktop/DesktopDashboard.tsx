import React, { useEffect, useState } from 'react';
import { Monitor, Cpu, Wifi, Keyboard, Database, Network, Power } from 'lucide-react';
import { SettingCard } from './components/SettingCard';
import { getColorForModule } from '@/core/theme/moduleColors';

export default function DesktopDashboard() {
    const [isOnline, setIsOnline] = useState(() => navigator.onLine);
    const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);
    const moduleColor = getColorForModule('desktop');

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <div className="flex h-full bg-background overflow-hidden relative text-white">
            <div className={`absolute top-[-10%] right-[-10%] w-[600px] h-[600px] ${moduleColor.bg} rounded-full blur-[150px] pointer-events-none`} />

            <div className="flex-1 flex flex-col z-10 min-w-0">
                <div className="h-24 border-b border-white/5 flex items-center justify-between px-10 bg-surface/30 backdrop-blur-md">
                    <div>
                        <h1 className={`text-3xl font-black tracking-tight flex items-center gap-3 ${moduleColor.text}`}>
                            <Monitor size={28} className={moduleColor.text} />
                            DESKTOP INTEGRATION
                        </h1>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">Verified Runtime Capabilities</p>
                    </div>

                    <div className="flex items-center gap-4 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                        <div className={`w-2 h-2 rounded-full ${isElectron ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <span className="text-xs font-bold text-gray-300 tracking-wider">
                            {isElectron ? 'ELECTRON DESKTOP CONNECTED' : 'WEB SESSION — DESKTOP CONTROLS UNAVAILABLE'}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-surface/30 border border-white/5 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
                                <h3 className={`text-sm font-bold mb-6 flex items-center gap-2 ${moduleColor.text}`}>
                                    <Cpu size={16} className={moduleColor.text} /> VERIFIED STATUS
                                </h3>

                                <dl className="space-y-5 text-sm">
                                    <div className="flex items-center justify-between gap-4">
                                        <dt className="text-gray-500 uppercase tracking-wider text-xs">Runtime</dt>
                                        <dd className="text-gray-200 font-medium">{isElectron ? 'Electron desktop' : 'Web browser'}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <dt className="text-gray-500 uppercase tracking-wider text-xs">Network</dt>
                                        <dd className={isOnline ? 'text-green-400 font-medium' : 'text-amber-400 font-medium'}>
                                            <span className="inline-flex items-center gap-1"><Wifi size={14} /> {isOnline ? 'Online' : 'Offline'}</span>
                                        </dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <dt className="text-gray-500 uppercase tracking-wider text-xs">Resource telemetry</dt>
                                        <dd className="text-gray-400 font-medium">Not exposed</dd>
                                    </div>
                                </dl>
                            </div>
                        </div>

                        <div className="lg:col-span-2 space-y-4">
                            <SettingCard
                                icon={Power}
                                title="Run on System Startup"
                                description="No startup preference is connected to the Electron main process in this build."
                                status="unavailable"
                            />

                            <SettingCard
                                icon={Cpu}
                                title="Hardware Acceleration"
                                description={isElectron
                                    ? 'Chromium manages acceleration for this desktop session; the app does not expose a user toggle.'
                                    : 'Hardware acceleration is controlled by the browser and is not exposed here.'}
                                status={isElectron ? 'managed' : 'unavailable'}
                            />

                            <SettingCard
                                icon={Database}
                                title="Offline Vault Synchronization"
                                description="Project-file mirroring is not implemented. Firestore's built-in local cache does not provide a separate file vault."
                                status="unavailable"
                            />

                            <SettingCard
                                icon={Keyboard}
                                title="Computer Control Kill Switch"
                                description={isElectron
                                    ? 'Command/Ctrl + Shift + Escape is registered by the desktop process to stop computer control.'
                                    : 'The global computer-control kill switch is available only in the Electron desktop app.'}
                                status={isElectron ? 'active' : 'unavailable'}
                            />

                            <SettingCard
                                icon={Network}
                                title="Background Agent Daemon"
                                description="A persistent background agent daemon is not implemented in this build."
                                status="unavailable"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
