import React, { useRef, useState } from 'react';
import { Camera, Upload, Trash2, Image as ImageIcon, Loader2, Folder, Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { BrandAsset } from '@/types/User';
import { StorageService } from '@/services/StorageService';
import WebcamCapture from '@/components/shared/WebcamCapture';

type AssetCollection = 'brandAssets' | 'referenceImages';
type AssetCategory = 'logo' | 'headshot' | 'bodyshot' | 'clothing' | 'environment' | 'other';

interface UnifiedAssetLibraryProps {
    userId: string;
    brandAssets: BrandAsset[];
    referenceImages: BrandAsset[];
    onUpdateBrandAssets: (assets: BrandAsset[]) => void;
    onUpdateReferenceImages: (assets: BrandAsset[]) => void;
}

const CATEGORIES: AssetCategory[] = ['logo', 'headshot', 'bodyshot', 'clothing', 'environment', 'other'];

export default function UnifiedAssetLibrary({
    userId,
    brandAssets,
    referenceImages,
    onUpdateBrandAssets,
    onUpdateReferenceImages
}: UnifiedAssetLibraryProps) {
    const [activeCollection, setActiveCollection] = useState<AssetCollection>('brandAssets');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [isUploading, setIsUploading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentAssets = activeCollection === 'brandAssets' ? brandAssets : referenceImages;
    const onUpdate = activeCollection === 'brandAssets' ? onUpdateBrandAssets : onUpdateReferenceImages;
    const storagePath = activeCollection === 'brandAssets' ? 'brand_assets' : 'reference_images';

    const filteredAssets = categoryFilter === 'all'
        ? currentAssets
        : currentAssets.filter(a => a.category === categoryFilter);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        await processFiles(Array.from(files));
    };

    const processFiles = async (files: (File | Blob)[], category: AssetCategory = 'other') => {
        setIsUploading(true);
        try {
            const newAssets: BrandAsset[] = [];

            for (const file of files) {
                const assetId = uuidv4();
                const path = `users/${userId}/${storagePath}/${assetId}`;
                const downloadUrl = await StorageService.uploadFile(file, path);

                newAssets.push({
                    id: assetId,
                    url: downloadUrl,
                    description: (file instanceof File) ? file.name : `Capture ${new Date().toLocaleTimeString()}`,
                    category
                });
            }

            onUpdate([...currentAssets, ...newAssets]);
        } catch (error) {
            console.error(`Failed to upload ${storagePath}`, error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            setShowCamera(false);
        }
    };

    const handleDelete = async (assetId: string, index: number) => {
        const asset = currentAssets[index];

        if (asset.id && userId) {
            const path = `users/${userId}/${storagePath}/${asset.id}`;
            await StorageService.deleteFile(path);
        }

        const updatedAssets = currentAssets.filter((_, i) => i !== index);
        onUpdate(updatedAssets);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            await processFiles(files);
        }
    };

    const handleWebcamCapture = async (blob: Blob) => {
        await processFiles([blob], 'headshot');
    };

    return (
        <div className="space-y-6">
            {/* Header with tabs and actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                        <Folder size={18} className="text-dept-marketing" />
                        Asset Library
                    </h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                        {currentAssets.length} {currentAssets.length === 1 ? 'asset' : 'assets'} in collection
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-[#0a0a0a] border border-gray-800 rounded-lg px-3 py-1.5 text-[10px] font-bold text-gray-400 outline-none cursor-pointer hover:border-gray-600 transition-colors"
                    >
                        <option value="all">View All</option>
                        {CATEGORIES.map(c => (
                            <option key={c} value={c} className="capitalize">{c}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowCamera(true)}
                        disabled={isUploading}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-[10px] font-bold transition-all border border-white/10"
                    >
                        <Camera size={12} />
                        Camera
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 px-3 py-1.5 bg-dept-marketing text-white rounded-lg text-[10px] font-bold hover:opacity-90 transition-all active:scale-95"
                    >
                        {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
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

            {/* Collection Tabs */}
            <div className="flex gap-2 border-b border-gray-800 pb-2">
                <button
                    onClick={() => setActiveCollection('brandAssets')}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all ${
                        activeCollection === 'brandAssets'
                            ? 'bg-dept-marketing/20 text-dept-marketing border-b-2 border-dept-marketing'
                            : 'text-gray-500 hover:text-gray-300'
                    }`}
                >
                    Brand Assets
                    <span className="ml-2 text-[10px] opacity-60">({brandAssets.length})</span>
                </button>
                <button
                    onClick={() => setActiveCollection('referenceImages')}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all ${
                        activeCollection === 'referenceImages'
                            ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-500'
                            : 'text-gray-500 hover:text-gray-300'
                    }`}
                >
                    Style References
                    <span className="ml-2 text-[10px] opacity-60">({referenceImages.length})</span>
                </button>
            </div>

            {/* Webcam Modal */}
            {showCamera && (
                <WebcamCapture
                    onCapture={handleWebcamCapture}
                    onClose={() => setShowCamera(false)}
                />
            )}

            {/* Drop Zone & Grid */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative transition-all rounded-xl ${
                    isDragging ? 'ring-2 ring-dept-marketing ring-offset-2 ring-offset-[#0a0a0a]' : ''
                }`}
            >
                {isDragging && (
                    <div className="absolute inset-0 bg-dept-marketing/10 rounded-xl flex items-center justify-center z-10 border-2 border-dashed border-dept-marketing">
                        <div className="text-center">
                            <Upload size={32} className="mx-auto mb-2 text-dept-marketing" />
                            <p className="text-sm font-bold text-dept-marketing">Drop images to upload</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredAssets?.map((asset, idx) => (
                        <div
                            key={asset.id || idx}
                            className="group relative aspect-square bg-[#0a0a0a] rounded-xl border border-gray-800 overflow-hidden hover:border-dept-marketing/50 transition-all"
                        >
                            <img
                                src={asset.url}
                                alt={asset.description}
                                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                <p className="text-[10px] font-bold text-white truncate">{asset.description}</p>
                                <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">{asset.category || 'other'}</span>
                            </div>
                            <button
                                onClick={() => handleDelete(asset.id || idx.toString(), idx)}
                                className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-all border border-white/5 hover:bg-red-500 hover:text-white"
                            >
                                <Trash2 size={10} />
                            </button>
                        </div>
                    ))}

                    {/* Quick Add Placeholder */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-xl border border-dashed border-white/10 hover:border-dept-marketing/50 bg-white/5 hover:bg-dept-marketing/5 transition-all flex flex-col items-center justify-center gap-3 group"
                    >
                        <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-dept-marketing/20 flex items-center justify-center transition-colors">
                            <Upload size={16} className="text-gray-500 group-hover:text-dept-marketing" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 group-hover:text-dept-marketing">Add New</span>
                    </button>
                </div>

                {filteredAssets?.length === 0 && (
                    <div className="py-12 border border-dashed border-gray-800 rounded-2xl flex flex-col items-center justify-center text-center opacity-40 mt-4">
                        <ImageIcon size={32} className="mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                            {categoryFilter === 'all' ? 'No assets yet' : `No ${categoryFilter} assets`}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-1">
                            {activeCollection === 'brandAssets'
                                ? 'Upload logos, headshots, and branded graphics'
                                : 'Upload style guides and reference imagery for AI training'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
