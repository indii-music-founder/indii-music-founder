import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { X, Upload, Image as ImageIcon, Plus } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

interface BrandAssetsDrawerProps {
    onClose: () => void;
    onSelect?: (asset: any) => void; // Optional prop for selection mode
}

export default function BrandAssetsDrawer({ onClose, onSelect }: BrandAssetsDrawerProps) {
    const { userProfile, updateBrandKit, addUploadedImage, currentProjectId, setActiveReferenceImage } = useStore();
    const toast = useToast();
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFiles(Array.from(e.target.files));
        }
    };

    const handleFiles = (files: File[]) => {
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (event.target?.result) {
                        const newAsset = {
                            url: event.target.result as string,
                            description: file.name
                        };

                        // Add to Brand Kit
                        const currentAssets = userProfile.brandKit.brandAssets || [];
                        updateBrandKit({
                            brandAssets: [...currentAssets, newAsset]
                        });

                        // Also add to global uploads for immediate use
                        addUploadedImage({
                            id: crypto.randomUUID(),
                            type: 'image',
                            url: event.target.result as string,
                            prompt: file.name,
                            timestamp: Date.now(),
                            projectId: currentProjectId
                        });
                    }
                };
                reader.readAsDataURL(file);
            }
        });
        toast.success(`Added ${files.length} asset(s) to Brand Kit`);
    };

    const assets = userProfile.brandKit.brandAssets || [];
    const refImages = userProfile.brandKit.referenceImages || [];

    return (
        <div className="absolute top-full right-0 mt-2 w-80 bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-top-2 fade-in duration-200">
            {/* Header */}
            <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-[#111]">
                <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                    <ImageIcon size={14} className="text-yellow-500" />
                    Brand Assets
                </h3>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                    <X size={14} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                {/* Upload Area */}
                <div
                    className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors mb-6 ${isDragging ? 'border-yellow-500 bg-yellow-900/10' : 'border-gray-700 hover:border-gray-500 bg-[#0f0f0f]'}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        id="brand-asset-upload"
                        onChange={handleFileInput}
                    />
                    <label htmlFor="brand-asset-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                            <Upload size={18} />
                        </div>
                        <span className="text-xs text-gray-400 font-medium">
                            Drag & Drop or <span className="text-yellow-500 hover:underline">Browse</span>
                        </span>
                        <span className="text-[10px] text-gray-600">Logos, textures, style refs</span>
                    </label>
                </div>

                {/* Assets Grid */}
                <div className="space-y-6">
                    {/* Brand Assets Section */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Logos & Graphics</h4>
                        {assets.length === 0 ? (
                            <p className="text-xs text-gray-600 italic text-center py-4">No assets yet.</p>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {assets.map((asset, i) => (
                                    <div key={i} className="aspect-square bg-[#0f0f0f] rounded border border-gray-800 p-1 group relative">
                                        <img src={asset.url} alt={asset.description} className="w-full h-full object-contain" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                            {onSelect ? (
                                                <button
                                                    className="p-1 bg-blue-600 rounded hover:bg-blue-500 text-white transition-colors"
                                                    title="Select Asset"
                                                    onClick={() => onSelect(asset)}
                                                >
                                                    <Plus size={12} /> Select
                                                </button>
                                            ) : (
                                                <button
                                                    className="p-1 bg-gray-700 rounded hover:bg-white hover:text-black text-white transition-colors"
                                                    title="Use as Reference"
                                                    onClick={() => {
                                                        setActiveReferenceImage({
                                                            id: crypto.randomUUID(),
                                                            type: 'image',
                                                            url: asset.url,
                                                            prompt: asset.description,
                                                            timestamp: Date.now(),
                                                            projectId: currentProjectId
                                                        });
                                                        toast.success("Added to Reference Image");
                                                    }}
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Reference Images Section */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Style References</h4>
                        {refImages.length === 0 ? (
                            <p className="text-xs text-gray-600 italic text-center py-4">No reference images.</p>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {refImages.map((img, i) => (
                                    <div key={i} className="aspect-square bg-[#0f0f0f] rounded border border-gray-800 overflow-hidden group relative">
                                        <img src={img.url} alt={img.description} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
