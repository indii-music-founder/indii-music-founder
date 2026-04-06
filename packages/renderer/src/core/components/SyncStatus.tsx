import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { events } from '@/core/events';

export interface SyncStatusProps {
    collapsed?: boolean;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ collapsed }) => {
    const {
        pendingCount,
        isSyncing,
        lastSyncError,
        setPendingCount,
        setIsSyncing,
        setLastSyncError
    } = useStore(useShallow(state => ({
        pendingCount: state.pendingCount,
        isSyncing: state.isSyncing,
        lastSyncError: state.lastSyncError,
        setPendingCount: state.setPendingCount,
        setIsSyncing: state.setIsSyncing,
        setLastSyncError: state.setLastSyncError
    })));

    useEffect(() => {
        // Initial count
        import('@/services/persistence/MetadataPersistenceService').then(m => {
            setPendingCount?.(m.metadataPersistenceService.getPendingCount());
        });

        // Listen for changes
        const unsubscribe = events.on<{ count: number; error?: string | null; syncing?: boolean }>('SYNC_QUEUE_CHANGE', (data) => {
            setPendingCount?.(data.count);
            if (data.error !== undefined) setLastSyncError?.(data.error);
            if (data.syncing !== undefined) setIsSyncing?.(data.syncing);
        });

        return unsubscribe;
    }, [setPendingCount, setIsSyncing, setLastSyncError]);

    if (pendingCount === 0 && !isSyncing && !lastSyncError) {
        return (
            <div role="status" aria-live="polite" aria-label="Sync status: all changes saved" className={cn(
                "flex items-center gap-2 rounded-lg bg-card/50 border border-border/50 text-zinc-500 transition-all duration-300",
                collapsed ? "p-1 justify-center" : "px-3 py-2"
            )}>
                <div className="p-1.5 rounded-full bg-emerald-500/10">
                    <CheckCircle2 size={14} className="text-emerald-500/70" />
                </div>
                {!collapsed && (
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground leading-none">
                            Status
                        </span>
                        <span className="text-xs font-medium leading-tight mt-0.5 text-emerald-500/70">
                            Cloud Synced
                        </span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <motion.div
            role="status"
            aria-live="polite"
            aria-label={isSyncing ? 'Syncing changes' : lastSyncError ? 'Sync error' : `${pendingCount} changes pending sync`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "flex items-center gap-2 rounded-lg transition-all duration-300",
                lastSyncError ? "bg-red-500/10 border border-red-500/50" : "bg-card/50 border border-border/50",
                collapsed ? "p-1 justify-center" : "px-3 py-2"
            )}
        >
            <div
                className={cn(
                    "p-1.5 rounded-full",
                    lastSyncError ? "bg-red-500/20" : isSyncing ? "bg-blue-500/10" : "bg-amber-500/10"
                )}
                title={collapsed ? (isSyncing ? 'Syncing...' : lastSyncError ? 'Sync Error' : `${pendingCount} items pending`) : undefined}
            >
                {isSyncing ? (
                    <RefreshCw size={14} className="text-blue-500 animate-spin" />
                ) : lastSyncError ? (
                    <CloudOff size={14} className="text-red-500" />
                ) : (
                    <Cloud size={14} className="text-amber-500" />
                )}
            </div>

            {!collapsed && (
                <>
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground leading-none">
                            Sync Queue
                        </span>
                        <span className={cn(
                            "text-xs font-medium leading-tight mt-0.5",
                            lastSyncError ? "text-red-500" : isSyncing ? "text-blue-500" : "text-amber-500"
                        )}>
                            {isSyncing ? 'Syncing...' : lastSyncError ? 'Sync Error' : `${pendingCount} items pending`}
                        </span>
                    </div>

                    {pendingCount > 0 && !isSyncing && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                                import('@/services/persistence/MetadataPersistenceService').then(m => {
                                    m.metadataPersistenceService.processQueue();
                                });
                            }}
                            className="ml-auto p-1.5 rounded-md hover:bg-white/10 text-muted-foreground transition-colors"
                            title="Force Sync"
                        >
                            <RefreshCw size={12} />
                        </motion.button>
                    )}
                </>
            )}
        </motion.div>
    );
};
