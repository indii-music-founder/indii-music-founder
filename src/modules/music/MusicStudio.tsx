import React, { useState, useEffect, useRef } from 'react';
import { Music, Upload, FileAudio, Activity, BarChart3, Zap, Heart, Waves, Play, Pause, SkipForward, SkipBack, Volume2, Disc, Image as ImageIcon, Video, Loader2, BotMessageSquare } from 'lucide-react';
import AgentWindow from '../../core/components/AgentWindow';
import { DualAgentService } from '../../services/agent/DualAgentService';
import { MUSIC_TOOLS, MUSIC_MANAGER_PROMPT, MUSIC_EXECUTOR_PROMPT } from './tools';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { Image } from '@/services/image/ImageService';
import { motion, AnimatePresence } from 'framer-motion';

const musicAgent = new DualAgentService(
    {
        name: "Lead Audio Analyst",
        role: "Manager",
        systemPrompt: MUSIC_MANAGER_PROMPT,
        tools: {}
    },
    {
        name: "Audio Technician",
        role: "Executor",
        systemPrompt: MUSIC_EXECUTOR_PROMPT,
        tools: MUSIC_TOOLS
    }
);

export default function MusicStudio() {
    const { addToHistory, currentProjectId, userProfile } = useStore();
    const toast = useToast();
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGeneratingArt, setIsGeneratingArt] = useState(false);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [videoTreatment, setVideoTreatment] = useState<any>(null);

    // Simulated Visualizer Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);

    const getBrandContext = () => {
        const brandKit = userProfile.brandKit;
        if (!brandKit) return undefined;
        return `
        - Identity: ${userProfile.bio || 'N/A'}
        - Visual Style: ${brandKit.brandDescription || 'N/A'}
        - Colors: ${brandKit.colors.join(', ') || 'N/A'}
        - Fonts: ${brandKit.fonts || 'N/A'}
        - Current Release: ${brandKit.releaseDetails.title} (${brandKit.releaseDetails.type}) - ${brandKit.releaseDetails.mood}
        `;
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('audio/')) {
            setSelectedFile(file);
            handleAnalysis(file);
        }
    };

    // Audio Context Ref
    const audioContextRef = useRef<AudioContext | null>(null);
    const essentiaRef = useRef<any>(null);

    // Initialize Essentia
    useEffect(() => {
        const loadEssentia = async () => {
            try {
                // Dynamic imports to avoid SSR issues and ensure WASM loads correctly
                const { EssentiaWASM } = await import('essentia.js/dist/essentia-wasm.web.js');
                const { Essentia } = await import('essentia.js');

                essentiaRef.current = new Essentia(EssentiaWASM);
                console.log("Essentia.js loaded successfully");
            } catch (error) {
                console.error("Failed to load Essentia.js:", error);
            }
        };
        loadEssentia();
    }, []);

    const analyzeAudioFile = async (file: File) => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        const essentia = essentiaRef.current;

        if (!essentia) {
            throw new Error("Essentia not loaded yet");
        }

        const arrayBuffer = await file.arrayBuffer();
        if (!ctx) throw new Error("AudioContext not initialized");
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0); // Left channel

        // Convert to Essentia Vector
        const vectorSignal = essentia.arrayToVector(channelData);

        // 1. Rhythm (BPM & Danceability)
        const rhythm = essentia.RhythmExtractor2013(vectorSignal);
        const bpm = rhythm.bpm;
        // Danceability is usually a separate model in Essentia, but we can infer it from beat confidence + energy
        // Or use a simpler heuristic if the specific model isn't in the standard WASM build.
        // For now, we'll use a heuristic based on beat confidence and energy.

        // 2. Key & Scale
        const keyExtractor = essentia.KeyExtractor(vectorSignal);
        const key = keyExtractor.key;
        const scale = keyExtractor.scale;

        // 3. Energy (RMS)
        const rms = essentia.RMS(vectorSignal).rms;
        const energy = Math.min(rms * 5, 1); // Normalize

        // 4. Timbre (Spectral Centroid / Brightness)
        // We need to frame the signal for spectral analysis
        // Taking a representative segment (e.g., middle 10 seconds)
        const frameSize = 1024;
        const hopSize = 512;
        const midPoint = Math.floor(channelData.length / 2);
        const segment = channelData.slice(midPoint, midPoint + 44100 * 5); // 5 seconds
        const segmentVector = essentia.arrayToVector(segment);

        // Simple spectral centroid average over the segment
        const windowFrame = essentia.Windowing(segmentVector).frame;
        const spectrum = essentia.Spectrum(windowFrame).spectrum;
        const centroid = essentia.SpectralCentroidTime(windowFrame).centroid;
        const brightness = Math.min(centroid / 5000, 1); // Normalize roughly (0-5kHz)

        return {
            duration: audioBuffer.duration,
            bpm: Math.round(bpm),
            key: `${key} ${scale}`,
            energy: energy,
            danceability: (rhythm.confidence * energy).toFixed(2), // Heuristic
            brightness: brightness
        };
    };

    const handleAnalysis = async (file: File) => {
        setIsAnalyzing(true);
        setAnalysisData(null);

        try {
            // 1. Perform Deep Analysis with Essentia
            const metrics = await analyzeAudioFile(file);
            console.log("Essentia Metrics:", metrics);

            // 2. Trigger Agent with Deep Hints
            musicAgent.processGoal(`Analyze '${file.name}'. Essentia Metrics: ${JSON.stringify(metrics)}. Extract deep semantic mood and generate visual prompt.`);

            // 3. Wait for Agent
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 4. Call the tool directly (bypassing full agent loop for demo)
            const analysisJson = await MUSIC_TOOLS.analyze_audio_features({
                filename: file.name,
                physical_metrics: metrics
            });

            const analysis = JSON.parse(analysisJson);

            // Merge Essentia data with Agent's semantic data
            const finalAnalysis = {
                ...analysis,
                rhythm: { ...analysis.rhythm, bpm: metrics.bpm },
                tonality: { ...analysis.tonality, key: metrics.key },
                energy: { ...analysis.energy, intensity: metrics.energy.toFixed(2) }
            };

            setAnalysisData(finalAnalysis);
            toast.success(`Essentia Analysis: ${metrics.bpm} BPM, ${metrics.key}`);

        } catch (error) {
            console.error("Analysis failed:", error);
            toast.error("Failed to analyze audio file. " + (error as any).message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGenerateCoverArt = async () => {
        if (!analysisData) return;
        setIsGeneratingArt(true);
        try {
            const prompt = await MUSIC_TOOLS.generate_visual_prompt({
                analysis_data: JSON.stringify(analysisData),
                brand_context: getBrandContext()
            });

            const images = await Image.generateImages({
                prompt: prompt,
                aspectRatio: '1:1',
                count: 1
            });

            if (images.length > 0) {
                addToHistory({
                    id: images[0].id,
                    url: images[0].url,
                    prompt: images[0].prompt,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });
                toast.success("Cover Art Generated!");
            }
        } catch (error) {
            console.error("Art generation failed:", error);
            toast.error("Failed to generate art.");
        } finally {
            setIsGeneratingArt(false);
        }
    };

    const handleGenerateTreatment = async () => {
        if (!analysisData) return;
        setIsGeneratingVideo(true);
        try {
            const treatmentJson = await MUSIC_TOOLS.generate_video_treatment({
                analysis_data: JSON.stringify(analysisData),
                brand_context: getBrandContext()
            });
            const treatment = JSON.parse(treatmentJson);
            setVideoTreatment(treatment);
            toast.success("Video Treatment Generated!");
        } catch (e) {
            console.error(e);
            toast.error("Failed to generate treatment.");
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (!analysisData) return;

        // If no treatment, generate one first (implicit flow)
        if (!videoTreatment) {
            await handleGenerateTreatment();
            return;
        }

        setIsGeneratingVideo(true);
        try {
            // Use the treatment to drive the video generation
            const prompt = `${videoTreatment.title}: ${videoTreatment.concept}. ${videoTreatment.visual_style}. Camera: ${videoTreatment.camera_movement}.`;

            const videos = await Image.generateVideo({
                prompt: prompt,
                aspectRatio: '16:9',
                resolution: '720p'
            });

            if (videos.length > 0) {
                addToHistory({
                    id: videos[0].id,
                    url: videos[0].url,
                    prompt: videos[0].prompt,
                    type: 'video',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });
                toast.success("Music Video Generated!");
            }
        } catch (error) {
            console.error("Video generation failed:", error);
            toast.error("Failed to generate video.");
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    // Real-time Visualizer Refs
    const realtimeCanvasRef = useRef<HTMLCanvasElement>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const visualizerContextRef = useRef<AudioContext | null>(null);
    const animationFrameRef = useRef<number>(0);

    const drawVisualizer = () => {
        if (!realtimeCanvasRef.current || !analyserRef.current) return;
        const canvas = realtimeCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i]; // Scale factor

                // Dynamic color based on height/intensity
                const r = barHeight + (25 * (i / bufferLength));
                const g = 50;
                const b = 200;

                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };
        draw();
    };

    // WaveSurfer Refs
    const waveformRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const spectrogramRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<any>(null);
    const wsRegions = useRef<any>(null);
    const [isAddingSegment, setIsAddingSegment] = useState(false);

    // Initialize WaveSurfer
    useEffect(() => {
        if (!waveformRef.current || !selectedFile || !timelineRef.current || !spectrogramRef.current) return;

        const initWaveSurfer = async () => {
            const WaveSurfer = (await import('wavesurfer.js')).default;
            const RegionsPlugin = (await import('wavesurfer.js/dist/plugins/regions.esm.js')).default;
            const TimelinePlugin = (await import('wavesurfer.js/dist/plugins/timeline.esm.js')).default;
            const SpectrogramPlugin = (await import('wavesurfer.js/dist/plugins/spectrogram.esm.js')).default;

            if (wavesurfer.current) {
                wavesurfer.current.destroy();
            }

            wavesurfer.current = WaveSurfer.create({
                container: waveformRef.current!,
                waveColor: '#4b5563',
                progressColor: '#a855f7',
                cursorColor: '#d8b4fe',
                barWidth: 2,
                barGap: 1,
                barRadius: 3,
                height: 128,
                normalize: true,
                plugins: [
                    TimelinePlugin.create({
                        container: timelineRef.current!,
                        style: {
                            color: '#9ca3af',
                        }
                    }),
                    SpectrogramPlugin.create({
                        container: spectrogramRef.current!,
                        labels: true,
                        height: 100,
                        labelsColor: '#9ca3af',
                    }),
                    RegionsPlugin.create()
                ]
            });

            wsRegions.current = wavesurfer.current.registerPlugin(RegionsPlugin.create());

            wsRegions.current.on('region-created', (region: any) => {
                setIsAddingSegment(false);
                region.setOptions({ color: 'rgba(168, 85, 247, 0.2)', drag: true, resize: true });
            });

            wsRegions.current.on('region-clicked', (region: any, e: any) => {
                e.stopPropagation();
                region.play();
            });

            // Load audio
            const url = URL.createObjectURL(selectedFile);
            wavesurfer.current.load(url);

            wavesurfer.current.on('finish', () => setIsPlaying(false));
            wavesurfer.current.on('play', () => setIsPlaying(true));
            wavesurfer.current.on('pause', () => setIsPlaying(false));

            // Setup Real-time Visualizer
            wavesurfer.current.on('ready', () => {
                const media = wavesurfer.current.getMediaElement();
                if (!media) return;

                // Initialize Audio Context for Visualizer
                if (!visualizerContextRef.current) {
                    visualizerContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                }
                const audioCtx = visualizerContextRef.current;

                try {
                    // Create source and analyser
                    const source = audioCtx.createMediaElementSource(media);
                    const analyser = audioCtx.createAnalyser();
                    analyser.fftSize = 256;

                    source.connect(analyser);
                    analyser.connect(audioCtx.destination);

                    analyserRef.current = analyser;
                    drawVisualizer();
                } catch (e) {
                    console.warn("Visualizer connection error (source may already be connected):", e);
                }
            });
        };

        initWaveSurfer();

        return () => {
            if (wavesurfer.current) {
                wavesurfer.current.destroy();
            }
            cancelAnimationFrame(animationFrameRef.current);
            if (visualizerContextRef.current) {
                visualizerContextRef.current.close();
                visualizerContextRef.current = null;
            }
        };
    }, [selectedFile]);

    const handleAddSegment = () => {
        if (wsRegions.current) {
            wsRegions.current.enableDragSelection({
                color: 'rgba(168, 85, 247, 0.2)',
            });
            setIsAddingSegment(true);
        }
    };

    // Playback Controls
    const togglePlay = () => {
        if (wavesurfer.current) {
            wavesurfer.current.playPause();
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0a0a0a] text-white p-6 overflow-hidden">
            <header className="flex items-center gap-4 mb-8 flex-shrink-0">
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                    <Activity size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Deep Audio Analysis Lab</h1>
                    <p className="text-gray-400">Essentia-powered feature extraction & Synesthetic Art Generation.</p>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
                {/* Main Work Area */}
                <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
                    {/* Upload / Visualizer Zone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`
                            flex-1 border-2 border-dashed rounded-2xl flex flex-col p-8 transition-all relative overflow-hidden
                            ${isDragging ? 'border-purple-500 bg-purple-500/10' : 'border-gray-800 bg-gray-900/50'}
                        `}
                    >
                        {/* Real-time Visualizer Canvas */}
                        <canvas
                            ref={realtimeCanvasRef}
                            className="absolute inset-0 w-full h-full opacity-40 pointer-events-none"
                            width={800}
                            height={600}
                        />

                        {selectedFile ? (
                            <div className="w-full h-full flex flex-col z-10 relative">
                                {/* Header Info */}
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-1">{selectedFile.name}</h3>
                                        <p className="text-purple-400 font-mono text-sm">
                                            {analysisData ? `${analysisData.rhythm.bpm} BPM • ${analysisData.tonality.key} • ${analysisData.energy.intensity} Energy` : 'Analyzing...'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedFile(null)}
                                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                    >
                                        <Upload size={20} className="text-gray-400" />
                                    </button>
                                </div>

                                {/* WaveSurfer Container */}
                                <div className="w-full mb-8 bg-black/20 rounded-xl p-4 border border-white/5 space-y-4">
                                    <div ref={timelineRef} />
                                    <div ref={waveformRef} className="w-full" />
                                    <div ref={spectrogramRef} />

                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleAddSegment}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${isAddingSegment ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-purple-500/20 text-purple-400 border border-purple-500/50 hover:bg-purple-500/30'}`}
                                        >
                                            {isAddingSegment ? 'Cancel Selection' : 'Add Segment'}
                                        </button>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex justify-center items-center gap-6 mb-8">
                                    <button className="p-3 text-gray-400 hover:text-white transition-colors"><SkipBack size={24} /></button>
                                    <button
                                        onClick={togglePlay}
                                        className="p-6 bg-white text-black rounded-full hover:scale-105 transition-transform shadow-xl shadow-purple-500/20"
                                    >
                                        {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                                    </button>
                                    <button className="p-3 text-gray-400 hover:text-white transition-colors"><SkipForward size={24} /></button>
                                </div>

                                {/* Analysis Tabs / Creative Brief */}
                                {analysisData && (
                                    <div className="flex-1 bg-black/20 rounded-xl border border-white/5 p-6 overflow-y-auto custom-scrollbar">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Art Department */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 text-purple-400 font-bold uppercase text-xs tracking-wider">
                                                    <ImageIcon size={14} /> Art Department
                                                </div>
                                                <div className="bg-white/5 p-4 rounded-lg space-y-3">
                                                    <div>
                                                        <span className="text-xs text-gray-500 block mb-1">Visual Theme</span>
                                                        <p className="text-sm text-gray-200">Abstract, {analysisData.timbre.brightness} lighting, {analysisData.timbre.roughness > 0.5 ? 'Gritty' : 'Smooth'} texture.</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-500 block mb-1">Color Palette</span>
                                                        <div className="flex gap-2 h-6">
                                                            <div className="flex-1 rounded bg-purple-500/50"></div>
                                                            <div className="flex-1 rounded bg-blue-500/50"></div>
                                                            <div className="flex-1 rounded bg-pink-500/50"></div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={handleGenerateCoverArt}
                                                        disabled={isGeneratingArt}
                                                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                                    >
                                                        {isGeneratingArt ? <Loader2 size={14} className="animate-spin" /> : <Disc size={14} />}
                                                        Generate Cover Art
                                                    </button>
                                                </div>
                                            </div>



                                            {/* Video Department */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 text-blue-400 font-bold uppercase text-xs tracking-wider">
                                                    <Video size={14} /> Video Department
                                                </div>
                                                <div className="bg-white/5 p-4 rounded-lg space-y-3">
                                                    {videoTreatment ? (
                                                        <div className="space-y-3 animate-in fade-in">
                                                            <div>
                                                                <span className="text-xs text-gray-500 block mb-1">Title</span>
                                                                <p className="text-sm font-bold text-white">{videoTreatment.title}</p>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs text-gray-500 block mb-1">Concept</span>
                                                                <p className="text-sm text-gray-200">{videoTreatment.concept}</p>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs text-gray-500 block mb-1">Visual Style</span>
                                                                <p className="text-xs text-gray-300">{videoTreatment.visual_style}</p>
                                                            </div>
                                                            <div className="max-h-32 overflow-y-auto custom-scrollbar bg-black/20 p-2 rounded">
                                                                <span className="text-xs text-gray-500 block mb-1 sticky top-0 bg-transparent">Scenes</span>
                                                                <ul className="space-y-2">
                                                                    {videoTreatment.scenes?.map((scene: any, i: number) => (
                                                                        <li key={i} className="text-xs text-gray-300 flex gap-2">
                                                                            <span className="text-blue-400 font-mono flex-shrink-0">{scene.time}</span>
                                                                            <span>{scene.description}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                            <button
                                                                onClick={handleGenerateVideo}
                                                                disabled={isGeneratingVideo}
                                                                className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                                            >
                                                                {isGeneratingVideo ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
                                                                Render Final Video
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div>
                                                                <span className="text-xs text-gray-500 block mb-1">Pacing</span>
                                                                <p className="text-sm text-gray-200">{analysisData.rhythm.bpm > 120 ? 'Fast-paced cuts' : 'Slow, cinematic flow'} synced to {analysisData.rhythm.bpm} BPM.</p>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs text-gray-500 block mb-1">Mood Board</span>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {Object.keys(analysisData.mood_tags).map(tag => (
                                                                        <span key={tag} className="px-2 py-1 bg-white/10 rounded text-[10px] text-gray-300">{tag}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={handleGenerateTreatment}
                                                                disabled={isGeneratingVideo}
                                                                className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-blue-300 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                                            >
                                                                {isGeneratingVideo ? <Loader2 size={14} className="animate-spin" /> : <BotMessageSquare size={14} />}
                                                                Generate Treatment
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-center pointer-events-none z-10">
                                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-500 group-hover:scale-110 transition-transform">
                                    <Upload size={40} />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Drop Audio File Here</h3>
                                <p className="text-gray-500 max-w-sm mx-auto">
                                    Upload a track to extract Mood, Danceability, Roughness, and generate AI visuals.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Metrics Panel */}
                    <div className="h-48 bg-gray-900/50 rounded-2xl border border-gray-800 p-6 flex flex-col justify-between flex-shrink-0">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-gray-400 tracking-wider">REAL-TIME METRICS</h3>
                            <span className={`text-xs font-bold flex items-center gap-2 ${isAnalyzing ? 'text-yellow-500' : 'text-green-500'}`}>
                                <span className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-yellow-500 animate-ping' : 'bg-green-500'}`}></span>
                                {isAnalyzing ? 'ANALYZING...' : 'ESSENTIA ENGINE READY'}
                            </span>
                        </div>

                        {analysisData ? (
                            <div className="grid grid-cols-3 gap-8">
                                <div>
                                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                                        <span>Energy</span>
                                        <span>{Math.round(analysisData.energy * 100)}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${analysisData.energy * 100}%` }}
                                            className="h-full bg-yellow-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                                        <span>Danceability</span>
                                        <span>{Math.round(analysisData.danceability * 100)}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${analysisData.danceability * 100}%` }}
                                            className="h-full bg-purple-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                                        <span>Valence</span>
                                        <span>High</span>
                                    </div>
                                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: '85%' }}
                                            className="h-full bg-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-600 text-sm italic">
                                Waiting for audio input...
                            </div>
                        )}
                    </div>
                </div>

                {/* Agent Sidebar */}
                <div className="bg-gray-900/30 rounded-2xl border border-gray-800 overflow-hidden flex flex-col">
                    <AgentWindow agent={musicAgent} title="Audio Analyst" className="flex-1" />
                </div>
            </div>
        </div>
    );
}
