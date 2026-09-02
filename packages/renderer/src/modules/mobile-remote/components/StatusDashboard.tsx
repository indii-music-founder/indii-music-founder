/**
 * StatusDashboard — Replaced by the Basic Home Actions Dashboard
 * Shows quick entry buttons for typical mobile tasks.
 */

import { Mic, ShoppingBag, Receipt, PenTool, LayoutDashboard, Navigation } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '../haptics';

interface StatusDashboardProps {
    connectionStatus: 'idle' | 'pairing' | 'connected' | 'error';
    isPaired: boolean;
    onTabChange?: (tab: 'home' | 'capture' | 'boardroom' | 'road' | 'stream' | 'settings') => void;
}

function ActionButton({ icon: Icon, label, description, delay = 0, onClick, disabled }: {
    icon: React.ElementType;
    label: string;
    description: string;
    delay?: number;
    onClick?: () => void;
    disabled?: boolean;
}) {
    return (
        <motion.button 
            whileTap={!disabled ? { scale: 0.95 } : undefined}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
            onClick={() => {
                if (!disabled && onClick) {
                    triggerHaptic(40);
                    onClick();
                }
            }}
            disabled={disabled}
            className={cn(
                "group relative overflow-hidden flex flex-col gap-3 p-5 rounded-[24px] border transition-all duration-300 text-left",
                disabled 
                    ? "bg-[#1c1c1e] border-white/5 opacity-50 cursor-not-allowed" 
                    : "bg-[#030303] border-white/10 hover:border-[#2E2EFE]/50 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_4px_20px_rgba(46,46,254,0.1)] cursor-pointer"
            )}
        >
            <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                disabled ? "bg-white/5 text-[#8e8e93]" : "bg-[#2E2EFE]/10 text-[#2E2EFE] group-hover:scale-110"
            )}>
                <Icon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 mt-2">
                <p className="text-sm font-bold text-[#F0F0F0] tracking-tight">{label}</p>
                <p className="text-[10px] text-[#8e8e93] font-medium leading-tight mt-1">{description}</p>
                {disabled && (
                    <span className="mt-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-[#8e8e93]">
                        Unavailable
                    </span>
                )}
            </div>
        </motion.button>
    );
}

export default function StatusDashboard({ connectionStatus, isPaired, onTabChange }: StatusDashboardProps) {
    return (
        <div className="space-y-6 pb-8">
            <div className="px-2 pt-2">
                <h2 className="text-2xl font-bold text-[#F0F0F0] tracking-tight mb-1">Welcome Back</h2>
                <p className="text-sm text-[#a1a1a6] font-medium">Ready to dispatch tasks to the studio.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <ActionButton
                    icon={Mic}
                    label="Live Moment"
                    description="Capture what just happened"
                    delay={0.1}
                    disabled={!isPaired}
                    onClick={() => onTabChange?.('capture')}
                />
                <ActionButton
                    icon={Receipt}
                    label="Log Receipt"
                    description="Snap a photo of an expense"
                    delay={0.2}
                    disabled={!isPaired}
                    onClick={() => onTabChange?.('capture')}
                />
                <ActionButton
                    icon={ShoppingBag}
                    label="Order Merch"
                    description="Request stock via agent"
                    delay={0.3}
                    disabled={!isPaired}
                    onClick={() => onTabChange?.('capture')}
                />
                <ActionButton
                    icon={PenTool}
                    label="Legal Review"
                    description="Remote legal approvals are not wired up in mobile yet."
                    delay={0.4}
                    disabled
                />
            </div>

            <motion.button
                whileTap={isPaired ? { scale: 0.98 } : undefined}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.4 }}
                onClick={() => {
                    if (!isPaired) return;
                    triggerHaptic(40);
                    onTabChange?.('boardroom');
                }}
                disabled={!isPaired}
                className={cn(
                    "group relative overflow-hidden flex w-full items-center justify-between gap-4 p-5 rounded-[24px] border transition-all duration-300 text-left mt-4",
                    isPaired
                        ? "bg-gradient-to-r from-blue-500/12 via-[#030303] to-indigo-500/12 border-blue-400/20 hover:border-blue-400/40 shadow-[0_8px_30px_rgba(46,46,254,0.08)] cursor-pointer"
                        : "bg-[#1c1c1e] border-white/5 opacity-50 cursor-not-allowed"
                )}
            >
                <div className="flex items-center gap-4 min-w-0">
                    <div className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0",
                        isPaired ? "bg-blue-500/15 text-blue-400" : "bg-white/5 text-[#8e8e93]"
                    )}>
                        <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-[#F0F0F0] tracking-tight">Talk to Boardroom</p>
                        <p className="text-[10px] text-[#8e8e93] font-medium leading-tight mt-1">
                            Open the boardroom thread and message the seated agents directly.
                        </p>
                    </div>
                </div>
                <span className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.2em]",
                    isPaired ? "text-blue-400" : "text-[#636366]"
                )}>
                    Open
                </span>
            </motion.button>

            <motion.button
                whileTap={isPaired ? { scale: 0.98 } : undefined}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.4 }}
                onClick={() => {
                    if (!isPaired) return;
                    triggerHaptic(40);
                    onTabChange?.('road');
                }}
                disabled={!isPaired}
                className={cn(
                    "group relative overflow-hidden flex w-full items-center justify-between gap-4 p-5 rounded-[24px] border transition-all duration-300 text-left mt-4",
                    isPaired
                        ? "bg-gradient-to-r from-emerald-500/10 via-[#030303] to-cyan-500/10 border-emerald-400/20 hover:border-emerald-400/40 shadow-[0_8px_30px_rgba(16,185,129,0.08)] cursor-pointer"
                        : "bg-[#1c1c1e] border-white/5 opacity-50 cursor-not-allowed"
                )}
            >
                <div className="flex items-center gap-4 min-w-0">
                    <div className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0",
                        isPaired ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-[#8e8e93]"
                    )}>
                        <Navigation className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-[#F0F0F0] tracking-tight">Road Mode</p>
                        <p className="text-[10px] text-[#8e8e93] font-medium leading-tight mt-1">
                            Touring controls for today&apos;s stop, nearby fuel, food, lodging, and emergency support.
                        </p>
                    </div>
                </div>
                <span className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.2em]",
                    isPaired ? "text-emerald-400" : "text-[#636366]"
                )}>
                    Open
                </span>
            </motion.button>

            {/* Basic Sync Indicator */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 px-5 py-4 rounded-[20px] bg-[#1c1c1e] border border-white/5 flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        connectionStatus === 'connected' ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse" :
                            isPaired ? "bg-amber-400" : "bg-red-400"
                    )} />
                    <span className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-widest">
                        {connectionStatus === 'connected' ? 'Studio Executor Active' :
                            isPaired ? 'Studio Standby' : 'Studio Disconnected'}
                    </span>
                </div>
                {isPaired && connectionStatus === 'connected' && (
                    <span className="text-[10px] font-mono font-bold text-green-400">SYNCED</span>
                )}
            </motion.div>
        </div>
    );
}
