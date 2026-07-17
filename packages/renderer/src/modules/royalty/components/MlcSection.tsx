import React from 'react';
import { FileMusic, ExternalLink, CheckCircle } from 'lucide-react';
import { RegistrationSection } from './RegistrationSection';
import { RoyaltyProfile } from '../types';

interface MlcSectionProps {
    profile: RoyaltyProfile;
    isExpanded: boolean;
    onToggle: () => void;
    onGoToPro?: () => void;
}

export const MlcSection: React.FC<MlcSectionProps> = ({
    profile,
    isExpanded,
    onToggle
}) => {
    const { status, registeredWorks } = profile.mlcRegistration;

    return (
        <RegistrationSection
            id="mlc-registration"
            icon={<FileMusic className="w-6 h-6" />}
            title="Mechanical Licensing Collective (MLC)"
            subtitle="Collect mechanical royalties directly from streaming services (Spotify, Apple Music) in the US"
            status={status}
            isRequired={false}
            isExpanded={isExpanded}
            onToggle={onToggle}
        >
            {status === 'not_started' && (
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
                    <h4 className="font-semibold text-gray-900">Why the MLC matters</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Streaming services pay mechanical royalties to the Mechanical Licensing Collective.
                        <strong> If you are an independent releasing your own music, you act as your own publisher.</strong>
                        Accurate writer, publisher, and IPI/CAE data helps the MLC match usage and route U.S. digital mechanical royalties to the correct party.
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
