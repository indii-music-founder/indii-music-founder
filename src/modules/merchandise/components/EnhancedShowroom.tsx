import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Video, Loader2, MonitorPlay, Box, Shirt, Coffee, Smartphone, Framer, Target, Maximize, LayoutGrid, Sparkles } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { MerchandiseService } from '@/services/merchandise/MerchandiseService';
import { Editing } from '@/services/image/EditingService';
import { useStore } from '@/core/store';
import ManufacturingPanel from './ManufacturingPanel';
import { THEMES } from '../themes';

// Placement options for different product types
const placementOptions: Record<string, { id: string; label: string; icon: React.ReactNode }[]> = {
    't-shirt': [
        { id: 'center-chest', label: 'Center Chest', icon: <Target size={14} /> },
        { id: 'left-chest', label: 'Left Chest', icon: <Target size={14} /> },
        { id: 'full-front', label: 'Full Front', icon: <Maximize size={14} /> },
        { id: 'back-print', label: 'Back Print', icon: <LayoutGrid size={14} /> },
    ],
    'hoodie': [
        { id: 'center-chest', label: 'Center Chest', icon: <Target size={14} /> },
        { id: 'kangaroo-pocket', label: 'Pocket Area', icon: <Target size={14} /> },
        { id: 'full-front', label: 'Full Front', icon: <Maximize size={14} /> },
        { id: 'hood', label: 'Hood', icon: <LayoutGrid size={14} /> },
    ],
    'mug': [
        { id: 'wrap-around', label: 'Wrap Around', icon: <Maximize size={14} /> },
        { id: 'front-center', label: 'Front Center', icon: <Target size={14} /> },
        { id: 'both-sides', label: 'Both Sides', icon: <LayoutGrid size={14} /> },
    ],
    'bottle': [
        { id: 'label-wrap', label: 'Label Wrap', icon: <Maximize size={14} /> },
        { id: 'front-label', label: 'Front Label', icon: <Target size={14} /> },
    ],
    'phone': [
        { id: 'full-back', label: 'Full Back', icon: <Maximize size={14} /> },
        { id: 'center-logo', label: 'Center Logo', icon: <Target size={14} /> },
    ],
    'poster': [
        { id: 'full-bleed', label: 'Full Bleed', icon: <Maximize size={14} /> },
        { id: 'centered', label: 'Centered', icon: <Target size={14} /> },
        { id: 'bordered', label: 'With Border', icon: <LayoutGrid size={14} /> },
    ],
};

// Motion presets for video generation
const motionPresets = [
    { id: 'slow-pan-right', label: 'Slow Pan Right', prompt: 'Slow camera pan to the right, smooth cinematic movement' },
    { id: 'slow-pan-left', label: 'Slow Pan Left', prompt: 'Slow camera pan to the left, smooth cinematic movement' },
    { id: 'orbit-360', label: '360° Orbit', prompt: 'Camera slowly orbits around the product in a full 360 degree rotation' },
    { id: 'zoom-in', label: 'Zoom In', prompt: 'Smooth zoom in towards the product, focusing on details' },
    { id: 'zoom-out', label: 'Zoom Out', prompt: 'Smooth zoom out revealing the full scene' },
    { id: 'model-turn', label: 'Model Turn', prompt: 'Model slowly turns to face the camera with a confident look' },
    { id: 'walk-forward', label: 'Walk Forward', prompt: 'Subject walks confidently towards the camera' },
    { id: 'dramatic-reveal', label: 'Dramatic Reveal', prompt: 'Dramatic lighting shift reveals the product with cinematic flair' },
    { id: 'gentle-breeze', label: 'Gentle Breeze', prompt: 'Fabric moves gently in a soft breeze, natural flowing motion' },
    { id: 'static-hero', label: 'Static Hero', prompt: 'Subtle ambient movement, hero product shot with slight camera drift' },
];

interface EnhancedShowroomProps {
    initialAsset?: string | null;
}

