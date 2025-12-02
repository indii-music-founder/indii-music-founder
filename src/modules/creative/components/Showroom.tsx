import React, { useState, useRef } from 'react';
import { useStore } from '@/core/store';
import { Upload, X, Image as ImageIcon, Video, Wand2, Loader2, Play, MonitorPlay, Box, ArrowRight, Shirt, Coffee, Smartphone, Framer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/core/context/ToastContext';

import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { VideoGeneration } from '@/services/image/VideoGenerationService';
import { Editing } from '@/services/image/EditingService';

export default function Showroom() {
    const { addToHistory, currentProjectId } = useStore();
    const toast = useToast();

    // State
    const [productAsset, setProductAsset] = useState<string | null>(null);
    const [productType, setProductType] = useState('t-shirt');
    const [scenePrompt, setScenePrompt] = useState('');
    const [motionPrompt, setMotionPrompt] = useState('');

    const [mockupResult, setMockupResult] = useState<string | null>(null);
    const [videoResult, setVideoResult] = useState<string | null>(null);

    const [isGeneratingMockup, setIsGeneratingMockup] = useState(false);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handlers
    const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setProductAsset(event.target.result as string);
                toast.success("Asset uploaded successfully");
            }
        };
        reader.readAsDataURL(file);
    };

    const handleGenerateMockup = async () => {
        if (!productAsset || !scenePrompt) {
            toast.error("Please upload an asset and describe the scene.");
            return;
        }

        setIsGeneratingMockup(true);
        try {
            // Extract mimeType and data from Data URL
            const match = productAsset.match(/^data:(.+);base64,(.+)$/);
            if (!match) throw new Error("Invalid asset data");

            const assetImage = { mimeType: match[1], data: match[2] };

            // Construct a specialized prompt for texture mapping
            const fullPrompt = `Product Visualization: ${productType}. ${scenePrompt}. 
            Task: Apply the provided graphic design (Reference 1) onto the ${productType}. 
            Requirements: Photorealistic texture mapping, correct perspective, fabric folds, lighting interaction. 
            The graphic should look like it is physically printed on the object.`;

            const result = await Editing.generateComposite({
                images: [assetImage],
                prompt: fullPrompt,
                projectContext: "High-end commercial product photography."
            });

            if (result) {
                setMockupResult(result.url);

                // Save to history
                addToHistory({
                    id: result.id,
                    url: result.url,
                    prompt: `Showroom Mockup: ${productType} - ${scenePrompt}`,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });

                toast.success("Mockup generated successfully!");
            } else {
                toast.error("Failed to generate mockup.");
            }
        } catch (error: unknown) {
            console.error(error);
            if (error instanceof Error) {
                toast.error(`Failed to generate mockup: ${error.message}`);
            } else {
                toast.error("Failed to generate mockup: An unknown error occurred.");
            }
        } finally {
            setIsGeneratingMockup(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (!mockupResult || !motionPrompt) {
            toast.error("Please generate a mockup first and describe the motion.");
            return;
        }

        setIsGeneratingVideo(true);
        try {
            const results = await VideoGeneration.generateVideo({
                prompt: `Cinematic product showcase. ${motionPrompt}`,
                firstFrame: mockupResult,
                resolution: '720p', // Veo default
                aspectRatio: '16:9'
            });

            if (results && results.length > 0) {
                setVideoResult(results[0].url);

                // Save to history
                addToHistory({
                    id: results[0].id,
                    url: results[0].url,
                    prompt: `Showroom Video: ${motionPrompt}`,
                    type: 'video',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });

                toast.success("Scene animated successfully!");
            } else {
                toast.error("Failed to animate scene.");
            }
        } catch (error: unknown) {
            console.error(error);
            if (error instanceof Error) {
                toast.error(`Failed to animate scene: ${error.message}`);
            }
            else {
                toast.error("Failed to animate scene: An unknown error occurred.");
            }
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    const productTypes = [
        { id: 't-shirt', label: 'T-Shirt', icon: Shirt },
        { id: 'hoodie', label: 'Hoodie', icon: Shirt },
        { id: 'mug', label: 'Mug', icon: Coffee },
        { id: 'bottle', label: 'Bottle', icon: Coffee },
        { id: 'phone', label: 'Phone Case', icon: Smartphone },
        { id: 'poster', label: 'Poster', icon: Framer },
    ];

    return (
        <div className="flex-1 bg-[#0f0f0f] text-white overflow-hidden flex flex-col">
            {/* Header */}
            <div className="h-16 border-b border-gray-800 flex items-center px-6 justify-between bg-[#1a1a1a]">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-900/30 rounded-lg text-purple-400">
                        <Box size={20} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg">Product Showroom</h1>
                        <p className="text-xs text-gray-400">Virtual Product Photography & Motion Studio</p>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-800 overflow-hidden">

                {/* Column 1: The Asset (Input) */}
                <div className="flex flex-col p-6 overflow-y-auto custom-scrollbar bg-[#111]">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs">1</span>
                        The Asset
                    </h2>

                    {/* Dropzone */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`aspect-square rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-4 mb-8 relative group overflow-hidden ${productAsset ? 'border-purple-500 bg-purple-900/10' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800'}`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/png,image/jpeg"
                            onChange={handleAssetUpload}
                        />

                        {productAsset ? (
                            <>
                                <img src={productAsset} alt="Asset" className="w-full h-full object-contain p-4" />
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-sm font-bold">Change Asset</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 group-hover:scale-110 transition-transform">
                                    <Upload size={24} />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-gray-300">Upload Design</p>
                                    <p className="text-xs text-gray-500 mt-1">PNG with transparency recommended</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Product Type Selector */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase">Product Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {productTypes.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setProductType(type.id)}
                                    className={`p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${productType === type.id ? 'bg-purple-900/20 border-purple-500 text-purple-300' : 'bg-[#1a1a1a] border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                >
                                    <type.icon size={16} />
                                    <span className="text-sm font-medium">{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Column 2: The Scenario (Context) */}
                <div className="flex flex-col p-6 overflow-y-auto custom-scrollbar bg-[#111]">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs">2</span>
                        The Scenario
                    </h2>

                    <div className="space-y-6">
                        {/* Scene Description */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                <ImageIcon size={12} /> Scene Description
                            </label>
                            <textarea
                                value={scenePrompt}
                                onChange={(e) => setScenePrompt(e.target.value)}
                                placeholder="E.g. A streetwear model leaning against a brick wall in Tokyo at night..."
                                className="w-full h-32 bg-[#1a1a1a] border border-gray-700 rounded-xl p-4 text-sm text-white placeholder-gray-600 focus:border-purple-500 outline-none resize-none"
                            />
                        </div>

                        {/* Motion Description */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                <Video size={12} /> Motion Description
                            </label>
                            <textarea
                                value={motionPrompt}
                                onChange={(e) => setMotionPrompt(e.target.value)}
                                placeholder="E.g. Slow camera pan to the right, model looks at the camera..."
                                className="w-full h-32 bg-[#1a1a1a] border border-gray-700 rounded-xl p-4 text-sm text-white placeholder-gray-600 focus:border-purple-500 outline-none resize-none"
                                disabled={!mockupResult} // Only enable after mockup
                            />
                            {!mockupResult && (
                                <p className="text-[10px] text-yellow-500/80 flex items-center gap-1">
                                    * Generate a mockup first to enable motion controls.
                                </p>
                            )}
                        </div>

                        {/* Presets (Placeholder) */}
                        <div className="pt-4 border-t border-gray-800">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-3">Quick Presets</p>
                            <div className="flex flex-wrap gap-2">
                                {['Studio Minimal', 'Urban Street', 'Nature', 'Cyberpunk'].map(preset => (
                                    <button
                                        key={preset}
                                        onClick={() => setScenePrompt(prev => prev + (prev ? ' ' : '') + preset + " style.")}
                                        className="px-3 py-1.5 bg-[#1a1a1a] border border-gray-700 rounded-full text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 3: The Stage (Output) */}
                <div className="flex flex-col p-6 bg-[#0a0a0a] relative">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs">3</span>
                        The Stage
                    </h2>

                    {/* Preview Monitor */}
                    <div className="flex-1 bg-[#111] rounded-2xl border border-gray-800 relative overflow-hidden flex items-center justify-center mb-6 group">
                        {videoResult ? (
                            <video src={videoResult} controls autoPlay loop className="max-w-full max-h-full object-contain" />
                        ) : mockupResult ? (
                            <img src={mockupResult} alt="Mockup" className="max-w-full max-h-full object-contain" />
                        ) : (
                            <div className="text-center text-gray-600">
                                <MonitorPlay size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Ready to Render</p>
                            </div>
                        )}

                        {/* Loading Overlay */}
                        {(isGeneratingMockup || isGeneratingVideo) && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                                <Loader2 size={48} className="text-purple-500 animate-spin mb-4" />
                                <p className="text-white font-bold animate-pulse">
                                    {isGeneratingMockup ? "Compositing Scene..." : "Rendering Video..."}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={handleGenerateMockup}
                            disabled={isGeneratingMockup || !productAsset || !scenePrompt}
                            className="py-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex flex-col items-center justify-center gap-2 transition-all border border-gray-700 hover:border-gray-500"
                        >
                            <ImageIcon size={20} className="text-blue-400" />
                            <span>Generate Mockup</span>
                        </button>

                        <button
                            onClick={handleGenerateVideo}
                            disabled={isGeneratingVideo || !mockupResult || !motionPrompt}
                            className="py-4 bg-purple-900/20 hover:bg-purple-900/40 disabled:opacity-50 disabled:cursor-not-allowed text-purple-300 rounded-xl font-bold flex flex-col items-center justify-center gap-2 transition-all border border-purple-900/50 hover:border-purple-500"
                        >
                            <Video size={20} className={mockupResult ? "text-purple-400" : "text-gray-600"} />
                            <span>Animate Scene</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
