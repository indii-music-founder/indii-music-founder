import { useState, useEffect } from 'react';
import { ShieldOff, Shield, ExternalLink } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';

/**
 * Item 304: CCPA "Do Not Sell My Data" Opt-Out
 *
 * Provides a toggle for California residents to opt out of data sharing.
 * Writes `privacyPreferences.doNotSell` to the user's Firestore profile.
 * When enabled, suppresses analytics and third-party data sharing.
 *
 * This component is designed to be embedded in a Settings or Privacy page.
 */

export function DoNotSellToggle() {
    const { user } = useStore(useShallow(state => ({
        user: state.user
    })));
    const [doNotSell, setDoNotSell] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Load initial preference from Firestore (via user profile)
    useEffect(() => {
        if (!user?.uid) return;

        const loadPreference = async () => {
            try {
                const { getDoc } = await import('firebase/firestore');
                const userRef = doc(db, 'users', user.uid);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setDoNotSell(data?.privacyPreferences?.doNotSell === true);
                }
            } catch (error: unknown) {
                logger.error('[CCPA] Failed to load privacy preferences', error);
            }
        };

        loadPreference();
    }, [user?.uid]);

    const handleToggle = async (newValue: boolean) => {
        if (!user?.uid) return;

        setDoNotSell(newValue);
        setSaving(true);
        setSaved(false);

        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                'privacyPreferences.doNotSell': newValue,
                'privacyPreferences.updatedAt': new Date().toISOString(),
            });
            setSaved(true);
            logger.info(`[CCPA] Do Not Sell preference set to: ${newValue}`);

            // Auto-clear the "saved" indicator after 2 seconds
            setTimeout(() => setSaved(false), 2000);
        } catch (error: unknown) {
            logger.error('[CCPA] Failed to save privacy preferences', error);
            // Revert on failure
            setDoNotSell(!newValue);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-start gap-4">
                <div className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full shrink-0',
                    doNotSell ? 'bg-green-500/10' : 'bg-gray-700'
                )}>
                    {doNotSell ? (
                        <Shield className="w-5 h-5 text-green-400" />
                    ) : (
                        <ShieldOff className="w-5 h-5 text-gray-400" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white mb-1">
                        Do Not Sell or Share My Personal Information
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed mb-3">
                        Under the California Consumer Privacy Act (CCPA), California residents
                        have the right to opt out of the sale or sharing of their personal information.
                        When enabled, we will not share your data with third-party services for
                        advertising or analytics purposes.
                    </p>

                    <div className="flex items-center gap-3">
                        <button
                            role="switch"
                            type="button"
                            aria-checked={doNotSell}
                            aria-label="Do Not Sell My Data"
                            disabled={saving}
                            onClick={() => handleToggle(!doNotSell)}
                            className={cn(
                                'relative w-12 h-6 rounded-full transition-colors duration-200',
                                doNotSell ? 'bg-green-600' : 'bg-gray-600',
                                saving && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            <span
                                className={cn(
                                    'absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm',
                                    doNotSell ? 'translate-x-6' : 'translate-x-0.5'
                                )}
                            />
                        </button>

                        <span className={cn(
                            'text-xs font-medium transition-colors',
                            doNotSell ? 'text-green-400' : 'text-gray-500'
                        )}>
                            {doNotSell ? 'Opted Out' : 'Not Opted Out'}
                        </span>

                        {saved && (
                            <span className="text-xs text-green-400 animate-in fade-in-0">
                                ✓ Saved
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Legal link */}
            <div className="mt-4 pt-3 border-t border-gray-700/50">
                <a
                    href="/legal/privacy"
                    className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                    <ExternalLink className="w-3 h-3" />
                    View Privacy Policy
                </a>
            </div>
        </div>
    );
}
