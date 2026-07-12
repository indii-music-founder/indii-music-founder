import { useState, useRef, useEffect } from 'react';
import { Mic, Image as ImageIcon, Video, Send, Loader2, MapPin, FileText, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { remoteRelayService, waitForDispatchConfirmation } from '@/services/agent/RemoteRelayService';
import { StorageService } from '@/services/StorageService';
import { useToast } from '@/core/context/ToastContext';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '../MobileRemote';

export default function QuickCaptureView({ isPaired }: { isPaired: boolean }) {
    const toast = useToast();
    const [isRecording, setIsRecording] = useState(false);
    const [isDispatching, setIsDispatching] = useState(false);
    const [capturedAudioBlob, setCapturedAudioBlob] = useState<Blob | null>(null);
    const [capturedImageBlob, setCapturedImageBlob] = useState<{file: File, type: 'photo' | 'document'} | null>(null);
    const [capturedVideoBlob, setCapturedVideoBlob] = useState<File | null>(null);
    const [momentText, setMomentText] = useState('');
    const [reviewUrl, setReviewUrl] = useState<string | null>(null);
    const [geoError, setGeoError] = useState<string | null>(null);
    
    const photoInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const reviewKind = capturedAudioBlob
        ? 'voice memo'
        : capturedImageBlob?.type === 'photo'
            ? 'photo'
            : capturedImageBlob?.type === 'document'
                ? 'document scan'
                : capturedVideoBlob
                    ? 'video'
                    : null;
    const hasGeolocation = typeof navigator !== 'undefined' && !!navigator.geolocation;

    useEffect(() => {
        const source = capturedAudioBlob ?? capturedImageBlob?.file ?? capturedVideoBlob;
        if (!source) {
            setReviewUrl(null);
            return;
        }

        const nextUrl = URL.createObjectURL(source);
        setReviewUrl(nextUrl);

        return () => {
            URL.revokeObjectURL(nextUrl);
        };
    }, [capturedAudioBlob, capturedImageBlob, capturedVideoBlob]);

    const handleMicTap = async () => {
        if (!isPaired) return;
        triggerHaptic([50, 100]);
        
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorderRef.current = new MediaRecorder(stream);
                audioChunksRef.current = [];

                mediaRecorderRef.current.ondataavailable = (e) => {
                    if (e.data.size > 0) audioChunksRef.current.push(e.data);
                };

                mediaRecorderRef.current.onstop = () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    setCapturedAudioBlob(audioBlob);
                    
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorderRef.current.start();
                setIsRecording(true);
                clearMediaState();
            } catch (error) {
                console.error("Failed to access microphone", error);
                triggerHaptic([100, 200, 100]);
            }
        }
    };

    const clearMediaState = () => {
        setCapturedAudioBlob(null);
        setCapturedImageBlob(null);
        setCapturedVideoBlob(null);
    };

    const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'document') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            clearMediaState();
            setCapturedImageBlob({ file, type });
        }
    };

    const handleVideoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            clearMediaState();
            setCapturedVideoBlob(file);
        }
    };

    const handlePinDrop = () => {
        if (!isPaired || isDispatching) return;
        triggerHaptic(50);
        setGeoError(null);
        
        if (!hasGeolocation) {
            const message = 'Location capture is unavailable in this browser.';
            setGeoError(message);
            toast.error(message);
            return;
        }

        setIsDispatching(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    await remoteRelayService.dispatchTask({
                        type: 'venue_log',
                        payload: { 
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        }
                    });
                    triggerHaptic([50, 50, 50]);
                } catch (error) {
                    console.error('Failed to dispatch pin:', error);
                    triggerHaptic([100, 200, 100]);
                } finally {
                    setIsDispatching(false);
                }
            },
            (error) => {
                console.error("Error getting location", error);
                setGeoError('Location capture failed. Please try again.');
                toast.error('Location capture failed. Please try again.');
                triggerHaptic([100, 200, 100]);
                setIsDispatching(false);
            }
        );
    };

    const handleTextSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const noteText = momentText.trim();
        if (!noteText || !isPaired || isDispatching) return;
        
        setIsDispatching(true);
        triggerHaptic(50);
        
        try {
            await remoteRelayService.dispatchTask({
                type: 'live_moment',
                payload: { noteText }
            });
            setMomentText('');
            triggerHaptic([50, 50, 50]);
        } catch (error) {
            console.error('Failed to dispatch text:', error);
            triggerHaptic([100, 200, 100]);
        } finally {
            setIsDispatching(false);
        }
    };

    const handleDispatchMedia = async () => {
        if (!isPaired) return;
        setIsDispatching(true);
        triggerHaptic(50);
        
        try {
            const { auth } = await import('@/services/firebase');
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error("User not authenticated");

            let taskId: string;
            if (capturedAudioBlob) {
                const filename = `voice_memo_${Date.now()}.webm`;
                const path = `users/${userId}/voice_memos/${filename}`;
                const downloadUrl = await StorageService.uploadFile(capturedAudioBlob, path);

                taskId = await remoteRelayService.dispatchTask({
                    type: 'voice_memo',
                    payload: { audioUrl: downloadUrl }
                });
            } else if (capturedImageBlob) {
                const file = capturedImageBlob.file;
                const filename = `photo_${Date.now()}.${file.name.split('.').pop() || 'jpg'}`;
                const path = `users/${userId}/assets/captured_media/${filename}`;
                const downloadUrl = await StorageService.uploadFile(file, path);

                taskId = await remoteRelayService.dispatchTask({
                    type: capturedImageBlob.type === 'document' ? 'document_scan' : 'media_capture',
                    payload: { imageUrl: downloadUrl }
                });
            } else if (capturedVideoBlob) {
                const filename = `video_${Date.now()}.${capturedVideoBlob.name.split('.').pop() || 'mp4'}`;
                const path = `users/${userId}/assets/captured_media/${filename}`;
                const downloadUrl = await StorageService.uploadFile(capturedVideoBlob, path);

                taskId = await remoteRelayService.dispatchTask({
                    type: 'media_capture',
                    payload: { videoUrl: downloadUrl }
                });
            } else {
                return;
            }

            // ISSUE-983: don't clear the capture until the desktop confirms a
            // note actually exists — queue acceptance alone is not success.
            const outcome = await waitForDispatchConfirmation(taskId);
            if (outcome.status === 'failed') {
                throw new Error(outcome.error?.message || 'Failed to save to Notes');
            }

            clearCapture();
            triggerHaptic([50, 50, 50]);
        } catch (error) {
            console.error('Failed to dispatch media:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save to Notes');
            triggerHaptic([100, 200, 100]);
        } finally {
            setIsDispatching(false);
        }
    };

    const clearCapture = () => {
        clearMediaState();
        if (photoInputRef.current) photoInputRef.current.value = '';
        if (docInputRef.current) docInputRef.current.value = '';
        if (videoInputRef.current) videoInputRef.current.value = '';
    };

    return (
        <div className="flex flex-col h-full min-h-[70vh] items-center justify-between pb-24 pt-8 px-4">
            <div className="w-full flex flex-col items-center space-y-10">
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-[#F0F0F0] tracking-tight">Live Moment Capture</h2>
                    <p className="text-[#a1a1a6] text-sm font-medium">Capture every moment live and keep the whole team in your pocket.</p>
                </div>

                {/* Primary Action: Mic */}
                <div className="relative flex items-center justify-center">
                    {isRecording && (
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1.5, opacity: 0 }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="absolute inset-0 bg-[#2E2EFE] rounded-full pointer-events-none"
                        />
                    )}
                    
                    <motion.button
                        whileTap={isPaired ? { scale: 0.9 } : undefined}
                        onClick={handleMicTap}
                        disabled={!isPaired || isDispatching}
                        className={cn(
                            "relative z-10 w-36 h-36 rounded-full flex flex-col items-center justify-center gap-2 transition-colors shadow-[0_0_40px_rgba(46,46,254,0.15)] border-4",
                            isRecording 
                                ? "bg-[#2E2EFE] border-[#2E2EFE] text-[#F0F0F0]" 
                                : "bg-[#030303] border-white/10 text-[#F0F0F0] hover:border-[#2E2EFE]/50",
                            !isPaired && "opacity-50 grayscale cursor-not-allowed"
                        )}
                    >
                        <Mic className={cn("w-10 h-10", isRecording && "animate-pulse")} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                            {isRecording ? 'Listening' : 'Speak'}
                        </span>
                    </motion.button>
                </div>

                {/* Secondary Actions Grid */}
                <div className="grid grid-cols-4 gap-4 w-full max-w-sm">
                    <button
                        onClick={() => docInputRef.current?.click()}
                        disabled={!isPaired || isDispatching || isRecording}
                        className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-white/10 bg-[#1c1c1e] text-[#8e8e93] hover:text-[#F0F0F0] hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <FileText className="w-6 h-6" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Doc</span>
                    </button>
                    <input type="file" accept="image/*" capture="environment" className="hidden" ref={docInputRef} onChange={(e) => handleImageCapture(e, 'document')} />

                    <button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={!isPaired || isDispatching || isRecording}
                        className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-white/10 bg-[#1c1c1e] text-[#8e8e93] hover:text-[#F0F0F0] hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <ImageIcon className="w-6 h-6" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Photo</span>
                    </button>
                    <input type="file" accept="image/*" capture="environment" className="hidden" ref={photoInputRef} onChange={(e) => handleImageCapture(e, 'photo')} />

                    <button
                        onClick={() => videoInputRef.current?.click()}
                        disabled={!isPaired || isDispatching || isRecording}
                        className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-white/10 bg-[#1c1c1e] text-[#8e8e93] hover:text-[#F0F0F0] hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <Video className="w-6 h-6" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Video</span>
                    </button>
                    <input type="file" accept="video/*" capture="environment" className="hidden" ref={videoInputRef} onChange={handleVideoCapture} />

                    <button
                        onClick={handlePinDrop}
                        disabled={!isPaired || isDispatching || isRecording || !hasGeolocation}
                        className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-white/10 bg-[#1c1c1e] text-[#8e8e93] hover:text-[#F0F0F0] hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <MapPin className="w-6 h-6" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">{hasGeolocation ? 'Pin' : 'Pin N/A'}</span>
                    </button>
                </div>
                {!hasGeolocation && (
                    <p className="w-full max-w-sm text-center text-[11px] text-[#8e8e93] -mt-2">
                        Location capture is unavailable in this browser.
                    </p>
                )}
                {geoError && (
                    <p className="w-full max-w-sm text-center text-[11px] text-[#ff8f8f] -mt-2">
                        {geoError}
                    </p>
                )}
            </div>

            {/* Silent Text Command */}
            <div className="w-full max-w-sm mt-8">
                <form onSubmit={handleTextSubmit} className="relative flex items-center">
                    <div className="absolute left-4 text-[#8e8e93]">
                        <Keyboard className="w-5 h-5" />
                    </div>
                        <input
                            type="text"
                            value={momentText}
                            onChange={(e) => setMomentText(e.target.value)}
                            placeholder="Capture a live moment..."
                            disabled={!isPaired || isDispatching || isRecording}
                            className="w-full bg-[#1c1c1e] border border-white/10 rounded-[20px] py-4 pl-12 pr-14 text-sm text-[#F0F0F0] placeholder:text-[#8e8e93] focus:outline-none focus:border-[#2E2EFE]/50 transition-colors"
                        />
                        <button
                            type="submit"
                            disabled={!momentText.trim() || !isPaired || isDispatching}
                            className="absolute right-2 w-10 h-10 rounded-xl flex items-center justify-center bg-[#2E2EFE] text-white disabled:opacity-50 disabled:bg-white/10 transition-all hover:bg-[#2E2EFE]/80"
                        >
                            {isDispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </form>
            </div>

            {/* Floating Review Card for Media */}
            <AnimatePresence>
                {(capturedAudioBlob || capturedImageBlob || capturedVideoBlob) && !isRecording && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-24 inset-x-6 z-50 mx-auto w-[calc(100%-3rem)] max-w-sm overflow-hidden rounded-[28px] border border-white/10 bg-[#1c1c1e] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
                    >
                        <div className="p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-400">Review before saving</p>
                                    <p className="mt-2 text-sm font-semibold text-white">Uploads to your vault, then writes it into Notes for the team.</p>
                                    <p className="mt-1 text-[11px] text-[#8e8e93]">
                                        {reviewKind ? `Captured ${reviewKind}` : 'Captured media'}
                                    </p>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                                    {capturedAudioBlob && <Mic className="w-5 h-5 text-blue-400" />}
                                    {capturedImageBlob?.type === 'photo' && <ImageIcon className="w-5 h-5 text-blue-400" />}
                                    {capturedImageBlob?.type === 'document' && <FileText className="w-5 h-5 text-blue-400" />}
                                    {capturedVideoBlob && <Video className="w-5 h-5 text-blue-400" />}
                                </div>
                            </div>

                            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                                {capturedAudioBlob && reviewUrl && (
                                    <div className="p-4">
                                        <audio controls src={reviewUrl} className="w-full" />
                                    </div>
                                )}
                                {capturedImageBlob && reviewUrl && (
                                    <img
                                        src={reviewUrl}
                                        alt={capturedImageBlob.type === 'photo' ? 'Captured photo preview' : 'Captured document preview'}
                                        className="max-h-72 w-full object-contain bg-black"
                                    />
                                )}
                                {capturedVideoBlob && reviewUrl && (
                                    <video controls src={reviewUrl} className="max-h-72 w-full bg-black" />
                                )}
                            </div>

                            <div className="mt-4 flex items-center gap-3">
                                <button 
                                    onClick={clearCapture}
                                    disabled={isDispatching}
                                    className="flex-1 h-12 rounded-2xl border border-white/10 bg-white/5 text-white/80 text-sm font-semibold transition-colors hover:bg-white/10 disabled:opacity-50"
                                >
                                    Retake
                                </button>
                                <button
                                    onClick={handleDispatchMedia}
                                    disabled={isDispatching}
                                    className="flex-1 h-12 rounded-2xl bg-white text-[#2E2EFE] text-sm font-semibold shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    {isDispatching ? (
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Sending
                                        </span>
                                    ) : (
                                        'Save to Notes'
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