export default function EnhancedShowroom({ initialAsset = null }: EnhancedShowroomProps) {
    const toast = useToast();
    const { addToHistory, currentProjectId } = useStore();
    const [activeMobileSection, setActiveMobileSection] = useState<'setup' | 'stage' | 'production'>('stage');

    // State
    const [productAsset, setProductAsset] = useState<string | null>(initialAsset);
    const [productType, setProductType] = useState('t-shirt');
    const [placement, setPlacement] = useState('center-chest');
    const [scenePrompt, setScenePrompt] = useState('');
    const [motionPrompt, setMotionPrompt] = useState('');

    const [mockupResult, setMockupResult] = useState<string | null>(null);
    const [videoResult, setVideoResult] = useState<string | null>(null);

    const [isGeneratingMockup, setIsGeneratingMockup] = useState(false);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [currentVideoJobId, setCurrentVideoJobId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Clean up subscription on unmount
    useEffect(() => {
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    // Monitor video job
    useEffect(() => {
        if (!currentVideoJobId) return;

        // Clean up previous subscription
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
        }

        setIsGeneratingVideo(true);
        unsubscribeRef.current = MerchandiseService.subscribeToVideoJob(currentVideoJobId, (job) => {
            if (!job) return;

            if (job.status === 'completed' && job.videoUrl) {
                setVideoResult(job.videoUrl);
                setIsGeneratingVideo(false);
                setCurrentVideoJobId(null);
                toast.success("Video generated successfully!");

                // Save to history
                if (currentProjectId) {
                    addToHistory({
                        id: job.id,
                        url: job.videoUrl,
                        prompt: `Merchandise Video: ${motionPrompt}`,
                        type: 'video',
                        timestamp: Date.now(),
                        projectId: currentProjectId
                    });
                }
            } else if (job.status === 'failed') {
                setIsGeneratingVideo(false);
                setCurrentVideoJobId(null);
                toast.error(`Video generation failed: ${job.error || 'Unknown error'}`);
            }
        });

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };
    }, [currentVideoJobId, toast, motionPrompt, addToHistory, currentProjectId]);

    // Get current placement options based on product type
    const currentPlacements = placementOptions[productType] || placementOptions['t-shirt'];

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

    // Get placement description for prompt
    const getPlacementDescription = (productType: string, placement: string): string => {
        const descriptions: Record<string, Record<string, string>> = {
            't-shirt': {
                'center-chest': 'centered on the chest area',
                'left-chest': 'on the left chest like a logo placement',
                'full-front': 'as a full-front print covering the entire front',
                'back-print': 'on the back of the shirt',
            },
            'hoodie': {
                'center-chest': 'centered on the chest area',
                'kangaroo-pocket': 'above the kangaroo pocket',
                'full-front': 'as a full-front print',
                'hood': 'on the hood area',
            },
            'mug': {
                'wrap-around': 'wrapping around the entire mug surface',
                'front-center': 'on the front center of the mug',
                'both-sides': 'visible on both sides of the mug',
            },
            'bottle': {
                'label-wrap': 'as a wrap-around label',
                'front-label': 'as a front-facing label',
            },
            'phone': {
                'full-back': 'covering the entire back of the phone case',
                'center-logo': 'as a centered logo on the back',
            },
            'poster': {
                'full-bleed': 'as a full-bleed edge-to-edge print',
                'centered': 'centered with margins',
                'bordered': 'with a decorative border frame',
            },
        };
        return descriptions[productType]?.[placement] || 'prominently displayed';
    };

    const handleGenerateMockup = async () => {
        if (!productAsset || !scenePrompt) {
            toast.error("Please upload an asset and describe the scene.");
            return;
        }

        setIsGeneratingMockup(true);
        const loadingId = toast.loading("Generating product mockup...");

        try {
            // Extract mimeType and data from Data URL
            const match = productAsset.match(/^data:(.+);base64,(.+)$/);
            if (!match) throw new Error("Invalid asset data");

            const assetImage = { mimeType: match[1], data: match[2] };
            const placementDesc = getPlacementDescription(productType, placement);

            // Enhanced texture mapping prompt with placement awareness
            const fullPrompt = `PRODUCT VISUALIZATION TASK:

Product Type: ${productType.replace('-', ' ').toUpperCase()}
Placement: The graphic design should be applied ${placementDesc}.

Scene Description: ${scenePrompt}

CRITICAL INSTRUCTIONS:
1. You are a professional product visualizer and 3D texture mapping expert.
2. Apply the provided graphic design (Reference Image 1) onto the ${productType} with photorealistic accuracy.
3. The graphic MUST:
   - Conform perfectly to the surface geometry and curvature of the ${productType}
   - Follow natural fabric folds, wrinkles, and creases (if applicable)
   - Respect the lighting and shadows of the scene
   - Appear as if it was physically printed/applied to the product
   - Maintain proper perspective distortion based on viewing angle
4. The final image should look like a professional commercial product photograph.
5. Preserve the exact colors and details of the original graphic design.

Style: High-end commercial product photography, 8K resolution, professional studio or environmental lighting.`;

            toast.updateProgress?.(loadingId, 30, "Compositing scene...");

            const result = await Editing.generateComposite({
                images: [assetImage],
                prompt: fullPrompt,
                projectContext: "Premium commercial product visualization with accurate texture mapping."
            });

            toast.updateProgress?.(loadingId, 90, "Finalizing mockup...");

            if (result) {
                setMockupResult(result.url);

                // Save to history
                if (currentProjectId) {
                    addToHistory({
                        id: result.id,
                        url: result.url,
                        prompt: `Showroom Mockup: ${productType} (${placement}) - ${scenePrompt}`,
                        type: 'image',
                        timestamp: Date.now(),
                        projectId: currentProjectId
                    });
                }

                toast.dismiss(loadingId);
                toast.success("Mockup generated successfully!");
            } else {
                toast.dismiss(loadingId);
                toast.error("Failed to generate mockup.");
            }
        } catch (error: unknown) {
            console.error(error);
            toast.dismiss(loadingId);
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

        const loadingId = toast.loading("Starting video generation...");

        try {
            toast.updateProgress?.(loadingId, 20, "Queueing job...");

            const enhancedPrompt = `CINEMATIC PRODUCT VIDEO:

Motion: ${motionPrompt}

REQUIREMENTS:
- Smooth, professional camera movement
- Maintain consistent lighting throughout
- Keep product as the focal point
- High production value, commercial quality
- Natural motion physics

Style: Premium brand commercial, 4K cinematic quality.`;

            const jobId = await MerchandiseService.generateVideo(mockupResult, enhancedPrompt);

            toast.dismiss(loadingId);
            toast.success("Video generation started! This may take a few minutes...");

            // Set job ID to trigger subscription
            setCurrentVideoJobId(jobId);
        } catch (error: unknown) {
            console.error(error);
            toast.dismiss(loadingId);
            setIsGeneratingVideo(false);
            if (error instanceof Error) {
                toast.error(`Failed to start video generation: ${error.message}`);
            } else {
                toast.error("Failed to start video generation: An unknown error occurred.");
            }
        }
    };

    // Handle motion preset selection
    const handleMotionPreset = (preset: typeof motionPresets[0]) => {
        setMotionPrompt(prev => prev ? `${prev} ${preset.prompt}` : preset.prompt);
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
        <div className="flex-1 text-white overflow-hidden flex flex-col bg-black">
            {/* Header */}
            <div className="h-16 border-b border-white/10 flex items-center px-6 justify-between bg-neutral-900">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#FFE135]/20 rounded-lg text-[#FFE135]">
                        <Box size={20} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg">Product Showroom</h1>
                        <p className="text-xs text-neutral-400">Virtual Product Photography & Motion Studio</p>
                    </div>
                </div>
            </div>

            {/* Mobile View Toggle */}
            <div className="lg:hidden flex border-b border-white/10 bg-neutral-900">
                <button
                    onClick={() => setActiveMobileSection('setup')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeMobileSection === 'setup' ? 'text-[#FFE135] border-b-2 border-[#FFE135] bg-white/5' : 'text-neutral-500'}`}
                >
                    Setup (1 & 2)
                </button>
                <button
                    onClick={() => setActiveMobileSection('stage')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeMobileSection === 'stage' ? 'text-[#FFE135] border-b-2 border-[#FFE135] bg-white/5' : 'text-neutral-500'}`}
                >
                    The Stage (3)
                </button>
                <button
                    onClick={() => setActiveMobileSection('production')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeMobileSection === 'production' ? 'text-[#FFE135] border-b-2 border-[#FFE135] bg-white/5' : 'text-neutral-500'}`}
                >
                    Production
                </button>
            </div>

            {/* Main Grid - 4 columns on desktop */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/10 overflow-hidden">

                {/* Column 1: The Asset (Input) */}
                <div className={`${activeMobileSection === 'setup' ? 'flex' : 'hidden'} lg:flex flex-col p-6 overflow-y-auto custom-scrollbar bg-neutral-950`}>
                    <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-neutral-800 text-white flex items-center justify-center text-xs">1</span>
                        The Asset
                    </h2>

                    {/* Dropzone */}
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label="Upload design asset"
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                fileInputRef.current?.click();
                            }
                        }}
                        className={`aspect-square rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-4 mb-8 relative group overflow-hidden focus-visible:ring-2 focus-visible:ring-[#FFE135] focus-visible:outline-none ${productAsset ? 'border-[#FFE135] bg-[#FFE135]/10' : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800'}`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/png,image/jpeg"
                            onChange={handleAssetUpload}
                            data-testid="showroom-upload-input"
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
                                <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:scale-110 transition-transform">
                                    <Upload size={24} />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-neutral-300">Upload Design</p>
                                    <p className="text-xs text-neutral-500 mt-1">PNG with transparency recommended</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Product Type Selector */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Product Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {productTypes.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => {
                                        setProductType(type.id);
                                        // Reset placement to first option for new product type
                                        const newPlacements = placementOptions[type.id];
                                        if (newPlacements && newPlacements.length > 0) {
                                            setPlacement(newPlacements[0].id);
                                        }
                                    }}
                                    data-testid={`showroom-product-${type.id}`}
                                    className={`p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${productType === type.id ? 'bg-[#FFE135]/20 border-[#FFE135] text-[#FFE135]' : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}
                                >
                                    <type.icon size={16} />
                                    <span className="text-sm font-medium">{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Placement Selector */}
                    <div className="space-y-3 mt-6">
                        <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                            <Target size={12} /> Placement
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {currentPlacements.map(option => (
                                <button
                                    key={option.id}
                                    onClick={() => setPlacement(option.id)}
                                    data-testid={`placement-${option.id}`}
                                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all flex items-center gap-2 ${placement === option.id ? 'bg-[#FFE135]/20 border-[#FFE135] text-[#FFE135]' : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}
                                >
                                    {option.icon}
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Column 2: The Scenario (Context) */}
                <div className={`${activeMobileSection === 'setup' ? 'flex' : 'hidden'} lg:flex flex-col p-6 overflow-y-auto custom-scrollbar bg-neutral-950`}>
                    <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-neutral-800 text-white flex items-center justify-center text-xs">2</span>
                        The Scenario
                    </h2>

                    <div className="space-y-6">
                        {/* Scene Description */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                                <ImageIcon size={12} /> Scene Description
                            </label>
                            <textarea
                                value={scenePrompt}
                                onChange={(e) => setScenePrompt(e.target.value)}
                                data-testid="scene-prompt-input"
                                placeholder="E.g. A streetwear model leaning against a brick wall in Tokyo at night..."
                                className="w-full h-32 bg-neutral-900 border border-neutral-700 rounded-xl p-4 text-sm text-white placeholder-neutral-600 focus:border-[#FFE135] outline-none resize-none"
                            />
                        </div>

                        {/* Motion Description */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
                                <Video size={12} /> Motion Description
                            </label>
                            <textarea
                                value={motionPrompt}
                                onChange={(e) => setMotionPrompt(e.target.value)}
                                data-testid="motion-prompt-input"
                                placeholder="E.g. Slow camera pan to the right, model looks at the camera..."
                                className="w-full h-32 bg-neutral-900 border border-neutral-700 rounded-xl p-4 text-sm text-white placeholder-neutral-600 focus:border-[#FFE135] outline-none resize-none"
                                disabled={!mockupResult} // Only enable after mockup
                            />
                            {!mockupResult && (
                                <p className="text-[10px] text-yellow-500/80 flex items-center gap-1">
                                    * Generate a mockup first to enable motion controls.
                                </p>
                            )}
                        </div>

                        {/* Scene Presets */}
                        <div className="pt-4 border-t border-neutral-800">
                            <p className="text-xs font-bold text-neutral-500 uppercase mb-3 flex items-center gap-2">
                                <Sparkles size={12} /> Scene Presets
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { label: 'Studio Minimal', prompt: 'Clean white studio background with soft professional lighting' },
                                    { label: 'Urban Street', prompt: 'Urban street scene with graffiti walls and city atmosphere' },
                                    { label: 'Nature', prompt: 'Outdoor natural setting with greenery and soft sunlight' },
                                    { label: 'Cyberpunk', prompt: 'Neon-lit cyberpunk cityscape with futuristic atmosphere' },
                                    { label: 'Beach Sunset', prompt: 'Golden hour beach setting with warm sunset lighting' },
                                    { label: 'Industrial', prompt: 'Industrial warehouse setting with dramatic lighting' },
                                    { label: 'Fashion Runway', prompt: 'High fashion runway setting with dramatic spotlights' },
                                    { label: 'Cozy Interior', prompt: 'Warm cozy interior setting with ambient lighting' },
                                ].map(preset => (
                                    <button
                                        key={preset.label}
                                        onClick={() => setScenePrompt(prev => prev ? `${prev}. ${preset.prompt}` : preset.prompt)}
                                        data-testid={`showroom-preset-${preset.label}`}
                                        className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-full text-xs text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Motion Presets */}
                        {mockupResult && (
                            <div className="pt-4 border-t border-neutral-800">
                                <p className="text-xs font-bold text-neutral-500 uppercase mb-3 flex items-center gap-2">
                                    <Video size={12} /> Motion Presets
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {motionPresets.map(preset => (
                                        <button
                                            key={preset.id}
                                            onClick={() => handleMotionPreset(preset)}
                                            data-testid={`motion-preset-${preset.id}`}
                                            className="px-3 py-1.5 bg-[#FFE135]/10 border border-[#FFE135]/30 rounded-full text-xs text-[#FFE135] hover:text-white hover:border-[#FFE135] hover:bg-[#FFE135]/20 transition-colors"
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 3: The Stage (Output) */}
                <div className={`${activeMobileSection === 'stage' ? 'flex' : 'hidden'} lg:flex flex-col p-6 bg-black relative`}>
                    <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-neutral-800 text-white flex items-center justify-center text-xs">3</span>
                        The Stage
                    </h2>

                    {/* Preview Monitor */}
                    <div className="flex-1 bg-neutral-950 rounded-2xl border border-neutral-800 relative overflow-hidden flex items-center justify-center mb-6 group">
                        {videoResult ? (
                            <video src={videoResult} controls autoPlay loop className="max-w-full max-h-full object-contain" />
                        ) : mockupResult ? (
                            <img src={mockupResult} alt="Mockup" className="max-w-full max-h-full object-contain" />
                        ) : (
                            <div className="text-center text-neutral-600">
                                <MonitorPlay size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Ready to Render</p>
                            </div>
                        )}

                        {/* Loading Overlay */}
                        {(isGeneratingMockup || isGeneratingVideo) && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                                <Loader2 size={48} className="text-[#FFE135] animate-spin mb-4" />
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
                            data-testid="showroom-generate-mockup-btn"
                            className="py-4 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex flex-col items-center justify-center gap-2 transition-all border border-neutral-700 hover:border-neutral-500"
                        >
                            <ImageIcon size={20} className="text-[#FFE135]" />
                            <span>Generate Mockup</span>
                        </button>

                        <button
                            onClick={handleGenerateVideo}
                            disabled={isGeneratingVideo || !mockupResult || !motionPrompt}
                            data-testid="showroom-animate-scene-btn"
                            className="py-4 bg-[#FFE135]/20 hover:bg-[#FFE135]/40 disabled:opacity-50 disabled:cursor-not-allowed text-[#FFE135] rounded-xl font-bold flex flex-col items-center justify-center gap-2 transition-all border border-[#FFE135]/50 hover:border-[#FFE135]"
                        >
                            <Video size={20} className={mockupResult ? "text-[#FFE135]" : "text-neutral-600"} />
                            <span>Animate Scene</span>
                        </button>
                    </div>
                </div>

                {/* Column 4: Manufacturing Panel */}
                <div className={`${activeMobileSection === 'production' ? 'flex' : 'hidden'} lg:flex flex-col p-6 overflow-y-auto custom-scrollbar bg-neutral-950`}>
                    <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-neutral-800 text-white flex items-center justify-center text-xs">4</span>
                        Production
                    </h2>
                    <ManufacturingPanel
                        theme={THEMES.pro}
                        productType={productType.replace('-', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    />
                </div>
            </div>
        </div >
    );
}
