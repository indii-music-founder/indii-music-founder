import React, { useState } from 'react';
import { functionsWest1 } from '@/services/firebase';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { X, Image as ImageIcon, Plus, Camera, ArrowRightLeft, Trash2, Tag } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import FileUpload from '@/components/kokonutui/file-upload';
import { StorageService } from '@/services/StorageService';
import { logger } from '@/utils/logger';
import type { BrandAsset } from '@/types/User';
import { AI_CONFIG } from '@/core/config/ai-models';
import type { StoreState } from '@/core/store';

interface BrandAssetsDrawerProps {
    onClose: () => void;
    onSelect?: (asset: BrandAsset) => void; // Optional prop for selection mode
}

export default function BrandAssetsDrawer({ onClose, onSelect }: BrandAssetsDrawerProps) {
    const {
        userProfile,
        updateBrandKit,
        addUploadedImage,
        currentProjectId,
        setActiveReferenceImage
    } = useStore(useShallow((state: StoreState) => ({
        userProfile: state.userProfile,
        updateBrandKit: state.updateBrandKit,
        addUploadedImage: state.addUploadedImage,
        currentProjectId: state.currentProjectId,
        setActiveReferenceImage: state.setActiveReferenceImage
    })));
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<'upload' | 'generate'>('upload');
    const [targetCategory, setTargetCategory] = useState<'style_reference' | 'logo'>('style_reference');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Derived state for assets
    const assets = userProfile?.brandKit?.brandAssets || [];
    const refImages = userProfile?.brandKit?.referenceImages || [];


    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            await processFiles(files);
        }
    };

    const processFiles = async (files: File[]) => {
        // For uploads, we'll default to style_reference if under limit, else logo
        const MAX_REF = AI_CONFIG.IMAGE.DEFAULT.maxReferenceImages;
        const currentCount = userProfile?.brandKit?.referenceImages?.length || 0;

        setIsGenerating(true);
        try {
            const newRefImages: BrandAsset[] = [];
            const newLogos: BrandAsset[] = [];
            const newUploadedImages = [];
            const timestamp = Date.now();

            for (const file of files) {
                const assetId = crypto.randomUUID();
                const userId = userProfile?.id || 'guest';
                const path = `users/${userId}/brand_assets/${assetId}`;
                
                logger.debug(`[BrandAssets] Uploading: ${file.name} to ${path}`);
                const downloadUrl = await StorageService.uploadFile(file, path);

                const asset: BrandAsset = { 
                    url: downloadUrl, 
                    description: file.name,
                    category: 'other'
                };

                // Logic: prioritize filling Style References (up to 14)
                if (currentCount + newRefImages.length < MAX_REF) {
                    newRefImages.push(asset);
                } else {
                    asset.category = 'logo';
                    newLogos.push(asset);
                }

                newUploadedImages.push({
                    id: assetId,
                    type: 'image' as const,
                    url: downloadUrl,
                    prompt: file.name,
                    timestamp,
                    projectId: currentProjectId || 'unassigned'
                });
            }

            const currentKit = userProfile?.brandKit || { brandAssets: [], referenceImages: [] };
            
            updateBrandKit({
                referenceImages: [...(currentKit.referenceImages || []), ...newRefImages],
                brandAssets: [...(currentKit.brandAssets || []), ...newLogos]
            });

            newUploadedImages.forEach(img => addUploadedImage({
                ...img,
                prompt: img.prompt || ''
            }));

            if (newRefImages.length > 0) toast.success(`${newRefImages.length} style reference(s) added`);
            if (newLogos.length > 0) toast.success(`${newLogos.length} logo/graphic(s) added`);

        } catch (error: unknown) {
            const err = error as { message?: string; code?: string; stack?: string };
            logger.error("[BrandAssets] Upload failed:", err);
            toast.error(`Upload failed: ${err.message || 'Unknown error'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const moveAsset = async (asset: BrandAsset, from: 'style' | 'logo') => {
        const currentKit = userProfile?.brandKit || { brandAssets: [], referenceImages: [] };
        
        if (from === 'style') {
            // Move from Style References to Logos
            const newRefImages = (currentKit.referenceImages || []).filter((a: BrandAsset) => a.url !== asset.url);
            const newLogos = [...(currentKit.brandAssets || []), { ...asset, category: 'logo' as const }];
            
            await updateBrandKit({
                referenceImages: newRefImages,
                brandAssets: newLogos
            });
            toast.success("Moved to Logos & Graphics");
        } else {
            // Move from Logos to Style References
            const MAX_REF = AI_CONFIG.IMAGE.DEFAULT.maxReferenceImages;
            if ((currentKit.referenceImages || []).length >= MAX_REF) {
                toast.error(`Limit reached. You can only have up to ${MAX_REF} style references.`);
                return;
            }

            const newLogos = (currentKit.brandAssets || []).filter((a: BrandAsset) => a.url !== asset.url);
            const newRefImages = [...(currentKit.referenceImages || []), { ...asset, category: 'other' as const }];
            
            await updateBrandKit({
                referenceImages: newRefImages,
                brandAssets: newLogos
            });
            toast.success("Moved to Style References");
        }
    };

    const deleteAsset = async (asset: BrandAsset, from: 'style' | 'logo') => {
        const currentKit = userProfile?.brandKit || { brandAssets: [], referenceImages: [] };
        
        try {
            if (from === 'style') {
                const newRefImages = (currentKit.referenceImages || []).filter((a: BrandAsset) => a.url !== asset.url);
                await updateBrandKit({ referenceImages: newRefImages });
            } else {
                const newLogos = (currentKit.brandAssets || []).filter((a: BrandAsset) => a.url !== asset.url);
                await updateBrandKit({ brandAssets: newLogos });
            }
            toast.success("Asset removed matching project settings");
        } catch (_error) {
            toast.error("Failed to remove asset");
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        try {
            const { auth } = await import('@/services/firebase');
            let downloadUrl = '';
            const assetId = crypto.randomUUID();

            // Check if we should use mock generation (either no auth or explicit guest)
            const isGuest = !auth.currentUser || userProfile?.id === 'guest';
            
            if (import.meta.env.DEV && isGuest) {
                logger.warn("[BrandAssets] Mocking generation for guest session:", prompt);
                downloadUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(prompt)}`;
                await new Promise(resolve => setTimeout(resolve, 1500));
            } else {
                try {
                    const { httpsCallable } = await import('firebase/functions');
                    const generateImage = httpsCallable(functionsWest1, 'generateImageV3');

                    const response = await generateImage({
                        prompt: prompt + " -- style: high quality, professional brand asset",
                        count: 1,
                        aspectRatio: '1:1'
                    });

                    const data = response.data as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> } }> };
                    const candidate = data.candidates?.[0];
                    const part = candidate?.content?.parts?.find(p => p.inlineData);

                    if (part?.inlineData) {
                        const base64Url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        const res = await fetch(base64Url);
                        const blob = await res.blob();
                        const path = `users/${userProfile?.id}/brand_assets/${assetId}`;
                        
                        // StorageService now handles DEV-mode permission fallbacks internally
                        downloadUrl = await StorageService.uploadFile(blob, path);
                    } else {
                        throw new Error("No image data in AI response");
                    }
                } catch (apiError: unknown) {
                    if (import.meta.env.DEV) {
                        logger.error("[BrandAssets] AI API failed in dev, falling back to mock", apiError);
                        downloadUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(prompt)}`;
                    } else {
                        throw apiError;
                    }
                }
            }

            if (downloadUrl) {
                const newAsset: BrandAsset = {
                    url: downloadUrl,
                    description: prompt,
                    category: targetCategory === 'logo' ? 'logo' : 'other'
                };

                const currentKit = userProfile?.brandKit || { brandAssets: [], referenceImages: [] };

                if (targetCategory === 'style_reference') {
                    const MAX_REF = AI_CONFIG.IMAGE.DEFAULT.maxReferenceImages;
                    const currentCount = currentKit.referenceImages?.length || 0;

                    if (currentCount >= MAX_REF) {
                        toast.warning("Limit reached. Asset generated but could not be added to Style References. Adding to Graphics instead.");
                        updateBrandKit({
                            brandAssets: [...(currentKit.brandAssets || []), { ...newAsset, category: 'logo' as const }]
                        });
                    } else {
                        updateBrandKit({
                            referenceImages: [...(currentKit.referenceImages || []), newAsset]
                        });
                        toast.success("Style reference generated and added");
                    }
                } else {
                    updateBrandKit({
                        brandAssets: [...(currentKit.brandAssets || []), newAsset]
                    });
                    toast.success("Brand asset generated and added");
                }

                addUploadedImage({
                    id: assetId,
                    type: 'image',
                    url: downloadUrl,
                    prompt: prompt,
                    timestamp: Date.now(),
                    projectId: currentProjectId || 'personal'
                });

                setPrompt('');
                setActiveTab('upload');
            }

        } catch (error: unknown) {
            const err = error as { message?: string };
            logger.error("[BrandAssets] Generation flow failed:", error);
            toast.error(`Generation failed: ${err.message || 'Unknown error'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="absolute top-full right-0 mt-2 w-80 bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl z-drawer overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-top-2 fade-in duration-200">
            {/* Header */}
            <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-[#111]">
                <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                    <ImageIcon size={14} className="text-white" />
                    Brand Assets
                </h3>
                <button onClick={onClose} aria-label="Close brand assets" className="text-gray-500 hover:text-white transition-colors">
                    <X size={14} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex p-2 gap-2 border-b border-gray-800 bg-[#151515]">
                <button
                    onClick={() => setActiveTab('upload')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${activeTab === 'upload' ? 'bg-[#333] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Upload
                </button>
                <button
                    onClick={() => setActiveTab('generate')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${activeTab === 'generate' ? 'bg-[#333] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Generate AI
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                {activeTab === 'upload' ? (
                    /* Upload Area */
                    <div className="space-y-4">
                        <div>
                            <FileUpload
                                onFilesSelected={(files: File[]) => {
                                    processFiles(files);
                                }}
                                acceptedFileTypes={['image/*']}
                                multiple={true}
                                immediate={true}
                                className="bg-transparent border-none p-0"
                            />
                        </div>

                        {/* Mobile Camera Option */}
                        <div className="md:hidden">
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                id="camera-upload"
                                onChange={handleFileInput}
                            />
                            <label
                                htmlFor="camera-upload"
                                className="w-full py-3 bg-[#222] border border-gray-700 rounded-xl text-white font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform"
                            >
                                <Camera size={18} />
                                Take a Photo
                            </label>
                        </div>
                    </div>
                ) : (
                    /* Generate Area */
                    <div className="mb-6 space-y-3">
                        {/* Target Category Selector */}
                        <div className="flex gap-2 p-1 bg-[#0a0a0a] rounded-lg border border-gray-800">
                            <button
                                onClick={() => setTargetCategory('style_reference')}
                                className={`flex-1 py-1 text-[10px] font-bold rounded flex items-center justify-center gap-1.5 transition-all ${targetCategory === 'style_reference' ? 'bg-white text-black shadow-lg scale-[1.02]' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <Tag size={10} /> Styles
                            </button>
                            <button
                                onClick={() => setTargetCategory('logo')}
                                className={`flex-1 py-1 text-[10px] font-bold rounded flex items-center justify-center gap-1.5 transition-all ${targetCategory === 'logo' ? 'bg-white text-black shadow-lg scale-[1.02]' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <ImageIcon size={10} /> Logos
                            </button>
                        </div>

                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the asset..."
                            className="w-full h-24 bg-[#0f0f0f] border border-gray-700 rounded-lg p-3 text-xs text-white focus:border-white outline-none resize-none placeholder:text-gray-600"
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            className="w-full py-2 bg-white text-black text-xs font-bold rounded hover:bg-gray-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <ImageIcon size={14} />
                                    Generate {targetCategory === 'logo' ? 'Logo' : 'Style'}
                                </>
                            ) }
                        </button>
                    </div>
                )}

                {/* Assets Grid */}
                <div className="space-y-6">
                    {/* Reference Images Section */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex justify-between">
                            Style References
                            <span className={refImages.length >= AI_CONFIG.IMAGE.DEFAULT.maxReferenceImages ? 'text-orange-500' : 'text-gray-400'}>
                                {refImages.length}/{AI_CONFIG.IMAGE.DEFAULT.maxReferenceImages}
                            </span>
                        </h4>
                        {refImages.length === 0 ? (
                            <p className="text-xs text-gray-600 italic text-center py-4">No reference images.</p>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {refImages.map((img: BrandAsset, i: number) => (
                                    <div key={i} className="aspect-square bg-[#0f0f0f] rounded border border-gray-800 overflow-hidden group relative">
                                        <img src={img.url} alt={img.description} title={img.description} className="w-full h-full object-cover" />
                                        
                                        {/* Persistent bottom label */}
                                        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-1.5 pt-4 pointer-events-none group-hover:opacity-0 transition-opacity">
                                            <span className="text-[9px] text-gray-300 line-clamp-1 leading-tight tracking-wide font-medium drop-shadow-md">
                                                {img.description || 'Uploaded File'}
                                            </span>
                                        </div>

                                        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                            <div className="flex gap-1.5">
                                                <button
                                                    className="p-1.5 bg-white rounded text-black hover:bg-gray-200 shadow-xl transition-transform active:scale-90"
                                                    title="Use as Style Input"
                                                    onClick={() => {
                                                        setActiveReferenceImage({
                                                            id: img.id || crypto.randomUUID(),
                                                            type: 'image',
                                                            url: img.url,
                                                            prompt: img.description,
                                                            timestamp: Date.now(),
                                                            projectId: currentProjectId || 'personal'
                                                        });
                                                        toast.success("Style reference selected");
                                                    }}
                                                >
                                                    <Plus size={12} />
                                                </button>
                                                <button
                                                    className="p-1.5 bg-gray-800 rounded text-white hover:bg-white hover:text-black shadow-xl transition-transform active:scale-90"
                                                    title="Move to Logos & Graphics"
                                                    onClick={() => moveAsset(img, 'style')}
                                                >
                                                    <ArrowRightLeft size={12} />
                                                </button>
                                                <button
                                                    className="p-1.5 bg-red-900/50 rounded text-red-100 hover:bg-red-500 hover:text-white shadow-xl transition-transform active:scale-90"
                                                    title="Delete Asset"
                                                    onClick={() => deleteAsset(img, 'style')}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                            <span className="text-[8px] text-gray-400 px-2 text-center line-clamp-2 leading-tight">
                                                {img.description}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Brand Assets Section */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Logos & Graphics</h4>
                        {assets.length === 0 ? (
                            <p className="text-xs text-gray-600 italic text-center py-4">No assets yet.</p>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {assets.map((asset: BrandAsset, i: number) => (
                                    <div key={i} className="aspect-square bg-[#0f0f0f] rounded border border-gray-800 overflow-hidden p-1 group relative">
                                        <img src={asset.url} alt={asset.description} title={asset.description} className="w-full h-full object-contain" />
                                        
                                        {/* Persistent bottom label */}
                                        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-1.5 pt-4 pointer-events-none group-hover:opacity-0 transition-opacity">
                                            <span className="text-[9px] text-gray-300 line-clamp-1 leading-tight tracking-wide font-medium drop-shadow-md">
                                                {asset.description || 'Uploaded File'}
                                            </span>
                                        </div>

                                        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                            <div className="flex gap-1.5">
                                                {onSelect ? (
                                                    <button
                                                        className="p-1.5 bg-white rounded text-black hover:bg-gray-200 shadow-xl transition-transform active:scale-90 flex items-center gap-1 text-[10px] font-bold"
                                                        onClick={() => onSelect(asset)}
                                                    >
                                                        <Plus size={10} /> Select
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="p-1.5 bg-gray-800 rounded text-white hover:bg-white hover:text-black shadow-xl transition-transform active:scale-90"
                                                        title="Convert to Style Reference"
                                                        onClick={() => moveAsset(asset, 'logo')}
                                                    >
                                                        <ArrowRightLeft size={12} />
                                                    </button>
                                                )}
                                                <button
                                                    className="p-1.5 bg-red-900/50 rounded text-red-100 hover:bg-red-500 hover:text-white shadow-xl transition-transform active:scale-90"
                                                    title="Delete Asset"
                                                    onClick={() => deleteAsset(asset, 'logo')}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                            <span className="text-[8px] text-gray-400 px-2 text-center line-clamp-2 leading-tight">
                                                {asset.description}
                                            </span>
                                        </div>
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
