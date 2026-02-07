import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { BiometricService } from '@/services/security/BiometricService';
import { Lock, Fingerprint, ScanFace } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BiometricGateProps {
    children: React.ReactNode;
}

export function BiometricGate({ children }: BiometricGateProps) {
    const { userProfile } = useStore(useShallow(state => ({
        userProfile: state.userProfile,
        // updatePreferences: state.updatePreferences // Not needed in Gate for now
    })));

    const isBiometricEnabled = userProfile?.preferences?.biometricEnabled ?? false;

    // Track verification state - derive isLocked from enabled + verified
    const [isVerified, setIsVerified] = useState(false);
    const [isAvailable, setIsAvailable] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);

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
            } else {
                setVerificationError('Biometric verification failed. Please try again.');
            }
        } catch (error) {
            setVerificationError('An error occurred during verification.');
            console.error(error);
        }
    };

    // Auto-prompt for unlocking on mount if locked and available
    useEffect(() => {
        if (isLocked && isAvailable) {
            handleUnlock();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAvailable]);

    // Fallback unlock (e.g. if biometrics fail repeatedly or aren't actually available but flag is set)
    // PRO TIP: In a real banking app, this would fallback to password/pin.
    // For this alpha, we might want a "Sign Out" option if they are stuck.

    if (!isBiometricEnabled || !isLocked) {
        return <>{children}</>;
    }

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

                        <div className="flex flex-col gap-4 w-full">
                            <button
                                onClick={handleUnlock}
                                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                            >
                                <ScanFace size={20} />
                                <span>Unlock with FaceID</span>
                            </button>

                            {/* Emergency Escape Hatch - Logout */}
                            {/*  This requires accessing logout from store, which allows them to re-login with password */}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
