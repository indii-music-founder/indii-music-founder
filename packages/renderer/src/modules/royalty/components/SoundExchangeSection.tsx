import React from 'react';
import { Radio, HeartHandshake, ExternalLink, CheckCircle } from 'lucide-react';
import { RegistrationSection } from './RegistrationSection';
import { RoyaltyProfile } from '../types';

interface SoundExchangeSectionProps {
    profile: RoyaltyProfile;
    isExpanded: boolean;
    onToggle: () => void;
}

export const SoundExchangeSection: React.FC<SoundExchangeSectionProps> = ({
    profile,
    isExpanded,
    onToggle
}) => {
    const { status, registeredTracks } = profile.soundExchangeRegistration;

    return (
        <RegistrationSection
            id="soundexchange-registration"
            icon={<Radio className="w-6 h-6" />}
            title="SoundExchange"
            subtitle="Collect digital performance royalties from Pandora, SiriusXM, web radio"
            status={status}
            isRequired={false}
            isExpanded={isExpanded}
            onToggle={onToggle}
        >
            {status === 'not_started' && (
                <div className="space-y-6">
                    <div className="bg-white border text-gray-800 p-5 rounded-xl shadow-sm">
                        <h4 className="flex items-center gap-2 font-semibold text-gray-900 mb-3">
                            <HeartHandshake className="w-5 h-5 text-blue-500" />
                            What is SoundExchange?
                        </h4>
                        <p className="text-sm text-gray-600 leading-relaxed mb-4">
                            Unlike PROs which pay songwriters, SoundExchange pays <strong>performers and sound recording owners</strong>.
                            This is separate money for the exact same plays on non-interactive digital streams.
                        </p>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Standard Royalty Split Visualization</h5>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700 font-medium">Sound Recording Owner</span>
                                    <span className="font-bold text-gray-900 bg-gray-200 px-2 py-0.5 rounded">50%</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700 font-medium">Featured Artist</span>
                                    <span className="font-bold text-gray-900 bg-gray-200 px-2 py-0.5 rounded">45%</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700 font-medium">Session Musicians (AFM/SAG-AFTRA)</span>
                                    <span className="font-bold text-gray-900 bg-gray-200 px-2 py-0.5 rounded">5%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-start">
                        <a
                            href="https://www.soundexchange.com/artist-copyright-owner/registration/"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            <span>Register Free with SX</span>
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            )}

            {status === 'active' && (
                <div className="flex items-start gap-4 p-5 bg-green-50/50 rounded-xl border border-green-100">
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                    <div className="flex-1">
                        <h4 className="text-gray-900 font-semibold mb-1">SoundExchange Active</h4>
                        <p className="text-sm text-gray-600 mb-4">Your artist and master owner accounts are linked.</p>
                        <div className="inline-flex items-center gap-2 text-sm bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-gray-700">
                            <Radio className="w-4 h-4 text-indigo-500" />
                            <span className="font-bold">Tracks Indexed:</span> {registeredTracks}
                        </div>
                    </div>
                    <a
                        href="https://www.soundexchange.com/"
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
