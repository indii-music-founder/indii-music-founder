import React, { useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, Check, Loader2, X } from 'lucide-react';

interface WebcamCaptureProps {
    onCapture: (blob: Blob) => void;
    onClose: () => void;
}

export default function WebcamCapture({ onCapture, onClose }: WebcamCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);

    const startCamera = useCallback(async () => {
        setIsInitializing(true);
        setError(null);
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: false
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError("Could not access camera. Please check permissions.");
        } finally {
            setIsInitializing(false);
        }
    }, []);

    React.useEffect(() => {
        startCamera();
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (context) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                const dataUrl = canvas.toDataURL('image/png');
                setCapturedImage(dataUrl);
            }
        }
    };

    const handleRetake = () => {
        setCapturedImage(null);
    };

    const handleConfirm = () => {
        if (canvasRef.current) {
            canvasRef.current.toBlob((blob) => {
                if (blob) {
                    onCapture(blob);
                }
            }, 'image/png');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 w-full max-w-lg flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Capture Reference</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                    {isInitializing && <Loader2 className="animate-spin text-purple-400" size={32} />}

                    {error && (
                        <div className="text-red-400 text-center px-4">
                            <p>{error}</p>
                            <button
                                onClick={startCamera}
                                className="mt-2 text-sm underline hover:text-red-300"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {!capturedImage && !error && (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className={`w-full h-full object-cover transform scale-x-[-1] ${isInitializing ? 'hidden' : ''}`}
                        />
                    )}

                    {capturedImage && (
                        <img
                            src={capturedImage}
                            alt="Captured"
                            className="w-full h-full object-cover"
                        />
                    )}

                    <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="flex justify-center gap-4">
                    {!capturedImage ? (
                        <button
                            onClick={handleCapture}
                            disabled={!!error || isInitializing}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-full font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Camera size={20} />
                            Capture
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleRetake}
                                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-full font-medium transition-colors"
                            >
                                <RefreshCw size={20} />
                                Retake
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full font-bold transition-colors"
                            >
                                <Check size={20} />
                                Use Photo
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
