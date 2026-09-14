/**
 * StatusDashboard — Replaced by the Basic Home Actions Dashboard
 * Shows quick entry buttons for typical mobile tasks.
 */

import { useState } from 'react';
import { Mic, ShoppingBag, Receipt, PenTool, LayoutDashboard, Navigation, Car } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '../haptics';
import MobileMileageModal from './MobileMileageModal';

interface StatusDashboardProps {
    connectionStatus: 'idle' | 'pairing' | 'connected' | 'error';
    isPaired: boolean;
    onTabChange?: (tab: 'home' | 'capture' | 'boardroom' | 'road' | 'stream' | 'settings') => void;
}

interface ActionButtonProps {
    icon: React.ElementType;
    label: string;
    description: string;
    delay?: number;
    onClick?: () => void;
    disabled?: boolean;
    iconColor?: string;
    iconBg?: string;
    iconBorder?: string;
}

function ActionButton({
    icon: Icon,
    label,
    description,
    delay = 0,
    onClick,
    disabled,
    iconColor = 'text-stone-300',
    iconBg = 'bg-white/[0.04]',
    iconBorder = 'border-white/10',
}: ActionButtonProps) {
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
                "group relative overflow-hidden flex flex-col gap-3 p-5 rounded-[24px] border transition-all duration-300 text-left font-sans",
                disabled 
                    ? "bg-[#181411]/60 border-white/5 opacity-50 cursor-not-allowed"
                    : "bg-[#1a1512]/80 border-white/10 hover:border-[#00ff66]/40 shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_rgba(0,255,102,0.08)] backdrop-blur-xl cursor-pointer"
            )}
        >
            <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300",
                disabled ? "bg-white/5 text-stone-500 border-white/5" : cn(iconBg, iconColor, iconBorder, "group-hover:scale-110")
            )}>
                <Icon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 mt-2">
                <p className="text-sm font-bold text-stone-100 tracking-tight font-display">{label}</p>
                <p className="text-[10px] text-stone-400 font-medium leading-tight mt-1">{description}</p>
                {disabled && (
                    <span className="mt-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-stone-500 font-mono">
                        Unavailable
                    </span>
                )}
            </div>
        </motion.button>
    );
}

