import { useState, useRef } from 'react';
import { Mic, Image as ImageIcon, Video, Send, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { remoteRelayService } from '@/services/agent/RemoteRelayService';
import { StorageService } from '@/services/StorageService';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '../MobileRemote';

export default function QuickCaptureView({ isPaired }: { isPaired: boolean }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isDispatching, setIsDispatching] = useState(false);
    const [capturedAudioBlob, setCapturedAudioBlob] = useState<Blob | null>(null);
    const [capturedImageBlob, setCapturedImageBlob] = useState<File | null>(null);
    const [capturedVideoBlob, setCapturedVideoBlob] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

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
                    
                    // Stop all microphone tracks to release the recording indicator
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorderRef.current.start();
                setIsRecording(true);
                clearMediaState();
            } catch (error) {
                console.error("Failed to access microphone", error);
                triggerHaptic([100, 200, 100]); // Error haptic
            }
        }
    };

    const clearMediaState = () => {
        setCapturedAudioBlob(null);
        setCapturedImageBlob(null);
        setCapturedVideoBlob(null);
    };

    const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            clearMediaState();
            setCapturedImageBlob(file);
        }
    };

    const handleVideoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            clearMediaState();
            setCapturedVideoBlob(file);
        }
    };

    const handleDispatch = async () => {
        if (!isPaired) return;
        setIsDispatching(true);
        triggerHaptic(50);
        
        try {
            const { auth } = await import('@/services/firebase');
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error("User not authenticated");

            if (capturedAudioBlob) {
                const filename = `voice_memo_${Date.now()}.webm`;
                const path = `users/${userId}/voice_memos/${filename}`;
                
                // Upload to Firebase Storage
                const downloadUrl = await StorageService.uploadFile(capturedAudioBlob, path);

                await remoteRelayService.dispatchTask({
                    type: 'voice_memo',
                    payload: { audioUrl: downloadUrl }
                });
            } else if (capturedImageBlob) {
                const filename = `photo_${Date.now()}.${capturedImageBlob.name.split('.').pop() || 'jpg'}`;
                const path = `users/${userId}/assets/captured_media/${filename}`;
                
                // Upload to Firebase Storage
                const downloadUrl = await StorageService.uploadFile(capturedImageBlob, path);

                await remoteRelayService.dispatchTask({
                    type: 'media_capture',
                    payload: { imageUrl: downloadUrl }
                });
            } else if (capturedVideoBlob) {
                const filename = `video_${Date.now()}.${capturedVideoBlob.name.split('.').pop() || 'mp4'}`;
                const path = `users/${userId}/assets/captured_media/${filename}`;
                
                // Upload to Firebase Storage
                const downloadUrl = await StorageService.uploadFile(capturedVideoBlob, path);

                await remoteRelayService.dispatchTask({
                    type: 'media_capture',
                    payload: { videoUrl: downloadUrl }
                });
            }
            
            // Success
            clearCapture();
            triggerHaptic([50, 50, 50]);
        } catch (error) {
            console.error('Failed to dispatch:', error);
            triggerHaptic([100, 200, 100]);
        } finally {
            setIsDispatching(false);
        }
    };

    const clearCapture = () => {
        clearMediaState();
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (videoInputRef.current) videoInputRef.current.value = '';
    };

    return (
        <div className="flex flex-col h-full min-h-[60vh] items-center justify-center space-y-12 pb-20">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-[#F0F0F0] tracking-tight">Quick Capture</h2>
                <p className="text-[#a1a1a6] text-sm font-medium">Dictate a contact or log a receipt</p>
            </div>

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
                        "relative z-10 w-40 h-40 rounded-full flex flex-col items-center justify-center gap-3 transition-colors shadow-[0_0_40px_rgba(46,46,254,0.15)] border-4",
                        isRecording 
                            ? "bg-[#2E2EFE] border-[#2E2EFE] text-[#F0F0F0]" 
                            : "bg-[#030303] border-white/10 text-[#F0F0F0] hover:border-[#2E2EFE]/50",
                        !isPaired && "opacity-50 grayscale cursor-not-allowed"
                    )}
                >
                    <Mic className={cn("w-12 h-12", isRecording && "animate-pulse")} />
                    <span className="text-xs font-bold uppercase tracking-widest">
                        {isRecording ? 'Listening...' : 'Tap to Speak'}
                    </span>
                </motion.button>
            </div>

            <div className="flex items-center gap-6">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!isPaired || isDispatching || isRecording}
                    className={cn(
                        "flex items-center gap-2 px-6 py-4 rounded-2xl border border-white/10 bg-white/5 font-bold uppercase tracking-widest text-[10px] transition-colors",
                        isPaired && !isRecording && !isDispatching ? "hover:bg-white/10 text-[#F0F0F0]" : "opacity-50 grayscale text-[#8e8e93]"
                    )}
                >
                    <ImageIcon className="w-5 h-5" />
                    Snap Photo
                </button>
                <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleImageCapture}
                />
            </div>

            <AnimatePresence>
                {(capturedAudioBlob || capturedImageBlob) && !isRecording && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-28 inset-x-6 p-4 rounded-[24px] bg-[#1c1c1e] border border-white/10 flex items-center justify-between shadow-2xl z-50"
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                {capturedAudioBlob ? <Mic className="w-5 h-5 text-white" /> : <ImageIcon className="w-5 h-5 text-white" />}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate uppercase tracking-widest">
                                    {capturedAudioBlob ? 'Voice Memo Ready' : 'Image Captured'}
                                </p>
                                <p className="text-[10px] text-[#8e8e93] truncate">
                                    Tap send to dispatch to desktop
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={clearCapture}
                                disabled={isDispatching}
                                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 text-[#8e8e93] transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleDispatch}
                                disabled={isDispatching}
                                className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#2E2EFE] hover:bg-[#2E2EFE]/80 text-[#F0F0F0] shadow-lg shadow-[#2E2EFE]/20 transition-all active:scale-95"
                            >
                                {isDispatching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
