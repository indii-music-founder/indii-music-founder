import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Image as ImageIcon, Video, Send, Loader2, MapPin, FileText, Keyboard, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { remoteRelayService, waitForDispatchConfirmation } from '@/services/agent/RemoteRelayService';
import { StorageService } from '@/services/StorageService';
import { useToast } from '@/core/context/ToastContext';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '../haptics';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { logger } from '@/utils/logger';
import { useStore } from '@/core/store';

/**
 * ISSUE-987: candidates in priority order — WebKit/Safari commonly can't
 * produce webm at all, so hardcoding `audio/webm` mislabels whatever bytes
 * the browser actually emitted. `undefined` (last resort) lets the browser
 * pick its own default rather than forcing an unsupported type.
 */
const AUDIO_MIME_CANDIDATES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
];

const AUDIO_MIME_EXTENSIONS: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
};

// eslint-disable-next-line react-refresh/only-export-components -- pure media capability helper is exported for regression tests
export const pickSupportedAudioMimeType = (): string | undefined => {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return undefined;
    }
    return AUDIO_MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type));
};

/** Derive the real filename extension from the recorder's actual (possibly codec-qualified) mimeType, instead of always writing `.webm`. */
// eslint-disable-next-line react-refresh/only-export-components -- pure filename helper is exported for regression tests
export const audioExtensionForMimeType = (mimeType: string): string => {
    const base = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
    return AUDIO_MIME_EXTENSIONS[base] ?? 'webm';
};

