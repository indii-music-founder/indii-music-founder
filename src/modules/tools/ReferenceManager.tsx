import React, { useRef, useState } from 'react';
import { Camera, Upload, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useStore } from '@/core/store';
import { v4 as uuidv4 } from 'uuid';
import { BrandAsset } from '@/modules/workflow/types';
import { StorageService } from '@/services/StorageService';
import WebcamCapture from './components/WebcamCapture';
import { ModuleDashboard } from '@/components/layout/ModuleDashboard';

export default function ReferenceManager() {
    const { userProfile, updateBrandKit } = useStore();
    const [isUploading, setIsUploading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Ensure we have an array to work with
    const referenceImages = userProfile?.brandKit?.referenceImages || [];

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        await processFiles(Array.from(files));
    };

    const processFiles = async (files: (File | Blob)[]) => {
        setIsUploading(true);
        try {
            const newAssets: BrandAsset[] = [];
            const userId = userProfile?.id || 'unknown_user';

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const imageId = uuidv4();
                const storagePath = `users/${userId}/reference_images/${imageId}`;
                const downloadUrl = await StorageService.uploadFile(file, storagePath);

                newAssets.push({
                    id: imageId,
                    url: downloadUrl,
                    description: (file instanceof File) ? file.name : `Capture ${new Date().toLocaleTimeString()}`
                });
            }

            updateBrandKit({
                referenceImages: [...referenceImages, ...newAssets]
            });

        } catch (error) {
            console.error("Failed to upload reference images", error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            setShowCamera(false);
        }
    };

    const handleDelete = async (index: number) => {
        const asset = referenceImages[index];

        if (asset.id && userProfile?.id) {
            const storagePath = `users/${userProfile.id}/reference_images/${asset.id}`;
            await StorageService.deleteFile(storagePath);
        }

        const newImages = [...referenceImages];
        newImages.splice(index, 1);
        updateBrandKit({ referenceImages: newImages });
    };

    return (
        <ModuleDashboard
            title="Reference Assets"
            description="Manage global style guides, selfies, and reference imagery for AI training."
            icon={<ImageIcon className="text-purple-400" />}
        >
            <div className="p-8 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                            <ImageIcon className="text-purple-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Asset Library</h2>
                            <p className="text-sm text-gray-400">
                                {referenceImages.length} {referenceImages.length === 1 ? 'asset' : 'assets'} in collection
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowCamera(true)}
                            disabled={isUploading}
                            data-testid="camera-btn"
                            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-5 py-3 rounded-xl text-sm font-bold transition-all border border-white/10 active:scale-95 disabled:opacity-50"
                        >
                            <Camera size={18} />
                            Use Camera
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            data-testid="upload-btn"
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] active:scale-95 disabled:opacity-50"
                        >
                            {isUploading ? <Loader2 data-testid="upload-loader" size={18} className="animate-spin" /> : <Upload size={18} />}
                            Upload Files
                        </button>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        multiple
                        accept="image/*"
                    />
                </div>

                {showCamera && (
                    <div className="mb-8 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl relative z-20">
                        <WebcamCapture
                            onCapture={(blob) => processFiles([blob])}
                            onClose={() => setShowCamera(false)}
                        />
                    </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {referenceImages.map((img, idx) => (
                        <div key={idx} data-testid={`gallery-item-${idx}`} className="group relative aspect-square bg-[#161b22] rounded-2xl overflow-hidden border border-white/5 hover:border-purple-500/50 transition-all shadow-lg hover:shadow-purple-900/20">
                            <img
                                src={img.url}
                                alt={img.description}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                <div className="flex justify-between items-end gap-3 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                    <span className="text-xs text-white font-medium truncate flex-1 drop-shadow-md">{img.description}</span>
                                    <button
                                        onClick={() => handleDelete(idx)}
                                        className="p-2 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors shadow-lg hover:scale-110"
                                        aria-label="Delete reference image"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Quick Add Placeholder */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="add-new-btn"
                        className="aspect-square rounded-2xl border border-dashed border-white/10 hover:border-purple-500/50 bg-white/5 hover:bg-purple-500/5 transition-all flex flex-col items-center justify-center gap-3 group"
                    >
                        <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-purple-500/20 flex items-center justify-center transition-colors">
                            <Upload size={20} className="text-gray-500 group-hover:text-purple-400" />
                        </div>
                        <span className="text-xs font-bold text-gray-500 group-hover:text-purple-400">Add New</span>
                    </button>
                </div>

                {referenceImages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-500 border border-dashed border-gray-800 rounded-3xl bg-bg-dark/50 mt-8">
                        <div className="p-6 bg-gray-800/30 rounded-full mb-6 relative">
                            <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
                            <ImageIcon size={48} className="opacity-40 relative z-10" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-300 mb-2">No references yet</h3>
                        <p className="text-sm text-gray-500 max-w-md text-center">
                            Upload images to build your personal style guide.
                            These assets can be used to train AI models on your specific look.
                        </p>
                    </div>
                )}
            </div>
        </ModuleDashboard>
    );
}
