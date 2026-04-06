import React from 'react';
import { Clock } from 'lucide-react';
import { RoyaltyProfile, calculateProgress } from '../types';

interface ChecklistHeaderProps {
    profile: RoyaltyProfile;
}

export const ChecklistHeader: React.FC<ChecklistHeaderProps> = ({ profile }) => {
    const { completed, total } = calculateProgress(profile);

    // Progress ratio 0 - 100
    const _progressRatio = Math.round((completed / total) * 100);

    const getSegmentColor = (index: number) => {
        // Determine status of each segment manually 
        // 0: PRO, 1: SoundExchange, 2: MLC, 3: Copyright
        let status = 'not_started';
        if (index === 0) status = profile.proRegistration.status;
        if (index === 1) status = profile.soundExchangeRegistration.status;
        if (index === 2) status = profile.mlcRegistration.status;
        if (index === 3) status = profile.copyrightRegistrations.length > 0 ? profile.copyrightRegistrations[0]!.status : 'not_started';

        if (status === 'active') return 'bg-green-500';
        if (status === 'in_progress') return 'bg-yellow-500 animate-pulse';
        return 'bg-gray-200';
    };

    return (
        <div className="p-6 bg-gradient-to-br from-indigo-50 to-white border border-gray-200 rounded-xl shadow-sm mb-6">
            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Royalty Collection Setup</h2>
                    <p className="text-gray-600">Complete these registrations to ensure you collect all royalties from your music.</p>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500 bg-white/60 px-3 py-1.5 rounded-full border border-gray-100">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <span className="font-medium">About 45 minutes total</span>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-medium text-gray-500 mb-1">
                    <span>Overall Progress</span>
                    <span>{completed} of {total} complete</span>
                </div>

                <div className="flex gap-1 h-3 w-full">
                    {[0, 1, 2, 3].map((index) => (
                        <div
                            key={index}
                            className={`flex-1 rounded-full transition-colors duration-500 ${getSegmentColor(index)}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