export default function StatusDashboard({ connectionStatus, isPaired, onTabChange }: StatusDashboardProps) {
    const [showMileageModal, setShowMileageModal] = useState(false);

    return (
        <div className="space-y-6 pb-8 font-sans">
            <div className="px-2 pt-2">
                <h2 className="text-2xl font-bold text-stone-100 tracking-tight mb-1 font-display">Welcome Back</h2>
                <p className="text-sm text-stone-400 font-medium">Ready to dispatch tasks to the studio.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <ActionButton
                    icon={Mic}
                    label="Live Moment"
                    description="Capture what just happened"
                    delay={0.1}
                    disabled={false}
                    iconColor="text-[#00ff66]"
                    iconBg="bg-[#00ff66]/10"
                    iconBorder="border-[#00ff66]/20"
                    onClick={() => onTabChange?.('capture')}
                />
                <ActionButton
                    icon={Receipt}
                    label="Log Receipt"
                    description="Snap a photo of an expense"
                    delay={0.2}
                    disabled={false}
                    iconColor="text-[#FFC107]"
                    iconBg="bg-[#FFC107]/10"
                    iconBorder="border-[#FFC107]/20"
                    onClick={() => onTabChange?.('capture')}
                />
                <ActionButton
                    icon={Car}
                    label="Track Miles"
                    description="Gear run & $0.67/mi deduction"
                    delay={0.25}
                    disabled={false}
                    iconColor="text-[#FF5722]"
                    iconBg="bg-[#FF5722]/10"
                    iconBorder="border-[#FF5722]/20"
                    onClick={() => setShowMileageModal(true)}
                />
                <ActionButton
                    icon={ShoppingBag}
                    label="Order Merch"
                    description="Request stock via agent"
                    delay={0.3}
                    disabled={!isPaired}
                    iconColor="text-[#FFB300]"
                    iconBg="bg-[#FFB300]/10"
                    iconBorder="border-[#FFB300]/20"
                    onClick={() => onTabChange?.('capture')}
                />
                <ActionButton
                    icon={PenTool}
                    label="Legal Review"
                    description="Remote legal approvals are not wired up in mobile yet."
                    delay={0.4}
                    disabled
                    iconColor="text-[#90A4AE]"
                    iconBg="bg-[#455A64]/20"
                    iconBorder="border-[#455A64]/30"
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
                    "group relative overflow-hidden flex w-full items-center justify-between gap-4 p-5 rounded-[24px] border transition-all duration-300 text-left mt-4 font-sans",
                    isPaired
                        ? "bg-linear-to-r from-[#00ff66]/10 via-[#1a1512] to-amber-500/10 border-[#00ff66]/20 hover:border-[#00ff66]/40 shadow-[0_8px_30px_rgba(0,0,0,0.5)] cursor-pointer"
                        : "bg-[#181411]/60 border-white/5 opacity-50 cursor-not-allowed"
                )}
            >
                <div className="flex items-center gap-4 min-w-0">
                    <div className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0 border",
                        isPaired ? "bg-[#00ff66]/15 text-[#00ff66] border-[#00ff66]/25" : "bg-white/5 text-stone-500 border-white/5"
                    )}>
                        <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-stone-100 tracking-tight font-display">Talk to Boardroom</p>
                        <p className="text-[10px] text-stone-400 font-medium leading-tight mt-1">
                            Open the boardroom thread and message the seated agents directly.
                        </p>
                    </div>
                </div>
                <span className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.2em] font-mono",
                    isPaired ? "text-[#00ff66]" : "text-stone-500"
                )}>
                    Open
                </span>
            </motion.button>

            <motion.button
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.4 }}
                onClick={() => {
                    triggerHaptic(40);
                    onTabChange?.('road');
                }}
                className={cn(
                    "group relative overflow-hidden flex w-full items-center justify-between gap-4 p-5 rounded-[24px] border transition-all duration-300 text-left mt-4 font-sans",
                    "bg-linear-to-r from-[#FF5722]/10 via-[#1a1512] to-amber-500/10 border-[#FF5722]/20 hover:border-[#FF5722]/40 shadow-[0_8px_30px_rgba(0,0,0,0.5)] cursor-pointer"
                )}
            >
                <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0 bg-[#FF5722]/15 text-[#FF5722] border border-[#FF5722]/25">
                        <Navigation className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-stone-100 tracking-tight font-display">Road Mode</p>
                        <p className="text-[10px] text-stone-400 font-medium leading-tight mt-1">
                            Touring controls for today&apos;s stop, nearby fuel, food, lodging, and emergency support.
                        </p>
                    </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF5722] font-mono">
                    Open
                </span>
            </motion.button>

            {/* Basic Sync Indicator */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 px-5 py-4 rounded-[20px] bg-[#1a1512]/80 border border-white/10 backdrop-blur-xl flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        connectionStatus === 'connected' ? "bg-[#00ff66] shadow-[0_0_8px_rgba(0,255,102,0.6)] animate-pulse" :
                            isPaired ? "bg-amber-400" : "bg-red-400"
                    )} />
                    <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest font-mono">
                        {connectionStatus === 'connected' ? 'Studio Executor Active' :
                            isPaired ? 'Studio Standby' : 'Studio Disconnected'}
                    </span>
                </div>
                {isPaired && connectionStatus === 'connected' && (
                    <span className="text-[10px] font-mono font-bold text-[#00ff66]">SYNCED</span>
                )}
            </motion.div>

            {/* Mileage & Travel Expense Modal */}
            <MobileMileageModal
                isOpen={showMileageModal}
                onClose={() => setShowMileageModal(false)}
                isPaired={isPaired}
                onOpenReceiptCapture={() => onTabChange?.('capture')}
            />
        </div>
    );
}
