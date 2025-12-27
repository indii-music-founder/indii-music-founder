import React, { useRef, useState } from 'react';
import { Camera, Upload, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useStore } from '@/core/store';
import { v4 as uuidv4 } from 'uuid';
import { BrandAsset } from '@/modules/workflow/types';
import { StorageService } from '@/services/StorageService';
import WebcamCapture from './WebcamCapture';

export default function ReferenceImageManager() {
    const { userProfile, updateBrandKit } = useStore();
    const [isUploading, setIsUploading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const referenceImages = userProfile.brandKit?.referenceImages || [];

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        await processFiles(Array.from(files));
    };

    const processFiles = async (files: (File | Blob)[]) => {
        setIsUploading(true);
        try {
            const newAssets: BrandAsset[] = [];
            const userId = userProfile.id || 'unknown_user';

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

        if (asset.id && userProfile.id) {
            const storagePath = `users/${userProfile.id}/reference_images/${asset.id}`;
            await StorageService.deleteFile(storagePath);
        }

        const newImages = [...referenceImages];
        newImages.splice(index, 1);
        updateBrandKit({ referenceImages: newImages });
    };

    return (
        <div className="bg-[#161b22]/50 backdrop-blur-md border border-gray-800 rounded-xl p-6 relative overflow-hidden group">
            {/* Background pattern */}
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <ImageIcon size={120} />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 relative z-10 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-500/10 rounded-lg">
                        <Camera className="text-purple-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Reference Images</h2>
                        <p className="text-xs text-gray-400 font-medium italic">Selfies or style guides for AI training</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowCamera(true)}
                        disabled={isUploading}
                        className="flex items-center gap-2 bg-[#0d1117] hover:bg-gray-800 text-gray-300 px-4 py-2.5 rounded-lg text-sm font-bold transition-all border border-gray-700 active:scale-95 disabled:opacity-50"
                    >
                        <Camera size={16} />
                        Use Camera
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 bg-white hover:bg-gray-100 text-black px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        Upload
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
                <div className="mb-6 rounded-xl overflow-hidden border border-gray-700 relative z-10">
                    <WebcamCapture
                        onCapture={(blob) => processFiles([blob])}
                        onClose={() => setShowCamera(false)}
                    />
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 relative z-10">
                {referenceImages.map((img, idx) => (
                    <div key={idx} className="group relative aspect-square bg-[#0d1117] rounded-xl overflow-hidden border border-gray-800/50 hover:border-blue-500/50 transition-all shadow-xl">
                        <img
                            src={img.url}
                            alt={img.description}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                            <div className="flex justify-between items-center gap-2">
                                <span className="text-[10px] text-white font-medium truncate flex-1">{img.description}</span>
                                <button
                                    onClick={() => handleDelete(idx)}
                                    className="p-2.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors shadow-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {referenceImages.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-500 border border-dashed border-gray-800 rounded-2xl bg-[#0d1117]/30 backdrop-blur-sm">
                        <div className="p-4 bg-gray-800/20 rounded-full mb-4">
                            <ImageIcon size={40} className="opacity-20" />
                        </div>
                        <p className="text-sm font-bold text-gray-400">No references active</p>
                        <p className="text-xs mt-1 text-gray-600">Add assets to personalize your studio</p>
                    </div>
                )}
            </div>
        </div>
    );
}
