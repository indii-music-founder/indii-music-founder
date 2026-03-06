import React, { useState } from 'react';
import { Copyright, Scale, ExternalLink, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { RegistrationSection } from './RegistrationSection';
import { RoyaltyProfile } from '../types';

interface CopyrightSectionProps {
    profile: RoyaltyProfile;
    isExpanded: boolean;
    onToggle: () => void;
}

export const CopyrightSection: React.FC<CopyrightSectionProps> = ({
    profile,
    isExpanded,
    onToggle
}) => {
    const [showMore, setShowMore] = useState(false);

    // Aggregate status
    const hasRegistrations = profile.copyrightRegistrations.length > 0;
    const status = hasRegistrations ? profile.copyrightRegistrations[0].status : 'not_started';

    return (
        <RegistrationSection
            id="copyright-registration"
            icon={<Copyright className="w-6 h-6" />}
            title="Copyright Protection"
            subtitle="Register formally with the Library of Congress for full legal and statutory damages protection"
            status={status}
            isRequired={false}
            isExpanded={isExpanded}
            onToggle={onToggle}
        >
            {status === 'not_started' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm text-slate-800">
                        <div className="flex gap-4">
                            <div className="bg-slate-100 p-2 rounded-lg flex-shrink-0">
                                <Scale className="w-6 h-6 text-slate-700" />
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">When do you actually need to register?</h4>
                                <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                                    Copyright exists automatically the moment you record your song ("fixed in a tangible medium").
                                    Formal registration with the US Copyright Office is only required if you plan to sue someone for copyright infringement and wish to collect statutory damages.
                                </p>

                                <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-5">
                                    <div>
                                        <span className="block uppercase tracking-wider mb-1">Standard Cost</span>
                                        <span className="text-slate-900 text-sm">$45 - $65 per work</span>
                                    </div>
                                    <div>
                                        <span className="block uppercase tracking-wider mb-1">Timeline</span>
                                        <span className="text-slate-900 text-sm">3 to 9 months processing</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowMore(!showMore)}
                                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1 transition-colors"
                                >
                                    {showMore ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    Read Detailed Guide
                                </button>

                                {showMore && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600 space-y-3">
                                        <p>If you are an independent artist on a budget, it is common to delay formal copyright registration until a track starts generating significant revenue or is selected for a major sync placement (TV/film).</p>
                                        <p>You can also save money by registering a collection of unpublished works (like an entire album) under a single application fee rather than registering each song separately.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-start">
                        <a
                            href="https://eco.copyright.gov"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors shadow-sm"
                        >
                            <span>eCO Portal Registry</span>
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            )}

            {status === 'active' && hasRegistrations && (
                <div className="flex flex-col gap-4">
                    {profile.copyrightRegistrations.map((reg) => (
                        <div key={reg.id} className="flex items-start gap-4 p-5 bg-green-50/50 rounded-xl border border-green-100">
                            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                            <div>
                                <h4 className="text-gray-900 font-semibold mb-1">Copyright Registered</h4>
                                <p className="text-sm text-gray-600 mb-3">Your work is formally protected.</p>
                                <div className="inline-flex flex-col gap-1 text-sm bg-white border border-gray-200 px-3 py-2 rounded-lg text-gray-700">
                                    <div><span className="font-bold text-gray-500 mr-2">Work ID:</span> {reg.workId}</div>
                                    <div><span className="font-bold text-gray-500 mr-2">Registry Number:</span> <span className="font-mono">{reg.registrationNumber || 'Pending'}</span></div>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div className="flex justify-end pt-2">
                        <a
                            href="https://eco.copyright.gov"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors shadow-sm"
                        >
                            <span>File Another Registration</span>
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                        </a>
                    </div>
                </div>
            )}
        </RegistrationSection>
    );
};
