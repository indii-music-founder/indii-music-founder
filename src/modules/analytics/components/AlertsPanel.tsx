import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Zap, TrendingUp, X } from 'lucide-react';
import type { BreakoutAlert } from '@/services/analytics/types';

interface AlertsPanelProps {
    alerts: BreakoutAlert[];
    onDismiss: (id: string) => void;
}

const ALERT_STYLES = {
    critical: { border: 'border-yellow-500/50', bg: 'bg-yellow-500/10', icon: Zap,           iconColor: 'text-yellow-400' },
    warning:  { border: 'border-blue-500/40',   bg: 'bg-blue-500/10',   icon: TrendingUp,    iconColor: 'text-blue-400'   },
    info:     { border: 'border-slate-500/40',  bg: 'bg-slate-800/50',  icon: AlertTriangle, iconColor: 'text-slate-400'  },
};

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts, onDismiss }) => {
    if (!alerts.length) {
        return (
            <div className="bg-slate-800/30 border border-white/5 rounded-xl p-5 text-center">
                <p className="text-slate-500 text-sm">No active alerts</p>
                <p className="text-slate-600 text-xs mt-1">Breakout triggers will appear here in real time.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <AnimatePresence>
                {alerts.map(alert => {
                    const style = ALERT_STYLES[alert.severity] ?? ALERT_STYLES.info;
                    const Icon = style.icon;
                    return (
                        <motion.div
                            key={alert.id}
                            layout
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className={`border ${style.border} ${style.bg} rounded-xl p-4 flex items-start gap-3`}
                        >
                            <Icon size={16} className={`${style.iconColor} shrink-0 mt-0.5`} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className="text-sm font-semibold text-white">{alert.title}</span>
                                    <span className="text-xs text-slate-500 shrink-0">{formatTime(alert.timestamp)}</span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
                            </div>
                            <button
                                onClick={() => onDismiss(alert.id)}
                                className="text-slate-600 hover:text-slate-300 transition-colors shrink-0"
                                aria-label="Dismiss alert"
                            >
                                <X size={14} />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};
