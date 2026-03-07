import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { WifiOff, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Global banner displayed when the application is offline.
 * Indicates pending syncs if any exist.
 */
export function OfflineBanner() {
    const { isOffline, pendingCount } = useStore(
        useShallow(state => ({
            isOffline: state.isOffline,
            pendingCount: state.pendingCount
        }))
    );

    return (
        <AnimatePresence>
            {isOffline && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] w-fit max-w-[90vw]"
                >
                    <div className="bg-amber-600/90 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-3 border border-amber-400/50">
                        <WifiOff className="w-4 h-4" />
                        <span className="text-sm font-medium">Working Offline</span>

                        {pendingCount > 0 && (
                            <div className="flex items-center gap-1.5 ml-1 border-l border-amber-400/40 pl-3">
                                <AlertCircle className="w-4 h-4 text-amber-200" />
                                <span className="text-xs font-semibold">{pendingCount} syncs pending</span>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
