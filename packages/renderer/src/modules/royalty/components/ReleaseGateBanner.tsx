import React from 'react';
import { AlertTriangle, CircleAlert } from 'lucide-react';
import { RoyaltyProfile } from '../types';

interface ReleaseGateBannerProps {
    profile: RoyaltyProfile;
    scrollToSection: (sectionId: string) => void;
}

export const ReleaseGateBanner: React.FC<ReleaseGateBannerProps> = ({ profile, scrollToSection }) => {
    const isProActive = profile.proRegistration.status === 'active';
    const isMlcActive = profile.mlcRegistration.status === 'active';
    const isSoundExchangeActive = profile.soundExchangeRegistration.status === 'active';
    const hasCopyright = profile.copyrightRegistrations.some(r => r.status === 'active');

    const allComplete = isProActive && isMlcActive && isSoundExchangeActive && hasCopyright;

    // These registrations improve collection/enforcement coverage, but their
    // absence is not itself a legal or DDEX technical prohibition on release.
    if (allComplete) return null;

    return (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-lg shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-start">
            <div className="bg-amber-100 p-2 rounded-full flex-shrink-0 mt-1">
                <AlertTriangle className="w-6 h-6 text-amber-700" />
            </div>

            <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-900 mb-2">Royalty collection gaps</h3>
                <p className="text-amber-900 text-sm mb-4 leading-relaxed max-w-2xl">
                    You may continue to release, but these incomplete channels can delay matching, collection, or enforcement. Review the recommended registrations for your rights and territories:
                </p>

                <ul className="space-y-3 mb-5">
                    {!isProActive && (
                        <li className="flex items-center gap-3 text-amber-800 bg-amber-100/50 p-2 rounded-lg border border-amber-100">
                            <CircleAlert className="w-5 h-5 flex-shrink-0" />
                            <span className="font-medium text-sm">PRO membership/work registration not confirmed</span>
                        </li>
                    )}
                    {!isMlcActive && (
                        <li className="flex items-center gap-3 text-amber-800 bg-amber-100/50 p-2 rounded-lg border border-amber-100">
                            <CircleAlert className="w-5 h-5 flex-shrink-0" />
                            <span className="font-medium text-sm">MLC work registration not confirmed</span>
                        </li>
                    )}
                    {!isSoundExchangeActive && (
                        <li className="flex items-center gap-3 text-amber-800 bg-amber-100/50 p-2 rounded-lg border border-amber-100">
                            <CircleAlert className="w-5 h-5 flex-shrink-0" />
                            <span className="font-medium text-sm">SoundExchange recording enrollment not confirmed</span>
                        </li>
                    )}
                    {!hasCopyright && (
                        <li className="flex items-center gap-3 text-amber-800 bg-amber-100/50 p-2 rounded-lg border border-amber-100">
                            <CircleAlert className="w-5 h-5 flex-shrink-0" />
                            <span className="font-medium text-sm">U.S. Copyright Office registration not confirmed</span>
                        </li>
                    )}
                </ul>

                <button
                    onClick={() => scrollToSection('pro-registration')}
                    className="inline-flex items-center justify-center px-5 py-2.5 bg-amber-700 text-white font-medium text-sm rounded-lg hover:bg-amber-800 transition-colors shadow-sm"
                >
                    Review Collection Setup
                </button>
            </div>
        </div>
    );
};
