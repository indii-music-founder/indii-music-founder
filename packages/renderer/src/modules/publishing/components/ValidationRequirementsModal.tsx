
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Music, Image as ImageIcon, Layout, Clock, DollarSign, Info } from 'lucide-react';
import type { DistributorId, DistributorRequirements } from '@/services/distribution/types/distributor';

interface ValidationRequirementsModalProps {
    isOpen: boolean;
    onClose: () => void;
    distributors: { id: DistributorId; name: string; requirements: DistributorRequirements }[];
    highlightDistributor?: DistributorId;
}

export const ValidationRequirementsModal: React.FC<ValidationRequirementsModalProps> = ({
    isOpen,
    onClose,
    distributors,
    highlightDistributor
}) => {
    if (!isOpen) return null;

    const categories = [
        { id: 'coverArt', label: 'Cover Art', icon: <ImageIcon size={16} /> },
        { id: 'audio', label: 'Audio Quality', icon: <Music size={16} /> },
        { id: 'metadata', label: 'Metadata', icon: <Layout size={16} /> },
        { id: 'timing', label: 'Lead Times', icon: <Clock size={16} /> },
        { id: 'pricing', label: 'Cost & Payout', icon: <DollarSign size={16} /> },
    ];

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-5xl bg-[#121212] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/20">
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Requirement Matrix</h2>
                            <p className="text-sm text-gray-500 mt-1">Cross-platform validation standards for distribution.</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Matrix Table */}
                    <div className="flex-1 overflow-auto p-6">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-800">
                                    <th className="py-4 px-4 sticky left-0 bg-[#121212] z-10 w-48">
                                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Specifications</span>
                                    </th>
                                    {distributors.map(d => (
                                        <th key={d.id} className={`py-4 px-6 text-center min-w-[180px] ${highlightDistributor === d.id ? 'bg-blue-500/5' : ''}`}>
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center font-bold text-[10px] text-gray-400">
                                                    {d.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-bold text-white">{d.name}</span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map(cat => (
                                    <React.Fragment key={cat.id}>
                                        <tr className="bg-gray-900/30">
                                            <td colSpan={distributors.length + 1} className="py-2 px-4 border-y border-gray-800/50">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                    {cat.icon}
                                                    {cat.label}
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Dynamic Rows based on category */}
                                        {cat.id === 'coverArt' && (
                                            <>
                                                <Row label="Dimensions" distributors={distributors} getValue={d => `${d.requirements.coverArt.minWidth}px min`} />
                                                <Row label="Formats" distributors={distributors} getValue={d => d.requirements.coverArt.allowedFormats.join(', ').toUpperCase()} />
                                                <Row label="Max File Size" distributors={distributors} getValue={d => `${Math.round(d.requirements.coverArt.maxSizeBytes / 1024 / 1024)}MB`} />
                                            </>
                                        )}
                                        {cat.id === 'audio' && (
                                            <>
                                                <Row label="Formats" distributors={distributors} getValue={d => d.requirements.audio.allowedFormats.join(', ').toUpperCase()} />
                                                <Row label="Sample Rate" distributors={distributors} getValue={d => `${d.requirements.audio.minSampleRate / 1000}kHz min`} />
                                                <Row label="Bit Depth" distributors={distributors} getValue={d => `${d.requirements.audio.minBitDepth}-bit min`} />
                                            </>
                                        )}
                                        {cat.id === 'metadata' && (
                                            <>
                                                <Row label="ISRC Required" distributors={distributors} getValue={d => d.requirements.metadata.isrcRequired ? 'Always' : 'Generated'} isBoolean />
                                                <Row label="Genre Required" distributors={distributors} getValue={d => d.requirements.metadata.genreRequired} isBoolean />
                                            </>
                                        )}
                                        {cat.id === 'timing' && (
                                            <>
                                                <Row label="Min Lead Time" distributors={distributors} getValue={d => `${d.requirements.timing.minLeadTimeDays} Days`} />
                                                <Row label="Review Cycle" distributors={distributors} getValue={d => `~${d.requirements.timing.reviewTimeDays} Days`} />
                                            </>
                                        )}
                                        {cat.id === 'pricing' && (
                                            <>
                                                <Row label="Payout Rate" distributors={distributors} getValue={d => `${d.requirements.pricing.payoutPercentage}%`} highlighted />
                                                <Row label="Model" distributors={distributors} getValue={d => d.requirements.pricing.model.replace('_', ' ')} />
                                            </>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-800 bg-gray-900/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Info size={14} className="text-blue-500" />
                            <span>These requirements are updated daily. Last sync: Today 04:00 AM</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="px-8 py-2.5 bg-white text-black rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                        >
                            Got it
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

type DistributorRow = ValidationRequirementsModalProps['distributors'][number];
interface RowProps {
    label: string;
    distributors: DistributorRow[];
    getValue: (d: DistributorRow) => string | boolean;
    isBoolean?: boolean;
    highlighted?: boolean;
}

const Row: React.FC<RowProps> = ({ label, distributors, getValue, isBoolean, highlighted }) => (
    <tr className="border-b border-gray-800/30 group hover:bg-white/[0.01] transition-colors">
        <td className="py-4 px-4 sticky left-0 bg-[#121212] z-10">
            <span className="text-xs font-medium text-gray-500 group-hover:text-gray-300 transition-colors">{label}</span>
        </td>
        {distributors.map(d => {
            const value = getValue(d);
            return (
                <td key={d.id} className="py-4 px-6 text-center">
                    {isBoolean ? (
                        <div className="flex justify-center">
                            {value === true || value === 'Always' ? (
                                <Check size={18} className="text-green-500" />
                            ) : value === false ? (
                                <X size={18} className="text-gray-700" />
                            ) : (
                                <span className="text-xs font-bold text-gray-400">{value}</span>
                            )}
                        </div>
                    ) : (
                        <span className={`text-xs font-bold ${highlighted ? 'text-green-400' : 'text-gray-300'}`}>
                            {value}
                        </span>
                    )}
                </td>
            );
        })}
    </tr>
);
