import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { X, Upload, Image as ImageIcon, Plus, Camera } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import FileUpload from '@/components/kokonutui/file-upload';

interface BrandAssetsDrawerProps {
    onClose: () => void;
    onSelect?: (asset: any) => void; // Optional prop for selection mode
}

export default function BrandAssetsDrawer({ onClose, onSelect }: BrandAssetsDrawerProps) {
    const { userProfile, updateBrandKit, addUploadedImage, currentProjectId, setActiveReferenceImage } = useStore();
    const toast = useToast();
    const [isDragging, setIsDragging] = useState(false);
    const [activeTab, setActiveTab] = useState<'upload' | 'generate'>('upload');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Derived state for assets
    const assets = userProfile?.brandKit?.brandAssets || [];
    const refImages = userProfile?.brandKit?.referenceImages || [];

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        await processFiles(files);
    };

    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            await processFiles(files);
        }
    };

    const processFiles = async (files: File[]) => {
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = () => {
                const base64Url = reader.result as string;
                const newAsset = { url: base64Url, description: file.name };
                updateBrandKit({
                    brandAssets: [...(userProfile?.brandKit?.brandAssets || []), newAsset]
                });
                addUploadedImage({
                    id: crypto.randomUUID(),
                    type: 'image',
                    url: base64Url,
                    prompt: file.name,
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });
            };
            reader.readAsDataURL(file);
        }
        if (files.length > 0) {
            toast.success(`${files.length} asset(s) uploaded`);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        try {
            const { functions } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');
            const generateImage = httpsCallable(functions, 'generateImageV3');

            const response = await generateImage({
                prompt: prompt + " -- style: high quality, professional brand asset",
                count: 1,
                aspectRatio: '1:1'
            });

            interface CloudFunctionResponse {
                candidates?: Array<{
                    content?: {
                        parts?: Array<{
                            inlineData?: {
                                mimeType: string;
                                data: string;
                            };
                            text?: string;
                        }>;
                    };
                }>;
            }
            const data = response.data as CloudFunctionResponse;

            // Parse Gemini response for images
            const candidate = data.candidates?.[0];
            const part = candidate?.content?.parts?.find((p) => p.inlineData);

            if (part && part.inlineData) {
                const base64Url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;

                const newAsset = {
                    url: base64Url,
                    description: prompt
                };

                updateBrandKit({
                    brandAssets: [...(userProfile.brandKit.brandAssets || []), newAsset]
                });

                addUploadedImage({
                    id: crypto.randomUUID(),
                    type: 'image',
                    url: base64Url,
                    prompt: prompt,
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });

                toast.success("Asset generated and added");
                setPrompt('');
                setActiveTab('upload'); // Switch back to view it
            } else {
                console.error("No image data in response", data);
                toast.error("Failed to generate image");
            }

        } catch (error) {
            console.error("Generation failed:", error);
            toast.error("Generation failed");
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
                        <FileUpload
                            onUploadSuccess={(file) => {
                                processFiles([file]);
                            }}
                            acceptedFileTypes={['image/*']}
                            multiple={true}
                            immediate={true}
                            className="bg-transparent border-none p-0"
                        />

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
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the asset..."
                            className="w-full h-24 bg-[#0f0f0f] border border-gray-700 rounded-lg p-3 text-xs text-white focus:border-white outline-none resize-none"
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            className="w-full py-2 bg-white text-black text-xs font-bold rounded hover:bg-gray-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            {isGenerating ? 'Generating...' : 'Generate New Asset'}
                        </button>
                    </div>
                )}

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
                                                    className="p-1 bg-white rounded hover:bg-gray-200 text-black transition-colors"
                                                    title="Select Asset"
                                                    onClick={() => onSelect(asset)}
                                                >
                                                    <Plus size={12} /> Select
                                                </button>
                                            ) : (
                                                <button
                                                    className="p-1 bg-gray-700 rounded hover:bg-white hover:text-black text-white transition-colors"
                                                    title="Use as Reference"
                                                    aria-label="Use as Reference"
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
