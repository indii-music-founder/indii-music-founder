import React, { useEffect, useState } from 'react';
import { Fingerprint, Lock, Unlock, AlertCircle, Loader2 } from 'lucide-react';
import { useStore } from '../../store';
import { useShallow } from 'zustand/react/shallow';
import { BiometricService } from '@/services/security/BiometricService';
import {
import { logger } from '@/utils/logger';
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export function BiometricToggle() {
    const { userProfile, updatePreferences } = useStore(useShallow(state => ({
        userProfile: state.userProfile,
        updatePreferences: state.updatePreferences
    })));

    const [isAvailable, setIsAvailable] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const isEnabled = userProfile?.preferences?.biometricEnabled ?? false;

    useEffect(() => {
        BiometricService.isAvailable().then(setIsAvailable);
    }, []);

    const handleToggle = async () => {
        setError(null);
        setIsLoading(true);

        try {
            if (!isEnabled) {
                // Turning ON: Must register/verify
                const success = await BiometricService.register(
                    userProfile.uid,
                    userProfile.displayName || 'User'
                );

                if (success) {
                    updatePreferences({ biometricEnabled: true });
                } else {
                    setError('Failed to setup biometrics. Please try again.');
                }
            } else {
                // Turning OFF: Just disable
                updatePreferences({ biometricEnabled: false });
            }
        } catch (err) {
            logger.error('Biometric toggle error:', err);
            setError('An error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAvailable) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 p-2 rounded-md bg-white/5 opacity-50 cursor-not-allowed">
                            <Fingerprint size={16} className="text-gray-500" />
                            <span className="text-xs text-gray-500 font-medium">Biometrics Unavailable</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Your device does not support biometric authentication.</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handleToggle}
                disabled={isLoading}
                className={`
                    relative flex items-center justify-between w-full p-2 rounded-md border
                    transition-all duration-200
                    ${isEnabled
                        ? 'bg-dept-security/10 border-dept-security/30 hover:bg-dept-security/20'
                        : 'bg-white/5 border-white/5 hover:bg-white/10'
                    }
                    ${error ? 'border-red-500/50' : ''}
                `}
                title={isEnabled ? "Disable Biometric Gate" : "Enable Biometric Gate"}
            >
                <div className="flex items-center gap-2">
                    {isLoading ? (
                        <Loader2 size={16} className="text-dept-security animate-spin" />
                    ) : (
                        <Fingerprint size={16} className={isEnabled ? 'text-dept-security' : 'text-gray-400'} />
                    )}
                    <span className={`text-xs font-medium ${isEnabled ? 'text-dept-security' : 'text-gray-400'}`}>
                        Privacy Gate
                    </span>
                </div>

                <div className={`
                    w-8 h-4 rounded-full p-0.5 transition-colors duration-200
                    ${isEnabled ? 'bg-dept-security' : 'bg-gray-700'}
                `}>
                    <div className={`
                        w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200
                        ${isEnabled ? 'translate-x-4' : 'translate-x-0'}
                    `} />
                </div>
            </button>

            {error && (
                <div className="flex items-center gap-1.5 px-2 text-[10px] text-red-400 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle size={10} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
