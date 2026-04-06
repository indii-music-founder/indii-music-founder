import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { StorageService } from '@/services/StorageService';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';
import { CaptureButtons } from './components/CaptureButtons';
import { CapturePreview } from './components/CapturePreview';

/**
 * GhostCapture — Rapid asset capture with OCR analysis simulation.
 *
 * Architecture:
 * - CaptureButtons  → Pre-capture action cards (Snap / Upload)
 * - CapturePreview  → Post-capture view with scanning overlay
 *   - ScanOverlay   → Blueprint-style HUD animation
 *
 * Flow: Upload image → Scanning animation → "INGEST COMPLETE" → Transmit to Studio
 */
export default function GhostCapture() {
    const { currentProjectId, userProfile, createFileNode, setModule } = useStore(
        useShallow(state => ({
            currentProjectId: state.currentProjectId,
            userProfile: state.userProfile,
            createFileNode: state.createFileNode,
            setModule: state.setModule,
        }))
    );
    const toast = useToast();
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanComplete, setScanComplete] = useState(false);
    const [capturedFile, setCapturedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCapturedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
                startMockIngest();
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const startMockIngest = () => {
        setIsScanning(true);
        setScanComplete(false);
        setTimeout(() => {
            setIsScanning(false);
            setScanComplete(true);
        }, 2000);
    };

    const resetCapture = () => {
        setImagePreview(null);
        setCapturedFile(null);
        setIsScanning(false);
        setScanComplete(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const transmitToStudio = async () => {
        if (!capturedFile || !currentProjectId || !userProfile) {
            toast.error("Please log in and select a project first.");
            setModule('dashboard');
            return;
        }

        const toastId = toast.loading("Transmitting to studio vault...");

        try {
            const timestamp = Date.now();
            const sanitizedName = capturedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const storagePath = `projects/${currentProjectId}/${userProfile.id}/capture_${timestamp}_${sanitizedName}`;

            const downloadUrl = await StorageService.uploadFile(capturedFile, storagePath);

            await createFileNode(
                capturedFile.name,
                null,
                currentProjectId,
                userProfile.id,
                'image',
                {
                    url: downloadUrl,
                    storagePath,
                    size: capturedFile.size,
                    mimeType: capturedFile.type
                }
            );

            toast.success("Capture transmitted successfully!");
            setModule('files');
        } catch (err: unknown) {
            logger.error("Capture upload failed:", err);
            toast.error("Failed to transmit capture.");
            resetCapture();
        } finally {
            toast.dismiss(toastId);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0f141e] text-white overflow-hidden flex flex-col supports-[height:100dvh]:h-[100dvh]">
            {/* Header */}
            <header className="px-6 py-4 flex justify-between items-center z-10">
                <div className="flex flex-col">
                    <span className="text-xs text-teal-500 font-mono tracking-widest uppercase">Quick Asset Setup</span>
                    <h1 className="text-xl font-bold tracking-tight">Rapid Capture</h1>
                </div>
                <button onClick={() => setModule('dashboard')} className="p-2 bg-gray-800/50 rounded-full hover:bg-gray-700 transition">
                    <X size={20} />
                </button>
            </header>

            {/* Main View Area */}
            <main className="flex-1 relative flex flex-col justify-center items-center p-6">
                <AnimatePresence mode="wait">
                    {!imagePreview ? (
                        <>
                            <CaptureButtons onCapture={triggerFileInput} />
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageCapture}
                            />
                        </>
                    ) : (
                        <CapturePreview
                            imagePreview={imagePreview}
                            isScanning={isScanning}
                            scanComplete={scanComplete}
                            onTransmit={transmitToStudio}
                        />
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
