import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { FileUp, FileAudio, FileImage, FileText } from 'lucide-react';

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
                currentProjectId
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
                    const reader = new FileReader();

                    reader.onload = (e) => {
                        const result = e.target?.result as string;
                        if (!result) return;

                        if (isAudio || isImage || isVideo) {
                            const newItem = {
                                id: crypto.randomUUID(),
                                type: isAudio ? 'music' : (isVideo ? 'video' : 'image') as any,
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
                                content: result, // for text files this might be base64 data url, we'd need to parse if string format needed
                                type: file.type || 'document',
                                indexingStatus: 'pending',
                                createdAt: Date.now()
                            });
                            docCount++;
                        }
                    };

                    if (isDocument && file.type.startsWith('text/')) {
                        reader.readAsText(file);
                    } else {
                        reader.readAsDataURL(file);
                    }
                }
            }

            // Wait a moment before showing toast so async reads can complete conceptually 
            // (a bit hacky but acceptable for simple UI feedback)
            setTimeout(() => {
                let msg = '';
                if (imagesVideoCount > 0) msg += `${imagesVideoCount} image(s)/video(s) `;
                if (audioCount > 0) msg += `${audioCount > 0 && msg ? ', ' : ''}${audioCount} track(s) `;
                if (docCount > 0) msg += `${docCount > 0 && msg ? ', ' : ''}${docCount} doc(s) `;

                if (msg) {
                    toast.success(`Successfully uploaded: ${msg}`);
                } else {
                    toast.error(`Unsupported file type(s) dropped.`);
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
