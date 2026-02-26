import React from 'react';
import { useStore } from '@/core/store';
import { RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface SidecarStatusProps {
    collapsed?: boolean;
}

export const SidecarStatus: React.FC<SidecarStatusProps> = ({ collapsed }) => {
    const sidecarStatus = useStore((state) => state.sidecarStatus);
    const triggerSidecarRestart = useStore((state) => state.triggerSidecarRestart);


    const config = {
        online: {
            icon: ShieldCheck,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
            label: 'Sidecar Online'
        },
        offline: {
            icon: ShieldAlert,
            color: 'text-rose-500',
            bg: 'bg-rose-500/10',
            label: 'Sidecar Offline'
        },
        checking: {
            icon: RefreshCw,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            label: 'Checking...'
        }
    };

    const current = config[sidecarStatus] || config.checking;
    const Icon = current.icon;

    return (
        <div className={cn(
            "flex items-center gap-2 rounded-lg bg-card/50 border border-border/50 transition-all duration-300",
            collapsed ? "p-1 justify-center" : "px-3 py-2"
        )}>
            <div className={cn("p-1.5 rounded-full transition-colors", current.bg)} title={collapsed ? current.label : undefined}>
                <Icon
                    size={14}
                    className={cn(
                        current.color,
                        sidecarStatus === 'checking' && "animate-spin"
                    )}
                />
            </div>

            {!collapsed && (
                <>
                    <div className="flex flex-col min-w-[70px]">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground leading-none">
                            Agent Zero
                        </span>
                        <span className={cn("text-xs font-medium leading-tight mt-0.5", current.color)}>
                            {current.label}
                        </span>
                    </div>

                    {sidecarStatus === 'offline' && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={triggerSidecarRestart}
                            className="ml-auto p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors group"
                            title="Restart Sidecar"
                        >
                            <RefreshCw size={12} className="group-active:animate-spin" />
                        </motion.button>
                    )}
                </>
            )}
        </div>
    );

};
