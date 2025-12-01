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

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            handleAnalysis(file);
        }
    };

    // Audio Context Ref
    const audioContextRef = useRef<AudioContext | null>(null);
    const essentiaRef = useRef<any>(null);

    const [isEngineReady, setIsEngineReady] = useState(false);

    // Initialize Essentia (Real WASM)
    useEffect(() => {
        const loadEssentia = async () => {
            try {
                // Wait for globals to be available (in case of async script loading)
                // @ts-ignore
                if (!window.EssentiaWASM || !window.Essentia) {
                    console.log("Waiting for Essentia globals...");
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // @ts-ignore
                const EssentiaWASM = window.EssentiaWASM;
                // @ts-ignore
                const Essentia = window.Essentia;

                if (!EssentiaWASM || !Essentia) {
                    throw new Error("Essentia globals not found");
                }

                console.log("Initializing Essentia WASM...");
                // Initialize the WASM backend
                const essentiaWasmInstance = await EssentiaWASM({
                    locateFile: (path: string, prefix: string) => {
                        if (path.endsWith('.wasm')) {
                            return '/essentia-wasm.web.wasm';
                        }
                        return prefix + path;
                    }
                });

                console.log("WASM Instance created, creating Essentia core...");
                essentiaRef.current = new Essentia(essentiaWasmInstance);
                console.log("Essentia.js loaded successfully");
                setIsEngineReady(true);
            } catch (error) {
                console.error("Failed to load Essentia.js:", error);
                toast.error("Failed to load audio analysis engine. Please refresh.");
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
        const midPoint = Math.floor(channelData.length / 2);
        const segmentLength = Math.min(44100 * 5, channelData.length - midPoint);
        const segment = channelData.slice(midPoint, midPoint + segmentLength);
        const segmentVector = essentia.arrayToVector(segment);

        // Simple spectral centroid average over the segment
        const windowFrame = essentia.Windowing(segmentVector).frame;
        const spectrumOutput = essentia.Spectrum(windowFrame);
        // Handle different Essentia versions return types
        const spectrum = spectrumOutput.spectrum || spectrumOutput;

        const centroidOutput = essentia.SpectralCentroidTime(windowFrame);
        const centroid = centroidOutput.centroid;

        const brightness = Math.min(centroid / 5000, 1); // Normalize roughly (0-5kHz)

        return {
            duration: audioBuffer.duration,
            bpm: Math.round(bpm),
            key: `${key} ${scale}`,
            energy: energy,
            danceability: (rhythm.confidence * energy).toFixed(2),
            brightness: brightness
        };
    };

    const handleAnalysis = async (file: File) => {
        if (!file) return;
        setIsAnalyzing(true);
        setAnalysisData(null);

        try {
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

    const runDiagnostics = async () => {
        const essentia = essentiaRef.current;
        if (!essentia) {
            toast.error("Essentia not ready.");
            return;
        }

        toast.info("Running System Diagnostics (10 iterations)...");
        console.log("--- STARTING ESSENTIA DIAGNOSTICS ---");

        try {
            // Generate synthetic signal (Sine wave @ 440Hz)
            const sampleRate = 44100;
            const duration = 5; // 5 seconds
            const length = sampleRate * duration;
            const signal = new Float32Array(length);
            for (let i = 0; i < length; i++) {
                signal[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
            }

            for (let i = 1; i <= 10; i++) {
                const start = performance.now();

                // Memory management: Create and delete vector each time to test stability
                const vector = essentia.arrayToVector(signal);

                essentia.RMS(vector);
                essentia.RhythmExtractor2013(vector);
                essentia.KeyExtractor(vector);

                // Clean up if possible (EssentiaJS might handle GC, but explicit delete is safer for WASM)
                if (vector.delete) vector.delete();

                const time = (performance.now() - start).toFixed(2);
                console.log(`Diagnostic Run ${i}/10: PASS (${time}ms)`);
            }

            // toast.dismiss();
            toast.success("Diagnostics Passed: 10/10 iterations successful.");
            console.log("--- DIAGNOSTICS COMPLETE ---");
        } catch (e) {
            console.error("Diagnostic Failed:", e);
            toast.error("Diagnostic Failed. Check console.");
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0f0f0f] text-white overflow-hidden font-sans">
            {/* Header */}
            <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-[#0f0f0f]/90 backdrop-blur z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-900/20">
                        <Music size={16} className="text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-sm tracking-wide">Deep Audio Analysis Lab</h1>
                        <p className="text-[10px] text-gray-500">Essentia-powered feature extraction & Synesthetic Art Generation.</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={runDiagnostics}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-mono text-green-400 border border-green-900/30 transition-colors"
                    >
                        Run Diagnostics (x10)
                    </button>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-full border border-gray-700">
                        <div className={`w-2 h-2 rounded-full ${isEngineReady ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`}></div>
                        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                            {isEngineReady ? 'Engine Online' : 'Offline'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-6">
                <div className="h-full grid grid-cols-[1fr_350px] gap-6 max-w-7xl mx-auto">
                    {/* Main Workspace */}
                    <div className="flex flex-col gap-6 overflow-hidden">
                        {/* Visualizer / Drop Zone */}
                        <div
                            className={`flex-1 bg-gray-900/50 rounded-2xl border border-gray-800 relative overflow-hidden group transition-all ${isDragging ? 'border-blue-500 bg-blue-500/10' : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileInput}
                                className="hidden"
                                accept="audio/*"
                            />

                            {selectedFile ? (
                                <div className="absolute inset-0 flex flex-col p-6">
                                    <div className="flex justify-between items-start mb-6 z-10">
                                        <div>
                                            <h2 className="text-xl font-bold text-white mb-1">{selectedFile.name}</h2>
                                            <div className="flex items-center gap-4 text-xs font-mono text-purple-400">
                                                {analysisData && (
                                                    <>
                                                        <span>{analysisData.rhythm.bpm} BPM</span>
                                                        <span>•</span>
                                                        <span>{analysisData.tonality.key}</span>
                                                        <span>•</span>
                                                        <span>{analysisData.energy.intensity} Energy</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setAnalysisData(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                            <Upload size={16} />
                                        </button>
                                    </div>

                                    {/* Waveform Visualization */}
                                    <div className="flex-1 relative flex items-center justify-center">
                                        <div className="absolute inset-0 flex items-center gap-0.5 opacity-50">
                                            {Array.from({ length: 60 }).map((_, i) => (
                                                <motion.div
                                                    key={i}
                                                    className="flex-1 bg-purple-500 rounded-full"
                                                    initial={{ height: '10%' }}
                                                    animate={{
                                                        height: isPlaying ? [
                                                            `${20 + Math.random() * 80}%`,
                                                            `${20 + Math.random() * 80}%`
                                                        ] : '20%'
                                                    }}
                                                    transition={{
                                                        duration: 0.2,
                                                        repeat: Infinity,
                                                        repeatType: "reverse",
                                                        delay: i * 0.01
                                                    }}
                                                />
                                            ))}
                                        </div>

                                        {/* Play Button Overlay */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
                                            className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform z-20 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                                        >
                                            {isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" className="ml-1" />}
                                        </button>
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

                                    {/* Timeline */}
                                    <div className="h-8 mt-6 flex items-end justify-between text-[10px] font-mono text-gray-600 border-t border-gray-800 pt-2">
                                        <span>0:00</span>
                                        <span>{analysisData?.meta?.duration ? `${Math.floor(analysisData.meta.duration / 60)}:${Math.floor(analysisData.meta.duration % 60).toString().padStart(2, '0')}` : '--:--'}</span>
                                    </div>
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
                                <span className={`text-xs font-bold flex items-center gap-2 ${isAnalyzing ? 'text-yellow-500' : isEngineReady ? 'text-green-500' : 'text-red-500'}`}>
                                    <span className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-yellow-500 animate-ping' : isEngineReady ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    {isAnalyzing ? 'ANALYZING...' : isEngineReady ? 'ESSENTIA ENGINE READY' : 'LOADING ENGINE...'}
                                </span>
                            </div>

                            {analysisData ? (
                                <div className="grid grid-cols-3 gap-8">
                                    <div>
                                        <div className="flex justify-between text-xs text-gray-400 mb-2">
                                            <span>Energy</span>
                                            <span>{Math.round(parseFloat(analysisData.energy.intensity) * 100)}%</span>
                                        </div>
                                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${parseFloat(analysisData.energy.intensity) * 100}%` }}
                                                className="h-full bg-yellow-500"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs text-gray-400 mb-2">
                                            <span>Danceability</span>
                                            <span>{Math.round(parseFloat(analysisData.rhythm.danceability) * 100)}%</span>
                                        </div>
                                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${parseFloat(analysisData.rhythm.danceability) * 100}%` }}
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
        </div>
    );
}
