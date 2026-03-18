import React, { useRef, useState, useCallback } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { User, X, Upload, AlertTriangle, Grid3x3, Eye, Palette, Pencil } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';

/** Maximum file size for character reference images: 10MB */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = '10MB';

/** Minimum resolution for character reference images: 720p (1280x720) */
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
const MIN_RESOLUTION_LABEL = '1280×720 (720p)';

/** Resolve the natural dimensions of an image from a data URL */
const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('Failed to load image for dimension check.'));
        img.src = dataUrl;
    });
};

/** Format bytes into a human-readable string */
const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

interface CharacterRefDimensions {
    [id: string]: { width: number; height: number };
}

export const CharacterLibrary: React.FC = () => {
    const toast = useToast();
    const { characterReferences, addCharacterReference, removeCharacterReference, updateCharacterReference, currentProjectId, addUploadedImage } = useStore(useShallow(state => ({
        characterReferences: state.characterReferences,
        addCharacterReference: state.addCharacterReference,
        removeCharacterReference: state.removeCharacterReference,
        updateCharacterReference: state.updateCharacterReference,
        currentProjectId: state.currentProjectId,
        addUploadedImage: state.addUploadedImage
    })));

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [dimensions, setDimensions] = useState<CharacterRefDimensions>({});
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [showAllGrid, setShowAllGrid] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const dragCounterRef = useRef(0); // Track nested drag events to prevent flicker
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    /**
     * Core file processing: validates size + resolution, persists on success.
     * Returns true if the file was accepted, false otherwise.
     */
    const processFile = useCallback(async (file: File, currentRefCount: number): Promise<boolean> => {
        // --- Guard: File type ---
        if (!ACCEPTED_TYPES.includes(file.type)) {
            toast.error(`Invalid file type: ${file.type}. Use PNG, JPEG, or WebP.`);
            return false;
        }

        // --- Guard: Max references ---
        if (currentRefCount >= 3) {
            toast.error("Maximum 3 character references allowed for Veo 3.1.");
            return false;
        }

        // --- Validation 1: File Size (10MB) ---
        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast.error(`File too large (${formatFileSize(file.size)}). Maximum size is ${MAX_FILE_SIZE_LABEL}.`);
            return false;
        }

        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = (e) => {
                const result = e.target?.result as string;
                if (result) resolve(result);
                else reject(new Error('FileReader returned empty result.'));
            };
            reader.onerror = () => reject(new Error('Failed to read file.'));
            reader.readAsDataURL(file);
        });

        // --- Validation 2: Image Resolution (720p minimum) ---
        const dims = await getImageDimensions(dataUrl);

        if (dims.width < MIN_WIDTH || dims.height < MIN_HEIGHT) {
            toast.error(`Image resolution too low (${dims.width}×${dims.height}). Minimum is ${MIN_RESOLUTION_LABEL}.`);
            return false;
        }

        // --- All validations passed — persist the image ---
        const newItem = {
            id: crypto.randomUUID(),
            url: dataUrl,
            prompt: "Uploaded Character Reference",
            type: 'image' as const,
            timestamp: Date.now(),
            category: 'headshot' as const,
            projectId: currentProjectId || 'default-project'
        };

        addUploadedImage(newItem);
        addCharacterReference({ image: newItem, referenceType: 'subject', name: `Character ${currentRefCount + 1}` });
        setDimensions(prev => ({ ...prev, [newItem.id]: dims }));
        toast.success(`Character reference added (${dims.width}×${dims.height}).`);
        return true;
    }, [currentProjectId, addUploadedImage, addCharacterReference, toast]);

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset input immediately so the same file can be re-selected
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        setIsValidating(true);
        try {
            await processFile(file, characterReferences.length);
        } catch (err) {
            logger.error('[CharacterLibrary] Validation error:', err);
            toast.error('Failed to validate image. Please try a different file.');
        } finally {
            setIsValidating(false);
        }
    }, [characterReferences.length, processFile, toast]);

    /** Drag-and-Drop Handlers */
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current += 1;
        if (dragCounterRef.current === 1) {
            setIsDragging(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragging(false);

        const droppedFiles = Array.from(e.dataTransfer.files);

        if (droppedFiles.length === 0) {
            toast.error('No files detected in drop.');
            return;
        }

        // Calculate available slots
        const availableSlots = 3 - characterReferences.length;
        if (availableSlots <= 0) {
            toast.error("Maximum 3 character references already uploaded.");
            return;
        }

        // Limit files to available slots
        const filesToProcess = droppedFiles.slice(0, availableSlots);
        if (droppedFiles.length > availableSlots) {
            toast.error(`Only ${availableSlots} slot(s) available. Processing first ${filesToProcess.length} file(s).`);
        }

        setIsValidating(true);
        let accepted = 0;
        let currentCount = characterReferences.length;

        try {
            for (const file of filesToProcess) {
                const ok = await processFile(file, currentCount);
                if (ok) {
                    accepted++;
                    currentCount++;
                }
            }
            if (accepted === 0 && filesToProcess.length > 0) {
                toast.error('No valid images found. Check file type, size, and resolution.');
            }
        } catch (err) {
            logger.error('[CharacterLibrary] Drop validation error:', err);
            toast.error('Failed to process dropped files.');
        } finally {
            setIsValidating(false);
        }
    }, [characterReferences.length, processFile, toast]);

    const handleRemove = useCallback((id: string) => {
        removeCharacterReference(id);
        setDimensions(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, [removeCharacterReference]);

    return (
        <div
            className={`bg-white/5 rounded-xl border p-4 space-y-4 transition-all duration-200 relative ${isDragging
                ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                : 'border-white/10'
                }`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="character-library-container"
        >
            {/* Drop Zone Overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 rounded-xl bg-blue-500/10 border-2 border-dashed border-blue-400 flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <Upload size={32} className="text-blue-400 animate-bounce" />
                    <span className="text-sm font-bold text-blue-300 uppercase tracking-wider">
                        Drop Character Images Here
                    </span>
                    <span className="text-[10px] text-blue-400/60">
                        PNG, JPEG, or WebP • Max {MAX_FILE_SIZE_LABEL} • Min {MIN_RESOLUTION_LABEL}
                    </span>
                </div>
            )}
            <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-400 tracking-wider flex items-center gap-2">
                    <User size={14} className="text-blue-400" /> VEO 3.1 CHARACTER PROFILES
                </label>
                <div className="text-[10px] font-medium text-gray-600">
                    {characterReferences.length}/3 IMAGES
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                {characterReferences.map((ref, index) => (
                    <div key={ref.image.id} className="relative group bg-black/40 aspect-square rounded-lg overflow-hidden border border-white/10 flex flex-col cursor-pointer" onClick={() => setPreviewIndex(index)}>
                        <img
                            src={ref.image.url}
                            alt={`Character Ref ${index + 1}`}
                            className="w-full h-full object-cover"
                        />
                        {/* Hover overlay with type + dimensions + preview hint */}
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye size={16} className="text-white/80 mb-0.5" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">{ref.referenceType}</span>
                            {dimensions[ref.image.id] && (
                                <span className="text-[9px] font-mono text-blue-300/80">
                                    {dimensions[ref.image.id]!.width}×{dimensions[ref.image.id]!.height}
                                </span>
                            )}
                        </div>
                        {/* Character label (editable) + Reference Type Toggle */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 flex items-center justify-between">
                            {editingNameId === ref.image.id ? (
                                <input
                                    ref={nameInputRef}
                                    type="text"
                                    defaultValue={ref.name || `Character ${index + 1}`}
                                    className="text-[9px] font-bold text-white bg-black/60 border border-blue-500/40 rounded px-1 py-0.5 w-16 outline-none focus:border-blue-400"
                                    data-testid={`character-name-input-${index}`}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={(e) => {
                                        const newName = e.target.value.trim();
                                        if (newName) {
                                            updateCharacterReference(ref.image.id, { name: newName });
                                        }
                                        setEditingNameId(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            (e.target as HTMLInputElement).blur();
                                        } else if (e.key === 'Escape') {
                                            setEditingNameId(null);
                                        }
                                    }}
                                />
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditingNameId(ref.image.id); }}
                                    title="Click to rename"
                                    className="flex items-center gap-0.5 text-[9px] font-bold text-white/70 hover:text-blue-300 transition-colors"
                                    data-testid={`character-name-btn-${index}`}
                                >
                                    {ref.name || `Character ${index + 1}`}
                                    <Pencil size={7} className="opacity-0 group-hover:opacity-60" />
                                </button>
                            )}
                            {/* Face / Style Toggle */}
                            <div
                                className="flex bg-black/60 rounded-md p-0.5 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={() => updateCharacterReference(ref.image.id, { referenceType: 'subject' })}
                                    data-testid={`ref-type-face-${index}`}
                                    title="Face Reference (Character Identity)"
                                    aria-label="Set as Face reference"
                                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${ref.referenceType === 'subject'
                                        ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    <User size={8} className="inline mr-0.5" />Face
                                </button>
                                <button
                                    onClick={() => updateCharacterReference(ref.image.id, { referenceType: 'style' })}
                                    data-testid={`ref-type-style-${index}`}
                                    title="Style Reference (Art Style/Aesthetic)"
                                    aria-label="Set as Style reference"
                                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${ref.referenceType === 'style'
                                        ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    <Palette size={8} className="inline mr-0.5" />Style
                                </button>
                            </div>
                        </div>
                        {/* Remove button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); handleRemove(ref.image.id); }}
                            className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white/60 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            aria-label={`Remove character reference ${index + 1}`}
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}

                {characterReferences.length < 3 && (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isValidating}
                        className="group relative bg-black/40 aspect-square rounded-lg border border-dashed border-white/20 hover:border-blue-500/50 hover:bg-blue-500/10 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isValidating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter text-center px-1">
                                    Validating…
                                </span>
                            </>
                        ) : (
                            <>
                                <Upload size={16} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
                                <span className="text-[10px] font-bold text-gray-500 group-hover:text-blue-400 uppercase tracking-tighter text-center px-1">
                                    Add Person
                                </span>
                            </>
                        )}
                    </button>
                )}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                data-testid="character-library-file-input"
            />

            {/* Validation requirements notice */}
            {characterReferences.length === 0 && (
                <div className="flex items-start gap-2 text-[10px] text-amber-500/70 leading-snug">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>PNG, JPEG, or WebP • Min {MIN_RESOLUTION_LABEL} • Max {MAX_FILE_SIZE_LABEL}</span>
                </div>
            )}

            {characterReferences.length > 0 && (
                <div className="text-[10px] text-gray-500 italic leading-snug">
                    These images will enforce strict character consistency in your next Veo 3.1 generation. Combine different angles for better structural accuracy.
                </div>
            )}

            {/* View All Characters Button */}
            {characterReferences.length >= 2 && (
                <button
                    onClick={() => setShowAllGrid(true)}
                    data-testid="view-all-characters-btn"
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/20 text-blue-400 hover:bg-blue-500/10 transition-all text-[10px] font-bold uppercase tracking-wider"
                >
                    <Grid3x3 size={12} />
                    View All Characters Together
                </button>
            )}

            {/* Character Preview Lightbox (Single) */}
            {previewIndex !== null && characterReferences[previewIndex] && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-8"
                    onClick={() => setPreviewIndex(null)}
                    data-testid="character-preview-modal"
                    role="dialog"
                    aria-label={`Character ${previewIndex + 1} Preview`}
                >
                    <div
                        className="relative max-w-2xl max-h-[80vh] flex flex-col items-center gap-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setPreviewIndex(null)}
                            className="absolute -top-3 -right-3 z-10 p-2 bg-white/10 rounded-full text-white hover:bg-red-500/30 hover:text-red-300 transition-all"
                            aria-label="Close preview"
                        >
                            <X size={16} />
                        </button>

                        {/* Large Image */}
                        <img
                            src={characterReferences[previewIndex].image.url}
                            alt={`Character ${previewIndex + 1} Preview`}
                            className="max-h-[65vh] w-auto rounded-xl border border-white/10 shadow-2xl shadow-black/80 object-contain"
                        />

                        {/* Info Bar */}
                        <div className="flex items-center gap-4 text-center">
                            <div className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30">
                                <span className="text-xs font-bold text-blue-300">{characterReferences[previewIndex].name || `Character ${previewIndex + 1}`}</span>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">{characterReferences[previewIndex].referenceType}</span>
                            </div>
                            {dimensions[characterReferences[previewIndex].image.id] && (
                                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                                    <span className="text-[10px] font-mono text-gray-400">
                                        {dimensions[characterReferences[previewIndex].image.id]!.width}×{dimensions[characterReferences[previewIndex].image.id]!.height}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Navigation (if multiple) */}
                        {characterReferences.length > 1 && (
                            <div className="flex items-center gap-2">
                                {characterReferences.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setPreviewIndex(i)}
                                        className={`w-2 h-2 rounded-full transition-all ${i === previewIndex ? 'bg-blue-400 scale-125' : 'bg-white/20 hover:bg-white/40'}`}
                                        aria-label={`View Character ${i + 1}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* All Characters Grid Modal */}
            {showAllGrid && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-8"
                    onClick={() => setShowAllGrid(false)}
                    data-testid="all-characters-modal"
                    role="dialog"
                    aria-label="All Characters Preview"
                >
                    <div
                        className="relative max-w-4xl w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close */}
                        <button
                            onClick={() => setShowAllGrid(false)}
                            className="absolute -top-3 -right-3 z-10 p-2 bg-white/10 rounded-full text-white hover:bg-red-500/30 hover:text-red-300 transition-all"
                            aria-label="Close all characters view"
                        >
                            <X size={16} />
                        </button>

                        {/* Title */}
                        <h2 className="text-center text-sm font-bold text-gray-300 uppercase tracking-widest mb-4">
                            Character Reference Lineup
                        </h2>

                        {/* Grid */}
                        <div className={`grid gap-4 ${characterReferences.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            {characterReferences.map((ref, index) => (
                                <div key={ref.image.id} className="flex flex-col items-center gap-2">
                                    <div className="relative bg-black/40 rounded-xl overflow-hidden border border-white/10 shadow-xl">
                                        <img
                                            src={ref.image.url}
                                            alt={`Character ${index + 1}`}
                                            className="w-full h-auto max-h-[50vh] object-contain"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-blue-300">{ref.name || `Character ${index + 1}`}</span>
                                        <span className="text-[9px] font-bold text-gray-500 uppercase px-2 py-0.5 bg-white/5 rounded-full">{ref.referenceType}</span>
                                        {dimensions[ref.image.id] && (
                                            <span className="text-[9px] font-mono text-gray-500">
                                                {dimensions[ref.image.id]!.width}×{dimensions[ref.image.id]!.height}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
