import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Video, Film, Music, Shield, Sliders, Play, 
    Sparkles, RefreshCw, Upload, Languages, Eye,
    Sparkle, Info, Download, CheckCircle, Volume2, Plus, Trash2, X
} from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';

interface StoryboardFrame {
    id: string;
    timestamp: number;
    previewUrl: string;
    prompt: string;
}

interface Joint {
    id: string;
    x: number;
    y: number;
    label: string;
}

interface Bone {
    from: string;
    to: string;
}

// Visual performance skeletal presets
const POSE_COORDINATES: Record<string, { joints: Joint[], bones: Bone[] }> = {
    guitar_solo: {
        joints: [
            { id: 'head', x: 50, y: 15, label: 'Head' },
            { id: 'neck', x: 50, y: 22, label: 'Neck' },
            { id: 'l_shoulder', x: 42, y: 25, label: 'Left Shoulder' },
            { id: 'r_shoulder', x: 58, y: 25, label: 'Right Shoulder' },
            { id: 'l_elbow', x: 35, y: 38, label: 'Left Elbow' },
            { id: 'r_elbow', x: 65, y: 35, label: 'Right Elbow' },
            { id: 'l_wrist', x: 45, y: 45, label: 'Left Wrist' },
            { id: 'r_wrist', x: 72, y: 28, label: 'Right Wrist' },
            { id: 'hip', x: 50, y: 55, label: 'Hip' },
            { id: 'l_knee', x: 44, y: 72, label: 'Left Knee' },
            { id: 'r_knee', x: 56, y: 75, label: 'Right Knee' },
            { id: 'l_ankle', x: 42, y: 90, label: 'Left Ankle' },
            { id: 'r_ankle', x: 58, y: 92, label: 'Right Ankle' }
        ],
        bones: [
            { from: 'head', to: 'neck' },
            { from: 'neck', to: 'l_shoulder' },
            { from: 'neck', to: 'r_shoulder' },
            { from: 'l_shoulder', to: 'l_elbow' },
            { from: 'l_elbow', to: 'l_wrist' },
            { from: 'r_shoulder', to: 'r_elbow' },
            { from: 'r_elbow', to: 'r_wrist' },
            { from: 'neck', to: 'hip' },
            { from: 'hip', to: 'l_knee' },
            { from: 'l_knee', to: 'l_ankle' },
            { from: 'hip', to: 'r_knee' },
            { from: 'r_knee', to: 'r_ankle' }
        ]
    },
    mic_stand_lean: {
        joints: [
            { id: 'head', x: 46, y: 13, label: 'Head' },
            { id: 'neck', x: 47, y: 20, label: 'Neck' },
            { id: 'l_shoulder', x: 38, y: 23, label: 'Left Shoulder' },
            { id: 'r_shoulder', x: 54, y: 23, label: 'Right Shoulder' },
            { id: 'l_elbow', x: 32, y: 35, label: 'Left Elbow' },
            { id: 'r_elbow', x: 52, y: 15, label: 'Right Elbow' },
            { id: 'l_wrist', x: 36, y: 48, label: 'Left Wrist' },
            { id: 'r_wrist', x: 48, y: 10, label: 'Right Wrist' },
            { id: 'hip', x: 48, y: 53, label: 'Hip' },
            { id: 'l_knee', x: 40, y: 70, label: 'Left Knee' },
            { id: 'r_knee', x: 52, y: 72, label: 'Right Knee' },
            { id: 'l_ankle', x: 38, y: 88, label: 'Left Ankle' },
            { id: 'r_ankle', x: 54, y: 90, label: 'Right Ankle' }
        ],
        bones: [
            { from: 'head', to: 'neck' },
            { from: 'neck', to: 'l_shoulder' },
            { from: 'neck', to: 'r_shoulder' },
            { from: 'l_shoulder', to: 'l_elbow' },
            { from: 'l_elbow', to: 'l_wrist' },
            { from: 'r_shoulder', to: 'r_elbow' },
            { from: 'r_elbow', to: 'r_wrist' },
            { from: 'neck', to: 'hip' },
            { from: 'hip', to: 'l_knee' },
            { from: 'l_knee', to: 'l_ankle' },
            { from: 'hip', to: 'r_knee' },
            { from: 'r_knee', to: 'r_ankle' }
        ]
    },
    dj_stance: {
        joints: [
            { id: 'head', x: 50, y: 18, label: 'Head' },
            { id: 'neck', x: 50, y: 25, label: 'Neck' },
            { id: 'l_shoulder', x: 40, y: 28, label: 'Left Shoulder' },
            { id: 'r_shoulder', x: 60, y: 28, label: 'Right Shoulder' },
            { id: 'l_elbow', x: 32, y: 42, label: 'Left Elbow' },
            { id: 'r_elbow', x: 68, y: 42, label: 'Right Elbow' },
            { id: 'l_wrist', x: 42, y: 55, label: 'Left Wrist' },
            { id: 'r_wrist', x: 58, y: 55, label: 'Right Wrist' },
            { id: 'hip', x: 50, y: 60, label: 'Hip' },
            { id: 'l_knee', x: 45, y: 76, label: 'Left Knee' },
            { id: 'r_knee', x: 55, y: 76, label: 'Right Knee' },
            { id: 'l_ankle', x: 42, y: 92, label: 'Left Ankle' },
            { id: 'r_ankle', x: 58, y: 92, label: 'Right Ankle' }
        ],
        bones: [
            { from: 'head', to: 'neck' },
            { from: 'neck', to: 'l_shoulder' },
            { from: 'neck', to: 'r_shoulder' },
            { from: 'l_shoulder', to: 'l_elbow' },
            { from: 'l_elbow', to: 'l_wrist' },
            { from: 'r_shoulder', to: 'r_elbow' },
            { from: 'r_elbow', to: 'r_wrist' },
            { from: 'neck', to: 'hip' },
            { from: 'hip', to: 'l_knee' },
            { from: 'l_knee', to: 'l_ankle' },
            { from: 'hip', to: 'r_knee' },
            { from: 'r_knee', to: 'r_ankle' }
        ]
    },
    vocal_belting: {
        joints: [
            { id: 'head', x: 50, y: 12, label: 'Head' },
            { id: 'neck', x: 50, y: 20, label: 'Neck' },
            { id: 'l_shoulder', x: 38, y: 24, label: 'Left Shoulder' },
            { id: 'r_shoulder', x: 62, y: 24, label: 'Right Shoulder' },
            { id: 'l_elbow', x: 30, y: 38, label: 'Left Elbow' },
            { id: 'r_elbow', x: 70, y: 38, label: 'Right Elbow' },
            { id: 'l_wrist', x: 26, y: 24, label: 'Left Wrist' },
            { id: 'r_wrist', x: 74, y: 24, label: 'Right Wrist' },
            { id: 'hip', x: 50, y: 56, label: 'Hip' },
            { id: 'l_knee', x: 42, y: 74, label: 'Left Knee' },
            { id: 'r_knee', x: 58, y: 74, label: 'Right Knee' },
            { id: 'l_ankle', x: 40, y: 92, label: 'Left Ankle' },
            { id: 'r_ankle', x: 60, y: 92, label: 'Right Ankle' }
        ],
        bones: [
            { from: 'head', to: 'neck' },
            { from: 'neck', to: 'l_shoulder' },
            { from: 'neck', to: 'r_shoulder' },
            { from: 'l_shoulder', to: 'l_elbow' },
            { from: 'l_elbow', to: 'l_wrist' },
            { from: 'r_shoulder', to: 'r_elbow' },
            { from: 'r_elbow', to: 'r_wrist' },
            { from: 'neck', to: 'hip' },
            { from: 'hip', to: 'l_knee' },
            { from: 'l_knee', to: 'l_ankle' },
            { from: 'hip', to: 'r_knee' },
            { from: 'r_knee', to: 'r_ankle' }
        ]
    },
    t_pose: {
        joints: [
            { id: 'head', x: 50, y: 15, label: 'Head' },
            { id: 'neck', x: 50, y: 22, label: 'Neck' },
            { id: 'l_shoulder', x: 36, y: 25, label: 'Left Shoulder' },
            { id: 'r_shoulder', x: 64, y: 25, label: 'Right Shoulder' },
            { id: 'l_elbow', x: 22, y: 25, label: 'Left Elbow' },
            { id: 'r_elbow', x: 78, y: 25, label: 'Right Elbow' },
            { id: 'l_wrist', x: 8, y: 25, label: 'Left Wrist' },
            { id: 'r_wrist', x: 92, y: 25, label: 'Right Wrist' },
            { id: 'hip', x: 50, y: 54, label: 'Hip' },
            { id: 'l_knee', x: 44, y: 72, label: 'Left Knee' },
            { id: 'r_knee', x: 56, y: 72, label: 'Right Knee' },
            { id: 'l_ankle', x: 44, y: 92, label: 'Left Ankle' },
            { id: 'r_ankle', x: 56, y: 92, label: 'Right Ankle' }
        ],
        bones: [
            { from: 'head', to: 'neck' },
            { from: 'neck', to: 'l_shoulder' },
            { from: 'neck', to: 'r_shoulder' },
            { from: 'l_shoulder', to: 'l_elbow' },
            { from: 'l_elbow', to: 'l_wrist' },
            { from: 'r_shoulder', to: 'r_elbow' },
            { from: 'r_elbow', to: 'r_wrist' },
            { from: 'neck', to: 'hip' },
            { from: 'hip', to: 'l_knee' },
            { from: 'l_knee', to: 'l_ankle' },
            { from: 'hip', to: 'r_knee' },
            { from: 'r_knee', to: 'r_ankle' }
        ]
    }
};

