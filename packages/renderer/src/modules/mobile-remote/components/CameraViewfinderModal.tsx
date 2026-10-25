import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, FlipHorizontal, Grid3X3, Lightbulb, Video, Square, X } from 'lucide-react';

type Facing = 'environment' | 'user';
type Ratio = '9:16' | '1:1' | '4:5' | '16:9';
type Range = { min: number; max: number; step?: number };
type CameraCapabilities = MediaTrackCapabilities & {
    torch?: boolean;
    zoom?: Range;
    exposureCompensation?: Range;
};

// eslint-disable-next-line react-refresh/only-export-components -- pure crop geometry is shared with focused tests
export function cropToRatio(width: number, height: number, ratio: Ratio): { sx: number; sy: number; width: number; height: number } {
    const [horizontal, vertical] = ratio.split(':').map(Number);
    const target = horizontal / vertical;
    if (width / height > target) {
        const cropWidth = Math.round(height * target);
        return { sx: Math.floor((width - cropWidth) / 2), sy: 0, width: cropWidth, height };
    }
    const cropHeight = Math.round(width / target);
    return { sx: 0, sy: Math.floor((height - cropHeight) / 2), width, height: cropHeight };
}

interface CameraViewfinderModalProps {
    mode?: 'photo' | 'video';
    onClose: () => void;
    onPhoto: (file: File) => void;
    onVideo?: (file: File) => void;
    onFallback: () => void;
}

