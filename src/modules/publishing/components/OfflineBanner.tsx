import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * OfflineBanner component
 * Phase 1.4: Offline Support
 */
export const OfflineBanner: React.FC = () => {
    const isOnline = useOnlineStatus();
    // Initialize state based on current status to avoid first-render effect update
    const [showNotification, setShowNotification] = useState(!isOnline);

    useEffect(() => {
        if (!isOnline) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (!showNotification) setShowNotification(true);
        } else {
            // Keep showing for a few seconds after coming back online to show "syncing" state
            // Only set timeout if we are currently showing notification
            if (showNotification) {
                const timer = setTimeout(() => setShowNotification(false), 3000);
                return () => clearTimeout(timer);
            }
        }
    }, [isOnline, showNotification]);

    return (
        <AnimatePresence>
            {showNotification && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-4"
                >
                    <div className={`flex items-center gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-md ${isOnline
                        ? 'bg-green-500/10 border-green-500/20 text-green-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}>
                        <div className={`p-2 rounded-xl ${isOnline ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
                            {isOnline ? <RefreshCw className="w-5 h-5 animate-spin" /> : <WifiOff className="w-5 h-5" />}
                        </div>

                        <div className="flex-1">
                            <p className="text-sm font-bold">
                                {isOnline ? 'Back Online' : 'Offline Mode'}
                            </p>
                            <p className="text-xs opacity-70">
                                {isOnline
                                    ? 'Synchronizing local changes with the cloud...'
                                    : 'You are working offline. Changes will sync when reconnected.'}
                            </p>
                        </div>

                        {!isOnline && (
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
