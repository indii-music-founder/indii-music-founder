import React, { useEffect, useState } from 'react';
import { distributionService, DistributionTask } from '@/services/distribution/DistributionService';
import { CheckCircle, XCircle, Loader2, Activity, Package, HardDrive, Shield } from 'lucide-react';

export const TransmissionMonitor: React.FC = () => {
    const [tasks, setTasks] = useState<DistributionTask[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const unsubscribe = distributionService.subscribeTasks((newTasks) => {
            setTasks(newTasks);
        });
        return () => unsubscribe();
    }, []);

    const getStatusIcon = (status: DistributionTask['status']) => {
        switch (status) {
            case 'COMPLETED': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
            case 'FAILED': return <XCircle className="w-4 h-4 text-rose-500" />;
            case 'RUNNING': return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
            default: return <Activity className="w-4 h-4 text-zinc-500" />;
        }
    };

    const getTypeIcon = (type: DistributionTask['type']) => {
        switch (type) {
            case 'QC': return <Shield className="w-4 h-4" />;
            case 'STAGING': return <HardDrive className="w-4 h-4" />;
            case 'PACKAGING': return <Package className="w-4 h-4" />;
            case 'DELIVERY': return <Activity className="w-4 h-4" />;
        }
    };

    if (tasks.length === 0) return null;

    const activeTasks = tasks.filter(t => t.status === 'RUNNING' || t.status === 'PENDING').length;

    return (
        <div className={`fixed bottom-20 right-6 z-50 transition-all duration-300 ${isOpen ? 'w-80' : 'w-12'}`}>
            {isOpen ? (
                <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[400px]">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-bold tracking-wider uppercase text-white/70">Transmission Monitor</span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-zinc-500 hover:text-white transition-colors"
                        >
                            <XCircle className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
                        {tasks.map((task) => (
                            <div key={task.id} className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-zinc-800 rounded-lg text-zinc-400">
                                            {getTypeIcon(task.type)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-medium text-white/90 truncate max-w-[150px]">{task.title}</span>
                                            <span className="text-[10px] text-zinc-500 uppercase">{task.type}</span>
                                        </div>
                                    </div>
                                    {getStatusIcon(task.status)}
                                </div>

                                {task.subtext && (
                                    <div className="text-[10px] text-zinc-400 italic px-1">
                                        {task.subtext}
                                    </div>
                                )}

                                {task.status === 'RUNNING' && (
                                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-500"
                                            style={{ width: `${task.progress || 10}%` }}
                                        />
                                    </div>
                                )}

                                {task.error && (
                                    <div className="text-[10px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                                        {task.error}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-12 h-12 bg-zinc-900 border border-white/10 rounded-full flex items-center justify-center shadow-2xl hover:bg-zinc-800 transition-all group relative"
                >
                    <Activity className={`w-5 h-5 text-blue-400 ${activeTasks > 0 ? 'animate-pulse' : ''}`} />
                    {activeTasks > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-zinc-900">
                            {activeTasks}
                        </div>
                    )}
                </button>
            )}
        </div>
    );
};