// eslint-disable-next-line react-refresh/only-export-components -- browser download helper is exported for regression tests
export function downloadCapturedMedia(source: Blob, filename: string): void {
    const url = URL.createObjectURL(source);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    // Let the browser start the download before releasing this temporary URL.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

const MIN_RECORDING_DURATION_MS = 300;

export default function QuickCaptureView({ isPaired }: { isPaired: boolean }) {
    const toast = useToast();
    const [isRecording, setIsRecording] = useState(false);
    const locationRequestId = useRef(0);
    // ISSUE-986: true from the moment Stop is tapped until the recorder's
    // async onstop actually delivers the audio blob. isRecording flips to
    // false immediately (so the mic button reads "Speak" again), but the
    // OTHER capture controls must stay blocked until finalization — otherwise
    // a photo/video picked in that gap gets silently clobbered when the
    // delayed audio blob lands on top of it.
    const [isFinalizingRecording, setIsFinalizingRecording] = useState(false);
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
    const streamRef = useRef<MediaStream | null>(null);
    const isMountedRef = useRef(true);
    const recordingStartedAtRef = useRef(0);

    const reviewKind = capturedAudioBlob
        ? 'voice memo'
        : capturedImageBlob?.type === 'photo'
            ? 'photo'
            : capturedImageBlob?.type === 'document'
                ? 'document scan'
                : capturedVideoBlob
                    ? 'video'
                    : null;

    const downloadReviewCopy = () => {
        const source = capturedAudioBlob ?? capturedImageBlob?.file ?? capturedVideoBlob;
        if (!source) return;
        const extension = capturedAudioBlob
            ? audioExtensionForMimeType(capturedAudioBlob.type)
            : capturedImageBlob?.file.name.split('.').pop() || capturedVideoBlob?.name.split('.').pop() || 'bin';
        downloadCapturedMedia(source, `indii-capture-${Date.now()}.${extension}`);
        toast.info('Downloaded a local copy of this capture.');
    };
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

    /**
     * ISSUE-985: stops the recorder AND the underlying tracks directly,
     * independent of the MediaRecorder's async `onstop` event — so the mic
     * is guaranteed dark immediately on explicit stop, unmount, page-hide,
     * or permission loss, regardless of pairing/dispatch state or whatever
     * state the recorder itself is in.
     */
    const stopRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            // ISSUE-986: the audio blob only lands once onstop fires
            // asynchronously — block photo/doc/video/pin/text replacement
            // until then, or a capture picked in this gap gets silently
            // clobbered when the delayed blob arrives on top of it.
            setIsFinalizingRecording(true);
            try {
                recorder.stop();
            } catch (error) {
                logger.error('[QuickCapture] Failed to stop media recorder:', error);
                setIsFinalizingRecording(false);
            }
        }
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setIsRecording(false);
    }, []);

    // Track real mount state so a late onstop/onerror callback (which can
    // fire after unmount/tab-switch) never calls setState on a dead component.
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            // Geolocation has no browser cancellation handle. Invalidate any
            // callback that arrives after this surface is gone so it cannot
            // confirm/dispatch a venue pin from an abandoned screen.
            locationRequestId.current += 1;
        };
    }, []);

    // Unmount / tab-switch (QuickCaptureView is conditionally rendered by
    // MobileRemote's tab switch, so this fires on every tab change): the mic
    // must never stay live after this view disappears.
    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        };
    }, []);

    // Backgrounding the app/tab mid-recording must not leave the mic live
    // with no way to stop it once the view regains focus.
    useEffect(() => {
        const onVisibilityChange = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && mediaRecorderRef.current?.state === 'recording') {
                stopRecording();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [stopRecording]);

    const handleMicTap = async () => {
        // Stop must always work, even if pairing dropped mid-recording —
        // this was the exact trap: !isPaired disabled the only stop control.
        if (isRecording) {
            triggerHaptic([50, 100]);
            stopRecording();
            return;
        }

        triggerHaptic([50, 100]);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = pickSupportedAudioMimeType();
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            streamRef.current = stream;
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            // A rapid stop-then-restart can leave this session's async
            // callbacks (onstop/onerror/track.onended) firing after a NEWER
            // session has already taken over the refs — every callback below
            // closes over `recorder`/`stream` and only touches shared
            // refs/state when it's still the active session, so a stale
            // callback can never stomp a newer one's stream or blob.
            const isStillActiveSession = () => mediaRecorderRef.current === recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                if (isMountedRef.current && isStillActiveSession()) {
                    // ISSUE-987: label the blob with what the recorder actually
                    // produced (recorder.mimeType), never a hardcoded assumption.
                    const actualMimeType = recorder.mimeType || 'audio/webm';
                    const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
                    const durationMs = Date.now() - recordingStartedAtRef.current;

                    if (audioBlob.size === 0) {
                        toast.error('No audio was captured — try again.');
                    } else if (durationMs < MIN_RECORDING_DURATION_MS) {
                        toast.error('Recording was too short to save.');
                    } else {
                        setCapturedAudioBlob(audioBlob);
                    }
                    setIsFinalizingRecording(false);
                }
                stream.getTracks().forEach(track => track.stop());
                if (streamRef.current === stream) streamRef.current = null;
            };

            recorder.onerror = (event) => {
                logger.error('[QuickCapture] MediaRecorder error:', event);
                if (isMountedRef.current && isStillActiveSession()) {
                    toast.error('Recording failed unexpectedly.');
                    setIsFinalizingRecording(false);
                    stopRecording();
                } else {
                    stream.getTracks().forEach(track => track.stop());
                }
            };

            // A track can end on its own (permission revoked, device
            // disconnected) without ever going through our stop button —
            // treat that as a stop too so isRecording/UI never goes stale.
            stream.getTracks().forEach(track => {
                track.onended = () => {
                    if (isMountedRef.current && isStillActiveSession()) stopRecording();
                };
            });

            recordingStartedAtRef.current = Date.now();
            recorder.start();
            setIsRecording(true);
            clearMediaState();
        } catch (error) {
            logger.error('[QuickCapture] Failed to access microphone:', error);
            triggerHaptic([100, 200, 100]);
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
        if (isDispatching) return;
        triggerHaptic(50);
        setGeoError(null);
        
        if (!hasGeolocation) {
            const message = 'Location capture is unavailable in this browser.';
            setGeoError(message);
            toast.error(message);
            return;
        }

        setIsDispatching(true);
        const requestId = ++locationRequestId.current;
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                if (requestId !== locationRequestId.current) return;
                try {
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;
                    const accuracy = position.coords.accuracy;
                    const confirmed = await ConfirmDialog.call({
                        title: 'Send venue pin?',
                        message: `Latitude ${latitude.toFixed(5)}, longitude ${longitude.toFixed(5)}${Number.isFinite(accuracy) ? ` (±${Math.round(accuracy)} m)` : ''}.`,
                        confirmText: 'Send Pin',
                    });
                    if (!confirmed) return;
                    const capturedAt = new Date(position.timestamp).toISOString();
                    if (isPaired) {
                        await remoteRelayService.dispatchTask({
                            type: 'venue_log',
                            payload: { lat: latitude, lng: longitude, accuracyMeters: accuracy, capturedAt }
                        });
                    } else {
                        useStore.getState().addNote({
                            title: `Venue pin — ${new Date(position.timestamp).toLocaleString()}`,
                            content: `Latitude ${latitude}, longitude ${longitude}${Number.isFinite(accuracy) ? ` (±${Math.round(accuracy)} m)` : ''}\nCaptured ${capturedAt}`,
                            attachments: [],
                            tags: ['venue', 'mobile-capture'],
                        });
                        toast.success('Venue pin saved directly to Notes.');
                    }
                    triggerHaptic([50, 50, 50]);
                } catch (error) {
                    logger.error('[QuickCapture] Failed to dispatch pin:', error);
                    triggerHaptic([100, 200, 100]);
                } finally {
                    setIsDispatching(false);
                }
            },
            (error) => {
                if (requestId !== locationRequestId.current) return;
                logger.error('[QuickCapture] Error getting location:', error);
                // ISSUE-988: TIMEOUT gets a clearer message; every branch still
                // unlocks isDispatching so a stalled provider can't freeze capture.
                const message = error.code === error.TIMEOUT
                    ? 'Location request timed out. Please try again.'
                    : 'Location capture failed. Please try again.';
                setGeoError(message);
                toast.error(message);
                triggerHaptic([100, 200, 100]);
                setIsDispatching(false);
            },
            // ISSUE-988: without an explicit timeout, a stalled location
            // provider left isDispatching (and every capture control) locked
            // forever with no error and no recovery.
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
        );
    };

    const handleTextSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const noteText = momentText.trim();
        if (!noteText || isDispatching) return;
        
        setIsDispatching(true);
        triggerHaptic(50);
        try {
            if (isPaired) {
                await remoteRelayService.dispatchTask({ type: 'live_moment', payload: { noteText } });
            } else {
                useStore.getState().addNote({
                    title: `Live moment — ${new Date().toLocaleString()}`,
                    content: noteText,
                    attachments: [],
                    tags: ['mobile-capture'],
                });
                toast.success('Live moment saved directly to Notes.');
            }
            setMomentText('');
            triggerHaptic([50, 50, 50]);
        } catch (error) {
            logger.error('[QuickCapture] Failed to dispatch text:', error);
            triggerHaptic([100, 200, 100]);
        } finally {
            setIsDispatching(false);
        }
    };

    const handleDispatchMedia = async () => {
        setIsDispatching(true);
        triggerHaptic(50);
        let uploadedPath: string | null = null;
        let dispatchAccepted = false;
        
        try {
            const { auth } = await import('@/services/firebase');
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error("User not authenticated");

            let taskId: string | null = null;
            let downloadUrl: string | null = null;
            if (capturedAudioBlob) {
                // ISSUE-987: name the upload from the blob's real mimeType
                // instead of assuming .webm — Safari/WebKit commonly record
                // mp4/aac, and a mismatched extension breaks downstream
                // playback/transcription that infers format from the name.
                const extension = audioExtensionForMimeType(capturedAudioBlob.type);
                const filename = `voice_memo_${Date.now()}.${extension}`;
                const path = `users/${userId}/voice_memos/${filename}`;
                downloadUrl = await StorageService.uploadFile(capturedAudioBlob, path);
                uploadedPath = path;
                if (isPaired) {
                    taskId = await remoteRelayService.dispatchTask({ type: 'voice_memo', payload: { audioUrl: downloadUrl } });
                    dispatchAccepted = true;
                }
            } else if (capturedImageBlob) {
                const file = capturedImageBlob.file;
                const filename = `photo_${Date.now()}.${file.name.split('.').pop() || 'jpg'}`;
                const path = `users/${userId}/assets/captured_media/${filename}`;
                downloadUrl = await StorageService.uploadFile(file, path);
                uploadedPath = path;
                if (isPaired) {
                    taskId = await remoteRelayService.dispatchTask({
                        type: capturedImageBlob.type === 'document' ? 'document_scan' : 'media_capture',
                        payload: { imageUrl: downloadUrl }
                    });
                    dispatchAccepted = true;
                }
            } else if (capturedVideoBlob) {
                const filename = `video_${Date.now()}.${capturedVideoBlob.name.split('.').pop() || 'mp4'}`;
                const path = `users/${userId}/assets/captured_media/${filename}`;
                downloadUrl = await StorageService.uploadFile(capturedVideoBlob, path);
                uploadedPath = path;
                if (isPaired) {
                    taskId = await remoteRelayService.dispatchTask({ type: 'media_capture', payload: { videoUrl: downloadUrl } });
                    dispatchAccepted = true;
                }
            } else {
                return;
            }

            if (isPaired && taskId) {
                // ISSUE-983: don't clear the capture until the desktop confirms a
                // note actually exists — queue acceptance alone is not success.
                const outcome = await waitForDispatchConfirmation(taskId);
                if (outcome.status === 'failed') {
                    throw new Error(outcome.error?.message || 'Failed to save to Notes');
                }
            } else {
                useStore.getState().addNote({
                    title: `Mobile capture — ${new Date().toLocaleString()}`,
                    content: reviewKind ? `Captured ${reviewKind} from mobile web.` : 'Captured from mobile web.',
                    attachments: downloadUrl ? [downloadUrl] : [],
                    tags: ['mobile-capture'],
                });
                toast.success('Capture saved directly to Notes.');
            }

            clearCapture();
            triggerHaptic([50, 50, 50]);
        } catch (error) {
            // If queue creation failed, no durable task refers to this upload.
            // Preserve the local preview for retry, but remove the orphaned blob.
            if (uploadedPath && !dispatchAccepted) {
                await StorageService.deleteFile(uploadedPath);
            }
            logger.error('[QuickCapture] Failed to dispatch media:', error);
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
                        whileTap={(isPaired || isRecording) ? { scale: 0.9 } : undefined}
                        onClick={handleMicTap}
                        disabled={!isRecording && isDispatching}
                        aria-pressed={isRecording}
                        aria-label={isRecording ? 'Stop recording' : 'Start recording a voice memo'}
                        className={cn(
                            "relative z-10 w-36 h-36 rounded-full flex flex-col items-center justify-center gap-2 transition-colors shadow-[0_0_40px_rgba(46,46,254,0.15)] border-4",
                            isRecording
                                ? "bg-[#2E2EFE] border-[#2E2EFE] text-[#F0F0F0]"
                                : "bg-[#030303] border-white/10 text-[#F0F0F0] hover:border-[#2E2EFE]/50",
                            !isPaired && !isRecording && "border-blue-500/30"
                        )}
                    >
                        <Mic className={cn("w-10 h-10", isRecording && "animate-pulse")} />
                        <span className="text-[10px] font-bold uppercase tracking-widest" role="status">
                            {isRecording ? 'Listening — tap to stop' : 'Speak'}
                        </span>
                    </motion.button>
                </div>

                {/* Secondary Actions Grid */}
                <div className="grid grid-cols-4 gap-4 w-full max-w-sm">
                    <button
                        onClick={() => docInputRef.current?.click()}
                        disabled={isDispatching || isRecording || isFinalizingRecording}
                        className="flex flex-col items-center justify-center gap-2 p-3 min-h-[64px] min-w-[44px] rounded-2xl border border-white/10 bg-[#1c1c1e] text-[#8e8e93] hover:text-[#F0F0F0] hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <FileText className="w-6 h-6" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Doc</span>
                    </button>
                    <input type="file" accept="image/*" capture="environment" className="hidden" ref={docInputRef} onChange={(e) => handleImageCapture(e, 'document')} />

                    <button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isDispatching || isRecording || isFinalizingRecording}
                        className="flex flex-col items-center justify-center gap-2 p-3 min-h-[64px] min-w-[44px] rounded-2xl border border-white/10 bg-[#1c1c1e] text-[#8e8e93] hover:text-[#F0F0F0] hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <ImageIcon className="w-6 h-6" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Photo</span>
                    </button>
                    <input type="file" accept="image/*" capture="environment" className="hidden" ref={photoInputRef} onChange={(e) => handleImageCapture(e, 'photo')} />

                    <button
                        onClick={() => videoInputRef.current?.click()}
                        disabled={isDispatching || isRecording || isFinalizingRecording}
                        className="flex flex-col items-center justify-center gap-2 p-3 min-h-[64px] min-w-[44px] rounded-2xl border border-white/10 bg-[#1c1c1e] text-[#8e8e93] hover:text-[#F0F0F0] hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <Video className="w-6 h-6" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Video</span>
                    </button>
                    <input type="file" accept="video/*" capture="environment" className="hidden" ref={videoInputRef} onChange={handleVideoCapture} />

                    <button
                        onClick={handlePinDrop}
                        disabled={isDispatching || isRecording || isFinalizingRecording || !hasGeolocation}
                        className="flex flex-col items-center justify-center gap-2 p-3 min-h-[64px] min-w-[44px] rounded-2xl border border-white/10 bg-[#1c1c1e] text-[#8e8e93] hover:text-[#F0F0F0] hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
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
                            disabled={isDispatching || isRecording || isFinalizingRecording}
                            className="w-full bg-[#1c1c1e] border border-white/10 rounded-[20px] py-4 pl-12 pr-14 text-sm text-[#F0F0F0] placeholder:text-[#8e8e93] focus:outline-none focus:border-[#2E2EFE]/50 transition-colors"
                        />
                        <button
                            type="submit"
                            aria-label="Save live moment"
                            disabled={!momentText.trim() || isDispatching}
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
                                    onClick={downloadReviewCopy}
                                    disabled={isDispatching}
                                    className="h-12 w-12 shrink-0 rounded-2xl border border-white/10 bg-white/5 text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50"
                                    aria-label="Download local copy"
                                    title="Download local copy"
                                >
                                    <Download className="mx-auto h-4 w-4" />
                                </button>
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
