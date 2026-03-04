import React from 'react';
import { motion } from 'motion/react';
import { Gauge } from 'lucide-react';

export function DeliveryHealthPanel({ releases }: { releases: any[] }) {
    const total = releases.length || 1;
    const live = releases.filter((r: any) => r.status === 'live' || r.deployments?.some((d: any) => d.status === 'live')).length;
    const rate = total > 0 ? Math.round((live / total) * 100) : 0;

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Delivery Health</h3>
            <div className="p-3 rounded-lg bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-2">
                    <Gauge size={14} className="text-green-400" />
                    <span className="text-xs font-bold text-white">{rate}% Success Rate</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${rate}%` }}
                        transition={{ duration: 1 }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-gray-500">
                    <span>{live} delivered</span>
                    <span>{total - live} pending</span>
                </div>
            </div>
        </div>
    );
}
