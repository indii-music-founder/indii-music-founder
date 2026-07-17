import React from 'react';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { RoyaltyProfile } from '../types';
import { calculateProgress } from '../types';

interface ActionPanelProps {
    profile: RoyaltyProfile;
    onComplete?: () => void;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ profile, onComplete }) => {
    const isProActive = profile.proRegistration.status === 'active';
    const isMlcActive = profile.mlcRegistration.status === 'active';
    const isSoundExchangeActive = profile.soundExchangeRegistration.status === 'active';
    const hasCopyright = profile.copyrightRegistrations.some(r => r.status === 'active');

    const royaltyCoverageComplete = isProActive && isMlcActive && isSoundExchangeActive && hasCopyright;

    // Progress for partial readiness message
    const { completed, total } = calculateProgress(profile);

    // Identify what's missing
    const missing: string[] = [];
    if (!isProActive) missing.push('PRO registration');
    if (!isMlcActive) missing.push('MLC registration');
    if (!isSoundExchangeActive) missing.push('SoundExchange registration');
    if (!hasCopyright) missing.push('copyright registrations');

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.05)] border-t border-gray-100 p-4 md:p-6 z-40 transition-all duration-300">
            <div className="max-w-4xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-4">

                <div className="order-2 md:order-1 flex-1" />

                {/* Action Button & Status */}
                <div className="order-1 md:order-2 flex flex-col items-center md:items-end w-full md:w-auto">
                    {royaltyCoverageComplete ? (
                        <div className="flex flex-col items-center md:items-end gap-1">
                            <span className="text-sm font-medium text-green-600">Royalty collection coverage complete</span>
                            <button
                                onClick={onComplete}
                                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
                            >
                                <span>Go to Dashboard</span>
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center md:items-end gap-2 w-full">
                            <div className="flex items-center gap-2 text-amber-700">
                                <AlertCircle className="w-5 h-5" />
                                <span className="text-sm font-medium">Royalty coverage incomplete ({completed}/{total})</span>
                            </div>
                            <span className="text-xs text-gray-600 text-center md:text-right">
                                Recommended next: {missing.join(', ')}
                            </span>
                            <button
                                onClick={onComplete}
                                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
                            >
                                <span>Go to Dashboard</span>
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
