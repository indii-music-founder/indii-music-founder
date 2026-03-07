import React from 'react';
import { FileMusic, Lock, ExternalLink, CheckCircle } from 'lucide-react';
import { RegistrationSection } from './RegistrationSection';
import { RoyaltyProfile, RegistrationStatus } from '../types';

interface MlcSectionProps {
    profile: RoyaltyProfile;
    isExpanded: boolean;
    onToggle: () => void;
    onGoToPro?: () => void;
}

export const MlcSection: React.FC<MlcSectionProps> = ({
    profile,
    isExpanded,
    onToggle,
    onGoToPro
}) => {
    const { status, registeredWorks } = profile.mlcRegistration;
    const proStatus = profile.proRegistration.status;

    // Calculate if the MLC section is blocked by an incomplete PRO registration
    const isBlockedByPro = proStatus === 'not_started' || proStatus === 'in_progress';
    const displayStatus: RegistrationStatus = isBlockedByPro && status !== 'active' ? 'blocked' : status;

    return (
        <RegistrationSection
            id="mlc-registration"
            icon={<FileMusic className="w-6 h-6" />}
            title="Mechanical Licensing Collective (MLC)"
            subtitle="Collect mechanical royalties directly from streaming services (Spotify, Apple Music) in the US"
            status={displayStatus}
            isRequired={false}
            isExpanded={isExpanded}
            onToggle={onToggle}
        >
            {isBlockedByPro && status !== 'active' && (
                <div className="bg-gray-100 border border-gray-200 p-5 rounded-xl shadow-sm text-center">
                    <div className="mx-auto bg-gray-200 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                        <Lock className="w-5 h-5 text-gray-500" />
                    </div>
                    <h4 className="text-gray-900 font-semibold mb-2">Complete PRO registration first</h4>
                    <p className="text-sm text-gray-600 mb-5 max-w-sm mx-auto">
                        The MLC requires your IPI number from your Performance Rights Organization (PRO) registration to identify you accurately.
                    </p>
                    <button
                        onClick={onGoToPro}
                        className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium rounded-lg transition-colors shadow-sm"
                    >
                        Go to PRO Registration
                    </button>
                </div>
            )}

            {!isBlockedByPro && status === 'not_started' && (
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
                    <h4 className="font-semibold text-gray-900">Why the MLC matters</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Streaming services pay mechanical royalties to the Mechanical Licensing Collective.
                        <strong> If you are an independent releasing your own music, you act as your own publisher.</strong>
                        If you're not registered with the MLC, that mechanical money goes unmatched and eventually gets paid out to major publishers based on market share.
                    </p>
                    <div className="pt-2">
                        <a
                            href="https://www.themlc.com/"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition-colors shadow-sm"
                        >
                            <span>Register with MLC</span>
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            )}

            {status === 'active' && (
                <div className="flex items-start gap-4 p-5 bg-green-50/50 rounded-xl border border-green-100">
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                    <div className="flex-1">
                        <h4 className="text-gray-900 font-semibold mb-1">MLC Registration Active</h4>
                        <p className="text-sm text-gray-600 mb-4">Your IPI number is successfully linked to your MLC publisher account.</p>
                        <div className="inline-flex items-center gap-2 text-sm bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-gray-700">
                            <FileMusic className="w-4 h-4 text-sky-500" />
                            <span className="font-bold">Works claimed:</span> {registeredWorks}
                        </div>
                    </div>
                    <a
                        href="https://portal.themlc.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium rounded-lg transition-colors shadow-sm"
                    >
                        Manage
                    </a>
                </div>
            )}
        </RegistrationSection>
    );
};