export default function CameraViewfinderModal({ mode = 'photo', onClose, onPhoto, onVideo, onFallback }: CameraViewfinderModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const cameraGenerationRef = useRef(0);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const discardRecordingRef = useRef(false);
    const [facing, setFacing] = useState<Facing>('environment');
    const [ratio, setRatio] = useState<Ratio>('9:16');
    const [grid, setGrid] = useState(true);
    const [torch, setTorch] = useState(false);
    const [zoom, setZoom] = useState<number | null>(null);
    const [exposure, setExposure] = useState<number | null>(null);
    const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isFinalizingRecording, setIsFinalizingRecording] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [horizon, setHorizon] = useState<number | null>(null);

    const stopCamera = useCallback(() => {
        cameraGenerationRef.current += 1;
        discardRecordingRef.current = true;
        if (recorderRef.current?.state === 'recording') {
            recorderRef.current.stop();
        }
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    useEffect(() => {
        let cancelled = false;
        stopCamera();
        if (!navigator.mediaDevices?.getUserMedia) {
            queueMicrotask(() => { if (!cancelled) setError('This browser does not support an in-app camera.'); });
            return;
        }
        void navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 } },
            audio: mode === 'video',
        }).then(stream => {
            if (cancelled) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                void videoRef.current.play().catch(() => setError('Tap the preview to start the camera.'));
            }
            const track = stream.getVideoTracks()[0];
            let caps: CameraCapabilities | undefined;
            try { caps = track?.getCapabilities?.() as CameraCapabilities | undefined; } catch { /* Optional hardware controls unavailable. */ }
            setCapabilities(caps ?? null);
            setZoom(caps?.zoom ? track.getSettings().zoom ?? caps.zoom.min : null);
            setExposure(caps?.exposureCompensation ? (track.getSettings() as { exposureCompensation?: number }).exposureCompensation ?? 0 : null);
            setIsReady(true);
        }).catch(() => {
            if (!cancelled) setError('Camera access failed. Use your phone camera instead.');
        });
        return () => { cancelled = true; stopCamera(); };
    }, [facing, mode, stopCamera]);

    useEffect(() => {
        if (mode !== 'video' || !isReady || !streamRef.current?.getAudioTracks().length || typeof AudioContext === 'undefined') return;
        const context = new AudioContext();
        const source = context.createMediaStreamSource(streamRef.current);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        let frame = 0;
        let sampledAt = 0;
        const update = () => {
            const now = performance.now();
            if (now - sampledAt >= 100) {
                analyser.getByteTimeDomainData(samples);
                const rms = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length);
                setAudioLevel(Math.min(100, Math.round(rms * 300)));
                sampledAt = now;
            }
            frame = requestAnimationFrame(update);
        };
        frame = requestAnimationFrame(update);
        return () => {
            cancelAnimationFrame(frame);
            source.disconnect();
            void context.close();
        };
    }, [mode, isReady]);

    useEffect(() => {
        const update = (event: DeviceOrientationEvent) => {
            if (Number.isFinite(event.gamma)) setHorizon(Math.max(-45, Math.min(45, event.gamma ?? 0)));
        };
        window.addEventListener('deviceorientation', update);
        return () => window.removeEventListener('deviceorientation', update);
    }, []);

    const requestHorizon = () => {
        if (typeof DeviceOrientationEvent === 'undefined') {
            setError('Motion sensors are unavailable on this device.');
            return;
        }
        const orientation = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
        if (orientation.requestPermission) void orientation.requestPermission().catch(() => setError('Motion sensor permission was denied.'));
    };

    useEffect(() => {
        const onHidden = () => {
            if (document.visibilityState === 'hidden') {
                stopCamera();
                onClose();
            }
        };
        document.addEventListener('visibilitychange', onHidden);
        return () => document.removeEventListener('visibilitychange', onHidden);
    }, [onClose, stopCamera]);

    const applyControl = async (constraint: Record<string, number | boolean>, onSuccess: () => void) => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track) return;
        try {
            await track.applyConstraints({ advanced: [constraint] } as MediaTrackConstraints);
            onSuccess();
            setError(null);
        } catch {
            setError('This camera could not apply that hardware setting.');
        }
    };

    const capture = async () => {
        const video = videoRef.current;
        if (!video || !isReady || isCapturing || !video.videoWidth || !video.videoHeight) return;
        setIsCapturing(true);
        const generation = cameraGenerationRef.current;
        const crop = cropToRatio(video.videoWidth, video.videoHeight, ratio);
        const canvas = document.createElement('canvas');
        canvas.width = crop.width;
        canvas.height = crop.height;
        const context = canvas.getContext('2d');
        if (!context) {
            setError('Photo capture is unavailable on this device.');
            setIsCapturing(false);
            return;
        }
        context.drawImage(video, crop.sx, crop.sy, crop.width, crop.height, 0, 0, crop.width, crop.height);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        if (generation !== cameraGenerationRef.current) return;
        if (!blob) {
            setError('Photo capture failed. Please retry.');
            setIsCapturing(false);
            return;
        }
        stopCamera();
        onPhoto(new File([blob], `mobile_photo_${Date.now()}.jpg`, { type: 'image/jpeg' }));
        onClose();
    };

    const toggleVideoRecording = () => {
        if (isRecording) {
            if (isFinalizingRecording) return;
            setIsFinalizingRecording(true);
            recorderRef.current?.stop();
            return;
        }
        const stream = streamRef.current;
        if (!stream || !isReady || typeof MediaRecorder === 'undefined') {
            setError('Video recording is unavailable. Use your phone camera instead.');
            return;
        }
        const mimeType = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
            .find(value => MediaRecorder.isTypeSupported?.(value));
        let recorder: MediaRecorder;
        try {
            recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        } catch {
            setError('Video recording is unavailable. Use your phone camera instead.');
            return;
        }
        const chunks: Blob[] = [];
        discardRecordingRef.current = false;
        recorderRef.current = recorder;
        recorder.ondataavailable = event => { if (event.data.size > 0) chunks.push(event.data); };
        recorder.onerror = () => setError('Video recording failed. Please retry.');
        recorder.onstop = () => {
            if (discardRecordingRef.current) return;
            setIsRecording(false);
            setIsFinalizingRecording(false);
            const type = recorder.mimeType || mimeType || 'video/webm';
            const blob = new Blob(chunks, { type });
            if (!blob.size) {
                setError('The video recording was empty. Please retry.');
                return;
            }
            stopCamera();
            onVideo?.(new File([blob], `mobile_video_${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type }));
            onClose();
        };
        try {
            recorder.start();
            setIsRecording(true);
        } catch {
            setError('Video recording could not start.');
        }
    };

    return (
        <div role="dialog" aria-modal="true" aria-label="In-app camera" className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
            <div className="flex items-center justify-between px-4 py-3">
                <button type="button" aria-label="Close camera" onClick={() => { stopCamera(); onClose(); }}><X className="h-6 w-6" /></button>
                <span className="text-sm font-bold">{mode === 'photo' ? 'Photo' : 'Video'} viewfinder</span>
                <button type="button" aria-label="Switch camera" disabled={isRecording} onClick={() => {
                    setIsReady(false);
                    setError(null);
                    setCapabilities(null);
                    setTorch(false);
                    setZoom(null);
                    setExposure(null);
                    setFacing(value => value === 'environment' ? 'user' : 'environment');
                }}><FlipHorizontal className="h-6 w-6" /></button>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden bg-stone-950">
                <video ref={videoRef} playsInline autoPlay muted onClick={() => void videoRef.current?.play()} className="h-full w-full object-cover" style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }} />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="relative max-h-full max-w-full border border-white/60" style={{ aspectRatio: ratio.replace(':', '/'), height: ratio === '16:9' ? '50%' : '90%' }}>
                        {grid && <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">{Array.from({ length: 9 }, (_, index) => <span key={index} className="border border-white/25" />)}</div>}
                        {horizon !== null && <div aria-label="Horizon guide" className="absolute top-1/2 left-0 right-0 border-t border-cyan-300" style={{ transform: `rotate(${-horizon}deg)` }} />}
                    </div>
                </div>
                {!isReady && !error && <p role="status" className="absolute inset-x-0 top-1/2 text-center text-sm">Starting camera…</p>}
                {error && <p role="alert" className="absolute inset-x-4 bottom-4 rounded-xl bg-black/80 p-3 text-center text-sm">{error}</p>}
            </div>
            <div className="space-y-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <div className="flex justify-center gap-2">{(['9:16', '1:1', '4:5', '16:9'] as Ratio[]).map(value => <button key={value} type="button" aria-pressed={ratio === value} disabled={isRecording} onClick={() => setRatio(value)} className={`rounded-lg px-3 py-1 text-xs ${ratio === value ? 'bg-cyan-400 text-black' : 'bg-white/10'}`}>{value}</button>)}</div>
                {mode === 'video' && <p className="text-center text-[10px] text-stone-400">Frame guide only; video keeps its original dimensions.</p>}
                <div className="flex items-center justify-center gap-5">
                    <button type="button" aria-label="Toggle grid" aria-pressed={grid} onClick={() => setGrid(value => !value)}><Grid3X3 className="h-5 w-5" /></button>
                    <button type="button" aria-label="Toggle torch" aria-pressed={torch} disabled={!capabilities?.torch} onClick={() => void applyControl({ torch: !torch }, () => setTorch(!torch))} className="disabled:opacity-30"><Lightbulb className="h-5 w-5" /></button>
                    <button type="button" onClick={requestHorizon} className="text-xs underline">Level</button>
                    <button type="button" onClick={() => { stopCamera(); onFallback(); onClose(); }} className="text-xs underline"><CameraOff className="mx-auto h-5 w-5" />Phone camera</button>
                </div>
                {capabilities?.zoom && zoom !== null && <label className="flex items-center gap-2 text-xs">Zoom <input type="range" min={capabilities.zoom.min} max={capabilities.zoom.max} step={capabilities.zoom.step ?? 0.1} value={zoom} onChange={event => void applyControl({ zoom: Number(event.target.value) }, () => setZoom(Number(event.target.value)))} className="flex-1" /></label>}
                {capabilities?.exposureCompensation && exposure !== null && <label className="flex items-center gap-2 text-xs">Exposure <input type="range" min={capabilities.exposureCompensation.min} max={capabilities.exposureCompensation.max} step={capabilities.exposureCompensation.step ?? 0.1} value={exposure} onChange={event => void applyControl({ exposureCompensation: Number(event.target.value) }, () => setExposure(Number(event.target.value)))} className="flex-1" /></label>}
                {mode === 'video' && <div role="meter" aria-label="Microphone level" aria-valuenow={audioLevel} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full rounded-full bg-white/10"><div className={`h-full rounded-full ${audioLevel > 85 ? 'bg-red-500' : 'bg-cyan-400'}`} style={{ width: `${audioLevel}%` }} /></div>}
                {mode === 'photo'
                    ? <button type="button" aria-label="Capture photo" disabled={!isReady || isCapturing} onClick={() => void capture()} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-cyan-400 text-black disabled:opacity-40"><Camera className="h-8 w-8" /></button>
                    : <button type="button" aria-label={isRecording ? 'Stop recording video' : 'Start recording video'} disabled={!isReady || isFinalizingRecording} onClick={toggleVideoRecording} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-red-500 text-white disabled:opacity-40">{isRecording ? <Square className="h-7 w-7" /> : <Video className="h-8 w-8" />}</button>}
            </div>
        </div>
    );
}
