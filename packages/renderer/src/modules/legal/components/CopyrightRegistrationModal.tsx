import React, { useState } from 'react';
import { X, Shield, Download, ExternalLink, Save, BookOpen, CheckCircle, Info } from 'lucide-react';
import { LegalService } from '@/services/legal/LegalService';
import { ContractPDFService } from '@/services/legal/ContractPDFService';
import { ContractStatus } from '../types';
import { useToast } from '@/core/context/ToastContext';

interface CopyrightRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: (contractId: string) => void;
}

export function CopyrightRegistrationModal({ isOpen, onClose, onCreated }: CopyrightRegistrationModalProps) {
    const toast = useToast();
    const [formType, setFormType] = useState<'PA' | 'SR' | 'BOTH'>('BOTH');
    const [workTitle, setWorkTitle] = useState('');
    const [alternateTitles, setAlternateTitles] = useState('');
    const [yearOfCreation, setYearOfCreation] = useState(String(new Date().getFullYear()));
    const [isPublished, setIsPublished] = useState(false);
    const [dateOfFirstPublication, setDateOfFirstPublication] = useState('');
    const [nationOfPublication, setNationOfPublication] = useState('United States');
    
    // Authors & Claimants
    const [authorName, setAuthorName] = useState('');
    const [authorCitizenship, setAuthorCitizenship] = useState('United States');
    const [isWorkForHire, setIsWorkForHire] = useState(false);
    const [natureOfAuthorship, setNatureOfAuthorship] = useState('Music, Lyrics, and Sound Recording');
    const [copyrightClaimant, setCopyrightClaimant] = useState('');
    const [isrc, setIsrc] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const generatePacketMarkdown = (): string => {
        const formDesc = formType === 'PA' 
            ? 'Form PA (Performing Arts — Musical Composition & Lyrics)' 
            : formType === 'SR' 
            ? 'Form SR (Sound Recording — Master Audio Performance)' 
            : 'Combined Forms PA & SR (Composition, Lyrics & Sound Recording)';

        return [
            `# UNITED STATES COPYRIGHT OFFICE — eCO APPLICATION PACKET`,
            `## Electronic Copyright Office Registration Preparation Document`,
            ``,
            `**Registration Classification:** ${formDesc}`,
            `**Generated Date:** ${new Date().toLocaleDateString('en-US')}`,
            ``,
            `---`,
            ``,
            `### SECTION 1: TITLE OF WORK`,
            `* **Title of this Work:** ${workTitle || 'Untitled Work'}`,
            `* **Previous or Alternate Titles:** ${alternateTitles || 'None'}`,
            `* **Nature of this Work:** Musical Composition and/or Sound Recording`,
            `* **ISRC Identifier:** ${isrc || 'Unassigned / Not Provided'}`,
            ``,
            `---`,
            ``,
            `### SECTION 2: CREATION & PUBLICATION METADATA`,
            `* **Year in Which Creation of This Work Was Completed:** ${yearOfCreation}`,
            `* **Has this Work been published?** ${isPublished ? 'YES' : 'NO'}`,
            isPublished ? `* **Date of First Publication:** ${dateOfFirstPublication || 'N/A'}` : `* **Publication Status:** Unpublished Work`,
            isPublished ? `* **Nation of First Publication:** ${nationOfPublication}` : '',
            ``,
            `---`,
            ``,
            `### SECTION 3: AUTHOR INFORMATION`,
            `* **Name of Author:** ${authorName || 'Primary Author'}`,
            `* **Was this contribution a "work made for hire"?** ${isWorkForHire ? 'YES' : 'NO'}`,
            `* **Author's Citizenship / Domicile:** ${authorCitizenship}`,
            `* **Nature of Authorship:** ${natureOfAuthorship}`,
            ``,
            `---`,
            ``,
            `### SECTION 4: COPYRIGHT CLAIMANT(S)`,
            `* **Name & Legal Address of Claimant:** ${copyrightClaimant || authorName || 'Primary Claimant'}`,
            `* **Transfer of Ownership (if claimant is not the author):** Written Assignment Agreement`,
            ``,
            `---`,
            ``,
            `### SECTION 5: INSTRUCTIONS FOR OFFICIAL FILING`,
            `1. Navigate to the official US Copyright Office portal at **https://www.copyright.gov/registration/**.`,
            `2. Log into the Electronic Copyright Office (eCO) registration portal.`,
            `3. Select "Standard Application" or "Registration for a Group of Unpublished Works (GRAM)".`,
            `4. Copy and paste each field from this preparation packet directly into the matching eCO form sections.`,
            `5. Upload the canonical lossless WAV audio deposit copy and pay the standard statutory fee ($45-$65).`,
            `6. Retain your 12-digit Service Request (SR) number in indii Legal for tracking.`,
        ].filter(Boolean).join('\n');
    };

    const handleSaveRecord = async () => {
        if (!workTitle.trim()) {
            toast.error('Please enter the work title');
            return;
        }

        setIsSaving(true);
        try {
            const content = generatePacketMarkdown();
            const contractId = await LegalService.saveContract({
                title: `Copyright Packet: ${workTitle}`,
                type: 'Copyright Registration',
                parties: [authorName || 'Author', copyrightClaimant || 'Claimant'],
                content,
                status: ContractStatus.DRAFT,
                metadata: {
                    workTitle,
                    formType,
                    yearOfCreation,
                    isPublished,
                    dateOfFirstPublication,
                    isrc,
                    authorName,
                    copyrightClaimant,
                }
            });

            toast.success('Copyright filing packet saved to My Contracts!');
            onCreated?.(contractId);
            onClose();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to save copyright packet');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!workTitle.trim()) {
            toast.error('Please enter the work title');
            return;
        }
        const content = generatePacketMarkdown();
        ContractPDFService.download({
            title: `Copyright Registration Packet - ${workTitle}`,
            content,
            subtitle: 'US Copyright Office eCO Application Preparation',
            filename: `copyright-packet-${workTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        });
        toast.success('Copyright packet PDF downloaded.');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                            <Shield size={18} className="text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">US Copyright Office eCO Assistant</h2>
                            <p className="text-xs text-gray-400">Prepare Form PA & SR filings for official statutory registration</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                    {/* Notice */}
                    <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl flex items-start gap-3">
                        <Info size={16} className="text-purple-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-purple-200/80 leading-relaxed">
                            This tool prepares a comprehensive, legally compliant filing docket for submission to the 
                            <strong> Electronic Copyright Office (eCO)</strong>. Official registration secures statutory damages and attorney’s fees in federal court.
                        </p>
                    </div>

                    {/* Registration Classification */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-2">Registration Type</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => setFormType('BOTH')}
                                className={`p-3 rounded-xl border text-left transition-all ${formType === 'BOTH' ? 'bg-purple-500/15 border-purple-500/50 text-white' : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.04]'}`}
                            >
                                <p className="text-xs font-bold text-white">Combined PA + SR</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Composition & Master Sound Recording</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormType('SR')}
                                className={`p-3 rounded-xl border text-left transition-all ${formType === 'SR' ? 'bg-purple-500/15 border-purple-500/50 text-white' : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.04]'}`}
                            >
                                <p className="text-xs font-bold text-white">Form SR Only</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Sound Recording / Master Only</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormType('PA')}
                                className={`p-3 rounded-xl border text-left transition-all ${formType === 'PA' ? 'bg-purple-500/15 border-purple-500/50 text-white' : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.04]'}`}
                            >
                                <p className="text-xs font-bold text-white">Form PA Only</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Music & Lyrics Composition Only</p>
                            </button>
                        </div>
                    </div>

                    {/* Work Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Title of Work *</label>
                            <input
                                type="text"
                                value={workTitle}
                                onChange={(e) => setWorkTitle(e.target.value)}
                                placeholder="e.g. Electric Dreams"
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Alternate / Working Titles</label>
                            <input
                                type="text"
                                value={alternateTitles}
                                onChange={(e) => setAlternateTitles(e.target.value)}
                                placeholder="e.g. Demo 4, Final Master"
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Year of Creation</label>
                            <input
                                type="number"
                                value={yearOfCreation}
                                onChange={(e) => setYearOfCreation(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">ISRC (If Master Assigned)</label>
                            <input
                                type="text"
                                value={isrc}
                                onChange={(e) => setIsrc(e.target.value.toUpperCase())}
                                placeholder="e.g. US-NDM-26-00001"
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                            />
                        </div>
                    </div>

                    {/* Author & Claimant */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Author Name *</label>
                            <input
                                type="text"
                                value={authorName}
                                onChange={(e) => setAuthorName(e.target.value)}
                                placeholder="Legal Full Name"
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Citizenship / Domicile</label>
                            <input
                                type="text"
                                value={authorCitizenship}
                                onChange={(e) => setAuthorCitizenship(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Copyright Claimant (Owner)</label>
                            <input
                                type="text"
                                value={copyrightClaimant}
                                onChange={(e) => setCopyrightClaimant(e.target.value)}
                                placeholder="Entity or Person holding copyright"
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Nature of Authorship</label>
                            <input
                                type="text"
                                value={natureOfAuthorship}
                                onChange={(e) => setNatureOfAuthorship(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                            />
                        </div>
                    </div>

                    {/* Work For Hire & Publication */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <label className="flex items-center gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isWorkForHire}
                                onChange={(e) => setIsWorkForHire(e.target.checked)}
                                className="rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                                <span className="text-xs font-semibold text-white block">Work Made for Hire</span>
                                <span className="text-[10px] text-gray-400">Created as employee or under written agreement</span>
                            </div>
                        </label>
                        <label className="flex items-center gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isPublished}
                                onChange={(e) => setIsPublished(e.target.checked)}
                                className="rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                                <span className="text-xs font-semibold text-white block">Work has been Published</span>
                                <span className="text-[10px] text-gray-400">Released commercially on DSPs or CD/Vinyl</span>
                            </div>
                        </label>
                    </div>

                    {isPublished && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-300 mb-1">Date of First Publication</label>
                                <input
                                    type="date"
                                    value={dateOfFirstPublication}
                                    onChange={(e) => setDateOfFirstPublication(e.target.value)}
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-300 mb-1">Nation of First Publication</label>
                                <input
                                    type="text"
                                    value={nationOfPublication}
                                    onChange={(e) => setNationOfPublication(e.target.value)}
                                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
                    <a
                        href="https://www.copyright.gov/registration/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                    >
                        <ExternalLink size={12} /> Open US Copyright Office (eCO) Portal
                    </a>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDownloadPDF}
                            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-2 border border-white/10 transition-colors"
                        >
                            <Download size={14} /> Download Filing Docket
                        </button>
                        <button
                            onClick={handleSaveRecord}
                            disabled={isSaving}
                            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-colors"
                        >
                            <Save size={14} /> {isSaving ? 'Saving...' : 'Save to Contracts'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
