import React from 'react';
import { motion } from 'motion/react';
import { Gauge } from 'lucide-react';
import type { DashboardRelease } from '@/services/distribution/types/distributor';

export function DeliveryHealthPanel({ releases }: { releases: DashboardRelease[] }) {
    if (releases.length === 0) {
        return (
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Delivery Health</h3>
                <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                    <Gauge size={14} className="text-gray-600 mx-auto mb-1.5" />
                    <p className="text-[10px] text-gray-600">No releases yet</p>
                    <p className="text-[10px] text-gray-700 mt-0.5">Submit a release to track delivery</p>
                </div>
            </div>
        );
    }

    const total = releases.length;
    const live = releases.filter((r) => Object.values(r.deployments ?? {}).some((d) => d.status === 'live')).length;
    const rate = Math.round((live / total) * 100);
    const rateColor = rate >= 90 ? 'text-green-400' : rate >= 75 ? 'text-yellow-400' : 'text-red-400';
    const barColor = rate >= 90 ? 'from-green-500 to-emerald-400' : rate >= 75 ? 'from-yellow-500 to-amber-400' : 'from-red-500 to-rose-400';

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Delivery Health</h3>
            <div className="p-3 rounded-lg bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-2">
                    <Gauge size={14} className={rateColor} />
                    <span className={`text-xs font-bold ${rateColor}`}>{rate}% Success Rate</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        className={`h-full bg-gradient-to-r ${barColor} rounded-full`}
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
