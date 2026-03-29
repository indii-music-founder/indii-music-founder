import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { FileUp, FileAudio, FileImage, FileText, AlertTriangle } from 'lucide-react';
import { logger } from '@/utils/logger';

async function validateAudioFormat(file: File): Promise<{ valid: boolean; error?: string }> {
    if (file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const buffer = e.target?.result as ArrayBuffer;
                if (!buffer) return resolve({ valid: false, error: 'Could not read file' });
                const view = new DataView(buffer);

                try {
                    // Check RIFF and WAVE
                    const rift = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
                    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));

                    if (rift !== 'RIFF' || wave !== 'WAVE') {
                        return resolve({ valid: true }); // Might be another type or non-PCM
                    }

                    const sampleRate = view.getUint32(24, true);
                    const bitsPerSample = view.getUint16(34, true);

                    if (sampleRate < 44100 || bitsPerSample < 16) {
                        return resolve({
                            valid: false,
                            error: `${file.name}: ${sampleRate}Hz ${bitsPerSample}-bit is below IndiiOS minimums (44.1kHz 16-bit).`
                        });
                    }
                } catch (err: unknown) {
                    logger.error('Error parsing WAV header:', err);
                }
                resolve({ valid: true });
            };
            reader.readAsArrayBuffer(file.slice(0, 44));
        });
    }
    return { valid: true };
}

export const GlobalDropZone: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isDragging, setIsDragging] = useState(false);
    const toast = useToast();

    // Track drag enter/leave on the window level to show the overlay
    useEffect(() => {
        let dragCounter = 0;

        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            dragCounter++;
            if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
                // Ensure we only show overlay for files
                if (Array.from(e.dataTransfer.items).some(item => item.kind === 'file')) {
                    setIsDragging(true);
                }
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                setIsDragging(false);
            }
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault(); // crucial to allow drop
        };

        const handleDrop = async (e: DragEvent) => {
            e.preventDefault();
            dragCounter = 0;
            setIsDragging(false);

            if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;

            const files = Array.from(e.dataTransfer.files);
            const {
                addUploadedAudio,
                addUploadedImage,
                addKnowledgeDocument,
                currentProjectId,
                addUploadItems,
                updateUploadProgress,
                updateUploadStatus
            } = useStore.getState();

            let imagesVideoCount = 0;
            let audioCount = 0;
            let docCount = 0;

            for (const file of files) {
                const isVideo = file.type.startsWith('video/');
                const isAudio = file.type.startsWith('audio/');
                const isImage = file.type.startsWith('image/');

                // Documents: PDF, TXT, Word, etc.
                const isDocument =
                    file.type === 'application/pdf' ||
                    file.type.startsWith('text/') ||
                    file.name.endsWith('.pdf') ||
                    file.name.endsWith('.txt') ||
                    file.name.endsWith('.md') ||
                    file.name.endsWith('.docx');

                if (isAudio || isImage || isVideo || isDocument) {
                    // Item 20: Audio Format Validation
                    if (isAudio) {
                        const validation = await validateAudioFormat(file);
                        if (!validation.valid) {
                            toast.warning(validation.error || "Low quality audio detected", 8000);
                            // We still let them upload in the Alpha, just warn them.
                        }
                    }

                    const queueId = crypto.randomUUID();
                    const itemType = (isDocument ? 'document' : (isAudio ? 'music' : (isVideo ? 'video' : 'image'))) as 'document' | 'music' | 'video' | 'image';

                    addUploadItems([{
                        id: queueId,
                        fileName: file.name,
                        fileSize: file.size,
                        progress: 0,
                        status: 'pending',
                        type: itemType
                    }]);

                    // Simulate upload delay and progress
                    setTimeout(() => {
                        updateUploadStatus(queueId, 'uploading');
                        let currentProgress = 0;
                        const interval = setInterval(() => {
                            currentProgress += Math.floor(Math.random() * 20) + 10;
                            if (currentProgress >= 100) {
                                currentProgress = 100;
                                clearInterval(interval);
                                updateUploadProgress(queueId, 100);

                                // Actually read the file when "upload" finishes
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    const result = e.target?.result as string;
                                    if (!result) {
                                        updateUploadStatus(queueId, 'error', 'Failed to read file');
                                        return;
                                    }

                                    if (isAudio || isImage || isVideo) {
                                        const newItem = {
                                            id: crypto.randomUUID(),
                                            type: (isAudio ? 'music' : isVideo ? 'video' : 'image') as 'music' | 'video' | 'image',
                                            url: result,
                                            prompt: file.name,
                                            timestamp: Date.now(),
                                            projectId: currentProjectId,
                                            origin: 'uploaded' as const
                                        };

                                        if (isAudio) {
                                            addUploadedAudio(newItem);
                                            audioCount++;
                                        } else {
                                            addUploadedImage(newItem);
                                            imagesVideoCount++;
                                        }
                                    } else if (isDocument) {
                                        addKnowledgeDocument({
                                            id: crypto.randomUUID(),
                                            name: file.name,
                                            content: result,
                                            type: file.type || 'document',
                                            indexingStatus: 'pending',
                                            createdAt: Date.now()
                                        });
                                        docCount++;
                                    }

                                    updateUploadStatus(queueId, 'success');
                                };

                                if (isDocument && file.type.startsWith('text/')) {
                                    reader.readAsText(file);
                                } else {
                                    reader.readAsDataURL(file);
                                }
                            } else {
                                updateUploadProgress(queueId, currentProgress);
                            }
                        }, 200 + Math.random() * 300); // Random chunk delay
                    }, Math.random() * 1000); // Random start delay
                }
            }

            // The toast behavior is less predictable now with simulated async processing,
            // we could remove it or leave it. We'll show a quick generic toast.
            setTimeout(() => {
                if (files.length > 0) {
                    toast.success(`Queued ${files.length} file(s) for upload...`);
                }
            }, 500);
        };

        window.addEventListener('dragenter', handleDragEnter);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('drop', handleDrop);
        };
    }, [toast]);

    return (
        <div className="relative w-full h-full">
            {children}
            {isDragging && (
                <div className="absolute inset-0 z-[99999] bg-black/60 backdrop-blur-sm border-4 border-dashed border-purple-500 rounded-lg flex flex-col items-center justify-center animate-in fade-in duration-200 m-4">
                    <div className="bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-md border border-gray-800">
                        <div className="flex gap-4 mb-6">
                            <div className="p-4 bg-blue-500/20 rounded-full text-blue-400">
                                <FileImage size={32} />
                            </div>
                            <div className="p-4 bg-orange-500/20 rounded-full text-orange-400">
                                <FileAudio size={32} />
                            </div>
                            <div className="p-4 bg-green-500/20 rounded-full text-green-400">
                                <FileText size={32} />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Drop files here</h2>
                        <p className="text-gray-400">
                            Upload images & video to the Creative Studio, tracks to Audio Distribution, and legal/text documents to your Knowledge Base.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
