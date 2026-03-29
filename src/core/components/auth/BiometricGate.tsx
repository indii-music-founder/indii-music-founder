import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { BiometricService } from '@/services/security/BiometricService';
import { Lock, ScanFace, LogOut, ShieldOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logger } from '@/utils/logger';

interface BiometricGateProps {
    children: React.ReactNode;
}

export function BiometricGate({ children }: BiometricGateProps) {
    // DEV MODE BYPASS: Immediately skip ALL biometric logic in development.
    // This must be the first check — before hooks — so that WebAuthn dialogs
    // never fire during automated testing or local development.
    // In production builds, Vite tree-shakes this entire branch away.
    if (import.meta.env.DEV) {
        return <>{children}</>;
    }

    /* eslint-disable react-hooks/rules-of-hooks -- Conditional is compile-time constant */
    const { userProfile, updatePreferences, logout } = useStore(useShallow(state => ({
        userProfile: state.userProfile,
        updatePreferences: state.updatePreferences,
        logout: state.logout,
    })));

    const isBiometricEnabled = userProfile?.preferences?.biometricEnabled ?? false;

    // Track verification state - derive isLocked from enabled + verified
    const [isVerified, setIsVerified] = useState(false);
    const [isAvailable, setIsAvailable] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [failCount, setFailCount] = useState(0);

    // Derive lock state: locked only when biometric is enabled AND not yet verified
    const isLocked = isBiometricEnabled && !isVerified;

    // Effect to check availability on mount
    useEffect(() => {
        BiometricService.isAvailable().then(setIsAvailable);
    }, []);

    const handleUnlock = async () => {
        setVerificationError(null);
        try {
            const success = await BiometricService.verify();
            if (success) {
                setIsVerified(true);
                setFailCount(0);
            } else {
                setFailCount(prev => prev + 1);
                setVerificationError('Biometric verification failed. Please try again.');
            }
        } catch (error: unknown) {
            setFailCount(prev => prev + 1);
            setVerificationError('An error occurred during verification.');
            logger.error("Operation failed:", error);
        }
    };

    const handleSkipBiometrics = () => {
        // Disable biometric lock so the user isn't trapped
        updatePreferences({ biometricEnabled: false });
        setIsVerified(true);
        logger.info('[BiometricGate] User skipped biometrics — preference disabled.');
    };

    const handleSignOut = async () => {
        try {
            await logout();
        } catch (error: unknown) {
            logger.error('[BiometricGate] Logout failed:', error);
            // Force reload as fallback
            window.location.reload();
        }
    };

    // Auto-prompt for unlocking on mount if locked and available
    useEffect(() => {
        if (isLocked && isAvailable) {
            handleUnlock();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAvailable]);

    if (!isBiometricEnabled || !isLocked) {
        return <>{children}</>;
    }

    // Show escape hatches after 1 failed attempt or if biometrics aren't available
    const showEscapeHatch = failCount >= 1 || !isAvailable;

    return (
        <AnimatePresence>
            {isLocked && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md"
                >
                    <div className="flex flex-col items-center gap-6 p-8 max-w-sm text-center">
                        <div className="p-4 bg-primary/10 rounded-full text-primary">
                            <Lock size={48} />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight">Locked</h2>
                            <p className="text-muted-foreground">
                                Verify your identity to access indiiOS
                            </p>
                        </div>

                        {verificationError && (
                            <p className="text-sm text-destructive font-medium">{verificationError}</p>
                        )}

                        <div className="flex flex-col gap-3 w-full">
                            {/* Primary: Biometric Unlock */}
                            <button
                                onClick={handleUnlock}
                                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                            >
                                <ScanFace size={20} />
                                <span>Unlock with FaceID</span>
                            </button>

                            {/* Escape Hatches — shown after a failed attempt or if biometrics unavailable */}
                            {showEscapeHatch && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="flex flex-col gap-2 pt-2 border-t border-white/10"
                                >
                                    <p className="text-xs text-muted-foreground mb-1">
                                        {!isAvailable
                                            ? "Biometrics not available on this device."
                                            : "Having trouble? You can continue without biometrics."}
                                    </p>

                                    <button
                                        onClick={handleSkipBiometrics}
                                        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-sm font-medium text-white transition-colors"
                                    >
                                        <ShieldOff size={16} />
                                        <span>Continue without biometrics</span>
                                    </button>

                                    <button
                                        onClick={handleSignOut}
                                        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 hover:bg-red-500/10 rounded-lg text-sm font-medium text-red-400 transition-colors"
                                    >
                                        <LogOut size={16} />
                                        <span>Sign Out</span>
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