export default function OmniWorkflow() {
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    // Global Store State Connection
    const { 
        studioControls, 
        setStudioControls, 
        addToHistory, 
        currentProjectId 
    } = useStore(useShallow((state: any) => ({
        studioControls: state.studioControls,
        setStudioControls: state.setStudioControls,
        addToHistory: state.addToHistory,
        currentProjectId: state.currentProjectId
    })));

    // Local Interactive States
    const [isRemixing, setIsRemixing] = useState(false);
    const [remixPrompt, setRemixPrompt] = useState('Remix performance into a cyberpunk neon concert stage, dramatic volumetric fog');
    const [refVideoFile, setRefVideoFile] = useState<File | null>(null);
    const [audioDubFile, setAudioDubFile] = useState<File | null>(null);
    const [activeFrameIndex, setActiveFrameIndex] = useState(0);
    const [outputVideoUrl, setOutputVideoUrl] = useState<string | null>(null);

    // Storyboard frame modal/creator state
    const [isAddingFrame, setIsAddingFrame] = useState(false);
    const [newFrameTimestamp, setNewFrameTimestamp] = useState<number>(10.0);
    const [newFramePrompt, setNewFramePrompt] = useState<string>('Zooming out from DJ decks under swirling purple lasers');

    // Flow Storyboard frames (dynamic state)
    const [storyboard, setStoryboard] = useState<StoryboardFrame[]>([
        { id: '1', timestamp: 0, previewUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=300&q=80', prompt: 'Artist stands center stage, holding base posture under volumetric backlights' },
        { id: '2', timestamp: 3.5, previewUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80', prompt: 'Dynamic zoom in, preserving skeletal alignment while swapping background to neon lights' },
        { id: '3', timestamp: 7.2, previewUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80', prompt: 'Volumetric color shift syncs directly with the kick drum beat pulse rate' },
    ]);

    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setRefVideoFile(file);
            const previewUrl = URL.createObjectURL(file);
            setStudioControls({ omniReferenceVideo: previewUrl });
            toast.success(`Loaded reference performance: ${file.name}`);
        }
    };

    const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAudioDubFile(file);
            toast.success(`Loaded multilingual audio track: ${file.name}`);
        }
    };

    const handleStartRemix = () => {
        if (!studioControls.omniReferenceVideo) {
            toast.error("Please upload an artist base performance video first!");
            return;
        }

        setIsRemixing(true);
        setOutputVideoUrl(null);
        toast.info(`Synthesizing Omni Remix (${studioControls.omniPipelineMode === 'hybrid-veo' ? 'Omni + Veo 3.1 hybrid' : 'pure Omni'})...`);

        setTimeout(() => {
            setIsRemixing(false);
            const demoVideoUrl = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
            setOutputVideoUrl(demoVideoUrl);

            // Add generated result to showroom history
            const remixId = `omni_remix_${Date.now()}`;
            addToHistory({
                id: remixId,
                type: 'video',
                url: demoVideoUrl,
                prompt: `Omni Remix: ${remixPrompt}. [Pipeline: ${studioControls.omniPipelineMode}, Pose Preset: ${studioControls.activePosePreset}, Dub Lang: ${studioControls.selectedLanguage}, Lyrics: "${studioControls.lyricsText || 'None'}" (${studioControls.typographyStyle}), X-Ray Lock: ${studioControls.characterXRay ? 'ON' : 'OFF'}, Beat Pulse: ${studioControls.beatPulse * 100}%, Pose preservation: ${studioControls.posePreservation * 100}%]`,
                timestamp: Date.now(),
                projectId: currentProjectId || '',
                origin: 'generated'
            });

            toast.success("Omni performance remix completed! Video added to Showroom.");
        }, 4000);
    };

    const handleDownload = () => {
        if (!outputVideoUrl) return;

        // Custom Electron download bridge check
        if (typeof window !== 'undefined' && 'electron' in window) {
            try {
                (window.electron as any).saveAsset({
                    url: outputVideoUrl,
                    type: 'video',
                    name: `omni_remix_${Date.now()}.mp4`
                });
                toast.success("Saved video to local timeline disk!");
                return;
            } catch (err) {
                console.error("Electron saving failed, falling back to browser download", err);
            }
        }

        // Browser fallback
        const a = document.createElement('a');
        a.href = outputVideoUrl;
        a.download = `omni_remix_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("Downloading video file...");
    };

    // Storyboard Frame Actions
    const handleAddFrame = () => {
        if (!newFramePrompt.trim()) {
            toast.error("Please specify a scene prompt!");
            return;
        }

        const newFrame: StoryboardFrame = {
            id: `frame_${Date.now()}`,
            timestamp: newFrameTimestamp,
            previewUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=300&q=80',
            prompt: newFramePrompt
        };

        setStoryboard(prev => [...prev, newFrame].sort((a, b) => a.timestamp - b.timestamp));
        setIsAddingFrame(false);
        setNewFramePrompt('');
        toast.success("Added new scene frame to storyboard sequence!");
    };

    const handleDeleteFrame = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (storyboard.length <= 1) {
            toast.error("You must retain at least one storyboard frame!");
            return;
        }
        setStoryboard(prev => prev.filter(f => f.id !== id));
        setActiveFrameIndex(0);
        toast.info("Removed frame from sequence");
    };

    const activePosePreset = POSE_COORDINATES[studioControls.activePosePreset] || POSE_COORDINATES['guitar_solo'] || { joints: [], bones: [] };
    const visualizerColor = studioControls.visualizerColor || '#8B5CF6';
    const pulseIntensity = studioControls.beatPulse || 0.5;

    return (
        <div className="flex-1 flex overflow-hidden h-full bg-[#070709] text-white select-none">
            {/* Left Panel: Stage & Live Preview */}
            <div className="flex-1 flex flex-col p-6 min-w-0 border-r border-white/5 relative">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                        <div className="p-1 bg-purple-500/10 rounded-lg">
                            <Video size={14} className="text-purple-400" />
                        </div>
                        Gemini Omni Stage
                    </h2>
                    {studioControls.omniReferenceVideo && (
                        <button 
                            onClick={() => { 
                                setRefVideoFile(null); 
                                setStudioControls({ omniReferenceVideo: null }); 
                                setOutputVideoUrl(null);
                                toast.info("Reference video cleared");
                            }}
                            className="text-[10px] text-gray-500 hover:text-red-400 uppercase font-mono tracking-wider font-bold transition-colors"
                        >
                            Reset Source
                        </button>
                    )}
                </div>

                {/* Main Video Arena */}
                <div className="flex-1 flex flex-col items-center justify-center border border-white/10 rounded-2xl bg-white/[0.02] shadow-2xl relative overflow-hidden group">
                    {/* Synchronized Beat Pulse Glow Rings */}
                    <div 
                        className="absolute inset-0 rounded-2xl pointer-events-none transition-all duration-300"
                        style={{
                            boxShadow: `inset 0 0 ${40 + pulseIntensity * 40}px ${visualizerColor}${isRemixing ? '33' : '15'}`,
                            border: `2.5px solid ${visualizerColor}${isRemixing ? '66' : '22'}`
                        }}
                    />

                    {/* Background glows */}
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

                    {outputVideoUrl ? (
                        <div className="absolute inset-0 w-full h-full flex flex-col justify-between p-4 z-10 bg-black">
                            <video 
                                src={outputVideoUrl} 
                                className="w-full h-full object-cover rounded-xl"
                                controls 
                                autoPlay 
                                loop
                            />
                            {/* Synth ID Watermark Overlay Indicator */}
                            {studioControls.synthIdEnabled && (
                                <div className="absolute top-6 right-6 flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md rounded-full shadow-lg pointer-events-none select-none z-30">
                                    <Shield size={10} className="text-emerald-400" />
                                    <span className="text-[9px] font-bold text-emerald-400 font-mono uppercase tracking-widest">SynthID Protected</span>
                                </div>
                            )}

                            {/* Dynamic Kinetic Lyric Typography Preview Layer */}
                            {studioControls.lyricsText && (
                                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 text-center select-none max-w-lg px-6 py-3 rounded-xl backdrop-blur-md border border-white/10 shadow-2xl bg-black/60">
                                    <p className={`text-base font-bold tracking-wide transition-all ${
                                        studioControls.typographyStyle === 'cyberpunk' ? 'font-mono text-purple-400 uppercase tracking-widest animate-pulse' :
                                        studioControls.typographyStyle === 'kinetic-neon' ? 'font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase' :
                                        studioControls.typographyStyle === 'liquid-gold' ? 'font-serif italic text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 drop-shadow-md' :
                                        'font-sans text-white font-medium tracking-normal'
                                    }`}>
                                        {studioControls.lyricsText}
                                    </p>
                                    <span className="text-[7px] text-gray-500 font-mono block mt-1 uppercase tracking-widest">{studioControls.typographyStyle} OVERLAY</span>
                                </div>
                            )}

                            <button 
                                onClick={handleDownload}
                                className="absolute bottom-6 right-6 bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-full shadow-2xl hover:scale-105 transition-all flex items-center justify-center border border-purple-400/30 z-20"
                                title="Download Synthesized Master"
                            >
                                <Download size={16} />
                            </button>
                        </div>
                    ) : studioControls.omniReferenceVideo ? (
                        <div className="absolute inset-0 flex flex-col justify-between p-4 z-10">
                            {/* Overlay Badge */}
                            <div className="flex items-center gap-2 self-start px-2.5 py-1.5 bg-black/60 rounded-lg border border-white/10 backdrop-blur-md">
                                <Film size={12} className="text-purple-400 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase font-mono tracking-wider">Base Performance Active</span>
                            </div>

                            {/* Dynamic Kinetic Lyric Typography Preview Layer (on base reference) */}
                            {studioControls.lyricsText && (
                                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 text-center select-none max-w-lg px-6 py-3 rounded-xl backdrop-blur-md border border-white/10 shadow-2xl bg-black/60">
                                    <p className={`text-base font-bold tracking-wide transition-all ${
                                        studioControls.typographyStyle === 'cyberpunk' ? 'font-mono text-purple-400 uppercase tracking-widest animate-pulse' :
                                        studioControls.typographyStyle === 'kinetic-neon' ? 'font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase' :
                                        studioControls.typographyStyle === 'liquid-gold' ? 'font-serif italic text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 drop-shadow-md' :
                                        'font-sans text-white font-medium tracking-normal'
                                    }`}>
                                        {studioControls.lyricsText}
                                    </p>
                                    <span className="text-[7px] text-gray-500 font-mono block mt-1 uppercase tracking-widest">{studioControls.typographyStyle} OVERLAY</span>
                                </div>
                            )}
                            
                            {/* Interactive Character X-ray skeletal mesh overlay */}
                            {studioControls.characterXRay && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    {/* Skeletal Pose Presets Wireframe Canvas */}
                                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                        <g stroke={visualizerColor} strokeWidth="1.5" opacity="0.8" strokeLinecap="round">
                                            {activePosePreset.bones.map((bone, idx) => {
                                                const fromJoint = activePosePreset.joints.find(j => j.id === bone.from);
                                                const toJoint = activePosePreset.joints.find(j => j.id === bone.to);
                                                if (!fromJoint || !toJoint) return null;
                                                return (
                                                    <line 
                                                        key={`bone-${idx}`} 
                                                        x1={fromJoint.x} 
                                                        y1={fromJoint.y} 
                                                        x2={toJoint.x} 
                                                        y2={toJoint.y} 
                                                    />
                                                );
                                            })}
                                        </g>
                                        <g>
                                            {activePosePreset.joints.map((joint) => (
                                                <circle 
                                                    key={`joint-${joint.id}`}
                                                    cx={joint.x}
                                                    cy={joint.y}
                                                    r="2"
                                                    fill="#10B981"
                                                    stroke="#FFFFFF"
                                                    strokeWidth="0.5"
                                                    className="animate-pulse"
                                                    style={{ filter: `drop-shadow(0 0 4px ${visualizerColor})` }}
                                                />
                                            ))}
                                        </g>
                                    </svg>
                                    <motion.div 
                                        initial={{ opacity: 0.3 }}
                                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                        className="text-[10px] font-mono text-emerald-400 uppercase font-bold px-3 py-1.5 bg-black/85 rounded-lg border border-emerald-500/30 flex items-center gap-1.5 shadow-xl shadow-emerald-950/20 z-10 self-center"
                                    >
                                        <Eye size={12} className="animate-pulse text-emerald-400" /> Pose locked: {studioControls.activePosePreset.replace('_', ' ')}
                                    </motion.div>
                                </div>
                            )}

                            <div className="w-full h-full flex items-center justify-center opacity-80 pointer-events-none select-none">
                                <Video size={64} className="text-white/10 animate-pulse" />
                            </div>

                            <div className="flex items-center justify-between mt-auto z-10">
                                <span className="text-[10px] font-mono text-gray-500 bg-black/40 px-2 py-1 rounded border border-white/5 truncate max-w-[200px]">{refVideoFile?.name || "base_performance.mp4"}</span>
                                <span className="text-[9px] font-mono text-purple-400 font-bold uppercase tracking-widest">{studioControls.omniPipelineMode === 'hybrid-veo' ? 'OMNI + VEO 3.1 HYBRID' : 'PURE OMNI V2V ENGINE'}</span>
                            </div>
                        </div>
                    ) : (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center p-12 cursor-pointer select-none text-center hover:bg-white/[0.04] transition-all rounded-xl h-full w-full border border-dashed border-white/10 hover:border-purple-500/40"
                        >
                            <div className="p-4 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-4 group-hover:scale-115 transition-all shadow-inner shadow-purple-500/5">
                                <Upload size={28} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest text-white">Upload Artist Base Performance</span>
                            <span className="text-[10px] text-gray-500 mt-1.5 uppercase tracking-wider font-mono">Drag and drop `.mp4`/`.mov` or click to browse</span>
                            <input 
                                type="file" 
                                id="omni-video-file-input"
                                ref={fileInputRef}
                                accept="video/*" 
                                onChange={handleVideoUpload} 
                                className="hidden" 
                            />
                        </div>
                    )}
                </div>

                {/* Bottom Storyboard Panel */}
                <div className="h-48 mt-6 border-t border-white/5 pt-4 flex flex-col gap-2 shrink-0">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">Storyboard Sequences (Flow Builder)</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-purple-400 uppercase font-mono tracking-widest">{storyboard.length} Scenes Synced</span>
                            <button
                                onClick={() => setIsAddingFrame(true)}
                                className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-500 text-[9px] font-bold uppercase font-mono tracking-wider rounded transition-colors"
                            >
                                <Plus size={10} /> Add Frame
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                        {storyboard.map((frame, i) => (
                            <motion.div 
                                key={frame.id} 
                                whileHover={{ y: -2, borderColor: 'rgba(147, 51, 234, 0.4)' }}
                                onClick={() => setActiveFrameIndex(i)}
                                className={`w-52 bg-white/[0.03] rounded-xl border p-2 flex flex-col justify-between shrink-0 relative cursor-pointer transition-all ${
                                    activeFrameIndex === i ? 'border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.15)] bg-purple-500/[0.02]' : 'border-white/10'
                                }`}
                            >
                                <div className="h-24 bg-black rounded-lg flex items-center justify-center overflow-hidden border border-white/5 relative">
                                    <img src={frame.previewUrl} alt={frame.prompt} className="w-full h-full object-cover opacity-80" />
                                    <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/75 rounded text-[8px] font-mono text-purple-300 border border-white/10">
                                        Frame {i + 1} ({frame.timestamp}s)
                                    </div>
                                    <button 
                                        onClick={(e) => handleDeleteFrame(frame.id, e)}
                                        className="absolute top-2 right-2 p-1 bg-black/70 hover:bg-red-500/85 hover:text-white text-gray-400 border border-white/10 rounded-md transition-colors"
                                        title="Delete Frame"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                                <span className="text-[9px] text-gray-400 line-clamp-2 mt-1.5 select-text leading-relaxed font-mono font-medium">{frame.prompt}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel: Omni Controller & Dubbing */}
            <div className="w-80 border-l border-white/5 flex flex-col bg-[#08080a] p-4 shrink-0 overflow-y-auto custom-scrollbar">
                <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                    <Sliders size={14} className="text-purple-400" />
                    Omni Controller
                </h3>

                <div className="space-y-6 flex-1 flex flex-col">
                    {/* Conversational Remix Box */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
                            <Sparkle size={11} className="text-purple-400" />
                            Remix Style Directives
                        </label>
                        <textarea
                            value={remixPrompt}
                            onChange={(e) => setRemixPrompt(e.target.value)}
                            className="w-full bg-black/60 text-white text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/10 h-24 resize-none placeholder:text-gray-600 transition-all font-mono leading-relaxed"
                            placeholder="Describe how to augment the performance (backgrounds, style, effects)..."
                        />
                    </div>

                    {/* Character X-ray */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/20 transition-all group">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                                <Eye size={12} className={studioControls.characterXRay ? 'text-emerald-400' : 'text-gray-400'} />
                                Character X-Ray
                            </span>
                            <span className="text-[9px] text-gray-500 mt-0.5">Pose matching & posture locking</span>
                        </div>
                        <button 
                            onClick={() => setStudioControls({ characterXRay: !studioControls.characterXRay })}
                            className={`w-9 h-5 rounded-full relative transition-all ${
                                studioControls.characterXRay 
                                    ? 'bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                                    : 'bg-gray-800'
                            }`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                studioControls.characterXRay ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold text-gray-404 uppercase font-mono tracking-wider">
                                <span>Pose Preservation</span>
                                <span className="font-mono text-purple-400">{(studioControls.posePreservation * 100).toFixed(0)}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="1" step="0.05"
                                value={studioControls.posePreservation} 
                                onChange={(e) => setStudioControls({ posePreservation: parseFloat(e.target.value) })}
                                className="w-full accent-purple-500 bg-black/60 h-1.5 rounded-full outline-none cursor-pointer"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold text-gray-404 uppercase font-mono tracking-wider">
                                <span>Beat Motion Pulse</span>
                                <span className="font-mono text-purple-400">{(studioControls.beatPulse * 100).toFixed(0)}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="1" step="0.05"
                                value={studioControls.beatPulse} 
                                onChange={(e) => setStudioControls({ beatPulse: parseFloat(e.target.value) })}
                                className="w-full accent-purple-500 bg-black/60 h-1.5 rounded-full outline-none cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Dubbing & Lip-Sync */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest font-mono flex items-center gap-1.5">
                            <Languages size={12} className="text-purple-400" />
                            Multilingual Dubbing
                        </span>
                        
                        <div className="relative">
                            <select 
                                value={studioControls.selectedLanguage}
                                onChange={(e) => setStudioControls({ selectedLanguage: e.target.value })}
                                className="w-full bg-black/60 text-[10px] p-2.5 rounded-lg border border-white/10 outline-none text-gray-200 appearance-none font-mono focus:border-purple-500/50"
                            >
                                <option value="es">Spanish Dub (AI Lip-Sync)</option>
                                <option value="ja">Japanese Dub (AI Lip-Sync)</option>
                                <option value="fr">French Dub (AI Lip-Sync)</option>
                                <option value="de">German Dub (AI Lip-Sync)</option>
                            </select>
                            <Volume2 size={12} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                        </div>
                        
                        <div className="space-y-2">
                            {audioDubFile ? (
                                <div className="flex items-center justify-between p-2 rounded-lg bg-purple-500/5 border border-purple-500/25">
                                    <span className="text-[9px] font-mono text-purple-300 truncate w-40">{audioDubFile.name}</span>
                                    <CheckCircle size={12} className="text-purple-400 shrink-0" />
                                </div>
                            ) : (
                                <button 
                                    onClick={() => audioInputRef.current?.click()}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20 rounded-lg text-[10px] font-bold uppercase transition-colors tracking-widest font-mono text-purple-300"
                                >
                                    <Music size={12} /> Upload translation audio
                                </button>
                            )}
                            <input 
                                type="file"
                                id="omni-audio-file-input"
                                ref={audioInputRef}
                                accept="audio/*"
                                onChange={handleAudioUpload}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* Synth ID Watermarking */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/20 transition-all group">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                                <Shield size={12} className={studioControls.synthIdEnabled ? 'text-emerald-400' : 'text-gray-400'} />
                                Synth ID Mark
                            </span>
                            <span className="text-[9px] text-gray-500 mt-0.5">Imperceptible digital watermark</span>
                        </div>
                        <button 
                            onClick={() => setStudioControls({ synthIdEnabled: !studioControls.synthIdEnabled })}
                            className={`w-9 h-5 rounded-full relative transition-all ${
                                studioControls.synthIdEnabled 
                                    ? 'bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                                    : 'bg-gray-800'
                            }`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                studioControls.synthIdEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>

                    {/* Remix Synthesis Button */}
                    <button 
                        onClick={handleStartRemix}
                        disabled={!studioControls.omniReferenceVideo || isRemixing}
                        className="w-full mt-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-850 disabled:to-gray-850 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold uppercase tracking-widest font-mono flex items-center justify-center gap-2 shadow-xl shadow-purple-500/10 border border-purple-400/20 hover:scale-[1.01] active:scale-[0.99] transition-all shrink-0 text-white"
                    >
                        {isRemixing ? (
                            <>
                                <RefreshCw size={14} className="animate-spin text-purple-200" />
                                Synthesizing Remix...
                            </>
                        ) : (
                            <>
                                <Sparkles size={14} fill="white" className="text-purple-200 animate-pulse" />
                                Synthesize Omni Remix
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Storyboard Add Frame Modal */}
            <AnimatePresence>
                {isAddingFrame && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#0b0b0e] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
                        >
                            <button 
                                onClick={() => setIsAddingFrame(false)}
                                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400 mb-4 flex items-center gap-2">
                                <Plus size={16} /> Add Storyboard Scene Frame
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Timestamp (Seconds)</label>
                                    <input 
                                        type="number" 
                                        step="0.1" 
                                        min="0"
                                        value={newFrameTimestamp}
                                        onChange={(e) => setNewFrameTimestamp(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 outline-none focus:border-purple-500/40 text-xs font-mono text-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Scene Prompt Directive</label>
                                    <textarea 
                                        rows={3}
                                        value={newFramePrompt}
                                        onChange={(e) => setNewFramePrompt(e.target.value)}
                                        placeholder="Describe the styling, action, or camera movement..."
                                        className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 outline-none focus:border-purple-500/40 text-xs font-mono text-white resize-none"
                                    />
                                </div>
                                <button 
                                    onClick={handleAddFrame}
                                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold uppercase tracking-widest font-mono transition-colors text-white"
                                >
                                    Add Frame to Sequence
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
