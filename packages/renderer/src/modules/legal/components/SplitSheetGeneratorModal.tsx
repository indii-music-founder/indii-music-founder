import React, { useState } from 'react';
import { X, Users, Percent, Download, Save, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { LegalService } from '@/services/legal/LegalService';
import { ContractPDFService } from '@/services/legal/ContractPDFService';
import { ContractStatus } from '../types';
import { useToast } from '@/core/context/ToastContext';

interface Collaborator {
    id: string;
    name: string;
    role: string;
    share: number;
    pro: string;
    ipi: string;
    email: string;
}

interface SplitSheetGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: (contractId: string) => void;
}

export function SplitSheetGeneratorModal({ isOpen, onClose, onCreated }: SplitSheetGeneratorModalProps) {
    const toast = useToast();
    const [trackTitle, setTrackTitle] = useState('');
    const [releaseTitle, setReleaseTitle] = useState('');
    const [isrc, setIsrc] = useState('');
    const [recordingDate, setRecordingDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSaving, setIsSaving] = useState(false);

    const [collaborators, setCollaborators] = useState<Collaborator[]>([
        { id: '1', name: 'Primary Artist', role: 'Producer / Songwriter', share: 50, pro: 'BMI', ipi: '', email: '' },
        { id: '2', name: 'Collaborator', role: 'Featured Artist / Lyricist', share: 50, pro: 'ASCAP', ipi: '', email: '' },
    ]);

    if (!isOpen) return null;

    const totalShare = collaborators.reduce((acc, curr) => acc + (Number(curr.share) || 0), 0);
    const isShareValid = Math.abs(totalShare - 100) < 0.01;

    const handleAddCollaborator = () => {
        setCollaborators([
            ...collaborators,
            {
                id: String(Date.now()),
                name: '',
                role: 'Songwriter',
                share: 0,
                pro: 'BMI',
                ipi: '',
                email: '',
            }
        ]);
    };

    const handleRemoveCollaborator = (id: string) => {
        if (collaborators.length <= 1) {
            toast.error('At least one party is required.');
            return;
        }
        setCollaborators(collaborators.filter(c => c.id !== id));
    };

    const handleUpdateCollaborator = (id: string, updates: Partial<Collaborator>) => {
        setCollaborators(collaborators.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const generateMarkdownContent = (): string => {
        const lines = [
            `# MUSICAL WORK SPLIT SHEET AGREEMENT`,
            ``,
            `**Date:** ${recordingDate}`,
            `**Track Title:** ${trackTitle || 'Untitled Composition'}`,
            `**Release Title:** ${releaseTitle || 'N/A'}`,
            `**ISRC:** ${isrc || 'Pending / Unassigned'}`,
            ``,
            `---`,
            ``,
            `### 1. OWNERSHIP & ROYALTIES BREAKDOWN`,
            ``,
            `The undersigned collaborators agree that the copyright and publishing ownership shares for the aforementioned musical work are allocated as follows:`,
            ``,
            `| Collaborator / Legal Name | Role | Share (%) | PRO | IPI / CAE # | Contact Email |`,
            `| :--- | :--- | :--- | :--- | :--- | :--- |`,
            ...collaborators.map(c => `| ${c.name || 'Unnamed'} | ${c.role || 'Contributor'} | ${c.share}% | ${c.pro || 'None'} | ${c.ipi || 'N/A'} | ${c.email || 'N/A'} |`),
            ``,
            `**Total Allocated Ownership:** ${totalShare}%`,
            ``,
            `---`,
            ``,
            `### 2. WARRANTIES & REPRESENTATIONS`,
            `Each collaborator hereby warrants and represents that their respective contributions (music, lyrics, production, arrangements) are original, do not infringe upon any third-party copyrights, trademarks, or personal rights, and that they possess full legal capacity to execute this agreement.`,
            ``,
            `### 3. MASTER RECORDING & PUBLISHING RIGHTS`,
            `Unless otherwise specified in a separate master rights license, this split sheet governs the musical composition and underlying copyright. Master mechanical and synchronization licensing shall require mutual written agreement of parties holding more than 50% combined share.`,
            ``,
            `---`,
            ``,
            `### SIGNATURES & EXECUTION`,
            ``,
            ...collaborators.flatMap(c => [
                `**Name:** ${c.name || 'Collaborator'}`,
                `Signature: ___________________________   Date: ______________`,
                ``
            ]),
        ];

        return lines.join('\n');
    };

    const handleSaveContract = async () => {
        if (!trackTitle.trim()) {
            toast.error('Please enter a track title');
            return;
        }
        if (!isShareValid) {
            toast.error(`Total shares must equal 100% (currently ${totalShare}%)`);
            return;
        }

        setIsSaving(true);
        try {
            const content = generateMarkdownContent();
            const contractId = await LegalService.saveContract({
                title: `Split Sheet: ${trackTitle}`,
                type: 'Split Sheet',
                parties: collaborators.map(c => c.name || 'Collaborator'),
                content,
                status: ContractStatus.DRAFT,
                metadata: {
                    trackTitle,
                    releaseTitle,
                    isrc,
                    recordingDate,
                    collaborators,
                    totalShare,
                }
            });

            toast.success('Split sheet created and saved to My Contracts!');
            onCreated?.(contractId);
            onClose();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to save split sheet');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!trackTitle.trim()) {
            toast.error('Please enter a track title');
            return;
        }
        const content = generateMarkdownContent();
        ContractPDFService.download({
            title: `Split Sheet - ${trackTitle}`,
            content,
            subtitle: 'Formal Music Publishing & Composition Split Agreement',
            filename: `split-sheet-${trackTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        });
        toast.success('Split sheet PDF downloaded.');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <Users size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Songwriter & Producer Split Sheet</h2>
                            <p className="text-xs text-gray-400">Lock down publishing & composition splits with collaborators</p>
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
                    {/* Track Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Song / Track Title *</label>
                            <input
                                type="text"
                                value={trackTitle}
                                onChange={(e) => setTrackTitle(e.target.value)}
                                placeholder="e.g. Midnight Horizon"
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Album / Release Title</label>
                            <input
                                type="text"
                                value={releaseTitle}
                                onChange={(e) => setReleaseTitle(e.target.value)}
                                placeholder="e.g. Horizon EP"
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">ISRC (Optional)</label>
                            <input
                                type="text"
                                value={isrc}
                                onChange={(e) => setIsrc(e.target.value.toUpperCase())}
                                placeholder="e.g. US-NDM-26-00001"
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-300 mb-1">Execution Date</label>
                            <input
                                type="date"
                                value={recordingDate}
                                onChange={(e) => setRecordingDate(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Collaborator Roster */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Collaborators & Splits</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${isShareValid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                    {isShareValid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                    Total: {totalShare}%
                                </span>
                            </div>
                            <button
                                onClick={handleAddCollaborator}
                                className="text-xs bg-white/5 hover:bg-white/10 text-blue-400 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-blue-500/20"
                            >
                                <Plus size={14} /> Add Party
                            </button>
                        </div>

                        <div className="space-y-3">
                            {collaborators.map((c) => (
                                <div key={c.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                        <div className="md:col-span-2">
                                            <input
                                                type="text"
                                                value={c.name}
                                                onChange={(e) => handleUpdateCollaborator(c.id, { name: e.target.value })}
                                                placeholder="Legal Name / Stage Name"
                                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                value={c.role}
                                                onChange={(e) => handleUpdateCollaborator(c.id, { role: e.target.value })}
                                                placeholder="Role (e.g. Producer)"
                                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={c.share}
                                                    onChange={(e) => handleUpdateCollaborator(c.id, { share: parseFloat(e.target.value) || 0 })}
                                                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white pr-6 focus:outline-none focus:border-blue-500"
                                                />
                                                <Percent size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
                                            </div>
                                            <button
                                                onClick={() => handleRemoveCollaborator(c.id)}
                                                className="text-gray-500 hover:text-red-400 p-1.5 transition-colors"
                                                title="Remove party"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <div>
                                            <input
                                                type="text"
                                                value={c.pro}
                                                onChange={(e) => handleUpdateCollaborator(c.id, { pro: e.target.value })}
                                                placeholder="PRO (BMI, ASCAP, SESAC, PRS)"
                                                className="w-full bg-white/[0.03] border border-white/5 rounded-lg px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                value={c.ipi}
                                                onChange={(e) => handleUpdateCollaborator(c.id, { ipi: e.target.value })}
                                                placeholder="IPI / CAE Number"
                                                className="w-full bg-white/[0.03] border border-white/5 rounded-lg px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="email"
                                                value={c.email}
                                                onChange={(e) => handleUpdateCollaborator(c.id, { email: e.target.value })}
                                                placeholder="Email Address"
                                                className="w-full bg-white/[0.03] border border-white/5 rounded-lg px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
                    <span className="text-xs text-gray-500">
                        Exports A4 PDF format with standard music industry terms.
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDownloadPDF}
                            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-2 border border-white/10 transition-colors"
                        >
                            <Download size={14} /> Download PDF
                        </button>
                        <button
                            onClick={handleSaveContract}
                            disabled={isSaving || !isShareValid}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-colors"
                        >
                            <Save size={14} /> {isSaving ? 'Saving...' : 'Save to Contracts'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
