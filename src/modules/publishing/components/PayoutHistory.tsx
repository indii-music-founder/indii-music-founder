import React from 'react';
import { motion, AnimatePresence } from 'motion';
import {
    CreditCard,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Download,
    ChevronRight,
    ExternalLink,
    Banknote,
    ArrowUpRight
} from 'lucide-react';

interface PayoutRecord {
    id: string;
    date: string;
    amount: number;
    currencyCode: string;
    status: 'pending' | 'processing' | 'paid' | 'failed';
    method: string;
    releases: { id: string; title: string; amount: number }[];
}

interface PayoutHistoryProps {
    payouts: PayoutRecord[];
    loading?: boolean;
    onViewDetails?: (payoutId: string) => void;
    className?: string;
}

export const PayoutHistory: React.FC<PayoutHistoryProps> = ({
    payouts,
    loading = false,
    onViewDetails,
    className = ''
}) => {
    const statusConfig = {
        pending: { label: 'Pending', color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: <Clock size={12} /> },
        processing: { label: 'Processing', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: <Clock size={12} /> },
        paid: { label: 'Settled', color: 'text-green-500', bg: 'bg-green-500/10', icon: <CheckCircle2 size={12} /> },
        failed: { label: 'Failed', color: 'text-red-500', bg: 'bg-red-500/10', icon: <AlertTriangle size={12} /> }
    };

    return (
        <div className={`bg-[#121212] border border-gray-800 rounded-2xl overflow-hidden shadow-xl flex flex-col ${className}`}>
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        Financial History
                        <Banknote size={14} className="text-gray-600" />
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">Settled payouts and pending transactions</p>
                </div>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-[10px] font-black text-gray-400 hover:text-white transition-all uppercase tracking-widest">
                    <Download size={14} />
                    Export CSV
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center opacity-40">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                            <Clock size={32} />
                        </motion.div>
                        <p className="text-xs font-bold uppercase tracking-widest mt-4">Loading history...</p>
                    </div>
                ) : payouts.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center opacity-30">
                        <CreditCard size={48} className="text-gray-700 mb-4" />
                        <p className="text-sm font-bold uppercase tracking-widest text-gray-600">No payment history available</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-800/50">
                        {payouts.map((payout, i) => (
                            <motion.div
                                key={payout.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="group p-5 hover:bg-gray-900/40 transition-all cursor-pointer flex items-center justify-between"
                                onClick={() => onViewDetails?.(payout.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500 group-hover:text-white transition-all group-hover:border-gray-700`}>
                                        <Banknote size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg font-black text-white tracking-tighter">
                                                {payout.currencyCode === 'USD' ? '$' : payout.currencyCode}
                                                {payout.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${statusConfig[payout.status].bg} ${statusConfig[payout.status].color} border border-current opacity-20 group-hover:opacity-100 transition-opacity`}>
                                                {statusConfig[payout.status].icon}
                                                <span className="text-[9px] font-black uppercase tracking-widest">{statusConfig[payout.status].label}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">
                                            {new Date(payout.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} • {payout.method}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="hidden sm:flex flex-col items-end">
                                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Impacted</p>
                                        <div className="flex -space-x-1.5">
                                            {payout.releases.slice(0, 3).map((r, i) => (
                                                <div key={r.id} className="w-5 h-5 rounded-md bg-gray-800 border border-[#121212] flex items-center justify-center text-[7px] font-black text-gray-500 overflow-hidden">
                                                    {r.title.charAt(0)}
                                                </div>
                                            ))}
                                            {payout.releases.length > 3 && (
                                                <div className="w-5 h-5 rounded-md bg-gray-800 border border-[#121212] flex items-center justify-center text-[7px] font-black text-gray-500">
                                                    +{payout.releases.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="text-gray-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-4 bg-gray-900/30 border-t border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ArrowUpRight size={14} className="text-purple-500" />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Lifetime Earnings</span>
                </div>
                <span className="text-sm font-black text-white tracking-tighter">
                    ${payouts.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
            </div>
        </div>
    );
};
