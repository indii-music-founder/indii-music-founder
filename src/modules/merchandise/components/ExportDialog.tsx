import React, { useState } from 'react';
import { Download, FileImage } from 'lucide-react';
import { MerchButton } from './MerchButton';

export interface ExportDialogProps {
    onExport: (format: 'png' | 'jpeg' | 'svg' | 'webp') => void;
    onCancel: () => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ onExport, onCancel }) => {
    const [selectedFormat, setSelectedFormat] = useState<'png' | 'jpeg' | 'svg' | 'webp'>('png');

    const formats = [
        { value: 'png', label: 'PNG', description: 'Lossless, transparent backgrounds' },
        { value: 'jpeg', label: 'JPEG', description: 'Compressed, smaller file size' },
        { value: 'svg', label: 'SVG', description: 'Vector format, scalable' },
        { value: 'webp', label: 'WebP', description: 'Modern format, small size' },
    ] as const;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                {/* Icon */}
                <div className="w-12 h-12 rounded-full bg-[#FFE135]/20 flex items-center justify-center mb-4">
                    <FileImage className="text-[#FFE135]" size={24} />
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-white mb-2">Export Design</h3>
                <p className="text-sm text-neutral-400 mb-6">Choose your preferred export format</p>

                {/* Format Options */}
                <div className="space-y-2 mb-6">
                    {formats.map((format) => (
                        <button
                            key={format.value}
                            onClick={() => setSelectedFormat(format.value)}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                                selectedFormat === format.value
                                    ? 'bg-[#FFE135]/20 border-[#FFE135]/40'
                                    : 'bg-neutral-800/50 border-white/5 hover:border-white/10'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className={`text-sm font-medium ${
                                        selectedFormat === format.value ? 'text-[#FFE135]' : 'text-white'
                                    }`}>
                                        {format.label}
                                    </p>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        {format.description}
                                    </p>
                                </div>
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                    selectedFormat === format.value
                                        ? 'border-[#FFE135]'
                                        : 'border-neutral-600'
                                }`}>
                                    {selectedFormat === format.value && (
                                        <div className="w-2 h-2 rounded-full bg-[#FFE135]" />
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onExport(selectedFormat)}
                        className="flex-1 px-4 py-2 bg-[#FFE135] hover:bg-[#FFE135]/90 text-black rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                        <Download size={16} />
                        Export
                    </button>
                </div>
            </div>
        </div>
    );
};
