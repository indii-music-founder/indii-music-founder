import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';

interface PhotoSourcePanelProps {
    onCapture: (image: { mimeType: string; data: string }) => void;
    onClose?: () => void;
}

export const PhotoSourcePanel: React.FC<PhotoSourcePanelProps> = ({ onCapture, onClose }) => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [capturedImage, setCapturedImage] = useState<{ mimeType: string; data: string } | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setIsCameraActive(true);
            setPreviewUrl(null);
            setCapturedImage(null);
        } catch (err) {
            toast.error('Failed to access camera. Please check permissions.');
            console.error('Camera error:', err);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsCameraActive(false);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                if (dataUrl) {
                    setPreviewUrl(dataUrl);
                    setCapturedImage({
                        mimeType: 'image/jpeg',
                        data: dataUrl.split(',')[1] || ''
                    });
                }
                stopCamera();
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                if (!dataUrl) return;
                setPreviewUrl(dataUrl);
                setCapturedImage({
                    mimeType: file.type || 'image/jpeg',
                    data: dataUrl.split(',')[1] || ''
                });
                setIsCameraActive(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleConfirm = () => {
        if (capturedImage) {
            onCapture(capturedImage);
            if (onClose) onClose();
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Add Photo Ingredient</h3>
                {onClose && (
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                )}
            </div>

            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/5">
                <AnimatePresence mode="wait">
                    {isCameraActive ? (
                        <motion.video
                            key="camera"
                            ref={videoRef}
                            autoPlay
                            playsInline
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full object-cover mirror"
                        />
                    ) : previewUrl ? (
                        <motion.img
                            key="preview"
                            src={previewUrl}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <motion.div
                            key="placeholder"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full flex flex-col items-center justify-center gap-4 text-gray-600"
                        >
                            <Camera size={48} strokeWidth={1} />
                            <p className="text-xs uppercase font-bold">Select source below</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {isCameraActive && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                        <button
                            onClick={capturePhoto}
                            className="w-14 h-14 rounded-full bg-white border-4 border-white/20 shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                        >
                            <div className="w-10 h-10 rounded-full border-2 border-black/10" />
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={isCameraActive ? stopCamera : startCamera}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                        isCameraActive 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                        : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                    }`}
                >
                    {isCameraActive ? <X size={16} /> : <Camera size={16} />}
                    {isCameraActive ? 'Cancel' : 'Take Photo'}
                </button>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 font-bold text-xs uppercase tracking-widest"
                >
                    <Upload size={16} />
                    Upload Photo
                </button>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
            />

            <canvas ref={canvasRef} className="hidden" />

            <AnimatePresence>
                {capturedImage && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="flex gap-2"
                    >
                        <button
                            onClick={handleConfirm}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-dept-creative text-white font-bold text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(var(--color-dept-creative-rgb),0.3)]"
                        >
                            <Check size={16} />
                            Use Photo
                        </button>
                        <button
                            onClick={() => { setCapturedImage(null); setPreviewUrl(null); }}
                            className="w-12 flex items-center justify-center rounded-xl bg-white/5 text-gray-400 border border-white/10 hover:text-white transition-colors"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
