import React, { useState } from 'react';
import { Film, Sliders, Image as ImageIcon, ChevronRight, Video, Settings, Plus, Move, Loader2, Sparkles } from 'lucide-react';
import CreativeGallery from '../../../modules/creative/components/CreativeGallery';
import { motion } from 'framer-motion';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { VideoAspectRatioSchema, VideoResolutionSchema } from '@/modules/video/schemas';
import { z } from 'zod';
import { useStore } from '../../store';

type VideoAspectRatio = z.infer<typeof VideoAspectRatioSchema>;
type VideoResolution = z.infer<typeof VideoResolutionSchema>;
import { useToast } from '@/core/context/ToastContext';

interface VideoPanelProps {
    toggleRightPanel: () => void;
}

export default function VideoPanel({ toggleRightPanel }: VideoPanelProps) {
    const [activeTab, setActiveTab] = useState('create');
    const [isGenerating, setIsGenerating] = useState(false);
    // Use global prompt state instead of local
    const { addToHistory, updateHistoryItem, currentProjectId, studioControls, setStudioControls, prompt, videoInputs, setVideoInput, currentOrganizationId } = useStore();
    const toast = useToast();

    const handleRender = async () => {
        if (!prompt.trim()) {
            toast.error("Please enter a video description");
            return;
        }

        setIsGenerating(true);
        try {
            let results: { id: string; url: string; prompt: string; }[] = [];

            if (studioControls.duration > 8) {
                // Trigger Long Form
                results = await VideoGeneration.generateLongFormVideo({
                    prompt: prompt,
                    totalDuration: studioControls.duration,
                    aspectRatio: studioControls.aspectRatio,
                    resolution: studioControls.resolution,
                    negativePrompt: studioControls.negativePrompt,
                    seed: studioControls.seed ? parseInt(studioControls.seed) : undefined,
                    firstFrame: undefined // Logic handled in service if needed
                });
            } else {
                // Trigger Single Shot
                results = await VideoGeneration.generateVideo({
                    prompt: prompt,
                    aspectRatio: studioControls.aspectRatio,
                    resolution: studioControls.resolution,
                    negativePrompt: studioControls.negativePrompt,
                    seed: studioControls.seed ? parseInt(studioControls.seed) : undefined,
                    duration: studioControls.duration,
                    firstFrame: videoInputs.firstFrame?.url,
                    lastFrame: videoInputs.lastFrame?.url,
                    fps: studioControls.fps,
                    cameraMovement: studioControls.cameraMovement,
                    motionStrength: studioControls.motionStrength,
                    orgId: currentOrganizationId
                });
            }

            if (results.length > 0) {
                results.forEach(res => {
                    addToHistory({
                        id: res.id,
                        url: res.url,
                        prompt: res.prompt,
                        type: 'video',
                        timestamp: Date.now(),
                        projectId: currentProjectId
                    });

                    // Subscribe to real-time updates for this job
                    const unsub = VideoGeneration.subscribeToJob(res.id, (job) => {
                        if (job) {
                            if (job.status === 'completed' && job.videoUrl) {
                                console.log(`[VideoPanel] Job ${res.id} completed. Updating URL.`);
                                updateHistoryItem(res.id, { url: job.videoUrl });
                                toast.success("Video generation completed!");
                                unsub();
                            } else if (job.status === 'failed') {
                                console.error(`[VideoPanel] Job ${res.id} failed:`, job.error);
                                toast.error(`Video generation failed: ${job.error}`);
                                unsub();
                            }
                        }
                    });
                });
                toast.success("Video generation started!");
            }
        } catch (e) {
            console.error("Video generation failed:", e);
            toast.error("Video generation failed");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-bg-dark to-bg-dark/90">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg">
                        <Film size={14} className="text-blue-400" />
                    </div>
                    Video Studio
                </h3>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`p-1.5 rounded-md transition-all ${activeTab === 'create' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                            title="Sequencer"
                        >
                            <Sliders size={14} />
                        </button>
                        <button
                            onClick={() => setActiveTab('assets')}
                            className={`p-1.5 rounded-md transition-all ${activeTab === 'assets' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                            title="Assets"
                        >
                            <ImageIcon size={14} />
                        </button>
                    </div>
                    <button onClick={toggleRightPanel} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {activeTab === 'assets' ? (
                <div className="flex-1 overflow-hidden">
                    <CreativeGallery compact={true} />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    {/* Video Inputs (Start/End Frame) */}
                    {(videoInputs.firstFrame || videoInputs.lastFrame) && (
                        <div className="bg-blue-500/5 rounded-xl border border-blue-500/20 p-3 space-y-3">
                            <label className="text-[10px] font-bold text-blue-400 tracking-wider flex items-center gap-2">
                                <Video size={12} /> ACTIVE WORKFLOW INPUTS
                            </label>
                            <div className="flex gap-2">
                                {videoInputs.firstFrame && (
                                    <div className="flex-1 relative group bg-black/40 rounded-lg overflow-hidden border border-white/10 aspect-video">
                                        <img src={videoInputs.firstFrame.url} alt="Start" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[8px] font-bold text-white uppercase tracking-tighter">START FRAME</span>
                                        </div>
                                        <button
                                            onClick={() => setVideoInput('firstFrame', null)}
                                            className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white/60 hover:text-white"
                                        >
                                            <Plus size={10} className="rotate-45" />
                                        </button>
                                    </div>
                                )}
                                {videoInputs.lastFrame && (
                                    <div className="flex-1 relative group bg-black/40 rounded-lg overflow-hidden border border-white/10 aspect-video">
                                        <img src={videoInputs.lastFrame.url} alt="End" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[8px] font-bold text-white uppercase tracking-tighter">END FRAME</span>
                                        </div>
                                        <button
                                            onClick={() => setVideoInput('lastFrame', null)}
                                            className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white/60 hover:text-white"
                                        >
                                            <Plus size={10} className="rotate-45" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Negative Prompt */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-500 tracking-wider">NEGATIVE PROMPT</label>
                        <textarea
                            value={studioControls.negativePrompt}
                            onChange={(e) => setStudioControls({ negativePrompt: e.target.value })}
                            className="w-full bg-black/40 text-white text-sm p-3 rounded-xl border border-white/10 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all h-20 resize-none placeholder:text-gray-600 shadow-inner"
                            placeholder="Blurry, shaky, distorted, text, watermark..."
                        />
                    </div>

                    {/* Technical Settings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">ASPECT RATIO</label>
                            <div className="relative group">
                                <select
                                    value={studioControls.aspectRatio}
                                    onChange={(e) => setStudioControls({ aspectRatio: e.target.value as VideoAspectRatio })}
                                    data-testid="aspect-ratio-select"
                                    className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none cursor-pointer hover:border-white/20 hover:bg-black/60 transition-all"
                                >
                                    <option value="16:9" data-testid="aspect-ratio-option-16-9">16:9 Landscape</option>
                                    <option value="1:1" data-testid="aspect-ratio-option-1-1">1:1 Square</option>
                                    <option value="9:16" data-testid="aspect-ratio-option-9-16">9:16 Portrait</option>
                                    <option value="4:3">4:3 Standard</option>
                                    <option value="3:4">3:4 Vertical</option>
                                </select>
                                <ChevronRight size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none group-hover:text-gray-300 transition-colors rotate-90" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">RESOLUTION</label>
                            <div className="relative group">
                                <select
                                    value={studioControls.resolution || '1024x1024'}
                                    onChange={(e) => setStudioControls({ resolution: e.target.value as VideoResolution })}
                                    data-testid="resolution-select"
                                    className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none appearance-none cursor-pointer hover:border-white/20 hover:bg-black/60 transition-all"
                                >
                                    <option value="1024x1024" data-testid="resolution-option-1k">1K (Square)</option>
                                    <option value="1280x720" data-testid="resolution-option-hd">HD (720p)</option>
                                    <option value="1920x1080" data-testid="resolution-option-fhd">FHD (1080p)</option>
                                    <option value="1080x1920">Vertical (1080x1920)</option>
                                    <option value="720x1280">Vertical (720x1280)</option>
                                </select>
                                <ChevronRight size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none group-hover:text-gray-300 transition-colors rotate-90" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">SEED</label>
                            <input
                                type="text"
                                pattern="[0-9]*"
                                value={studioControls.seed || ''}
                                onChange={(e) => setStudioControls({ seed: e.target.value })}
                                placeholder="Random"
                                className="w-full bg-black/40 text-white text-xs p-2.5 rounded-xl border border-white/10 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-gray-600"
                            />
                        </div>
                    </div>

                    {/* Shot List */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-gray-500 tracking-wider">SHOT LIST</label>
                            <span className="text-[10px] text-gray-600 font-mono">00:00 / 00:15</span>
                        </div>

                        <div className="space-y-2">
                            {[1, 2].map((shot) => (
                                <motion.div
                                    key={shot}
                                    whileHover={{ scale: 1.01 }}
                                    className="group relative bg-black/40 rounded-xl border border-white/10 p-2 flex gap-3 hover:border-blue-500/30 transition-all cursor-pointer shadow-sm"
                                >
                                    <div className="w-16 h-16 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/5">
                                        <Video size={16} className="text-gray-600" />
                                    </div>
                                    <div className="flex-1 min-w-0 py-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-medium text-gray-300 group-hover:text-blue-400 transition-colors">Shot {shot}</span>
                                            <span className="text-[10px] font-mono text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">4.0s</span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 truncate">Cinematic drone shot over mountains...</p>
                                    </div>
                                    <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-1 hover:bg-white/10 rounded"><Settings size={10} className="text-gray-400" /></button>
                                    </div>
                                </motion.div>
                            ))}
                            <button
                                data-testid="add-shot-btn"
                                className="w-full py-3 border border-dashed border-white/10 rounded-xl text-xs text-gray-500 hover:text-gray-300 hover:border-white/20 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={12} /> Add New Shot
                            </button>
                        </div>
                    </div>

                    {/* Motion Controls */}
                    <div className="space-y-4 pt-4 border-t border-white/10">
                        <label className="text-[10px] font-bold text-gray-500 tracking-wider flex items-center gap-2">
                            <Move size={12} /> CAMERA MOVEMENT
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Zoom In', 'Pan Left', 'Tilt Up'].map((move) => (
                                <button
                                    key={move}
                                    data-testid={`camera-${move.toLowerCase().replace(' ', '-')}`}
                                    className="px-2 py-2 bg-black/40 hover:bg-white/10 rounded-lg text-[10px] text-gray-300 border border-white/10 hover:border-white/20 transition-all"
                                >
                                    {move}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">MOTION STRENGTH</label>
                                <span className="text-[10px] text-gray-500 font-mono">{studioControls.motionStrength || 0.5}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={(studioControls.motionStrength || 0.5) * 100}
                                onChange={(e) => setStudioControls({ motionStrength: parseInt(e.target.value) / 100 })}
                                data-testid="motion-slider"
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-all hover:[&::-webkit-slider-thumb]:scale-125"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">FPS</label>
                                <span className="text-[10px] text-gray-500 font-mono">24</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full w-[40%] bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-[10px] font-bold text-gray-500 tracking-wider">DURATION</label>
                                <span className="text-[10px] text-gray-500 font-mono">{studioControls.duration}s</span>
                            </div>
                            <input
                                type="range"
                                min="5"
                                max="60"
                                step="1"
                                value={studioControls.duration}
                                onChange={(e) => setStudioControls({ duration: parseInt(e.target.value) })}
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-all hover:[&::-webkit-slider-thumb]:scale-125"
                            />
                            {studioControls.duration > 8 && (
                                <p className="text-[10px] text-purple-400 flex items-center gap-1">
                                    <Sparkles size={10} /> Long-form generation enabled
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Render Button */}
                    <div className="pt-4 border-t border-white/10">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleRender}
                            disabled={isGenerating || !prompt.trim()}
                            data-testid="render-sequence-btn"
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 border border-blue-400/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
                            {isGenerating ? 'Rendering...' : 'Render Sequence'}
                        </motion.button>
                    </div>
                </div>
            )}
        </div>
    );
}
