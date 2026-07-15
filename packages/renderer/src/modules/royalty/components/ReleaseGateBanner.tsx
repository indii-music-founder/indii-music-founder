import React from 'react';
import { AlertOctagon, XCircle, AlertCircle } from 'lucide-react';
import { RoyaltyProfile } from '../types';

interface ReleaseGateBannerProps {
    profile: RoyaltyProfile;
    scrollToSection: (sectionId: string) => void;
}

export const ReleaseGateBanner: React.FC<ReleaseGateBannerProps> = ({ profile, scrollToSection }) => {
    // All four items required for release (not just PRO)
    const isProActive = profile.proRegistration.status === 'active';
    const isMlcActive = profile.mlcRegistration.status === 'active';
    const isSoundExchangeActive = profile.soundExchangeRegistration.status === 'active';
    const hasCopyright = profile.copyrightRegistrations.some(r => r.status === 'active');

    const allComplete = isProActive && isMlcActive && isSoundExchangeActive && hasCopyright;

    // If all requirements met, don't show blocker banner
    if (allComplete) return null;

    return (
        <div className="bg-red-50 border-l-4 border-red-500 p-5 rounded-lg shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-start">
            <div className="bg-red-100 p-2 rounded-full flex-shrink-0 mt-1">
                <AlertOctagon className="w-6 h-6 text-red-600" />
            </div>

            <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900 mb-2">Release Blocked</h3>
                <p className="text-red-800 text-sm mb-4 leading-relaxed max-w-2xl">
                    You cannot schedule an audio release yet. Your royalty collection pipeline is incomplete. Complete ALL of the following required registrations to proceed:
                </p>

                <ul className="space-y-3 mb-5">
                    {!isProActive && (
                        <li className="flex items-center gap-3 text-red-700 bg-red-100/50 p-2 rounded-lg border border-red-100">
                            <XCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="font-medium text-sm">PRO registration (BMI/ASCAP/SESAC) is Required</span>
                        </li>
                    )}
                    {!isMlcActive && (
                        <li className="flex items-center gap-3 text-red-700 bg-red-100/50 p-2 rounded-lg border border-red-100">
                            <XCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="font-medium text-sm">MLC registration (Mechanical licenses) is Required</span>
                        </li>
                    )}
                    {!isSoundExchangeActive && (
                        <li className="flex items-center gap-3 text-red-700 bg-red-100/50 p-2 rounded-lg border border-red-100">
                            <XCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="font-medium text-sm">SoundExchange registration (Neighboring rights) is Required</span>
                        </li>
                    )}
                    {!hasCopyright && (
                        <li className="flex items-center gap-3 text-red-700 bg-red-100/50 p-2 rounded-lg border border-red-100">
                            <XCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="font-medium text-sm">Copyright registration for at least one work is Required</span>
                        </li>
                    )}
                </ul>

                <button
                    onClick={() => scrollToSection('pro-registration')}
                    className="inline-flex items-center justify-center px-5 py-2.5 bg-red-600 text-white font-medium text-sm rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                >
                    Fix Incomplete Items
                </button>
            </div>
        </div>
    );
};
