import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { initPWAInstall, showPWAInstall, canInstallPWA, isStandalone, haptic } from '@/lib/mobile';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * PWA Install Prompt
 * Shows a banner when the app can be installed as a PWA
 */
export const PWAInstallPrompt: React.FC = () => {
    const [canInstall, setCanInstall] = useState(false);
    const [dismissed, setDismissed] = useState(() => {
        // Checking standalone or previous dismissal during state initialization
        if (isStandalone()) return true;

        try {
            const dismissedTimestamp = localStorage.getItem('pwa-install-dismissed');
            if (dismissedTimestamp) {
                const timestamp = parseInt(dismissedTimestamp, 10);
                if (!isNaN(timestamp)) {
                    const daysSinceDismissal = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
                    // Show again after 7 days
                    return daysSinceDismissal < 7;
                }
            }
        } catch (error) {
            console.debug('[PWA] localStorage unavailable during init:', error);
        }
        return false;
    });

    useEffect(() => {
        // Only initialize PWA install prompt listeners here
        if (isStandalone()) return;

        // Initialize PWA install prompt
        initPWAInstall();

        // Listen for installable event
        const handleInstallable = () => {
            setCanInstall(canInstallPWA());
        };

        window.addEventListener('pwa-installable', handleInstallable);

        return () => {
            window.removeEventListener('pwa-installable', handleInstallable);
        };
    }, []);

    const handleInstall = async () => {
        haptic('medium');
        const accepted = await showPWAInstall();

        if (accepted) {
            haptic('success');
            setCanInstall(false);
        }
    };

    const handleDismiss = () => {
        haptic('light');
        setDismissed(true);

        // Save dismissal timestamp (with safe localStorage access)
        try {
            localStorage.setItem('pwa-install-dismissed', Date.now().toString());
        } catch (error) {
            // localStorage unavailable (private browsing, quota exceeded, etc.)
            // Silently ignore - user dismissed the prompt in memory
            console.debug('[PWA] localStorage unavailable, dismissal not persisted:', error);
        }
    };

    // Don't show if can't install, dismissed, or already standalone
    if (!canInstall || dismissed || isStandalone()) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[100]"
            >
                <div className="bg-gradient-to-br from-neon-blue/10 to-neon-purple/10 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
                    {/* Close Button */}
                    <button
                        onClick={handleDismiss}
                        className="absolute top-2 right-2 p-1.5 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
                        aria-label="Dismiss"
                    >
                        <X size={16} className="text-white/60" />
                    </button>

                    <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-neon-blue to-neon-purple rounded-xl flex items-center justify-center">
                            <Download size={24} className="text-white" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 pr-6">
                            <h3 className="text-white font-semibold text-sm mb-1">
                                Install indiiOS
                            </h3>
                            <p className="text-white/60 text-xs mb-3 leading-relaxed">
                                Add to your home screen for faster access and offline support
                            </p>

                            {/* Install Button */}
                            <button
                                onClick={handleInstall}
                                className="w-full px-4 py-2 bg-gradient-to-r from-neon-blue to-neon-purple text-white text-sm font-medium rounded-xl hover:opacity-90 active:scale-95 transition-all"
                            >
                                Install Now
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
