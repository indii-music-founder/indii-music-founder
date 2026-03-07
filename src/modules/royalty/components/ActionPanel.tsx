import React from 'react';
import { MessageCircle, ArrowRight } from 'lucide-react';
import { RoyaltyProfile } from '../types';

interface ActionPanelProps {
    profile: RoyaltyProfile;
    onComplete?: () => void;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ profile, onComplete }) => {
    // Check if all required items are complete
    const isProComplete = profile.proRegistration.status === 'active';

    // Hard blocker is PRO. The rest are optional/recommended
    const canContinue = isProComplete;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.05)] border-t border-gray-100 p-4 md:p-6 z-40 transition-all duration-300">
            <div className="max-w-4xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-4">

                {/* Helper Link */}
                <div className="order-2 md:order-1 flex-1 flex justify-center md:justify-start">
                    <button className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                        <MessageCircle className="w-5 h-5" />
                        <span>Need help? Chat with Publishing Agent</span>
                    </button>
                </div>

                {/* Action Button & Status */}
                <div className="order-1 md:order-2 flex flex-col items-center md:items-end w-full md:w-auto">
                    {canContinue ? (
                        <div className="flex flex-col items-center md:items-end gap-1">
                            <span className="text-sm font-medium text-green-600">You're ready to release music!</span>
                            <button
                                onClick={onComplete}
                                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
                            >
                                <span>Go to Dashboard</span>
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center md:items-end gap-1 w-full">
                            <span className="text-sm font-medium text-gray-500">Complete PRO registration to enable releases</span>
                            <button
                                disabled
                                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-gray-200 text-gray-400 font-semibold rounded-xl cursor-not-allowed transition-colors"
                                aria-disabled="true"
                            >
                                <span>Continue Setup</span>
                                <ArrowRight className="w-5 h-5 opacity-50" />
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
