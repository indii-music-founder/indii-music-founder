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
            const userId = userProfile.id || 'unknown_user'; // Fallback if ID missing

            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                // Construct a path: users/{userId}/reference_images/{uuid}
                const imageId = uuidv4();
                const storagePath = `users/${userId}/reference_images/${imageId}`;

                const downloadUrl = await StorageService.uploadFile(file, storagePath);

                newAssets.push({
                    id: imageId,
                    url: downloadUrl,
                    description: (file instanceof File) ? file.name : `Capture ${new Date().toLocaleTimeString()}`
                });
            }

            // Update store
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

        // Delete from Storage if we have an ID and User ID
        if (asset.id && userProfile.id) {
            // Path: users/{userId}/reference_images/{asset.id}
            const storagePath = `users/${userProfile.id}/reference_images/${asset.id}`;
            await StorageService.deleteFile(storagePath);
        }

        const newImages = [...referenceImages];
        newImages.splice(index, 1);
        updateBrandKit({ referenceImages: newImages });
    };

    return (
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Camera className="text-purple-400" size={24} />
                    <div>
                        <h2 className="text-lg font-bold text-white">Reference Images</h2>
                        <p className="text-xs text-gray-400">Upload selfies or styles for AI likeness</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowCamera(true)}
                        disabled={isUploading}
                        className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        <Camera size={16} />
                        Use Camera
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
                <WebcamCapture
                    onCapture={(blob) => processFiles([blob])}
                    onClose={() => setShowCamera(false)}
                />
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {referenceImages.map((img, idx) => (
                    <div key={idx} className="group relative aspect-square bg-[#0d1117] rounded-lg overflow-hidden border border-gray-800">
                        <img
                            src={img.url}
                            alt={img.description}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                                onClick={() => handleDelete(idx)}
                                className="p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-xs text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {img.description}
                        </div>
                    </div>
                ))}

                {referenceImages.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-xl bg-[#0d1117]/50">
                        <ImageIcon size={48} className="mb-4 opacity-50" />
                        <p className="text-sm">No reference images yet.</p>
                        <p className="text-xs mt-1">Upload photos to define your style.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
