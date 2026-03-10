import React from 'react';
import { Building2, AlertTriangle, CheckCircle, ExternalLink, ArrowRight } from 'lucide-react';
import { RegistrationSection } from './RegistrationSection';
import { RoyaltyProfile } from '../types';

interface ProRegistrationSectionProps {
    profile: RoyaltyProfile;
    isExpanded: boolean;
    onToggle: () => void;
    onSelectPro?: (pro: 'BMI' | 'ASCAP' | 'SESAC') => void;
}

const PRO_URLS: Record<'BMI' | 'ASCAP' | 'SESAC', { hub: string; login: string }> = {
    BMI:   { hub: 'https://www.bmi.com/creator',    login: 'https://www.bmi.com/login' },
    ASCAP: { hub: 'https://www.ascap.com/members',  login: 'https://www.ascap.com/members' },
    BMI: { hub: 'https://www.bmi.com/creator', login: 'https://www.bmi.com/login' },
    ASCAP: { hub: 'https://www.ascap.com/members', login: 'https://www.ascap.com/members' },
    SESAC: { hub: 'https://www.sesac.com/licensing', login: 'https://www.sesac.com/licensing' },
};

export const ProRegistrationSection: React.FC<ProRegistrationSectionProps> = ({
    profile,
    isExpanded,
    onToggle,
    onSelectPro
}) => {
    const { status, selectedPro, ipiNumber, applicationDate } = profile.proRegistration;
    const proUrls = selectedPro ? PRO_URLS[selectedPro] : PRO_URLS.BMI;

    return (
        <RegistrationSection
            id="pro-registration"
            icon={<Building2 className="w-6 h-6" />}
            title="Performance Rights Organization (PRO)"
            subtitle="Collect royalties when your music is played on radio, TV, streaming, live venues"
            status={status}
            isRequired={true}
            isExpanded={isExpanded}
            onToggle={onToggle}
        >
            {/* NOT STARTED */}
            {status === 'not_started' && (
                <div className="space-y-6">
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-800 shadow-sm">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-semibold mb-1">Required before releasing music</h4>
                            <p className="text-sm">You must register with a PRO before your music generates performance royalties. PROs generally do not pay retroactively.</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50/80 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Feature</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-900">BMI</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-900">ASCAP</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-900">SESAC</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-700">
                                <tr>
                                    <td className="px-4 py-3 font-medium">Cost</td>
                                    <td className="px-4 py-3 text-green-600 font-medium">Free</td>
                                    <td className="px-4 py-3">$50</td>
                                    <td className="px-4 py-3">Invite-only</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-medium">Payout</td>
                                    <td className="px-4 py-3">Quarterly</td>
                                    <td className="px-4 py-3">Quarterly</td>
                                    <td className="px-4 py-3">Monthly</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-medium">Best for</td>
                                    <td className="px-4 py-3">Most independent artists</td>
                                    <td className="px-4 py-3">Songwriters & producers</td>
                                    <td className="px-4 py-3">Established professionals</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => { onSelectPro && onSelectPro('BMI'); window.open('https://www.bmi.com/creator', '_blank', 'noopener,noreferrer'); }}
                            onClick={() => { if (onSelectPro) onSelectPro('BMI'); window.open('https://www.bmi.com/creator', '_blank', 'noopener,noreferrer'); }}
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <span>Register with BMI</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => { onSelectPro && onSelectPro('ASCAP'); window.open('https://www.ascap.com/help/new-to-ascap/ascap-member-registration', '_blank', 'noopener,noreferrer'); }}
                            onClick={() => { if (onSelectPro) onSelectPro('ASCAP'); window.open('https://www.ascap.com/help/new-to-ascap/ascap-member-registration', '_blank', 'noopener,noreferrer'); }}
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            <span>Register with ASCAP</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* IN PROGRESS */}
            {status === 'in_progress' && (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1 bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-2 h-full bg-yellow-400" />
                            <h4 className="font-semibold text-gray-900 mb-4">Registration Status: {selectedPro}</h4>
                            <ul className="space-y-4">
                                <li className="flex items-center gap-3 text-sm text-gray-600">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    <span>Step 1: Account created</span>
                                </li>
                                <li className="flex items-center gap-3 text-sm text-gray-600">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    <span>Step 2: Application submitted</span>
                                </li>
                                <li className="flex items-center gap-3 text-sm font-medium text-gray-900">
                                    <div className="w-5 h-5 rounded-full border-2 border-yellow-500 animate-pulse flex-shrink-0" />
                                    <span>Step 3: Awaiting IPI number</span>
                                </li>
                            </ul>
                        </div>

                        <div className="md:w-64 bg-slate-50 p-5 rounded-xl border border-slate-100">
                            <h4 className="font-semibold text-slate-800 mb-3">Timeline</h4>
                            <p className="text-sm text-slate-600 mb-2"><strong>Expected completion:</strong><br /> 5-7 business days from Application Date ({applicationDate?.toLocaleDateString() ?? 'Recently'})</p>
                            <p className="text-sm text-slate-600"><strong>First payout cycle:</strong><br /> Q3 (Aug 2026)</p>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <a
                            href={proUrls.hub}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors shadow-sm"
                        >
                            <span>Check {selectedPro} Hub</span>
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                        </a>
                    </div>
                </div>
            )}

            {/* ACTIVE */}
            {status === 'active' && (
                <div className="flex flex-col md:flex-row gap-4 items-center md:items-start justify-between bg-green-50/50 p-6 rounded-xl border border-green-100">
                    <div className="flex items-start gap-4 flex-1">
                        <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0 mt-1" />
                        <div>
                            <h4 className="text-lg font-bold text-gray-900 mb-4">Registered with {selectedPro}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm text-gray-700">
                                <div>
                                    <p className="text-gray-500 mb-0.5">IPI / CAE Number</p>
                                    <p className="font-medium text-gray-900 font-mono bg-white px-2 py-1 rounded border border-gray-200 inline-block">{ipiNumber}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-0.5">Registration Date</p>
                                    <p className="font-medium text-gray-900">{applicationDate ? new Date(applicationDate).toLocaleDateString() : 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-0.5">Next Statement</p>
                                    <p className="font-medium text-green-700">Q2 (May 2026)</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-0.5">Songwriter Account</p>
                                    <p className="font-medium text-gray-900 flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" /> Verified</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="w-full md:w-auto mt-4 md:mt-0 pt-2 border-t border-green-100 md:border-0">
                        <a
                            href={proUrls.login}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full flex items-center justify-center gap-2 px-5 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors shadow-sm"
                        >
                            <span>Manage {selectedPro}</span>
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                        </a>
                    </div>
                </div>
            )}
        </RegistrationSection>
    );
};
